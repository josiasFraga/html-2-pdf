import { Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import type {
  ErrorRequestHandler,
  Request,
  Response,
  NextFunction,
} from 'express';

function boundedInteger(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = env[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (
    !/^\d+$/.test(raw) ||
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  ) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }
  return value;
}

export function pdfConcurrency(env: NodeJS.ProcessEnv = process.env) {
  return boundedInteger(env, 'PDF_MAX_CONCURRENT_REQUESTS', 2, 1, 8);
}

export function configureHttp(
  app: NestExpressApplication,
  env: NodeJS.ProcessEnv = process.env,
) {
  const maxBytes = boundedInteger(
    env,
    'PDF_MAX_REQUEST_BYTES',
    20 * 1024 * 1024,
    1024,
    100 * 1024 * 1024,
  );
  const concurrency = pdfConcurrency(env);
  const logger = new Logger('PdfHttp');
  let active = 0;

  app.use('/html-to-pdf', (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'POST') return next();
    if (active >= concurrency) {
      res.setHeader('Retry-After', '5');
      logger.warn('PDF request rejected: concurrent request limit reached.');
      res.status(503).json({
        statusCode: 503,
        message: 'Servico PDF ocupado. Tente novamente em alguns segundos.',
      });
      return;
    }

    active++;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      active--;
    };
    res.once('finish', release);
    res.once('close', release);
    next();
  });
  app.useBodyParser('json', { limit: maxBytes, inflate: false });
  const parserErrors: ErrorRequestHandler = (
    error: unknown,
    _req,
    res,
    next,
  ) => {
    if (
      error &&
      typeof error === 'object' &&
      'type' in error &&
      (error.type === 'encoding.unsupported' ||
        error.type === 'entity.parse.failed')
    ) {
      const status = error.type === 'encoding.unsupported' ? 415 : 400;
      logger.warn(`PDF request rejected: ${error.type}.`);
      res.status(status).json({
        statusCode: status,
        message:
          status === 415
            ? 'Envie JSON sem compressao.'
            : 'JSON invalido na requisicao PDF.',
      });
      return;
    }
    if (
      error &&
      typeof error === 'object' &&
      'type' in error &&
      error.type === 'entity.too.large'
    ) {
      logger.warn(`PDF request rejected: JSON exceeds ${maxBytes} bytes.`);
      res.status(413).json({
        statusCode: 413,
        message: `Requisicao PDF excede o limite de ${maxBytes} bytes. Reduza o lote ou ajuste PDF_MAX_REQUEST_BYTES no servico.`,
      });
      return;
    }
    next(error);
  };
  app.use(parserErrors);
  logger.log(
    `JSON limit: ${maxBytes} bytes; concurrent PDF requests: ${concurrency}.`,
  );
}

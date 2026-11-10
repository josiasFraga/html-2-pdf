import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as request from 'supertest';
import { AppModule } from './app.module';
import { HtmlToPdfService } from './html-to-pdf/html-to-pdf.service';
import { configureHttp } from './http-config';

describe('PDF HTTP limits', () => {
  let app: NestExpressApplication;
  const render = jest.fn();
  const limit = 256 * 1024;
  beforeEach(async () => {
    render.mockReset().mockResolvedValue(Buffer.from('%PDF-1.7\n'));
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(HtmlToPdfService)
      .useValue({ htmlToPdf: render })
      .compile();
    app = module.createNestApplication<NestExpressApplication>({
      bodyParser: false,
    });
    configureHttp(app, {
      PDF_MAX_REQUEST_BYTES: String(limit),
      PDF_MAX_CONCURRENT_REQUESTS: '1',
    });
    await app.init();
  });
  afterEach(async () => {
    await app.close();
  });

  it('accepts the reported 185191-byte payload and the exact configured boundary', async () => {
    for (const size of [185191, limit]) {
      const body = JSON.stringify({ html: 'a'.repeat(size - 11) });
      expect(Buffer.byteLength(body)).toBe(size);
      await request(app.getHttpServer())
        .post('/html-to-pdf')
        .set('Content-Type', 'application/json')
        .send(body)
        .expect(201)
        .expect('Content-Type', /application\/pdf/);
    }
    expect(render).toHaveBeenCalledTimes(2);
  });
  it('rejects one byte over the limit with a clear 413 before rendering, then releases the slot', async () => {
    const response = await request(app.getHttpServer())
      .post('/html-to-pdf')
      .send({ html: 'a'.repeat(limit - 10) })
      .expect(413);
    expect(response.body).toHaveProperty(
      'message',
      expect.stringContaining('PDF_MAX_REQUEST_BYTES'),
    );
    expect(render).not.toHaveBeenCalled();
    await request(app.getHttpServer())
      .post('/html-to-pdf')
      .send({ html: '<p>OK</p>' })
      .expect(201);
  });
  it('measures bytes rather than characters', async () => {
    await request(app.getHttpServer())
      .post('/html-to-pdf')
      .send({ html: 'á'.repeat(limit / 2) })
      .expect(413);
    expect(render).not.toHaveBeenCalled();
  });
  it('rejects compressed JSON instead of allowing decompression expansion', async () => {
    await request(app.getHttpServer())
      .post('/html-to-pdf')
      .set('Content-Encoding', 'gzip')
      .send({ html: '<p>test</p>' })
      .expect(415);
    expect(render).not.toHaveBeenCalled();
  });
  it('rejects malformed JSON without echoing its content', async () => {
    const response = await request(app.getHttpServer())
      .post('/html-to-pdf')
      .set('Content-Type', 'application/json')
      .send('{"html":"private')
      .expect(400);
    expect(JSON.stringify(response.body)).not.toContain('private');
    expect(render).not.toHaveBeenCalled();
  });
  it('rejects excess work without a queue and accepts requests after completion', async () => {
    let finish!: (buffer: Buffer) => void;
    let started!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    render.mockImplementationOnce(() => {
      started();
      return new Promise<Buffer>((resolve) => {
        finish = resolve;
      });
    });
    const first = request(app.getHttpServer())
      .post('/html-to-pdf')
      .send({ html: 'first' })
      .then((res) => res);
    await ready;
    try {
      await request(app.getHttpServer())
        .post('/html-to-pdf')
        .send({ html: 'second' })
        .expect(503)
        .expect('Retry-After', '5');
      expect(render).toHaveBeenCalledTimes(1);
    } finally {
      finish(Buffer.from('%PDF-1.7\n'));
    }
    expect((await first).status).toBe(201);
    await request(app.getHttpServer())
      .post('/html-to-pdf')
      .send({ html: 'third' })
      .expect(201);
  });
  it.each([
    { PDF_MAX_REQUEST_BYTES: '0' },
    { PDF_MAX_REQUEST_BYTES: 'unlimited' },
    { PDF_MAX_REQUEST_BYTES: String(101 * 1024 * 1024) },
    { PDF_MAX_CONCURRENT_REQUESTS: '9' },
  ])('refuses unsafe configuration %j', (env) => {
    expect(() => configureHttp(app, env)).toThrow('must be an integer');
  });
});

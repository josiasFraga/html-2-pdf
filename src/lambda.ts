import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { Handler } from 'aws-lambda';
import { configure as awsLambdaExpress } from '@vendia/serverless-express';
import { NestExpressApplication } from '@nestjs/platform-express';
import { configureHttp } from './http-config';

let cachedServer: Handler;

async function bootstrapServer(): Promise<Handler> {
  const nestApp = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true, bodyParser: false });
  configureHttp(nestApp);
  await nestApp.init();

  /* ⬇️ Express "puro" usado internamente pelo Nest */
  const expressApp = nestApp.getHttpAdapter().getInstance();

  return awsLambdaExpress({ app: expressApp });
}

export const handler: Handler = async (event, context, callback) => {
  cachedServer = cachedServer ?? (await bootstrapServer());
  return cachedServer(event, context, callback);
};

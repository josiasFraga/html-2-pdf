import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { Handler } from 'aws-lambda';
import { configure as awsLambdaExpress } from '@vendia/serverless-express';

let cachedServer: Handler;

async function bootstrapServer(): Promise<Handler> {
  const nestApp = await NestFactory.create(AppModule, { bufferLogs: true });
  await nestApp.init();

  /* ⬇️ Express "puro" usado internamente pelo Nest */
  const expressApp = nestApp.getHttpAdapter().getInstance();

  return awsLambdaExpress({ app: expressApp });
}

export const handler: Handler = async (event, context, callback) => {
  cachedServer = cachedServer ?? (await bootstrapServer());
  return cachedServer(event, context, callback);
};

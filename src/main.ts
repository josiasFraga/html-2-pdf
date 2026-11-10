import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { configureHttp } from './http-config';
import type { Server } from 'node:http';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  configureHttp(app);
  const server: Server = app.getHttpServer();
  server.requestTimeout = 60_000;
  server.headersTimeout = 30_000;
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

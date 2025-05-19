import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HtmlToPdfModule } from './html-to-pdf/html-to-pdf.module';

@Module({
  imports: [HtmlToPdfModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

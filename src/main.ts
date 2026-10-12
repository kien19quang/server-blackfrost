import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableShutdownHooks();
  const config = app.get(ConfigService);
  app.enableCors({ origin: config.get<string>('CORS_ORIGIN', '').split(',').filter(Boolean) });

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('Server BlackFrost').setVersion('0.1.0').build(),
  );
  // UI at /api-docs, JSON at /api-docs-json.
  SwaggerModule.setup('api-docs', app, document, { jsonDocumentUrl: 'api-docs-json' });

  await app.listen(config.get<number>('PORT', 3301));
}
void bootstrap();

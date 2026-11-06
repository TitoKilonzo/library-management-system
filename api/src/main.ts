import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Validate every request body against its DTO and strip undeclared fields.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  // Allow the frontend (a different origin) to call this API.
  app.enableCors();

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

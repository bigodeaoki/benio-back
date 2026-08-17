// Grimorium Industrial — API (deploy via Railway)
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ErrosFilter } from './shared/erros.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors();
  // 8mb comporta uploads de documentos de até 5MB (base64 infla ~33%)
  app.useBodyParser('json', { limit: '8mb' });
  app.useGlobalFilters(new ErrosFilter());
  const port = Number(process.env.PORT || 4000);
  // '::' aceita IPv4 e IPv6 — necessário para a rede privada do Railway (somente IPv6)
  await app.listen(port, '::');
  console.log(`[grimorium] API NestJS ouvindo em http://0.0.0.0:${port}/api`);
}
bootstrap();

import { Module } from '@nestjs/common';
import { IntegracaoController } from './integracao.controller';
import { IntegracaoService } from './integracao.service';

@Module({
  controllers: [IntegracaoController],
  providers: [IntegracaoService],
})
export class IntegracaoModule {}

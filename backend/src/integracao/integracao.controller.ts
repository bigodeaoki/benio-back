import { Controller, Get, Param, Query } from '@nestjs/common';
import { IntegracaoService } from './integracao.service';

@Controller('integracao')
export class IntegracaoController {
  constructor(private service: IntegracaoService) {}

  @Get('cnpj/:cnpj')
  consultarCnpj(@Param('cnpj') cnpj: string) {
    return this.service.consultarCnpj(cnpj);
  }

  @Get('ncm')
  buscarNcm(@Query('q') q: string) {
    return this.service.buscarNcm(q);
  }
}

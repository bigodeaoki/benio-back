import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { ProducaoService } from './producao.service';
import { EmpresaId, Papeis } from '../auth/decorators';

@Controller('producao')
export class ProducaoController {
  constructor(private service: ProducaoService) {}

  @Get('ordens')
  listarOrdens(@EmpresaId() empresaId: number) {
    return this.service.listarOrdens(empresaId);
  }

  @Get('mrp')
  mrp(@EmpresaId() empresaId: number) {
    return this.service.mrp(empresaId);
  }

  @Papeis('admin', 'gestor')
  @Post('ordens')
  criarOrdem(@EmpresaId() empresaId: number, @Body() body: any) {
    return this.service.criarOrdem(empresaId, body);
  }

  @Papeis('admin', 'gestor', 'operador')
  @Put('ordens/:id/status')
  atualizarStatus(
    @EmpresaId() empresaId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: string },
  ) {
    return this.service.atualizarStatus(empresaId, id, body?.status);
  }

  @Papeis('admin', 'gestor')
  @Delete('ordens/:id')
  remover(@EmpresaId() empresaId: number, @Param('id', ParseIntPipe) id: number) {
    return this.service.remover(empresaId, id);
  }
}

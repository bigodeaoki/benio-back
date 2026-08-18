import { Body, Controller, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { ProducaoService } from './producao.service';
import { EmpresaId, Papeis } from '../auth/decorators';
import { PERM } from '../auth/papeis';

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

  @Papeis(...PERM.producaoCriar)
  @Post('ordens')
  criarOrdem(@EmpresaId() empresaId: number, @Body() body: any) {
    return this.service.criarOrdem(empresaId, body);
  }

  @Papeis(...PERM.producaoStatus)
  @Put('ordens/:id/status')
  atualizarStatus(
    @EmpresaId() empresaId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: string },
  ) {
    return this.service.atualizarStatus(empresaId, id, body?.status);
  }

  // Ordem de produção nunca é apagada — encerrar significa marcar como finalizada
  @Papeis(...PERM.producaoCriar)
  @Put('ordens/:id/finalizar')
  finalizar(@EmpresaId() empresaId: number, @Param('id', ParseIntPipe) id: number) {
    return this.service.finalizar(empresaId, id);
  }
}

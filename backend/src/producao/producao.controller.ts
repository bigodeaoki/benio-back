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
    @Body() body: { status: string; quantidade_produzida?: number },
  ) {
    return this.service.atualizarStatus(empresaId, id, body?.status, body?.quantidade_produzida);
  }

  // Fórmula da ordem: cópia editável, não altera a fórmula do produto
  @Get('ordens/:id/formula')
  formula(@EmpresaId() empresaId: number, @Param('id', ParseIntPipe) id: number) {
    return this.service.formulaDaOrdem(empresaId, id);
  }

  @Papeis(...PERM.producaoStatus)
  @Put('ordens/:id/formula')
  salvarFormula(
    @EmpresaId() empresaId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { itens: any[] },
  ) {
    return this.service.salvarFormulaDaOrdem(empresaId, id, body?.itens);
  }

  // Ordem de produção nunca é apagada — encerrar significa marcar como finalizada
  @Papeis(...PERM.producaoCriar)
  @Put('ordens/:id/finalizar')
  finalizar(@EmpresaId() empresaId: number, @Param('id', ParseIntPipe) id: number) {
    return this.service.finalizar(empresaId, id);
  }
}

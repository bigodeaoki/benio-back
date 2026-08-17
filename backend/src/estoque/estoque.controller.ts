import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { EstoqueService } from './estoque.service';
import { EmpresaId, Papeis } from '../auth/decorators';
import { PERM } from '../auth/papeis';

@Controller('estoque')
export class EstoqueController {
  constructor(private service: EstoqueService) {}

  @Get()
  posicao(@EmpresaId() empresaId: number) {
    return this.service.posicao(empresaId);
  }

  @Get('movimentos')
  movimentos(@EmpresaId() empresaId: number, @Query('materia_prima_id') mpId?: string) {
    return this.service.movimentos(empresaId, mpId ? Number(mpId) : undefined);
  }

  @Papeis(...PERM.estoqueMovimentar)
  @Post('movimentos')
  movimentar(@EmpresaId() empresaId: number, @Body() body: any) {
    return this.service.movimentar(empresaId, body);
  }
}

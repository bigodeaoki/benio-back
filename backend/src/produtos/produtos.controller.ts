import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { ProdutosService } from './produtos.service';
import { EmpresaId, Papeis } from '../auth/decorators';
import { PERM } from '../auth/papeis';

@Controller('produtos')
export class ProdutosController {
  constructor(private service: ProdutosService) {}

  @Get()
  listar(@EmpresaId() empresaId: number) {
    return this.service.listar(empresaId);
  }

  @Get(':id')
  obter(@EmpresaId() empresaId: number, @Param('id', ParseIntPipe) id: number) {
    return this.service.obter(empresaId, id);
  }

  @Papeis(...PERM.produtos)
  @Post()
  criar(@EmpresaId() empresaId: number, @Body() body: any) {
    return this.service.criar(empresaId, body);
  }

  @Papeis(...PERM.produtos)
  @Put(':id')
  atualizar(@EmpresaId() empresaId: number, @Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.service.atualizar(empresaId, id, body);
  }

  @Papeis(...PERM.produtos)
  @Delete(':id')
  remover(@EmpresaId() empresaId: number, @Param('id', ParseIntPipe) id: number) {
    return this.service.remover(empresaId, id);
  }
}

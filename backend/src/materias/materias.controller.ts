import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { MateriasService } from './materias.service';
import { EmpresaId, Papeis } from '../auth/decorators';
import { PERM } from '../auth/papeis';

@Controller('materias')
export class MateriasController {
  constructor(private service: MateriasService) {}

  @Get()
  listar(@EmpresaId() empresaId: number) {
    return this.service.listar(empresaId);
  }

  // --- Compras (lotes). Declaradas antes das rotas ':id' para que
  // 'compras' não seja capturado como se fosse um id de matéria-prima ---

  @Papeis(...PERM.materiasCompras)
  @Put('compras/:compraId')
  atualizarCompra(
    @EmpresaId() empresaId: number,
    @Param('compraId', ParseIntPipe) compraId: number,
    @Body() body: any,
  ) {
    return this.service.atualizarCompra(empresaId, compraId, body);
  }

  @Papeis(...PERM.materiasCompras)
  @Delete('compras/:compraId')
  removerCompra(@EmpresaId() empresaId: number, @Param('compraId', ParseIntPipe) compraId: number) {
    return this.service.removerCompra(empresaId, compraId);
  }

  @Get(':id/compras')
  listarCompras(@EmpresaId() empresaId: number, @Param('id', ParseIntPipe) id: number) {
    return this.service.listarCompras(empresaId, id);
  }

  @Papeis(...PERM.materiasCompras)
  @Post(':id/compras')
  criarCompra(@EmpresaId() empresaId: number, @Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.service.criarCompra(empresaId, id, body);
  }

  // --- Cadastro da matéria-prima ---

  @Papeis(...PERM.materias)
  @Post()
  criar(@EmpresaId() empresaId: number, @Body() body: any) {
    return this.service.criar(empresaId, body);
  }

  @Papeis(...PERM.materias)
  @Put(':id')
  atualizar(@EmpresaId() empresaId: number, @Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.service.atualizar(empresaId, id, body);
  }

  @Papeis(...PERM.materias)
  @Delete(':id')
  remover(@EmpresaId() empresaId: number, @Param('id', ParseIntPipe) id: number) {
    return this.service.remover(empresaId, id);
  }
}

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

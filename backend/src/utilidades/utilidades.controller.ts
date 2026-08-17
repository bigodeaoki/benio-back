import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { UtilidadesService } from './utilidades.service';
import { EmpresaId, Papeis } from '../auth/decorators';
import { PERM } from '../auth/papeis';

@Controller('utilidades')
export class UtilidadesController {
  constructor(private service: UtilidadesService) {}

  @Get()
  listar(@EmpresaId() empresaId: number) {
    return this.service.listar(empresaId);
  }

  @Papeis(...PERM.utilidades)
  @Post()
  criar(@EmpresaId() empresaId: number, @Body() body: any) {
    return this.service.criar(empresaId, body);
  }

  @Papeis(...PERM.utilidades)
  @Put(':id')
  atualizar(@EmpresaId() empresaId: number, @Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.service.atualizar(empresaId, id, body);
  }

  @Papeis(...PERM.utilidades)
  @Delete(':id')
  remover(@EmpresaId() empresaId: number, @Param('id', ParseIntPipe) id: number) {
    return this.service.remover(empresaId, id);
  }
}

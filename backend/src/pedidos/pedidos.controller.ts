import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { PedidosService } from './pedidos.service';
import { EmpresaId, Papeis } from '../auth/decorators';

@Controller('pedidos')
export class PedidosController {
  constructor(private service: PedidosService) {}

  @Get()
  listar(@EmpresaId() empresaId: number) {
    return this.service.listar(empresaId);
  }

  @Papeis('admin', 'gestor', 'operador')
  @Post()
  criar(@EmpresaId() empresaId: number, @Body() body: any) {
    return this.service.criar(empresaId, body);
  }

  @Papeis('admin', 'gestor', 'operador')
  @Put(':id')
  atualizar(@EmpresaId() empresaId: number, @Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.service.atualizar(empresaId, id, body);
  }

  @Papeis('admin', 'gestor')
  @Delete(':id')
  remover(@EmpresaId() empresaId: number, @Param('id', ParseIntPipe) id: number) {
    return this.service.remover(empresaId, id);
  }

  @Papeis('admin', 'gestor')
  @Post(':id/gerar-ordens')
  gerarOrdens(@EmpresaId() empresaId: number, @Param('id', ParseIntPipe) id: number) {
    return this.service.gerarOrdens(empresaId, id);
  }
}

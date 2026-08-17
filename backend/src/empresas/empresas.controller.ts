import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Req } from '@nestjs/common';
import { EmpresasService } from './empresas.service';
import { Papeis } from '../auth/decorators';

@Controller('empresas')
export class EmpresasController {
  constructor(private service: EmpresasService) {}

  @Get()
  listar(@Req() req: any) {
    return this.service.listar(req.empresaIds);
  }

  @Papeis('admin')
  @Post()
  criar(@Body() body: any) {
    return this.service.criar(body);
  }

  @Papeis('admin')
  @Put(':id')
  atualizar(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.service.atualizar(id, body);
  }

  @Papeis('admin')
  @Delete(':id')
  remover(@Param('id', ParseIntPipe) id: number) {
    return this.service.remover(id);
  }
}

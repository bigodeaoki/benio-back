import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { Papeis, UsuarioAtual } from '../auth/decorators';

@Papeis('admin')
@Controller('usuarios')
export class UsuariosController {
  constructor(private service: UsuariosService) {}

  @Get()
  listar() {
    return this.service.listar();
  }

  @Post()
  criar(@Body() body: any) {
    return this.service.criar(body);
  }

  @Put(':id')
  atualizar(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.service.atualizar(id, body);
  }

  @Delete(':id')
  remover(@Param('id', ParseIntPipe) id: number, @UsuarioAtual() usuario: any) {
    return this.service.remover(id, usuario.id);
  }
}

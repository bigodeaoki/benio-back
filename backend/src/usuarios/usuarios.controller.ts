import { Body, Controller, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { EmpresaId, Papeis, UsuarioAtual } from '../auth/decorators';
import { PERM } from '../auth/papeis';

@Controller('usuarios')
export class UsuariosController {
  constructor(private service: UsuariosService) {}

  // Funcionários da empresa ativa (para vincular às linhas) — acessível a qualquer papel
  @Get('equipe')
  equipe(@EmpresaId() empresaId: number) {
    return this.service.equipe(empresaId);
  }

  @Papeis(...PERM.usuarios)
  @Get()
  listar() {
    return this.service.listar();
  }

  @Papeis(...PERM.usuarios)
  @Post()
  criar(@Body() body: any) {
    return this.service.criar(body);
  }

  @Papeis(...PERM.usuarios)
  @Put(':id')
  atualizar(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.service.atualizar(id, body);
  }

  // Sem exclusão física — apenas ativa/inativa (mantém histórico)
  @Papeis(...PERM.usuarios)
  @Put(':id/ativo')
  alterarAtivo(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioAtual() usuario: any,
    @Body() body: { ativo: boolean },
  ) {
    return this.service.alterarAtivo(id, usuario.id, !!body?.ativo);
  }
}

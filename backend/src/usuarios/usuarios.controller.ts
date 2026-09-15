import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { EmpresaId, Papeis, UsuarioAtual } from '../auth/decorators';
import { PERM } from '../auth/papeis';

@Controller('usuarios')
export class UsuariosController {
  constructor(private service: UsuariosService) {}

  // Funcionários da empresa ativa (para vincular às linhas) — acessível a qualquer papel.
  // ?todos=1 lista todos os usuários ativos do sistema (usado pelo envase)
  @Get('equipe')
  equipe(@EmpresaId() empresaId: number, @Query('todos') todos?: string) {
    return this.service.equipe(empresaId, todos === '1' || todos === 'true');
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

  // Importação em lote: com dry_run só confere, sem dry_run grava os válidos
  @Papeis(...PERM.usuarios)
  @Post('importar')
  importar(@Body() body: any) {
    return this.service.importar(body);
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

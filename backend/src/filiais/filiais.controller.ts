import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Req } from '@nestjs/common';
import { FiliaisService } from './filiais.service';
import { Papeis } from '../auth/decorators';

@Controller('filiais')
export class FiliaisController {
  constructor(private service: FiliaisService) {}

  // Filiais das empresas acessíveis — qualquer papel (a tela de usuários lista por filial)
  @Get()
  listar(@Req() req: any) {
    return this.service.listar(req.empresaIds);
  }

  @Papeis('admin')
  @Post()
  criar(@Req() req: any, @Body() body: any) {
    return this.service.criar(req.empresaIds, body);
  }

  @Papeis('admin')
  @Put(':id/ativa')
  alterarAtiva(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() body: { ativa: boolean }) {
    return this.service.alterarAtiva(req.empresaIds, id, !!body?.ativa);
  }

  @Papeis('admin')
  @Put(':id')
  atualizar(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.service.atualizar(req.empresaIds, id, body);
  }
}

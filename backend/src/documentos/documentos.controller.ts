import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { DocumentosService, TIPOS_DOCUMENTO } from './documentos.service';
import { EmpresaId, Papeis, UsuarioAtual } from '../auth/decorators';

@Controller('documentos')
export class DocumentosController {
  constructor(private service: DocumentosService) {}

  @Get()
  listar(
    @EmpresaId() empresaId: number,
    @Query('tipo') tipo?: string,
    @Query('tag_id') tagId?: string,
    @Query('busca') busca?: string,
  ) {
    return this.service.listar(empresaId, {
      tipo: tipo || undefined,
      tag_id: tagId ? Number(tagId) : undefined,
      busca: busca || undefined,
    });
  }

  @Get('tags')
  listarTags(@EmpresaId() empresaId: number) {
    return this.service.listarTags(empresaId);
  }

  @Get('tipos')
  listarTipos() {
    return TIPOS_DOCUMENTO;
  }

  @Papeis('admin', 'gestor', 'operador')
  @Post()
  criar(@EmpresaId() empresaId: number, @UsuarioAtual() usuario: any, @Body() body: any) {
    return this.service.criar(empresaId, usuario.id, body);
  }

  @Papeis('admin', 'gestor')
  @Put(':id')
  atualizar(@EmpresaId() empresaId: number, @Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.service.atualizar(empresaId, id, body);
  }

  @Papeis('admin', 'gestor')
  @Delete(':id')
  remover(@EmpresaId() empresaId: number, @Param('id', ParseIntPipe) id: number) {
    return this.service.remover(empresaId, id);
  }

  @Get(':id/arquivo')
  async arquivo(@EmpresaId() empresaId: number, @Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const doc = await this.service.arquivo(empresaId, id);
    res.setHeader('Content-Type', doc.mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.arquivo_nome)}"`);
    res.send(doc.conteudo);
  }
}

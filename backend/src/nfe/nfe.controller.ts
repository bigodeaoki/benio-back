import { Body, Controller, Get, Param, ParseIntPipe, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { NfeService } from './nfe.service';
import { EmpresaId, Papeis } from '../auth/decorators';
import { PERM } from '../auth/papeis';

@Controller('nfe')
export class NfeController {
  constructor(private service: NfeService) {}

  @Get()
  listar(@EmpresaId() empresaId: number) {
    return this.service.listar(empresaId);
  }

  @Papeis(...PERM.nfe)
  @Post('emitir')
  emitir(@EmpresaId() empresaId: number, @Body() body: any) {
    return this.service.emitir(empresaId, body);
  }

  @Papeis(...PERM.nfe)
  @Post(':id/cancelar')
  cancelar(@EmpresaId() empresaId: number, @Param('id', ParseIntPipe) id: number) {
    return this.service.cancelar(empresaId, id);
  }

  @Get(':id/xml')
  async xml(@EmpresaId() empresaId: number, @Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const nota = await this.service.xml(empresaId, id);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="NFe-${nota.chave_acesso || nota.numero}.xml"`);
    res.send(nota.xml);
  }
}

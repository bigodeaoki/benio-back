import { Body, Controller, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { EnviosService } from './envios.service';
import { EmpresaId, Papeis } from '../auth/decorators';
import { PERM } from '../auth/papeis';

@Controller('envios')
export class EnviosController {
  constructor(private service: EnviosService) {}

  @Get()
  listar(@EmpresaId() empresaId: number) {
    return this.service.listar(empresaId);
  }

  @Get('ordens-disponiveis')
  ordensDisponiveis(@EmpresaId() empresaId: number) {
    return this.service.ordensDisponiveis(empresaId);
  }

  @Papeis(...PERM.envios)
  @Post()
  criar(@EmpresaId() empresaId: number, @Body() body: any) {
    return this.service.criar(empresaId, body);
  }

  @Papeis(...PERM.envios)
  @Put(':id')
  atualizar(@EmpresaId() empresaId: number, @Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.service.atualizar(empresaId, id, body);
  }

  @Papeis(...PERM.enviosStatus)
  @Put(':id/status')
  atualizarStatus(
    @EmpresaId() empresaId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: string },
  ) {
    return this.service.atualizarStatus(empresaId, id, body?.status);
  }
}

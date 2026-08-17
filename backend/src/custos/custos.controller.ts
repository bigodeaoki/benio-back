import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { CustosService } from './custos.service';
import { EmpresaId } from '../auth/decorators';

@Controller('custos')
export class CustosController {
  constructor(private service: CustosService) {}

  @Get('produtos')
  listarResumo(@EmpresaId() empresaId: number) {
    return this.service.listarResumo(empresaId);
  }

  @Get('produto/:id')
  custoProduto(
    @EmpresaId() empresaId: number,
    @Param('id', ParseIntPipe) id: number,
    @Query('margem_pct') margem?: string,
    @Query('uf_destino') ufDestino?: string,
  ) {
    return this.service.custoProduto(empresaId, id, {
      margem_pct: margem != null && margem !== '' ? Number(margem) : undefined,
      uf_destino: ufDestino || undefined,
    });
  }

  @Get('produto/:id/simulacao-uf')
  simulacaoUf(
    @EmpresaId() empresaId: number,
    @Param('id', ParseIntPipe) id: number,
    @Query('margem_pct') margem?: string,
  ) {
    return this.service.simulacaoUf(empresaId, id, margem != null && margem !== '' ? Number(margem) : undefined);
  }
}

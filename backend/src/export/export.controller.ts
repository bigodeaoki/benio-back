import { Controller, Get, Param, ParseIntPipe, Res } from '@nestjs/common';
import { Response } from 'express';
import { ExportService } from './export.service';
import { EmpresaId } from '../auth/decorators';

// Downloads autenticados via query string (?token=...&empresa=...)
@Controller('export')
export class ExportController {
  constructor(private service: ExportService) {}

  @Get('custos.xlsx')
  custos(@EmpresaId() empresaId: number, @Res() res: Response) {
    return this.service.custosXlsx(empresaId, res);
  }

  @Get('pedidos.xlsx')
  pedidos(@EmpresaId() empresaId: number, @Res() res: Response) {
    return this.service.pedidosXlsx(empresaId, res);
  }

  @Get('estoque.xlsx')
  estoque(@EmpresaId() empresaId: number, @Res() res: Response) {
    return this.service.estoqueXlsx(empresaId, res);
  }

  @Get('colaboradores.xlsx')
  colaboradores(@EmpresaId() empresaId: number, @Res() res: Response) {
    return this.service.colaboradoresXlsx(empresaId, res);
  }

  @Get('custo-produto/:id.pdf')
  custoProduto(@EmpresaId() empresaId: number, @Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    return this.service.custoProdutoPdf(empresaId, id, res);
  }

  @Get('pedido/:id.pdf')
  pedido(@EmpresaId() empresaId: number, @Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    return this.service.pedidoPdf(empresaId, id, res);
  }
}

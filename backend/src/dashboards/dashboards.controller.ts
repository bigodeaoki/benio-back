import { Controller, Get } from '@nestjs/common';
import { DashboardsService } from './dashboards.service';
import { EmpresaId } from '../auth/decorators';

@Controller('dashboards')
export class DashboardsController {
  constructor(private service: DashboardsService) {}

  @Get('resumo')
  resumo(@EmpresaId() empresaId: number) {
    return this.service.resumo(empresaId);
  }
}

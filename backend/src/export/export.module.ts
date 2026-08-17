import { Module } from '@nestjs/common';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';
import { CustosModule } from '../custos/custos.module';

@Module({
  imports: [CustosModule],
  controllers: [ExportController],
  providers: [ExportService],
})
export class ExportModule {}

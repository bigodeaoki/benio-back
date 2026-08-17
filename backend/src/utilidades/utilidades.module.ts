import { Module } from '@nestjs/common';
import { UtilidadesController } from './utilidades.controller';
import { UtilidadesService } from './utilidades.service';

@Module({
  controllers: [UtilidadesController],
  providers: [UtilidadesService],
})
export class UtilidadesModule {}

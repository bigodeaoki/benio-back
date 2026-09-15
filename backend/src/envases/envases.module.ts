import { Module } from '@nestjs/common';
import { EnvasesController } from './envases.controller';
import { EnvasesService } from './envases.service';

@Module({
  controllers: [EnvasesController],
  providers: [EnvasesService],
})
export class EnvasesModule {}

import { Module } from '@nestjs/common';
import { NfeController } from './nfe.controller';
import { NfeService } from './nfe.service';
import { CustosModule } from '../custos/custos.module';

@Module({
  imports: [CustosModule],
  controllers: [NfeController],
  providers: [NfeService],
})
export class NfeModule {}

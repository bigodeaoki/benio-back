import { Module } from '@nestjs/common';
import { LinhasController } from './linhas.controller';
import { LinhasService } from './linhas.service';

@Module({
  controllers: [LinhasController],
  providers: [LinhasService],
})
export class LinhasModule {}

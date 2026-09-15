import { Module } from '@nestjs/common';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';
import { EmpresasModule } from '../empresas/empresas.module';
import { FiliaisModule } from '../filiais/filiais.module';

@Module({
  // a importação em lote cadastra empresas e filiais citadas na planilha
  imports: [EmpresasModule, FiliaisModule],
  controllers: [UsuariosController],
  providers: [UsuariosService],
})
export class UsuariosModule {}

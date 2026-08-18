import { Module } from '@nestjs/common';
import { DatabaseModule } from './db/database.module';
import { AuthModule } from './auth/auth.module';
import { EmpresasModule } from './empresas/empresas.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { UtilidadesModule } from './utilidades/utilidades.module';
import { LinhasModule } from './linhas/linhas.module';
import { MateriasModule } from './materias/materias.module';
import { ProdutosModule } from './produtos/produtos.module';
import { PedidosModule } from './pedidos/pedidos.module';
import { CustosModule } from './custos/custos.module';
import { EstoqueModule } from './estoque/estoque.module';
import { ProducaoModule } from './producao/producao.module';
import { NfeModule } from './nfe/nfe.module';
import { DashboardsModule } from './dashboards/dashboards.module';
import { IntegracaoModule } from './integracao/integracao.module';
import { FiscalModule } from './fiscal/fiscal.module';
import { ExportModule } from './export/export.module';
import { DocumentosModule } from './documentos/documentos.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    EmpresasModule,
    UsuariosModule,
    UtilidadesModule,
    LinhasModule,
    MateriasModule,
    ProdutosModule,
    PedidosModule,
    CustosModule,
    EstoqueModule,
    ProducaoModule,
    NfeModule,
    DashboardsModule,
    IntegracaoModule,
    FiscalModule,
    ExportModule,
    DocumentosModule,
  ],
})
export class AppModule {}

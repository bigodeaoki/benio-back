// Papéis do sistema e permissões de ESCRITA por domínio.
// Leitura (GET) é liberada para qualquer usuário autenticado.
// Para ajustar as restrições de um papel, edite apenas este arquivo.

export const TODOS_PAPEIS = ['admin', 'producao', 'qualidade', 'compras', 'vendas', 'administrativo', 'financeiro', 'operador'];

// administrativo = rotina de escritório: pedidos e NF-e, compras (notas de
// fornecedor) e cadastro de MP, estoque, remessas e documentos. Não mexe em
// produção, fórmulas, linhas, utilidades nem configurações.

export const PERM = {
  usuarios: ['admin'],
  empresas: ['admin'],
  fiscal: ['admin'],                                                            // tabelas NCM/IPI e ICMS por UF
  utilidades: ['admin', 'producao'],
  linhas: ['admin', 'producao'],
  materias: ['admin', 'compras', 'producao', 'administrativo'],                 // cadastro da MP (nome, unidade, NCM, estoque mínimo)
  materiasCompras: ['admin', 'compras', 'administrativo'],                      // lançar/editar as compras (lotes) de cada MP
  produtos: ['admin', 'producao', 'qualidade'],                                 // fórmulas e especificações
  pedidos: ['admin', 'vendas', 'administrativo'],
  pedidosGerarOrdens: ['admin', 'vendas', 'producao', 'administrativo'],
  estoqueMovimentar: ['admin', 'compras', 'producao', 'operador', 'administrativo'],
  producaoCriar: ['admin', 'producao'],
  producaoStatus: ['admin', 'producao', 'operador'],                            // apontamentos de chão de fábrica
  nfe: ['admin', 'vendas', 'administrativo'],
  envios: ['admin', 'vendas', 'producao', 'administrativo'],                    // criar/editar remessas
  enviosStatus: ['admin', 'vendas', 'producao', 'operador', 'administrativo'],  // apontar despacho/entrega
  documentosGestao: ['admin', 'qualidade', 'administrativo'],                   // editar/obsoletar (controle de documentos)
};

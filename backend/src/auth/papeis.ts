// Papéis do sistema e permissões de ESCRITA por domínio.
// Leitura (GET) é liberada para qualquer usuário autenticado.
// Para ajustar as restrições de um papel, edite apenas este arquivo.

export const TODOS_PAPEIS = ['admin', 'producao', 'qualidade', 'compras', 'vendas', 'financeiro', 'operador'];

export const PERM = {
  usuarios: ['admin'],
  empresas: ['admin'],
  fiscal: ['admin'],                                            // tabelas NCM/IPI e ICMS por UF
  utilidades: ['admin', 'producao'],
  linhas: ['admin', 'producao'],
  materias: ['admin', 'compras', 'producao'],                   // cadastro da MP (nome, unidade, NCM, estoque mínimo)
  materiasCompras: ['admin', 'compras'],                        // lançar/editar as compras (lotes) de cada MP
  produtos: ['admin', 'producao', 'qualidade'],                 // fórmulas e especificações
  pedidos: ['admin', 'vendas'],
  pedidosGerarOrdens: ['admin', 'vendas', 'producao'],
  estoqueMovimentar: ['admin', 'compras', 'producao', 'operador'],
  producaoCriar: ['admin', 'producao'],
  producaoStatus: ['admin', 'producao', 'operador'],            // apontamentos de chão de fábrica
  nfe: ['admin', 'vendas'],
  envios: ['admin', 'vendas', 'producao'],                      // criar/editar remessas
  enviosStatus: ['admin', 'vendas', 'producao', 'operador'],    // apontar despacho/entrega
  documentosGestao: ['admin', 'qualidade'],                     // editar/obsoletar (controle de documentos)
};

import { Inject, Injectable } from '@nestjs/common';
import { POOL, Pool } from '../db/database.module';
import { CustosService } from '../custos/custos.service';
import { round2 } from '../shared/calculos';

@Injectable()
export class DashboardsService {
  constructor(
    @Inject(POOL) private pool: Pool,
    private custos: CustosService,
  ) {}

  async resumo(empresaId: number) {
    const [kpiPedidos]: any = await this.pool.query(
      `SELECT
         SUM(CASE WHEN p.status IN ('aberto','em_producao') THEN 1 ELSE 0 END) AS pedidos_abertos,
         COUNT(*) AS pedidos_total
       FROM pedidos p WHERE p.empresa_id=?`,
      [empresaId],
    );
    const [carteira]: any = await this.pool.query(
      `SELECT COALESCE(SUM(pi.quantidade * pi.preco_unitario),0) AS valor
       FROM pedidos p JOIN pedido_itens pi ON pi.pedido_id = p.id
       WHERE p.empresa_id=? AND p.status IN ('aberto','em_producao')`,
      [empresaId],
    );
    const [ops]: any = await this.pool.query(
      `SELECT COUNT(*) AS c FROM ordens_producao WHERE empresa_id=? AND status IN ('planejada','liberada','em_producao')`,
      [empresaId],
    );
    const [estoqueCritico]: any = await this.pool.query(
      `SELECT id, nome, unidade, estoque_atual, estoque_minimo FROM materias_primas
       WHERE empresa_id=? AND estoque_atual < estoque_minimo ORDER BY (estoque_minimo - estoque_atual) DESC`,
      [empresaId],
    );
    const [nfes]: any = await this.pool.query(
      `SELECT COUNT(*) AS c, COALESCE(SUM(valor_total),0) AS total FROM notas_fiscais
       WHERE empresa_id=? AND status='emitida_homologacao'`,
      [empresaId],
    );

    // Pedidos por mês (últimos 6 meses com dados)
    const [pedidosMes]: any = await this.pool.query(
      `SELECT DATE_FORMAT(p.data_pedido,'%Y-%m') AS mes, SUM(pi.quantidade * pi.preco_unitario) AS valor, COUNT(DISTINCT p.id) AS pedidos
       FROM pedidos p JOIN pedido_itens pi ON pi.pedido_id = p.id
       WHERE p.empresa_id=? AND p.status <> 'cancelado'
       GROUP BY mes ORDER BY mes DESC LIMIT 6`,
      [empresaId],
    );

    // Próximas entregas
    const [entregas]: any = await this.pool.query(
      `SELECT p.id, p.numero, p.cliente, p.data_entrega, p.status,
              COALESCE(SUM(pi.quantidade * pi.preco_unitario),0) AS valor
       FROM pedidos p LEFT JOIN pedido_itens pi ON pi.pedido_id = p.id
       WHERE p.empresa_id=? AND p.status IN ('aberto','em_producao') AND p.data_entrega IS NOT NULL
       GROUP BY p.id ORDER BY p.data_entrega ASC LIMIT 8`,
      [empresaId],
    );

    // Utilidades: participação no custo-hora de processo (todas as linhas)
    const [utilShare]: any = await this.pool.query(
      `SELECT u.nome, SUM(lu.consumo_hora * u.custo_unitario) AS custo_hora
       FROM linha_utilidades lu
       JOIN utilidades u ON u.id = lu.utilidade_id
       JOIN linhas_processo l ON l.id = lu.linha_id
       WHERE l.empresa_id=? GROUP BY u.id, u.nome ORDER BY custo_hora DESC`,
      [empresaId],
    );

    // Custos e margens por produto (motor de custos)
    const custosProdutos = await this.custos.listarResumo(empresaId);
    const composicao = custosProdutos.map((c: any) => ({
      nome: c.nome,
      formula: c.composicao.formula,
      mao_de_obra: c.composicao.mao_de_obra,
      processo: c.composicao.processo,
      manutencao: c.composicao.manutencao,
    }));
    const margens = custosProdutos.map((c: any) => ({
      nome: c.nome,
      custo_unitario: c.custo_unitario,
      preco_sugerido: c.preco_sugerido,
      margem_pct: c.margem_pct,
      lucro_unitario: c.preco_sugerido != null ? round2(c.preco_sugerido - (c.carga_tributaria_unit || 0) - c.custo_unitario) : null,
      carga_tributaria_unit: c.carga_tributaria_unit,
    }));

    return {
      kpis: {
        pedidos_abertos: Number(kpiPedidos[0].pedidos_abertos || 0),
        valor_carteira: round2(Number(carteira[0].valor)),
        ordens_abertas: Number(ops[0].c),
        alertas_estoque: estoqueCritico.length,
        nfe_emitidas: Number(nfes[0].c),
        nfe_valor_total: round2(Number(nfes[0].total)),
        produtos_ativos: custosProdutos.length,
      },
      pedidos_por_mes: pedidosMes.reverse().map((m: any) => ({ ...m, valor: round2(Number(m.valor)) })),
      entregas_proximas: entregas.map((e: any) => ({ ...e, valor: round2(Number(e.valor)) })),
      utilidades_participacao: utilShare.map((u: any) => ({ nome: u.nome, custo_hora: round2(Number(u.custo_hora)) })),
      composicao_custos: composicao,
      margens_produtos: margens,
      estoque_critico: estoqueCritico,
    };
  }
}

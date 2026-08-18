import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { POOL, Pool } from '../db/database.module';
import { numeroLote, round2, round4 } from '../shared/calculos';

const STATUS_ABERTOS = ['planejada', 'liberada', 'em_producao'];

@Injectable()
export class ProducaoService {
  constructor(@Inject(POOL) private pool: Pool) {}

  async listarOrdens(empresaId: number) {
    const [rows]: any = await this.pool.query(
      `SELECT op.*, p.nome AS produto_nome, p.unidade, p.tamanho_lote, p.horas_producao,
              l.nome AS linha_nome, pe.numero AS pedido_numero, pe.cliente
       FROM ordens_producao op
       JOIN produtos p ON p.id = op.produto_id
       LEFT JOIN linhas_processo l ON l.id = op.linha_id
       LEFT JOIN pedidos pe ON pe.id = op.pedido_id
       WHERE op.empresa_id=? ORDER BY FIELD(op.status,'em_producao','liberada','planejada','concluida','cancelada','finalizada'), op.data_inicio, op.id`,
      [empresaId],
    );
    return rows.map((r: any) => ({
      ...r,
      lotes: Number(r.tamanho_lote) > 0 ? round2(Number(r.quantidade) / Number(r.tamanho_lote)) : null,
      horas_estimadas:
        Number(r.tamanho_lote) > 0
          ? round2((Number(r.quantidade) / Number(r.tamanho_lote)) * Number(r.horas_producao))
          : null,
    }));
  }

  async criarOrdem(empresaId: number, body: any) {
    const produtoId = Number(body?.produto_id);
    const quantidade = Number(body?.quantidade);
    if (!produtoId || !(quantidade > 0)) throw new BadRequestException('Informe produto e quantidade');
    const [produtos]: any = await this.pool.query(
      'SELECT * FROM produtos WHERE id=? AND empresa_id=?', [produtoId, empresaId],
    );
    if (!produtos.length) throw new NotFoundException('Produto não encontrado');
    const [seq]: any = await this.pool.query('SELECT COUNT(*) AS c FROM ordens_producao WHERE empresa_id=?', [empresaId]);
    const numero = `OP-${String(seq[0].c + 1).padStart(4, '0')}`;
    const [res]: any = await this.pool.query(
      `INSERT INTO ordens_producao (empresa_id, numero, pedido_id, produto_id, linha_id, quantidade, data_inicio, data_fim, status)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        empresaId, numero, body.pedido_id || null, produtoId,
        body.linha_id || produtos[0].linha_id || null, quantidade,
        body.data_inicio || null, body.data_fim || null, body.status || 'planejada',
      ],
    );
    return { id: res.insertId, numero };
  }

  async atualizarStatus(empresaId: number, id: number, status: string) {
    if (!['planejada', 'liberada', 'em_producao', 'concluida', 'cancelada', 'finalizada'].includes(status)) {
      throw new BadRequestException('Status inválido');
    }
    if (status === 'concluida') return this.concluir(empresaId, id);
    await this.pool.query('UPDATE ordens_producao SET status=? WHERE id=? AND empresa_id=?', [status, id, empresaId]);
    return { ok: true };
  }

  // Ordem de produção não se apaga: vira histórico com status 'finalizada'.
  // Só encerra o que ainda não rodou — em_producao/concluida seguem o fluxo normal.
  async finalizar(empresaId: number, id: number) {
    const [res]: any = await this.pool.query(
      "UPDATE ordens_producao SET status='finalizada' WHERE id=? AND empresa_id=? AND status IN ('planejada','cancelada')",
      [id, empresaId],
    );
    if (!res.affectedRows) {
      throw new BadRequestException('Só é possível finalizar ordens planejadas ou canceladas');
    }
    return { ok: true };
  }

  // Ordem concluída entra no Controle de envio já como remessa em "preparando",
  // com o saldo ainda não despachado (a ordem pode ter tido remessas parciais
  // enquanto estava em produção). Roda na transação do concluir.
  private async abrirRemessa(conn: any, empresaId: number, ordem: any) {
    const [enviado]: any = await conn.query(
      'SELECT COALESCE(SUM(quantidade),0) AS total FROM envios WHERE ordem_id=?', [ordem.id],
    );
    const saldo = round4(Number(ordem.quantidade) - Number(enviado[0].total));
    if (!(saldo > 0)) return null;

    const [seq]: any = await conn.query(
      'SELECT COUNT(*) AS c FROM envios WHERE empresa_id=?', [empresaId],
    );
    const lote = numeroLote(seq[0].c + 1);

    // Ordem gerada a partir de um pedido já nasce com o destinatário preenchido
    let cliente = null;
    let uf = null;
    if (ordem.pedido_id) {
      const [pedidos]: any = await conn.query(
        'SELECT cliente, cliente_uf FROM pedidos WHERE id=?', [ordem.pedido_id],
      );
      cliente = pedidos[0]?.cliente ?? null;
      uf = pedidos[0]?.cliente_uf ?? null;
    }

    await conn.query(
      `INSERT INTO envios (empresa_id, lote, ordem_id, produto_id, quantidade, destinatario, uf, status, observacao)
       VALUES (?,?,?,?,?,?,?,'preparando',?)`,
      [empresaId, lote, ordem.id, ordem.produto_id, saldo, cliente, uf, `Gerada ao concluir ${ordem.numero}`],
    );
    return { lote, quantidade: saldo };
  }

  // Conclusão da OP: baixa as matérias-primas do estoque conforme a fórmula
  // (com o rendimento da linha) e abre a remessa no Controle de envio
  private async concluir(empresaId: number, id: number) {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      const [ordens]: any = await conn.query(
        'SELECT * FROM ordens_producao WHERE id=? AND empresa_id=? FOR UPDATE', [id, empresaId],
      );
      if (!ordens.length) throw new NotFoundException('Ordem não encontrada');
      const ordem = ordens[0];
      if (ordem.status === 'concluida') throw new BadRequestException('Ordem já concluída');
      const necessidades = await this.necessidadesDaOrdem(conn, ordem);
      for (const n of necessidades) {
        const [mps]: any = await conn.query('SELECT estoque_atual FROM materias_primas WHERE id=? FOR UPDATE', [n.materia_prima_id]);
        const saldo = Number(mps[0].estoque_atual);
        await conn.query(
          'INSERT INTO estoque_movimentos (empresa_id, materia_prima_id, tipo, quantidade, origem) VALUES (?,?,?,?,?)',
          [empresaId, n.materia_prima_id, 'saida', n.necessidade_bruta, `Consumo ${ordem.numero}`],
        );
        await conn.query('UPDATE materias_primas SET estoque_atual=? WHERE id=?', [
          round4(saldo - n.necessidade_bruta), n.materia_prima_id,
        ]);
      }
      await conn.query("UPDATE ordens_producao SET status='concluida' WHERE id=?", [id]);
      const remessa = await this.abrirRemessa(conn, empresaId, ordem);
      await conn.commit();
      return { ok: true, consumos: necessidades, remessa };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  private async necessidadesDaOrdem(conn: any, ordem: any) {
    const [produtos]: any = await conn.query('SELECT * FROM produtos WHERE id=?', [ordem.produto_id]);
    const produto = produtos[0];
    const lotes = Number(produto.tamanho_lote) > 0 ? Number(ordem.quantidade) / Number(produto.tamanho_lote) : 0;
    const rendLinha = Number(produto.rendimento_linha_pct) > 0 ? Number(produto.rendimento_linha_pct) / 100 : 1;
    const [itens]: any = await conn.query(
      `SELECT fi.quantidade, mp.id AS materia_prima_id, mp.nome, mp.unidade
       FROM formula_itens fi JOIN materias_primas mp ON mp.id = fi.materia_prima_id
       WHERE fi.produto_id=?`,
      [ordem.produto_id],
    );
    return itens.map((i: any) => ({
      materia_prima_id: i.materia_prima_id,
      nome: i.nome,
      unidade: i.unidade,
      necessidade_bruta: round4((Number(i.quantidade) * lotes) / rendLinha),
    }));
  }

  // ------------------------------------------------------------------
  // MRP: necessidades de materiais das ordens abertas × estoque disponível
  // + capacidade das linhas (horas necessárias × horas disponíveis/semana)
  // ------------------------------------------------------------------
  async mrp(empresaId: number) {
    const [ordens]: any = await this.pool.query(
      `SELECT op.*, p.nome AS produto_nome, p.tamanho_lote, p.horas_producao, p.rendimento_linha_pct,
              l.nome AS linha_nome, l.horas_disponiveis_semana
       FROM ordens_producao op
       JOIN produtos p ON p.id = op.produto_id
       LEFT JOIN linhas_processo l ON l.id = op.linha_id
       WHERE op.empresa_id=? AND op.status IN (?)`,
      [empresaId, STATUS_ABERTOS],
    );
    const necessidades = new Map<number, any>();
    const capacidade = new Map<string, any>();

    for (const ordem of ordens) {
      const lotes = Number(ordem.tamanho_lote) > 0 ? Number(ordem.quantidade) / Number(ordem.tamanho_lote) : 0;
      const horas = lotes * Number(ordem.horas_producao);
      const chaveLinha = ordem.linha_nome || 'Sem linha definida';
      const cap = capacidade.get(chaveLinha) || {
        linha: chaveLinha,
        horas_necessarias: 0,
        horas_disponiveis_semana: Number(ordem.horas_disponiveis_semana) || null,
        ordens: 0,
      };
      cap.horas_necessarias = round2(cap.horas_necessarias + horas);
      cap.ordens += 1;
      capacidade.set(chaveLinha, cap);

      const rendLinha = Number(ordem.rendimento_linha_pct) > 0 ? Number(ordem.rendimento_linha_pct) / 100 : 1;
      const [itens]: any = await this.pool.query(
        `SELECT fi.quantidade, mp.id, mp.nome, mp.unidade, mp.custo_unitario, mp.estoque_atual, mp.estoque_minimo
         FROM formula_itens fi JOIN materias_primas mp ON mp.id = fi.materia_prima_id
         WHERE fi.produto_id=?`,
        [ordem.produto_id],
      );
      for (const i of itens) {
        const bruta = (Number(i.quantidade) * lotes) / rendLinha;
        const atual = necessidades.get(i.id) || {
          materia_prima_id: i.id,
          nome: i.nome,
          unidade: i.unidade,
          custo_unitario: Number(i.custo_unitario),
          estoque_atual: Number(i.estoque_atual),
          estoque_minimo: Number(i.estoque_minimo),
          necessidade_bruta: 0,
        };
        atual.necessidade_bruta = round4(atual.necessidade_bruta + bruta);
        necessidades.set(i.id, atual);
      }
    }

    const listaNecessidades = [...necessidades.values()].map((n) => {
      const falta = Math.max(0, n.necessidade_bruta - n.estoque_atual);
      // sugestão de compra repõe a falta e recompõe o estoque mínimo
      const sugestao = falta > 0 ? round4(falta + n.estoque_minimo) : 0;
      return {
        ...n,
        falta: round4(falta),
        sugestao_compra: sugestao,
        custo_compra_estimado: round2(sugestao * n.custo_unitario),
        situacao: falta > 0 ? 'comprar' : 'suficiente',
      };
    }).sort((a, b) => b.falta - a.falta);

    const listaCapacidade = [...capacidade.values()].map((c) => ({
      ...c,
      ocupacao_semana_pct: c.horas_disponiveis_semana
        ? round2((c.horas_necessarias / c.horas_disponiveis_semana) * 100)
        : null,
    }));

    return {
      ordens_consideradas: ordens.length,
      necessidades: listaNecessidades,
      capacidade: listaCapacidade,
      compras_total_estimado: round2(listaNecessidades.reduce((s, n) => s + n.custo_compra_estimado, 0)),
    };
  }
}

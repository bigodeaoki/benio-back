import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { POOL, Pool } from '../db/database.module';
import { round2, round4 } from '../shared/calculos';

@Injectable()
export class MateriasService {
  constructor(@Inject(POOL) private pool: Pool) {}

  async listar(empresaId: number) {
    const [rows]: any = await this.pool.query(
      `SELECT mp.*, n.descricao AS ncm_descricao,
              (SELECT COUNT(*) FROM materia_compras c
                WHERE c.materia_prima_id = mp.id AND c.status='ativo') AS compras_ativas,
              (SELECT MAX(c.data_compra) FROM materia_compras c
                WHERE c.materia_prima_id = mp.id) AS ultima_compra_em
       FROM materias_primas mp LEFT JOIN ncm n ON n.codigo = mp.ncm_codigo
       WHERE mp.empresa_id=? ORDER BY mp.nome`,
      [empresaId],
    );
    return rows;
  }

  // Compras de uma matéria-prima, na ordem em que serão consumidas (FIFO)
  async listarCompras(empresaId: number, materiaPrimaId: number) {
    const [rows]: any = await this.pool.query(
      `SELECT c.* FROM materia_compras c
       WHERE c.empresa_id=? AND c.materia_prima_id=?
       ORDER BY c.data_compra, c.id`,
      [empresaId, materiaPrimaId],
    );
    return rows.map((c: any) => ({
      ...c,
      valor_total: round2(Number(c.quantidade) * Number(c.valor_unitario)),
      valor_restante: round2(Number(c.quantidade_restante) * Number(c.valor_unitario)),
    }));
  }

  // Cadastro: só identificação. Estoque e custo passam a vir das compras.
  async criar(empresaId: number, body: any) {
    if (!body?.nome) throw new BadRequestException('Nome é obrigatório');
    const [res]: any = await this.pool.query(
      `INSERT INTO materias_primas (empresa_id, nome, unidade, ncm_codigo, estoque_minimo)
       VALUES (?,?,?,?,?)`,
      [empresaId, body.nome, body.unidade || 'kg', body.ncm_codigo || null, body.estoque_minimo ?? 0],
    );
    return { id: res.insertId };
  }

  async atualizar(empresaId: number, id: number, body: any) {
    const [res]: any = await this.pool.query(
      `UPDATE materias_primas SET nome=?, unidade=?, ncm_codigo=?, estoque_minimo=?
       WHERE id=? AND empresa_id=?`,
      [body.nome, body.unidade || 'kg', body.ncm_codigo || null, body.estoque_minimo ?? 0, id, empresaId],
    );
    if (!res.affectedRows) throw new NotFoundException('Matéria-prima não encontrada');
    return { ok: true };
  }

  async remover(empresaId: number, id: number) {
    try {
      await this.pool.query('DELETE FROM materias_primas WHERE id=? AND empresa_id=?', [id, empresaId]);
    } catch (e: any) {
      if (e?.code === 'ER_ROW_IS_REFERENCED_2') {
        throw new BadRequestException('Matéria-prima em uso em fórmulas — remova das fórmulas antes');
      }
      throw e;
    }
    return { ok: true };
  }

  async criarCompra(empresaId: number, materiaPrimaId: number, body: any) {
    const quantidade = Number(body?.quantidade);
    const valorUnitario = Number(body?.valor_unitario);
    if (!body?.fornecedor?.trim()) throw new BadRequestException('Informe o fornecedor');
    if (!body?.data_compra) throw new BadRequestException('Informe a data da compra');
    if (!(quantidade > 0)) throw new BadRequestException('Quantidade deve ser maior que zero');
    if (!(valorUnitario >= 0)) throw new BadRequestException('Valor unitário inválido');

    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      const [mps]: any = await conn.query(
        'SELECT id FROM materias_primas WHERE id=? AND empresa_id=?', [materiaPrimaId, empresaId],
      );
      if (!mps.length) throw new NotFoundException('Matéria-prima não encontrada');

      const [res]: any = await conn.query(
        `INSERT INTO materia_compras
         (empresa_id, materia_prima_id, fornecedor, numero_nota, data_compra,
          quantidade, quantidade_restante, valor_unitario, status, observacao)
         VALUES (?,?,?,?,?,?,?,?,'ativo',?)`,
        [
          empresaId, materiaPrimaId, body.fornecedor.trim(), body.numero_nota || null,
          body.data_compra, quantidade, quantidade, valorUnitario, body.observacao || null,
        ],
      );
      // a compra também é uma entrada no histórico de estoque
      await conn.query(
        `INSERT INTO estoque_movimentos (empresa_id, materia_prima_id, tipo, quantidade, custo_unitario, origem)
         VALUES (?,?,'entrada',?,?,?)`,
        [
          empresaId, materiaPrimaId, quantidade, valorUnitario,
          `Compra ${body.fornecedor.trim()}${body.numero_nota ? ` · NF ${body.numero_nota}` : ''}`,
        ],
      );
      await MateriasService.recalcular(conn, materiaPrimaId);
      await conn.commit();
      return { id: res.insertId };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  async atualizarCompra(empresaId: number, compraId: number, body: any) {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      const [compras]: any = await conn.query(
        'SELECT * FROM materia_compras WHERE id=? AND empresa_id=? FOR UPDATE', [compraId, empresaId],
      );
      if (!compras.length) throw new NotFoundException('Compra não encontrada');
      const compra = compras[0];
      const consumido = Number(compra.quantidade) - Number(compra.quantidade_restante);
      const quantidade = Number(body?.quantidade);
      if (!(quantidade > 0)) throw new BadRequestException('Quantidade deve ser maior que zero');
      if (quantidade < consumido) {
        throw new BadRequestException(`Este lote já teve ${consumido} consumido — a quantidade não pode ser menor`);
      }
      const restante = round4(quantidade - consumido);
      await conn.query(
        `UPDATE materia_compras SET fornecedor=?, numero_nota=?, data_compra=?, quantidade=?,
         quantidade_restante=?, valor_unitario=?, status=?, observacao=? WHERE id=?`,
        [
          body.fornecedor?.trim() || compra.fornecedor, body.numero_nota || null, body.data_compra,
          quantidade, restante, Number(body.valor_unitario) || 0,
          restante > 0 ? 'ativo' : 'inativo', body.observacao || null, compraId,
        ],
      );
      await MateriasService.recalcular(conn, compra.materia_prima_id);
      await conn.commit();
      return { ok: true };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  async removerCompra(empresaId: number, compraId: number) {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      const [compras]: any = await conn.query(
        'SELECT * FROM materia_compras WHERE id=? AND empresa_id=? FOR UPDATE', [compraId, empresaId],
      );
      if (!compras.length) throw new NotFoundException('Compra não encontrada');
      const compra = compras[0];
      if (Number(compra.quantidade_restante) < Number(compra.quantidade)) {
        throw new BadRequestException('Lote já consumido pela produção — não pode ser removido');
      }
      await conn.query('DELETE FROM materia_compras WHERE id=?', [compraId]);
      await MateriasService.recalcular(conn, compra.materia_prima_id);
      await conn.commit();
      return { ok: true };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  // ------------------------------------------------------------------
  // Estáticos: usados também pela produção e pelo estoque, dentro das
  // transações deles, por isso recebem a conexão de fora.
  // ------------------------------------------------------------------

  // Baixa `quantidade` dos lotes ativos em ordem crescente de data (FIFO).
  // Lote que zera vira 'inativo'. Devolve o consumo por lote e o custo real baixado.
  static async consumirFifo(conn: any, materiaPrimaId: number, quantidade: number) {
    const [lotes]: any = await conn.query(
      `SELECT * FROM materia_compras
       WHERE materia_prima_id=? AND status='ativo' AND quantidade_restante > 0
       ORDER BY data_compra, id FOR UPDATE`,
      [materiaPrimaId],
    );
    const disponivel = lotes.reduce((s: number, l: any) => s + Number(l.quantidade_restante), 0);
    if (round4(quantidade) > round4(disponivel)) {
      const [mps]: any = await conn.query('SELECT nome FROM materias_primas WHERE id=?', [materiaPrimaId]);
      throw new BadRequestException(
        `Estoque insuficiente de ${mps[0]?.nome}: disponível ${round4(disponivel)}, necessário ${round4(quantidade)}`,
      );
    }

    let restante = quantidade;
    const baixas: any[] = [];
    let custo = 0;
    for (const lote of lotes) {
      if (restante <= 0) break;
      const usar = Math.min(restante, Number(lote.quantidade_restante));
      const sobra = round4(Number(lote.quantidade_restante) - usar);
      await conn.query(
        "UPDATE materia_compras SET quantidade_restante=?, status=? WHERE id=?",
        [sobra, sobra > 0 ? 'ativo' : 'inativo', lote.id],
      );
      baixas.push({ compra_id: lote.id, fornecedor: lote.fornecedor, quantidade: round4(usar) });
      custo += usar * Number(lote.valor_unitario);
      restante = round4(restante - usar);
    }
    await MateriasService.recalcular(conn, materiaPrimaId);
    return { baixas, custo: round2(custo) };
  }

  // Devolve `quantidade` aos lotes, do mais recente para o mais antigo
  // (desfaz o FIFO na ordem inversa). Reativa lote que volta a ter saldo.
  static async estornarFifo(conn: any, materiaPrimaId: number, quantidade: number) {
    const [lotes]: any = await conn.query(
      `SELECT * FROM materia_compras
       WHERE materia_prima_id=? AND quantidade_restante < quantidade
       ORDER BY data_compra DESC, id DESC FOR UPDATE`,
      [materiaPrimaId],
    );
    let restante = quantidade;
    for (const lote of lotes) {
      if (restante <= 0) break;
      const espaco = Number(lote.quantidade) - Number(lote.quantidade_restante);
      const devolver = Math.min(restante, espaco);
      const novo = round4(Number(lote.quantidade_restante) + devolver);
      await conn.query(
        "UPDATE materia_compras SET quantidade_restante=?, status='ativo' WHERE id=?",
        [novo, lote.id],
      );
      restante = round4(restante - devolver);
    }
    await MateriasService.recalcular(conn, materiaPrimaId);
    return { devolvido: round4(quantidade - restante), nao_alocado: restante };
  }

  // Estoque = soma do que resta nos lotes; custo = média ponderada desse saldo
  static async recalcular(conn: any, materiaPrimaId: number) {
    const [rows]: any = await conn.query(
      `SELECT COALESCE(SUM(quantidade_restante),0) AS qtd,
              COALESCE(SUM(quantidade_restante * valor_unitario),0) AS valor
       FROM materia_compras WHERE materia_prima_id=? AND status='ativo'`,
      [materiaPrimaId],
    );
    const qtd = Number(rows[0].qtd);
    const custo = qtd > 0 ? round4(Number(rows[0].valor) / qtd) : 0;
    await conn.query(
      'UPDATE materias_primas SET estoque_atual=?, custo_unitario=? WHERE id=?',
      [round4(qtd), custo, materiaPrimaId],
    );
    return { estoque_atual: round4(qtd), custo_unitario: custo };
  }
}

import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { POOL, Pool } from '../db/database.module';
import { round2 } from '../shared/calculos';
import { limparCnpj } from '../shared/cnpj';

@Injectable()
export class PedidosService {
  constructor(@Inject(POOL) private pool: Pool) {}

  async listar(empresaId: number) {
    const [pedidos]: any = await this.pool.query(
      'SELECT * FROM pedidos WHERE empresa_id=? ORDER BY data_pedido DESC, id DESC',
      [empresaId],
    );
    if (!pedidos.length) return [];
    const ids = pedidos.map((p: any) => p.id);
    const [itens]: any = await this.pool.query(
      `SELECT pi.*, pr.nome AS produto_nome, pr.unidade, pr.tamanho_lote, pr.horas_producao
       FROM pedido_itens pi JOIN produtos pr ON pr.id = pi.produto_id
       WHERE pi.pedido_id IN (?) ORDER BY pi.id`,
      [ids],
    );
    return pedidos.map((p: any) => {
      const doPedido = itens.filter((i: any) => i.pedido_id === p.id).map((i: any) => ({
        ...i,
        subtotal: round2(Number(i.quantidade) * Number(i.preco_unitario)),
        // horas estimadas de produção do item = lotes necessários × horas por lote
        horas_estimadas: Number(i.tamanho_lote) > 0
          ? round2((Number(i.quantidade) / Number(i.tamanho_lote)) * Number(i.horas_producao))
          : null,
      }));
      return {
        ...p,
        itens: doPedido,
        valor_total: round2(doPedido.reduce((s: number, i: any) => s + i.subtotal, 0)),
      };
    });
  }

  async criar(empresaId: number, body: any) {
    this.validar(body);
    const cnpjCliente = limparCnpj(body.cliente_cnpj, 'CNPJ do cliente');
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      const numero = body.numero || (await this.proximoNumero(conn, empresaId));
      const [res]: any = await conn.query(
        `INSERT INTO pedidos (empresa_id, numero, cliente, cliente_cnpj, cliente_uf, data_pedido, data_entrega, status, observacao)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [
          empresaId, numero, body.cliente, cnpjCliente, body.cliente_uf || 'SP',
          body.data_pedido, body.data_entrega || null, body.status || 'aberto', body.observacao || null,
        ],
      );
      await this.salvarItens(conn, res.insertId, body.itens);
      await conn.commit();
      return { id: res.insertId, numero };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  async atualizar(empresaId: number, id: number, body: any) {
    this.validar(body);
    const cnpjCliente = limparCnpj(body.cliente_cnpj, 'CNPJ do cliente');
    const [existe]: any = await this.pool.query('SELECT id FROM pedidos WHERE id=? AND empresa_id=?', [id, empresaId]);
    if (!existe.length) throw new NotFoundException('Pedido não encontrado');
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        `UPDATE pedidos SET cliente=?, cliente_cnpj=?, cliente_uf=?, data_pedido=?, data_entrega=?, status=?, observacao=?
         WHERE id=?`,
        [
          body.cliente, cnpjCliente, body.cliente_uf || 'SP', body.data_pedido,
          body.data_entrega || null, body.status || 'aberto', body.observacao || null, id,
        ],
      );
      await conn.query('DELETE FROM pedido_itens WHERE pedido_id=?', [id]);
      await this.salvarItens(conn, id, body.itens);
      await conn.commit();
      return { ok: true };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  async remover(empresaId: number, id: number) {
    await this.pool.query('DELETE FROM pedidos WHERE id=? AND empresa_id=?', [id, empresaId]);
    return { ok: true };
  }

  // Gera uma ordem de produção por item do pedido (PCP)
  async gerarOrdens(empresaId: number, id: number) {
    const [pedidos]: any = await this.pool.query('SELECT * FROM pedidos WHERE id=? AND empresa_id=?', [id, empresaId]);
    if (!pedidos.length) throw new NotFoundException('Pedido não encontrado');
    const pedido = pedidos[0];
    const [itens]: any = await this.pool.query(
      'SELECT pi.*, pr.linha_id FROM pedido_itens pi JOIN produtos pr ON pr.id = pi.produto_id WHERE pi.pedido_id=?',
      [id],
    );
    if (!itens.length) throw new BadRequestException('Pedido sem itens');
    const criadas: any[] = [];
    for (const item of itens) {
      const [seq]: any = await this.pool.query(
        'SELECT COUNT(*) AS c FROM ordens_producao WHERE empresa_id=?', [empresaId],
      );
      const numero = `OP-${String(seq[0].c + 1).padStart(4, '0')}`;
      const [res]: any = await this.pool.query(
        `INSERT INTO ordens_producao (empresa_id, numero, pedido_id, produto_id, linha_id, quantidade, data_inicio, data_fim, status)
         VALUES (?,?,?,?,?,?,?,?,'planejada')`,
        [empresaId, numero, id, item.produto_id, item.linha_id || null, item.quantidade, pedido.data_pedido, pedido.data_entrega],
      );
      criadas.push({ id: res.insertId, numero });
    }
    await this.pool.query("UPDATE pedidos SET status='em_producao' WHERE id=? AND status='aberto'", [id]);
    return { ordens: criadas };
  }

  private validar(body: any) {
    if (!body?.cliente) throw new BadRequestException('Cliente é obrigatório');
    if (!body?.data_pedido) throw new BadRequestException('Data do pedido é obrigatória');
    if (!Array.isArray(body?.itens) || !body.itens.filter((i: any) => i?.produto_id).length) {
      throw new BadRequestException('Inclua ao menos um item no pedido');
    }
  }

  private async proximoNumero(conn: any, empresaId: number): Promise<string> {
    const [rows]: any = await conn.query('SELECT COUNT(*) AS c FROM pedidos WHERE empresa_id=?', [empresaId]);
    return `PED-${String(rows[0].c + 1).padStart(4, '0')}`;
  }

  private async salvarItens(conn: any, pedidoId: number, itens: any[]) {
    for (const item of itens || []) {
      if (!item?.produto_id || !(Number(item.quantidade) > 0)) continue;
      await conn.query(
        'INSERT INTO pedido_itens (pedido_id, produto_id, quantidade, preco_unitario) VALUES (?,?,?,?)',
        [pedidoId, Number(item.produto_id), Number(item.quantidade), Number(item.preco_unitario) || 0],
      );
    }
  }
}

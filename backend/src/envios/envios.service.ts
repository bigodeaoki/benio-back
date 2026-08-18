import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { POOL, Pool } from '../db/database.module';
import { numeroLote } from '../shared/calculos';

const STATUS = ['preparando', 'enviado', 'entregue'];

@Injectable()
export class EnviosService {
  constructor(@Inject(POOL) private pool: Pool) {}

  async listar(empresaId: number) {
    const [rows]: any = await this.pool.query(
      `SELECT e.*, p.nome AS produto_nome, p.unidade, op.numero AS ordem_numero,
              pe.numero AS pedido_numero, pe.cliente AS pedido_cliente
       FROM envios e
       JOIN produtos p ON p.id = e.produto_id
       JOIN ordens_producao op ON op.id = e.ordem_id
       LEFT JOIN pedidos pe ON pe.id = op.pedido_id
       WHERE e.empresa_id=?
       ORDER BY FIELD(e.status,'preparando','enviado','entregue'), e.data_envio DESC, e.id DESC`,
      [empresaId],
    );
    return rows;
  }

  // Ordens que podem virar remessa, já com o cliente do pedido para preencher o destinatário
  async ordensDisponiveis(empresaId: number) {
    const [rows]: any = await this.pool.query(
      `SELECT op.id, op.numero, op.quantidade, op.status,
              p.id AS produto_id, p.nome AS produto_nome, p.unidade,
              pe.numero AS pedido_numero, pe.cliente, pe.cliente_uf,
              COALESCE((SELECT SUM(e.quantidade) FROM envios e WHERE e.ordem_id = op.id), 0) AS ja_enviado
       FROM ordens_producao op
       JOIN produtos p ON p.id = op.produto_id
       LEFT JOIN pedidos pe ON pe.id = op.pedido_id
       WHERE op.empresa_id=? AND op.status IN ('em_producao','concluida')
       ORDER BY op.numero`,
      [empresaId],
    );
    return rows.map((r: any) => ({
      ...r,
      saldo: Number(r.quantidade) - Number(r.ja_enviado),
    }));
  }

  async criar(empresaId: number, body: any) {
    const ordemId = Number(body?.ordem_id);
    const quantidade = Number(body?.quantidade);
    if (!ordemId) throw new BadRequestException('Informe a ordem de produção de origem');
    if (!(quantidade > 0)) throw new BadRequestException('Quantidade deve ser maior que zero');

    const [ordens]: any = await this.pool.query(
      'SELECT id, produto_id, quantidade FROM ordens_producao WHERE id=? AND empresa_id=?',
      [ordemId, empresaId],
    );
    if (!ordens.length) throw new NotFoundException('Ordem de produção não encontrada');

    // Não deixa despachar mais do que a ordem produziu, somando as remessas anteriores
    const [enviado]: any = await this.pool.query(
      'SELECT COALESCE(SUM(quantidade),0) AS total FROM envios WHERE ordem_id=?',
      [ordemId],
    );
    const saldo = Number(ordens[0].quantidade) - Number(enviado[0].total);
    if (quantidade > saldo) {
      throw new BadRequestException(`Saldo da ordem é de ${saldo} — reduza a quantidade do envio`);
    }

    const [res]: any = await this.pool.query(
      `INSERT INTO envios
       (empresa_id, lote, ordem_id, produto_id, quantidade, destinatario, endereco, uf,
        transportadora, rastreio, data_envio, status, observacao)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        empresaId, body.lote?.trim() || (await this.proximoLote(empresaId)),
        ordemId, ordens[0].produto_id, quantidade,
        body.destinatario || null, body.endereco || null, body.uf || null,
        body.transportadora || null, body.rastreio || null, body.data_envio || null,
        STATUS.includes(body.status) ? body.status : 'preparando',
        body.observacao || null,
      ],
    );
    return { id: res.insertId };
  }

  async atualizar(empresaId: number, id: number, body: any) {
    const [res]: any = await this.pool.query(
      `UPDATE envios SET lote=?, quantidade=?, destinatario=?, endereco=?, uf=?,
       transportadora=?, rastreio=?, data_envio=?, observacao=?
       WHERE id=? AND empresa_id=?`,
      [
        body.lote?.trim() || null, Number(body.quantidade) || 0,
        body.destinatario || null, body.endereco || null, body.uf || null,
        body.transportadora || null, body.rastreio || null, body.data_envio || null,
        body.observacao || null, id, empresaId,
      ],
    );
    if (!res.affectedRows) throw new NotFoundException('Envio não encontrado');
    return { ok: true };
  }

  async atualizarStatus(empresaId: number, id: number, status: string) {
    if (!STATUS.includes(status)) throw new BadRequestException('Status inválido');
    const [res]: any = await this.pool.query(
      'UPDATE envios SET status=? WHERE id=? AND empresa_id=?',
      [status, id, empresaId],
    );
    if (!res.affectedRows) throw new NotFoundException('Envio não encontrado');
    return { ok: true };
  }

  // Número de série sequencial por empresa
  private async proximoLote(empresaId: number) {
    const [seq]: any = await this.pool.query(
      'SELECT COUNT(*) AS c FROM envios WHERE empresa_id=?', [empresaId],
    );
    return numeroLote(seq[0].c + 1);
  }
}

import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { POOL, Pool } from '../db/database.module';

@Injectable()
export class EstoqueService {
  constructor(@Inject(POOL) private pool: Pool) {}

  async posicao(empresaId: number) {
    const [rows]: any = await this.pool.query(
      `SELECT id, nome, unidade, custo_unitario, estoque_atual, estoque_minimo
       FROM materias_primas WHERE empresa_id=? ORDER BY nome`,
      [empresaId],
    );
    return rows.map((r: any) => ({
      ...r,
      valor_estoque: Math.round(Number(r.estoque_atual) * Number(r.custo_unitario) * 100) / 100,
      situacao: Number(r.estoque_atual) <= 0 ? 'zerado' : Number(r.estoque_atual) < Number(r.estoque_minimo) ? 'abaixo_minimo' : 'ok',
    }));
  }

  async movimentos(empresaId: number, materiaPrimaId?: number) {
    const filtro = materiaPrimaId ? 'AND em.materia_prima_id=?' : '';
    const params: any[] = [empresaId];
    if (materiaPrimaId) params.push(materiaPrimaId);
    const [rows]: any = await this.pool.query(
      `SELECT em.*, mp.nome AS materia_prima_nome, mp.unidade
       FROM estoque_movimentos em JOIN materias_primas mp ON mp.id = em.materia_prima_id
       WHERE em.empresa_id=? ${filtro} ORDER BY em.data DESC, em.id DESC LIMIT 300`,
      params,
    );
    return rows;
  }

  // entrada soma; saída subtrai; ajuste define o saldo final
  async movimentar(empresaId: number, body: any) {
    const materiaPrimaId = Number(body?.materia_prima_id);
    const quantidade = Number(body?.quantidade);
    const tipo = body?.tipo;
    if (!materiaPrimaId || !['entrada', 'saida', 'ajuste'].includes(tipo)) {
      throw new BadRequestException('Informe matéria-prima e tipo (entrada/saida/ajuste)');
    }
    if (!(quantidade >= 0) || (tipo !== 'ajuste' && !(quantidade > 0))) {
      throw new BadRequestException('Quantidade inválida');
    }
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      const [mps]: any = await conn.query(
        'SELECT * FROM materias_primas WHERE id=? AND empresa_id=? FOR UPDATE',
        [materiaPrimaId, empresaId],
      );
      if (!mps.length) throw new NotFoundException('Matéria-prima não encontrada');
      const mp = mps[0];
      const saldoAtual = Number(mp.estoque_atual);
      let novoSaldo: number;
      let quantidadeMovimento = quantidade;
      if (tipo === 'entrada') novoSaldo = saldoAtual + quantidade;
      else if (tipo === 'saida') {
        if (quantidade > saldoAtual) throw new BadRequestException(`Saldo insuficiente (atual: ${saldoAtual})`);
        novoSaldo = saldoAtual - quantidade;
      } else {
        novoSaldo = quantidade; // ajuste: define o saldo
        quantidadeMovimento = quantidade - saldoAtual;
      }
      await conn.query(
        'INSERT INTO estoque_movimentos (empresa_id, materia_prima_id, tipo, quantidade, custo_unitario, origem) VALUES (?,?,?,?,?,?)',
        [empresaId, materiaPrimaId, tipo, quantidadeMovimento, body.custo_unitario ?? null, body.origem || null],
      );
      await conn.query('UPDATE materias_primas SET estoque_atual=? WHERE id=?', [novoSaldo, materiaPrimaId]);
      // entrada com custo informado atualiza o preço da matéria-prima (última compra)
      if (tipo === 'entrada' && body.custo_unitario != null && Number(body.custo_unitario) > 0) {
        await conn.query('UPDATE materias_primas SET custo_unitario=? WHERE id=?', [Number(body.custo_unitario), materiaPrimaId]);
      }
      await conn.commit();
      return { ok: true, saldo: novoSaldo };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }
}

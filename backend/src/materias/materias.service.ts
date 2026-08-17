import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { POOL, Pool } from '../db/database.module';

@Injectable()
export class MateriasService {
  constructor(@Inject(POOL) private pool: Pool) {}

  async listar(empresaId: number) {
    const [rows]: any = await this.pool.query(
      `SELECT mp.*, n.descricao AS ncm_descricao
       FROM materias_primas mp LEFT JOIN ncm n ON n.codigo = mp.ncm_codigo
       WHERE mp.empresa_id=? ORDER BY mp.nome`,
      [empresaId],
    );
    return rows;
  }

  async criar(empresaId: number, body: any) {
    if (!body?.nome) throw new BadRequestException('Nome é obrigatório');
    const [res]: any = await this.pool.query(
      `INSERT INTO materias_primas
       (empresa_id, nome, unidade, custo_unitario, rendimento_pct, ncm_codigo, estoque_atual, estoque_minimo)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        empresaId, body.nome, body.unidade || 'kg', body.custo_unitario ?? 0,
        body.rendimento_pct ?? 100, body.ncm_codigo || null,
        body.estoque_atual ?? 0, body.estoque_minimo ?? 0,
      ],
    );
    return { id: res.insertId };
  }

  async atualizar(empresaId: number, id: number, body: any) {
    await this.pool.query(
      `UPDATE materias_primas SET nome=?, unidade=?, custo_unitario=?, rendimento_pct=?, ncm_codigo=?, estoque_minimo=?
       WHERE id=? AND empresa_id=?`,
      [
        body.nome, body.unidade || 'kg', body.custo_unitario ?? 0,
        body.rendimento_pct ?? 100, body.ncm_codigo || null, body.estoque_minimo ?? 0,
        id, empresaId,
      ],
    );
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
}

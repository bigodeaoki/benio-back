import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { POOL, Pool } from '../db/database.module';

@Injectable()
export class UtilidadesService {
  constructor(@Inject(POOL) private pool: Pool) {}

  async listar(empresaId: number) {
    const [rows]: any = await this.pool.query(
      'SELECT * FROM utilidades WHERE empresa_id=? ORDER BY nome',
      [empresaId],
    );
    return rows;
  }

  async criar(empresaId: number, body: any) {
    if (!body?.nome) throw new BadRequestException('Nome é obrigatório');
    const [res]: any = await this.pool.query(
      'INSERT INTO utilidades (empresa_id, nome, tipo, unidade, custo_unitario, conta_mensal) VALUES (?,?,?,?,?,?)',
      [empresaId, body.nome, body.tipo || 'outro', body.unidade || 'un', body.custo_unitario ?? 0, body.conta_mensal ?? 0],
    );
    return { id: res.insertId };
  }

  async atualizar(empresaId: number, id: number, body: any) {
    await this.pool.query(
      'UPDATE utilidades SET nome=?, tipo=?, unidade=?, custo_unitario=?, conta_mensal=? WHERE id=? AND empresa_id=?',
      [body.nome, body.tipo || 'outro', body.unidade || 'un', body.custo_unitario ?? 0, body.conta_mensal ?? 0, id, empresaId],
    );
    return { ok: true };
  }

  async remover(empresaId: number, id: number) {
    await this.pool.query('DELETE FROM utilidades WHERE id=? AND empresa_id=?', [id, empresaId]);
    return { ok: true };
  }
}

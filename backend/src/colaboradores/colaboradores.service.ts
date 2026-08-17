import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { POOL, Pool } from '../db/database.module';
import { custoColaborador } from '../shared/calculos';

@Injectable()
export class ColaboradoresService {
  constructor(@Inject(POOL) private pool: Pool) {}

  async listar(empresaId: number) {
    const [rows]: any = await this.pool.query(
      'SELECT * FROM colaboradores WHERE empresa_id=? ORDER BY nome',
      [empresaId],
    );
    // salário total (com encargos/benefícios) e salário-hora calculados no servidor
    return rows.map((c: any) => ({ ...c, ...custoColaborador(c) }));
  }

  async criar(empresaId: number, body: any) {
    if (!body?.nome) throw new BadRequestException('Nome é obrigatório');
    const [res]: any = await this.pool.query(
      `INSERT INTO colaboradores
       (empresa_id, nome, cargo, salario_base, encargos_pct, vale_transporte, vale_alimentacao, outros_beneficios, horas_mes, ativo)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        empresaId, body.nome, body.cargo || null, body.salario_base ?? 0, body.encargos_pct ?? 70,
        body.vale_transporte ?? 0, body.vale_alimentacao ?? 0, body.outros_beneficios ?? 0,
        body.horas_mes ?? 220, body.ativo ?? 1,
      ],
    );
    return { id: res.insertId };
  }

  async atualizar(empresaId: number, id: number, body: any) {
    await this.pool.query(
      `UPDATE colaboradores SET nome=?, cargo=?, salario_base=?, encargos_pct=?, vale_transporte=?,
       vale_alimentacao=?, outros_beneficios=?, horas_mes=?, ativo=? WHERE id=? AND empresa_id=?`,
      [
        body.nome, body.cargo || null, body.salario_base ?? 0, body.encargos_pct ?? 70,
        body.vale_transporte ?? 0, body.vale_alimentacao ?? 0, body.outros_beneficios ?? 0,
        body.horas_mes ?? 220, body.ativo ?? 1, id, empresaId,
      ],
    );
    return { ok: true };
  }

  async remover(empresaId: number, id: number) {
    await this.pool.query('DELETE FROM colaboradores WHERE id=? AND empresa_id=?', [id, empresaId]);
    return { ok: true };
  }
}

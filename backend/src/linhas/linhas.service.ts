import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { POOL, Pool } from '../db/database.module';
import { custoColaborador, round4 } from '../shared/calculos';

@Injectable()
export class LinhasService {
  constructor(@Inject(POOL) private pool: Pool) {}

  async listar(empresaId: number) {
    const [linhas]: any = await this.pool.query(
      'SELECT * FROM linhas_processo WHERE empresa_id=? ORDER BY nome',
      [empresaId],
    );
    if (!linhas.length) return [];
    const ids = linhas.map((l: any) => l.id);
    const [equipamentos]: any = await this.pool.query(
      'SELECT * FROM linha_equipamentos WHERE linha_id IN (?) ORDER BY id', [ids],
    );
    const [colabs]: any = await this.pool.query(
      `SELECT lc.linha_id, lc.usuario_id, lc.dedicacao_pct, c.nome, c.cargo,
              c.salario_base, c.encargos_pct, c.vale_transporte, c.vale_alimentacao, c.outros_beneficios, c.horas_mes
       FROM linha_usuarios lc JOIN usuarios c ON c.id = lc.usuario_id
       WHERE lc.linha_id IN (?) AND c.ativo = 1 ORDER BY c.nome`, [ids],
    );
    const [utils]: any = await this.pool.query(
      `SELECT lu.linha_id, lu.utilidade_id, lu.consumo_hora, u.nome, u.unidade, u.custo_unitario, u.tipo
       FROM linha_utilidades lu JOIN utilidades u ON u.id = lu.utilidade_id
       WHERE lu.linha_id IN (?) ORDER BY u.nome`, [ids],
    );
    return linhas.map((l: any) => {
      const equipe = colabs
        .filter((c: any) => c.linha_id === l.id)
        .map((c: any) => {
          const { custo_hora } = custoColaborador(c);
          return {
            usuario_id: c.usuario_id,
            nome: c.nome,
            cargo: c.cargo,
            dedicacao_pct: Number(c.dedicacao_pct),
            custo_hora,
            custo_hora_efetivo: round4(custo_hora * (Number(c.dedicacao_pct) / 100)),
          };
        });
      const consumos = utils
        .filter((u: any) => u.linha_id === l.id)
        .map((u: any) => ({
          utilidade_id: u.utilidade_id,
          nome: u.nome,
          tipo: u.tipo,
          unidade: u.unidade,
          custo_unitario: Number(u.custo_unitario),
          consumo_hora: Number(u.consumo_hora),
          custo_hora: round4(Number(u.consumo_hora) * Number(u.custo_unitario)),
        }));
      return {
        ...l,
        equipamentos: equipamentos.filter((e: any) => e.linha_id === l.id),
        funcionarios: equipe,
        utilidades: consumos,
        custo_hora_mao_de_obra: round4(equipe.reduce((s: number, c: any) => s + c.custo_hora_efetivo, 0)),
        custo_hora_utilidades: round4(consumos.reduce((s: number, u: any) => s + u.custo_hora, 0)),
      };
    });
  }

  async criar(empresaId: number, body: any) {
    if (!body?.nome) throw new BadRequestException('Nome da linha é obrigatório');
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      const [res]: any = await conn.query(
        `INSERT INTO linhas_processo
         (empresa_id, nome, descricao, producao_hora, unidade_producao, rendimento_pct, horas_disponiveis_semana, ativa)
         VALUES (?,?,?,?,?,?,?,?)`,
        [
          empresaId, body.nome, body.descricao || null, body.producao_hora ?? 0,
          body.unidade_producao || 'un', body.rendimento_pct ?? 100,
          body.horas_disponiveis_semana ?? 44, body.ativa ?? 1,
        ],
      );
      await this.salvarFilhos(conn, res.insertId, body);
      await conn.commit();
      return { id: res.insertId };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  async atualizar(empresaId: number, id: number, body: any) {
    const [existe]: any = await this.pool.query(
      'SELECT id FROM linhas_processo WHERE id=? AND empresa_id=?', [id, empresaId],
    );
    if (!existe.length) throw new NotFoundException('Linha não encontrada');
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        `UPDATE linhas_processo SET nome=?, descricao=?, producao_hora=?, unidade_producao=?,
         rendimento_pct=?, horas_disponiveis_semana=?, ativa=? WHERE id=?`,
        [
          body.nome, body.descricao || null, body.producao_hora ?? 0, body.unidade_producao || 'un',
          body.rendimento_pct ?? 100, body.horas_disponiveis_semana ?? 44, body.ativa ?? 1, id,
        ],
      );
      await conn.query('DELETE FROM linha_equipamentos WHERE linha_id=?', [id]);
      await conn.query('DELETE FROM linha_usuarios WHERE linha_id=?', [id]);
      await conn.query('DELETE FROM linha_utilidades WHERE linha_id=?', [id]);
      await this.salvarFilhos(conn, id, body);
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
    await this.pool.query('DELETE FROM linhas_processo WHERE id=? AND empresa_id=?', [id, empresaId]);
    return { ok: true };
  }

  private async salvarFilhos(conn: any, linhaId: number, body: any) {
    for (const e of body.equipamentos || []) {
      if (!e?.nome) continue;
      await conn.query(
        'INSERT INTO linha_equipamentos (linha_id, nome, potencia_kw, observacao) VALUES (?,?,?,?)',
        [linhaId, e.nome, e.potencia_kw ?? 0, e.observacao || null],
      );
    }
    for (const c of body.funcionarios || []) {
      if (!c?.usuario_id) continue;
      await conn.query(
        'INSERT IGNORE INTO linha_usuarios (linha_id, usuario_id, dedicacao_pct) VALUES (?,?,?)',
        [linhaId, Number(c.usuario_id), c.dedicacao_pct ?? 100],
      );
    }
    for (const u of body.utilidades || []) {
      if (!u?.utilidade_id) continue;
      await conn.query(
        'INSERT IGNORE INTO linha_utilidades (linha_id, utilidade_id, consumo_hora) VALUES (?,?,?)',
        [linhaId, Number(u.utilidade_id), u.consumo_hora ?? 0],
      );
    }
  }
}

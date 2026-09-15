import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { POOL, Pool } from '../db/database.module';
import { custoColaborador, round4 } from '../shared/calculos';

// Envase: etapa de envase/embalagem que a linha de processo pode ter (várias
// por linha). Tudo aqui é "por hora de envase": funcionários (custo-hora ×
// dedicação), equipamentos (kW × preço do kWh da utilidade de energia da
// empresa) e matérias-primas consumidas por hora (× custo médio do estoque).
// O rendimento entra nos materiais (perda de embalagem/produto), como o
// rendimento da linha entra na fórmula. O total em R$/h alimenta a linha e o
// custo do produto (× horas do lote).
@Injectable()
export class EnvasesService {
  constructor(@Inject(POOL) private pool: Pool) {}

  // Custo por hora de cada envase — estático porque linhas e custos precisam
  // do mesmo número, às vezes dentro da transação deles
  static async custos(conn: any, empresaId: number, envaseIds?: number[]) {
    const mapa = new Map<number, any>();
    if (envaseIds && !envaseIds.length) return mapa;
    const filtro = envaseIds ? 'AND e.id IN (?)' : '';
    const params: any[] = [empresaId];
    if (envaseIds) params.push(envaseIds);
    const [envases]: any = await conn.query(
      `SELECT e.* FROM envases e WHERE e.empresa_id=? ${filtro} ORDER BY e.titulo`, params,
    );
    if (!envases.length) return mapa;
    const ids = envases.map((e: any) => e.id);

    // Preço da energia: primeira utilidade do tipo energia da empresa
    const [energia]: any = await conn.query(
      "SELECT nome, custo_unitario FROM utilidades WHERE empresa_id=? AND tipo='energia' ORDER BY id LIMIT 1",
      [empresaId],
    );
    const precoKwh = energia.length ? Number(energia[0].custo_unitario) : 0;

    const [equipamentos]: any = await conn.query(
      'SELECT * FROM envase_equipamentos WHERE envase_id IN (?) ORDER BY id', [ids],
    );
    const [colabs]: any = await conn.query(
      `SELECT ec.envase_id, ec.usuario_id, ec.dedicacao_pct, c.nome, c.cargo,
              c.salario_base, c.encargos_pct, c.vale_transporte, c.vale_alimentacao, c.outros_beneficios, c.horas_mes
         FROM envase_usuarios ec JOIN usuarios c ON c.id = ec.usuario_id
        WHERE ec.envase_id IN (?) AND c.ativo = 1 ORDER BY c.nome`, [ids],
    );
    const [materias]: any = await conn.query(
      `SELECT em.envase_id, em.materia_prima_id, em.quantidade_hora, mp.nome, mp.unidade, mp.custo_unitario
         FROM envase_materias em JOIN materias_primas mp ON mp.id = em.materia_prima_id
        WHERE em.envase_id IN (?) ORDER BY mp.nome`, [ids],
    );

    for (const e of envases) {
      const funcionarios = colabs
        .filter((c: any) => c.envase_id === e.id)
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
      const equips = equipamentos
        .filter((q: any) => q.envase_id === e.id)
        .map((q: any) => ({
          id: q.id,
          nome: q.nome,
          potencia_kw: Number(q.potencia_kw),
          observacao: q.observacao,
          custo_hora_energia: round4(Number(q.potencia_kw) * precoKwh),
        }));
      const mats = materias
        .filter((m: any) => m.envase_id === e.id)
        .map((m: any) => ({
          materia_prima_id: m.materia_prima_id,
          nome: m.nome,
          unidade: m.unidade,
          quantidade_hora: Number(m.quantidade_hora),
          custo_unitario: Number(m.custo_unitario),
          custo_hora: round4(Number(m.quantidade_hora) * Number(m.custo_unitario)),
        }));
      const rendimento = Number(e.rendimento_pct) > 0 ? Number(e.rendimento_pct) : 100;
      const maoDeObra = funcionarios.reduce((s: number, c: any) => s + c.custo_hora_efetivo, 0);
      const energiaHora = equips.reduce((s: number, q: any) => s + q.custo_hora_energia, 0);
      const materiaisBruto = mats.reduce((s: number, m: any) => s + m.custo_hora, 0);
      const materiais = materiaisBruto / (rendimento / 100);
      mapa.set(e.id, {
        ...e,
        rendimento_pct: Number(e.rendimento_pct),
        funcionarios,
        equipamentos: equips,
        materias: mats,
        preco_kwh: precoKwh,
        energia_nome: energia[0]?.nome || null,
        custo_hora_mao_de_obra: round4(maoDeObra),
        custo_hora_energia: round4(energiaHora),
        custo_hora_materiais_bruto: round4(materiaisBruto),
        perda_rendimento_hora: round4(materiais - materiaisBruto),
        custo_hora_materiais: round4(materiais),
        custo_hora_total: round4(maoDeObra + energiaHora + materiais),
      });
    }
    return mapa;
  }

  // Lista com custos e em quais linhas cada envase é usado
  async listar(empresaId: number) {
    const mapa = await EnvasesService.custos(this.pool, empresaId);
    const ids = [...mapa.keys()];
    let usos: any[] = [];
    if (ids.length) {
      const [rows]: any = await this.pool.query(
        `SELECT le.envase_id, l.id, l.nome
           FROM linha_envases le JOIN linhas_processo l ON l.id = le.linha_id
          WHERE le.envase_id IN (?) ORDER BY l.nome`, [ids],
      );
      usos = rows;
    }
    return [...mapa.values()].map((e: any) => ({
      ...e,
      linhas: usos.filter((u) => u.envase_id === e.id).map((u) => ({ id: u.id, nome: u.nome })),
    }));
  }

  async criar(empresaId: number, body: any) {
    const dados = this.validar(body);
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      const [res]: any = await conn.query(
        'INSERT INTO envases (empresa_id, titulo, descricao, rendimento_pct, ativo) VALUES (?,?,?,?,?)',
        [empresaId, dados.titulo, dados.descricao, dados.rendimento_pct, dados.ativo],
      );
      await this.salvarFilhos(conn, empresaId, res.insertId, body);
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
    const [existe]: any = await this.pool.query('SELECT id FROM envases WHERE id=? AND empresa_id=?', [id, empresaId]);
    if (!existe.length) throw new NotFoundException('Envase não encontrado');
    const dados = this.validar(body);
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        'UPDATE envases SET titulo=?, descricao=?, rendimento_pct=?, ativo=? WHERE id=?',
        [dados.titulo, dados.descricao, dados.rendimento_pct, dados.ativo, id],
      );
      await conn.query('DELETE FROM envase_equipamentos WHERE envase_id=?', [id]);
      await conn.query('DELETE FROM envase_usuarios WHERE envase_id=?', [id]);
      await conn.query('DELETE FROM envase_materias WHERE envase_id=?', [id]);
      await this.salvarFilhos(conn, empresaId, id, body);
      await conn.commit();
      return { ok: true };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  // Remover tira o envase das linhas que o usavam (cascata em linha_envases)
  async remover(empresaId: number, id: number) {
    const [res]: any = await this.pool.query('DELETE FROM envases WHERE id=? AND empresa_id=?', [id, empresaId]);
    if (!res.affectedRows) throw new NotFoundException('Envase não encontrado');
    return { ok: true };
  }

  private validar(body: any) {
    const titulo = String(body?.titulo || '').trim();
    if (titulo.length < 2) throw new BadRequestException('Informe o título do envase (ex.: Envase pote 400 g)');
    const rendimento = body?.rendimento_pct === '' || body?.rendimento_pct == null ? 100 : Number(body.rendimento_pct);
    if (!(rendimento > 0) || rendimento > 100) throw new BadRequestException('Rendimento deve ficar entre 0 e 100%');
    return {
      titulo,
      descricao: String(body?.descricao || '').trim() || null,
      rendimento_pct: rendimento,
      ativo: body?.ativo === 0 || body?.ativo === false ? 0 : 1,
    };
  }

  private async salvarFilhos(conn: any, empresaId: number, envaseId: number, body: any) {
    for (const q of body?.equipamentos || []) {
      const nome = String(q?.nome || '').trim();
      if (!nome) continue;
      const kw = Number(q?.potencia_kw) || 0;
      if (kw < 0) throw new BadRequestException(`Potência do equipamento "${nome}" não pode ser negativa`);
      await conn.query(
        'INSERT INTO envase_equipamentos (envase_id, nome, potencia_kw, observacao) VALUES (?,?,?,?)',
        [envaseId, nome, kw, String(q?.observacao || '').trim() || null],
      );
    }
    for (const c of body?.funcionarios || []) {
      if (!c?.usuario_id) continue;
      const dedicacao = c?.dedicacao_pct === '' || c?.dedicacao_pct == null ? 100 : Number(c.dedicacao_pct);
      if (!(dedicacao >= 0)) throw new BadRequestException('Dedicação do funcionário deve ser um percentual');
      await conn.query(
        'INSERT IGNORE INTO envase_usuarios (envase_id, usuario_id, dedicacao_pct) VALUES (?,?,?)',
        [envaseId, Number(c.usuario_id), dedicacao],
      );
    }
    const materias = (body?.materias || []).filter((m: any) => m?.materia_prima_id);
    if (materias.length) {
      // Só matéria-prima da própria empresa entra no envase
      const idsMp = [...new Set(materias.map((m: any) => Number(m.materia_prima_id)))];
      const [validas]: any = await conn.query(
        'SELECT id FROM materias_primas WHERE id IN (?) AND empresa_id=?', [idsMp, empresaId],
      );
      const permitidas = new Set(validas.map((v: any) => v.id));
      for (const m of materias) {
        const mpId = Number(m.materia_prima_id);
        if (!permitidas.has(mpId)) throw new BadRequestException(`Matéria-prima de id ${mpId} não pertence a esta empresa`);
        const qtd = Number(m?.quantidade_hora) || 0;
        if (qtd < 0) throw new BadRequestException('Quantidade por hora não pode ser negativa');
        await conn.query(
          `INSERT INTO envase_materias (envase_id, materia_prima_id, quantidade_hora) VALUES (?,?,?)
           ON DUPLICATE KEY UPDATE quantidade_hora = VALUES(quantidade_hora)`,
          [envaseId, mpId, qtd],
        );
      }
    }
  }
}

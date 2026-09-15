import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { POOL, Pool } from '../db/database.module';

// Filial: escopo abaixo da empresa (matriz, unidade, planta). O usuário é
// vinculado à empresa e, dentro dela, às filiais em que participa. Não se
// exclui filial — inativa-se — porque ela vai referenciar auditoria.
@Injectable()
export class FiliaisService {
  constructor(@Inject(POOL) private pool: Pool) {}

  // Filiais das empresas que o usuário logado acessa (admin: todas)
  async listar(empresaIds: number[]) {
    if (!empresaIds?.length) return [];
    const [rows]: any = await this.pool.query(
      `SELECT f.id, f.empresa_id, f.nome, f.codigo, f.municipio, f.uf, f.ativa, f.criado_em,
              COALESCE(e.nome_fantasia, e.razao_social) AS empresa_nome,
              (SELECT COUNT(*) FROM usuario_filiais uf WHERE uf.filial_id = f.id) AS usuarios
       FROM filiais f
       JOIN empresas e ON e.id = f.empresa_id
       WHERE f.empresa_id IN (?)
       ORDER BY f.empresa_id, f.ativa DESC, f.nome`,
      [empresaIds],
    );
    return rows;
  }

  async criar(empresaIds: number[], body: any) {
    const empresaId = Number(body?.empresa_id);
    if (!empresaIds.includes(empresaId)) throw new BadRequestException('Empresa inválida');
    const dados = this.validar(body);
    const [res]: any = await this.pool.query(
      'INSERT INTO filiais (empresa_id, nome, codigo, municipio, uf) VALUES (?,?,?,?,?)',
      [empresaId, dados.nome, dados.codigo, dados.municipio, dados.uf],
    ).catch((e: any) => this.traduzirDuplicada(e));
    return { id: res.insertId };
  }

  // A empresa da filial não muda: mover unidade entre empresas quebraria a auditoria
  async atualizar(empresaIds: number[], id: number, body: any) {
    await this.buscar(empresaIds, id);
    const dados = this.validar(body);
    await this.pool.query(
      'UPDATE filiais SET nome=?, codigo=?, municipio=?, uf=? WHERE id=?',
      [dados.nome, dados.codigo, dados.municipio, dados.uf, id],
    ).catch((e: any) => this.traduzirDuplicada(e));
    return { ok: true };
  }

  // Sem exclusão física: inativa (some das escolhas, mas os vínculos ficam)
  async alterarAtiva(empresaIds: number[], id: number, ativa: boolean) {
    await this.buscar(empresaIds, id);
    await this.pool.query('UPDATE filiais SET ativa=? WHERE id=?', [ativa ? 1 : 0, id]);
    return { ok: true, ativa };
  }

  private async buscar(empresaIds: number[], id: number) {
    const [rows]: any = await this.pool.query(
      'SELECT id, empresa_id FROM filiais WHERE id=? AND empresa_id IN (?)',
      [id, empresaIds?.length ? empresaIds : [0]],
    );
    if (!rows[0]) throw new BadRequestException('Filial não encontrada');
    return rows[0];
  }

  private validar(body: any) {
    const nome = String(body?.nome || '').trim();
    if (nome.length < 2) throw new BadRequestException('Informe o nome da filial (ex.: Matriz, Filial Guarulhos)');
    if (nome.length > 120) throw new BadRequestException('Nome da filial deve ter até 120 caracteres');
    const codigo = String(body?.codigo || '').trim() || null;
    if (codigo && codigo.length > 20) throw new BadRequestException('Código da filial deve ter até 20 caracteres');
    const municipio = String(body?.municipio || '').trim() || null;
    const uf = String(body?.uf || '').trim().toUpperCase() || null;
    if (uf && !/^[A-Z]{2}$/.test(uf)) throw new BadRequestException('UF inválida');
    return { nome, codigo, municipio, uf };
  }

  private traduzirDuplicada(e: any): never {
    if (e?.code === 'ER_DUP_ENTRY') throw new BadRequestException('Já existe filial com este nome nesta empresa');
    throw e;
  }
}

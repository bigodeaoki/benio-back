import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { POOL, Pool } from '../db/database.module';

@Injectable()
export class UsuariosService {
  constructor(@Inject(POOL) private pool: Pool) {}

  async listar() {
    const [rows]: any = await this.pool.query(
      'SELECT id, nome, email, papel, ativo, criado_em FROM usuarios ORDER BY nome',
    );
    const [vinculos]: any = await this.pool.query('SELECT usuario_id, empresa_id FROM usuario_empresas');
    return rows.map((u: any) => ({
      ...u,
      empresa_ids: vinculos.filter((v: any) => v.usuario_id === u.id).map((v: any) => v.empresa_id),
    }));
  }

  async criar(body: any) {
    if (!body?.nome || !body?.email || !body?.senha) {
      throw new BadRequestException('Nome, e-mail e senha são obrigatórios');
    }
    const hash = await bcrypt.hash(String(body.senha), 10);
    const [res]: any = await this.pool.query(
      'INSERT INTO usuarios (nome, email, senha_hash, papel, ativo) VALUES (?,?,?,?,?)',
      [body.nome, String(body.email).trim().toLowerCase(), hash, body.papel || 'gestor', body.ativo ?? 1],
    ).catch((e: any) => {
      if (e?.code === 'ER_DUP_ENTRY') throw new BadRequestException('Já existe usuário com este e-mail');
      throw e;
    });
    await this.vincular(res.insertId, body.empresa_ids);
    return { id: res.insertId };
  }

  async atualizar(id: number, body: any) {
    await this.pool.query(
      'UPDATE usuarios SET nome=?, email=?, papel=?, ativo=? WHERE id=?',
      [body.nome, String(body.email).trim().toLowerCase(), body.papel || 'gestor', body.ativo ?? 1, id],
    );
    if (body.senha) {
      const hash = await bcrypt.hash(String(body.senha), 10);
      await this.pool.query('UPDATE usuarios SET senha_hash=? WHERE id=?', [hash, id]);
    }
    await this.vincular(id, body.empresa_ids);
    return { ok: true };
  }

  async remover(id: number, usuarioLogadoId: number) {
    if (id === usuarioLogadoId) throw new BadRequestException('Você não pode remover o próprio usuário');
    await this.pool.query('DELETE FROM usuarios WHERE id=?', [id]);
    return { ok: true };
  }

  private async vincular(usuarioId: number, empresaIds: any) {
    if (!Array.isArray(empresaIds)) return;
    await this.pool.query('DELETE FROM usuario_empresas WHERE usuario_id=?', [usuarioId]);
    for (const e of empresaIds) {
      await this.pool.query('INSERT IGNORE INTO usuario_empresas (usuario_id, empresa_id) VALUES (?,?)', [usuarioId, Number(e)]);
    }
  }
}

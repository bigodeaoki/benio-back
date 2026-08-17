import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { POOL, Pool } from '../db/database.module';
import { TODOS_PAPEIS } from '../auth/papeis';

@Injectable()
export class UsuariosService {
  constructor(@Inject(POOL) private pool: Pool) {}

  async listar() {
    const [rows]: any = await this.pool.query(
      'SELECT id, nome, email, telefone, documento, papel, ativo, criado_em FROM usuarios ORDER BY nome',
    );
    const [vinculos]: any = await this.pool.query('SELECT usuario_id, empresa_id FROM usuario_empresas');
    return rows.map((u: any) => ({
      ...u,
      empresa_ids: vinculos.filter((v: any) => v.usuario_id === u.id).map((v: any) => v.empresa_id),
    }));
  }

  async criar(body: any) {
    const dados = this.validar(body, { senhaObrigatoria: true });
    const hash = await bcrypt.hash(String(body.senha), 10);
    const [res]: any = await this.pool.query(
      'INSERT INTO usuarios (nome, email, telefone, documento, senha_hash, papel, ativo) VALUES (?,?,?,?,?,?,?)',
      [dados.nome, dados.email, dados.telefone, dados.documento, hash, dados.papel, body.ativo ?? 1],
    ).catch((e: any) => {
      if (e?.code === 'ER_DUP_ENTRY') throw new BadRequestException('Já existe usuário com este e-mail');
      throw e;
    });
    await this.vincular(res.insertId, dados.papel, body.empresa_ids);
    return { id: res.insertId };
  }

  async atualizar(id: number, body: any) {
    const dados = this.validar(body, { senhaObrigatoria: false });
    await this.pool.query(
      'UPDATE usuarios SET nome=?, email=?, telefone=?, documento=?, papel=?, ativo=? WHERE id=?',
      [dados.nome, dados.email, dados.telefone, dados.documento, dados.papel, body.ativo ?? 1, id],
    ).catch((e: any) => {
      if (e?.code === 'ER_DUP_ENTRY') throw new BadRequestException('Já existe usuário com este e-mail');
      throw e;
    });
    if (body.senha) {
      this.validarSenha(body.senha);
      const hash = await bcrypt.hash(String(body.senha), 10);
      await this.pool.query('UPDATE usuarios SET senha_hash=? WHERE id=?', [hash, id]);
    }
    await this.vincular(id, dados.papel, body.empresa_ids);
    return { ok: true };
  }

  async remover(id: number, usuarioLogadoId: number) {
    if (id === usuarioLogadoId) throw new BadRequestException('Você não pode remover o próprio usuário');
    await this.pool.query('DELETE FROM usuarios WHERE id=?', [id]);
    return { ok: true };
  }

  // Todos os campos são obrigatórios — cada papel carrega restrições de acesso
  private validar(body: any, opts: { senhaObrigatoria: boolean }) {
    const nome = String(body?.nome || '').trim();
    if (nome.length < 3 || !nome.includes(' ')) {
      throw new BadRequestException('Informe o nome completo (nome e sobrenome)');
    }
    const email = String(body?.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('E-mail inválido');
    }
    const telefone = String(body?.telefone || '').replace(/\D/g, '');
    if (telefone.length < 10 || telefone.length > 15) {
      throw new BadRequestException('Telefone inválido — informe DDD + número (10 a 15 dígitos)');
    }
    const documento = this.validarDocumento(body?.documento);
    if (opts.senhaObrigatoria) this.validarSenha(body?.senha);
    const papel = String(body?.papel || '');
    if (!TODOS_PAPEIS.includes(papel)) {
      throw new BadRequestException(`Papel inválido — use um destes: ${TODOS_PAPEIS.join(', ')}`);
    }
    if (papel !== 'admin') {
      const empresas = Array.isArray(body?.empresa_ids) ? body.empresa_ids.filter(Boolean) : [];
      if (!empresas.length) {
        throw new BadRequestException('Vincule ao menos uma empresa (apenas admin acessa todas automaticamente)');
      }
    }
    return { nome, email, telefone, documento, papel };
  }

  private validarSenha(senha: any) {
    if (String(senha || '').length < 6) {
      throw new BadRequestException('Senha deve ter ao menos 6 caracteres');
    }
  }

  // Número de documento obrigatório; com 11 dígitos é tratado como CPF e valida os dígitos verificadores
  private validarDocumento(valor: any): string {
    const documento = String(valor || '').replace(/[.\-\/\s]/g, '').toUpperCase();
    if (documento.length < 4 || documento.length > 20) {
      throw new BadRequestException('Número de documento é obrigatório (CPF, RG ou passaporte)');
    }
    if (/^\d{11}$/.test(documento)) {
      if (/^(\d)\1{10}$/.test(documento) || !this.cpfValido(documento)) {
        throw new BadRequestException('CPF inválido — dígitos verificadores não conferem');
      }
    }
    return documento;
  }

  private cpfValido(cpf: string): boolean {
    const dv = (tamanho: number) => {
      let soma = 0;
      for (let i = 0; i < tamanho; i++) soma += Number(cpf[i]) * (tamanho + 1 - i);
      const resto = (soma * 10) % 11;
      return resto === 10 ? 0 : resto;
    };
    return dv(9) === Number(cpf[9]) && dv(10) === Number(cpf[10]);
  }

  private async vincular(usuarioId: number, papel: string, empresaIds: any) {
    if (!Array.isArray(empresaIds)) return;
    await this.pool.query('DELETE FROM usuario_empresas WHERE usuario_id=?', [usuarioId]);
    if (papel === 'admin') return; // admin acessa todas as empresas
    for (const e of empresaIds) {
      await this.pool.query('INSERT IGNORE INTO usuario_empresas (usuario_id, empresa_id) VALUES (?,?)', [usuarioId, Number(e)]);
    }
  }
}

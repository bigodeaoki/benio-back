import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { POOL, Pool } from '../db/database.module';
import { TODOS_PAPEIS } from '../auth/papeis';
import { custoColaborador } from '../shared/calculos';

@Injectable()
export class UsuariosService {
  constructor(@Inject(POOL) private pool: Pool) {}

  async listar() {
    const [rows]: any = await this.pool.query(
      `SELECT id, nome, email, telefone, documento, papel, ativo, criado_em,
              cargo, salario_base, encargos_pct, vale_transporte, vale_alimentacao, outros_beneficios, horas_mes
       FROM usuarios ORDER BY nome`,
    );
    const [vinculos]: any = await this.pool.query('SELECT usuario_id, empresa_id FROM usuario_empresas');
    return rows.map((u: any) => ({
      ...u,
      ...custoColaborador(u),
      empresa_ids: vinculos.filter((v: any) => v.usuario_id === u.id).map((v: any) => v.empresa_id),
    }));
  }

  // Funcionários vinculáveis às linhas de processo: usuários ativos da empresa ativa
  async equipe(empresaId: number) {
    const [rows]: any = await this.pool.query(
      `SELECT u.id, u.nome, u.cargo, u.salario_base, u.encargos_pct, u.vale_transporte,
              u.vale_alimentacao, u.outros_beneficios, u.horas_mes
       FROM usuarios u
       JOIN usuario_empresas ue ON ue.usuario_id = u.id AND ue.empresa_id = ?
       WHERE u.ativo = 1 ORDER BY u.nome`,
      [empresaId],
    );
    return rows.map((u: any) => ({
      id: u.id,
      nome: u.nome,
      cargo: u.cargo,
      custo_hora: custoColaborador(u).custo_hora,
    }));
  }

  async criar(body: any) {
    const dados = this.validar(body, { senhaObrigatoria: true });
    const hash = await bcrypt.hash(String(body.senha), 10);
    const [res]: any = await this.pool.query(
      `INSERT INTO usuarios (nome, email, telefone, documento, senha_hash, papel, ativo,
        cargo, salario_base, encargos_pct, vale_transporte, vale_alimentacao, outros_beneficios, horas_mes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        dados.nome, dados.email, dados.telefone, dados.documento, hash, dados.papel, body.ativo ?? 1,
        body.cargo || null, body.salario_base ?? 0, body.encargos_pct ?? 70,
        body.vale_transporte ?? 0, body.vale_alimentacao ?? 0, body.outros_beneficios ?? 0, body.horas_mes ?? 220,
      ],
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
      `UPDATE usuarios SET nome=?, email=?, telefone=?, documento=?, papel=?, ativo=?,
        cargo=?, salario_base=?, encargos_pct=?, vale_transporte=?, vale_alimentacao=?, outros_beneficios=?, horas_mes=?
       WHERE id=?`,
      [
        dados.nome, dados.email, dados.telefone, dados.documento, dados.papel, body.ativo ?? 1,
        body.cargo || null, body.salario_base ?? 0, body.encargos_pct ?? 70,
        body.vale_transporte ?? 0, body.vale_alimentacao ?? 0, body.outros_beneficios ?? 0, body.horas_mes ?? 220,
        id,
      ],
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

  // Usuários nunca são excluídos — inativação preserva o histórico (documentos, auditoria)
  async alterarAtivo(id: number, usuarioLogadoId: number, ativo: boolean) {
    if (id === usuarioLogadoId && !ativo) {
      throw new BadRequestException('Você não pode inativar o próprio usuário');
    }
    const [res]: any = await this.pool.query('UPDATE usuarios SET ativo=? WHERE id=?', [ativo ? 1 : 0, id]);
    if (!res.affectedRows) throw new BadRequestException('Usuário não encontrado');
    return { ok: true, ativo };
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

  // ------------------------------------------------------------------
  // Importação em lote. Valida linha a linha com as mesmas regras do
  // cadastro individual e devolve o resultado por linha, para a tela
  // mostrar a conferência antes de gravar (dry_run) e depois do commit.
  // Só aqui salário e encargos são obrigatórios: quem entra por lote vai
  // para as linhas de processo, e salário zerado falsearia o custo-hora.
  // ------------------------------------------------------------------
  async importar(body: any) {
    const linhas = Array.isArray(body?.usuarios) ? body.usuarios : [];
    if (!linhas.length) throw new BadRequestException('Nenhuma linha para importar');
    if (linhas.length > 500) throw new BadRequestException('Importe no máximo 500 usuários por vez');
    const dryRun = body?.dry_run !== false;
    const senhaPadrao = String(body?.senha_padrao || '');

    const [empresas]: any = await this.pool.query('SELECT id, razao_social, nome_fantasia FROM empresas');
    const [existentes]: any = await this.pool.query('SELECT LOWER(email) AS email FROM usuarios');
    const emailsNoBanco = new Set(existentes.map((e: any) => e.email));
    const emailsNoArquivo = new Set<string>();

    const resultados = linhas.map((u: any, i: number) => {
      const numero = Number(u?.__linha) || i + 1;
      try {
        const salario = u?.salario_base;
        if (salario === '' || salario == null || !(Number(salario) >= 0)) {
          throw new BadRequestException('Salário base é obrigatório na importação');
        }
        const encargos = u?.encargos_pct;
        if (encargos === '' || encargos == null || !(Number(encargos) >= 0)) {
          throw new BadRequestException('Encargos (%) é obrigatório na importação');
        }

        const empresaIds = this.resolverEmpresas(u, empresas, body?.empresa_ids);
        const dados = this.validar(
          { ...u, senha: u?.senha || senhaPadrao, empresa_ids: empresaIds },
          { senhaObrigatoria: true },
        );
        if (emailsNoBanco.has(dados.email)) throw new BadRequestException('Já existe usuário com este e-mail');
        if (emailsNoArquivo.has(dados.email)) throw new BadRequestException('E-mail repetido dentro do arquivo');
        emailsNoArquivo.add(dados.email);

        return {
          linha: numero,
          ok: true,
          nome: dados.nome,
          email: dados.email,
          papel: dados.papel,
          empresa_ids: empresaIds,
          _dados: { ...u, ...dados, senha: u?.senha || senhaPadrao, empresa_ids: empresaIds },
        };
      } catch (e: any) {
        return { linha: numero, ok: false, nome: u?.nome || '', email: u?.email || '', erro: e?.message || 'Linha inválida' };
      }
    });

    const validos = resultados.filter((r: any) => r.ok);
    if (!dryRun) {
      for (const r of validos as any[]) {
        await this.criar(r._dados);
      }
    }
    return {
      dry_run: dryRun,
      total: resultados.length,
      importados: dryRun ? 0 : validos.length,
      validos: validos.length,
      invalidos: resultados.length - validos.length,
      linhas: resultados.map(({ _dados, ...r }: any) => r),
    };
  }

  // Empresas da linha: coluna 'empresas' (nomes ou ids separados por ; ou |)
  // quando vier preenchida; senão, as escolhidas no modal da importação
  private resolverEmpresas(u: any, empresas: any[], padrao: any): number[] {
    const bruto = String(u?.empresas ?? u?.empresa ?? '').trim();
    if (!bruto) return Array.isArray(padrao) ? padrao.map(Number).filter(Boolean) : [];
    const chave = (v: any) => String(v || '').trim().toLowerCase();
    return bruto
      .split(/[;|]/)
      .map((parte) => parte.trim())
      .filter(Boolean)
      .map((parte) => {
        if (/^\d+$/.test(parte)) {
          const porId = empresas.find((e) => e.id === Number(parte));
          if (!porId) throw new BadRequestException(`Empresa de id ${parte} não existe`);
          return porId.id;
        }
        const achada = empresas.find(
          (e) => chave(e.nome_fantasia) === chave(parte) || chave(e.razao_social) === chave(parte),
        );
        if (!achada) throw new BadRequestException(`Empresa "${parte}" não encontrada`);
        return achada.id;
      });
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

import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as ExcelJS from 'exceljs';
import { POOL, Pool } from '../db/database.module';
import { TODOS_PAPEIS } from '../auth/papeis';
import { custoColaborador } from '../shared/calculos';
import { EmpresasService } from '../empresas/empresas.service';
import { FiliaisService } from '../filiais/filiais.service';

@Injectable()
export class UsuariosService {
  constructor(
    @Inject(POOL) private pool: Pool,
    private empresasService: EmpresasService,
    private filiaisService: FiliaisService,
  ) {}

  async listar() {
    const [rows]: any = await this.pool.query(
      `SELECT id, nome, email, telefone, documento, papel, ativo, criado_em,
              cargo, salario_base, encargos_pct, vale_transporte, vale_alimentacao, outros_beneficios, horas_mes
       FROM usuarios ORDER BY nome`,
    );
    const [vinculos]: any = await this.pool.query('SELECT usuario_id, empresa_id FROM usuario_empresas');
    const [vinculosFiliais]: any = await this.pool.query('SELECT usuario_id, filial_id FROM usuario_filiais');
    return rows.map((u: any) => ({
      ...u,
      ...custoColaborador(u),
      empresa_ids: vinculos.filter((v: any) => v.usuario_id === u.id).map((v: any) => v.empresa_id),
      filial_ids: vinculosFiliais.filter((v: any) => v.usuario_id === u.id).map((v: any) => v.filial_id),
    }));
  }

  // Funcionários vinculáveis às linhas de processo: usuários ativos da empresa
  // ativa. Com `todos`, lista todos os usuários ativos do sistema (o envase
  // escolhe qualquer pessoa pelo nome, sem depender do vínculo com a empresa)
  async equipe(empresaId: number, todos = false) {
    const [rows]: any = await this.pool.query(
      `SELECT u.id, u.nome, u.cargo, u.salario_base, u.encargos_pct, u.vale_transporte,
              u.vale_alimentacao, u.outros_beneficios, u.horas_mes
       FROM usuarios u
       ${todos ? '' : 'JOIN usuario_empresas ue ON ue.usuario_id = u.id AND ue.empresa_id = ?'}
       WHERE u.ativo = 1 ORDER BY u.nome`,
      todos ? [] : [empresaId],
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
    const filialIds = await this.validarFiliais(dados.papel, body.empresa_ids, body.filial_ids);
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
    await this.vincular(res.insertId, dados.papel, body.empresa_ids, filialIds);
    return { id: res.insertId };
  }

  async atualizar(id: number, body: any) {
    const dados = this.validar(body, { senhaObrigatoria: false });
    const filialIds = await this.validarFiliais(dados.papel, body.empresa_ids, body.filial_ids);
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
    await this.vincular(id, dados.papel, body.empresa_ids, filialIds);
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
  // `empresaPendente`: a linha cita empresa que será cadastrada na importação —
  // ainda não tem id, mas o vínculo vai existir
  private validar(body: any, opts: { senhaObrigatoria: boolean; empresaPendente?: boolean }) {
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
      if (!empresas.length && !opts.empresaPendente) {
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
    let analise: any = null;
    let linhas: any[];
    if (body?.arquivo_base64 || body?.texto) {
      const lido = await this.lerArquivo(body);
      analise = lido.analise;
      // Sem todas as obrigatórias no de-para não há o que validar: devolve a
      // análise das colunas para a tela pedir a escolha — nada é gravado
      if (analise.faltando.length) {
        return {
          precisa_mapear: true,
          analise,
          dry_run: true,
          total: lido.linhas.length,
          importados: 0,
          validos: 0,
          invalidos: 0,
          linhas: [],
        };
      }
      linhas = lido.linhas;
    } else {
      linhas = Array.isArray(body?.usuarios) ? body.usuarios : [];
    }
    if (!linhas.length) throw new BadRequestException('Nenhuma linha de usuário encontrada abaixo do cabeçalho');
    if (linhas.length > 500) throw new BadRequestException('Importe no máximo 500 usuários por vez');
    const dryRun = body?.dry_run !== false;
    const senhaPadrao = String(body?.senha_padrao || '');

    const [empresas]: any = await this.pool.query('SELECT id, razao_social, nome_fantasia FROM empresas');
    const [filiais]: any = await this.pool.query('SELECT id, empresa_id, nome, codigo, ativa FROM filiais');
    // Empresa ou filial citada na planilha e ainda não cadastrada não é erro:
    // na conferência vira "cadastro pendente" (a tela pede UF e regime da
    // empresa) e na gravação é criada antes dos usuários — empresa, filial, usuário
    if (!dryRun) await this.criarCadastros(body?.cadastros, empresas, filiais);
    const pendentes = { empresas: new Map<string, any>(), filiais: new Map<string, any>() };
    const anotar = (mapa: Map<string, any>, chave: string, base: any, linha: number) => {
      const atual = mapa.get(chave) || { ...base, linhas: [] };
      atual.linhas.push(linha);
      mapa.set(chave, atual);
    };
    const [existentes]: any = await this.pool.query('SELECT LOWER(email) AS email FROM usuarios');
    const emailsNoBanco = new Set(existentes.map((e: any) => e.email));
    const emailsNoArquivo = new Set<string>();

    const resultados = linhas.map((bruto: any, i: number) => {
      const numero = Number(bruto?.__linha) || i + 1;
      // Planilha brasileira traz "2.350,50" e "R$ 3.100,00": vira número antes de validar
      const u: any = { ...bruto };
      for (const c of UsuariosService.CAMPOS_NUMERICOS) if (c in u) u[c] = this.numeroBr(u[c]);
      try {
        const salario = u?.salario_base;
        if (salario === '' || salario == null || !(Number(salario) >= 0)) {
          throw new BadRequestException('Salário base é obrigatório na importação');
        }
        const encargos = u?.encargos_pct;
        if (encargos === '' || encargos == null || !(Number(encargos) >= 0)) {
          throw new BadRequestException('Encargos (%) é obrigatório na importação');
        }

        const emp = this.resolverEmpresas(u, empresas, body?.empresa_ids);
        const dados = this.validar(
          { ...u, senha: u?.senha || senhaPadrao, empresa_ids: emp.ids },
          { senhaObrigatoria: true, empresaPendente: emp.novas.length > 0 },
        );
        const fil = dados.papel === 'admin'
          ? { ids: [] as number[], novas: [] as any[] }
          : this.resolverFiliais(u, filiais, empresas, emp, body?.filial_ids);
        // Na gravação os cadastros já foram criados; sobrar algo é conferência desatualizada
        if (!dryRun && (emp.novas.length || fil.novas.length)) {
          const [tipo, nome] = emp.novas.length ? ['Empresa', emp.novas[0]] : ['Filial', fil.novas[0].nome];
          throw new BadRequestException(`${tipo} "${nome}" não cadastrada — refaça a conferência para incluí-la nos cadastros`);
        }
        if (emailsNoBanco.has(dados.email)) throw new BadRequestException('Já existe usuário com este e-mail');
        if (emailsNoArquivo.has(dados.email)) throw new BadRequestException('E-mail repetido dentro do arquivo');
        emailsNoArquivo.add(dados.email);
        for (const nome of emp.novas) anotar(pendentes.empresas, this.chaveNome(nome), { nome }, numero);
        for (const f of fil.novas) anotar(pendentes.filiais, `${this.chaveNome(f.empresa)}|${this.chaveNome(f.nome)}`, f, numero);

        return {
          linha: numero,
          ok: true,
          nome: dados.nome,
          email: dados.email,
          papel: dados.papel,
          cargo: u?.cargo || null,
          salario_base: Number(salario),
          encargos_pct: Number(encargos),
          empresa_ids: emp.ids,
          empresas_novas: emp.novas,
          filial_ids: fil.ids,
          filiais_novas: fil.novas,
          _dados: { ...u, ...dados, senha: u?.senha || senhaPadrao, empresa_ids: emp.ids, filial_ids: fil.ids },
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
      precisa_mapear: false,
      analise,
      cadastros: { empresas: [...pendentes.empresas.values()], filiais: [...pendentes.filiais.values()] },
      total: resultados.length,
      importados: dryRun ? 0 : validos.length,
      validos: validos.length,
      invalidos: resultados.length - validos.length,
      linhas: resultados.map(({ _dados, ...r }: any) => r),
    };
  }

  // ---- Leitura do arquivo: CSV/colagem e .xlsx caem no mesmo formato ----
  //
  // Planilha de verdade não segue modelo: "Salário Bruto (R$)", "Nome do
  // Funcionário", título na primeira linha. Por isso a leitura acha a linha do
  // cabeçalho sozinha, sugere o de-para por palavra-chave e, quando alguma
  // coluna obrigatória não é reconhecida, devolve as colunas encontradas para
  // o usuário indicar qual é qual — em vez de recusar o arquivo.

  // Ordem de tentativa: nome normalizado igual a um `exatos`; depois começando
  // por um deles; por último contendo uma palavra de `contem`. `exceto` evita
  // falso positivo (ex.: "Nome da Empresa" não é o nome da pessoa).
  private static readonly CAMPOS: Array<{
    campo: string; rotulo: string; obrigatorio: boolean;
    exatos: string[]; contem: string[]; exceto?: string[];
  }> = [
    { campo: 'nome', rotulo: 'Nome completo', obrigatorio: true,
      exatos: ['nome', 'nomecompleto'], contem: ['nome', 'funcionario', 'colaborador'],
      exceto: ['empresa', 'filial', 'unidade', 'fantasia', 'razao', 'mae', 'pai', 'cpf', 'documento', 'email', 'telefone'] },
    { campo: 'email', rotulo: 'E-mail', obrigatorio: true,
      exatos: ['email'], contem: ['email', 'correio'] },
    { campo: 'telefone', rotulo: 'Telefone', obrigatorio: true,
      exatos: ['telefone', 'fone', 'celular'], contem: ['telefone', 'celular', 'whatsapp', 'fone'] },
    { campo: 'documento', rotulo: 'Documento (CPF/RG)', obrigatorio: true,
      exatos: ['documento', 'cpf', 'rg', 'doc'], contem: ['cpf', 'documento', 'identidade', 'passaporte'] },
    { campo: 'papel', rotulo: 'Papel (perfil de acesso)', obrigatorio: true,
      exatos: ['papel', 'perfil'], contem: ['papel', 'perfil', 'acesso', 'permissao'] },
    { campo: 'salario_base', rotulo: 'Salário base', obrigatorio: true,
      exatos: ['salariobase', 'salario'], contem: ['salario', 'remuneracao', 'vencimento'],
      exceto: ['vale', 'beneficio'] },
    { campo: 'encargos_pct', rotulo: 'Encargos (%)', obrigatorio: true,
      exatos: ['encargospct', 'encargos', 'encargo'], contem: ['encargo'] },
    { campo: 'cargo', rotulo: 'Cargo', obrigatorio: false,
      exatos: ['cargo', 'funcao'], contem: ['cargo', 'funcao', 'ocupacao'] },
    { campo: 'senha', rotulo: 'Senha', obrigatorio: false,
      exatos: ['senha', 'password'], contem: ['senha'] },
    { campo: 'vale_transporte', rotulo: 'Vale-transporte', obrigatorio: false,
      exatos: ['valetransporte', 'vt'], contem: ['transporte'] },
    { campo: 'vale_alimentacao', rotulo: 'Vale-alimentação', obrigatorio: false,
      exatos: ['valealimentacao', 'va', 'vr'], contem: ['alimentacao', 'refeicao'] },
    { campo: 'outros_beneficios', rotulo: 'Outros benefícios', obrigatorio: false,
      exatos: ['outrosbeneficios', 'outros'], contem: ['beneficio'] },
    { campo: 'horas_mes', rotulo: 'Horas/mês', obrigatorio: false,
      exatos: ['horasmes', 'horas'], contem: ['horas', 'cargahoraria', 'jornada'] },
    { campo: 'empresas', rotulo: 'Empresas', obrigatorio: false,
      exatos: ['empresas', 'empresa'], contem: ['empresa'] },
    { campo: 'filiais', rotulo: 'Filiais', obrigatorio: false,
      exatos: ['filiais', 'filial', 'unidade', 'unidades'], contem: ['filial', 'unidade', 'planta'] },
  ];

  private static readonly CAMPOS_NUMERICOS = [
    'salario_base', 'encargos_pct', 'vale_transporte', 'vale_alimentacao', 'outros_beneficios', 'horas_mes',
  ];

  // "R$ 2.350,50", "2350,5" e "2350.5" viram 2350.5; "2.350" (só milhar) vira 2350.
  // Vazio continua vazio — a obrigatoriedade é checada depois, campo a campo.
  private numeroBr(valor: any): any {
    if (valor === '' || valor == null || typeof valor === 'number') return valor;
    let s = String(valor).trim().replace(/[^\d,.\-]/g, '');
    if (!s) return NaN;
    const virgula = s.lastIndexOf(',');
    const ponto = s.lastIndexOf('.');
    if (virgula >= 0 && ponto >= 0) {
      s = virgula > ponto ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    } else if (virgula >= 0) {
      s = s.replace(/,/g, (m, idx) => (idx === virgula ? '.' : ''));
    } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
      s = s.replace(/\./g, '');
    }
    return Number(s);
  }

  // Tira acento e tudo que não é letra/dígito: "Encargos (%)" vira "encargos"
  private normalizarCabecalho(valor: any): string {
    return String(valor ?? '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  // Sugere a coluna de cada campo; uma coluna nunca atende dois campos
  private sugerirMapeamento(cabecalho: any[]): Record<string, number | null> {
    const norm = cabecalho.map((c) => this.normalizarCabecalho(c));
    const usados = new Set<number>();
    const mapa: Record<string, number | null> = {};
    UsuariosService.CAMPOS.forEach((c) => { mapa[c.campo] = null; });
    const semExcecao = (h: string, c: any) => !(c.exceto || []).some((x: string) => h.includes(x));
    const passadas: Array<(h: string, c: any) => boolean> = [
      (h, c) => c.exatos.includes(h),
      (h, c) => semExcecao(h, c) && c.exatos.some((e: string) => e.length >= 4 && h.startsWith(e)),
      (h, c) => semExcecao(h, c) && c.contem.some((k: string) => h.includes(k)),
    ];
    for (const teste of passadas) {
      for (const c of UsuariosService.CAMPOS) {
        if (mapa[c.campo] != null) continue;
        const i = norm.findIndex((h, idx) => h !== '' && !usados.has(idx) && teste(h, c));
        if (i >= 0) {
          mapa[c.campo] = i;
          usados.add(i);
        }
      }
    }
    return mapa;
  }

  // Quanto uma linha "parece" cabeçalho: obrigatória reconhecida vale mais
  private pontuarCabecalho(linha: any[]): number {
    const m = this.sugerirMapeamento(linha);
    return UsuariosService.CAMPOS.reduce((s, c) => s + (m[c.campo] != null ? (c.obrigatorio ? 2 : 1) : 0), 0);
  }

  // Entre as 10 primeiras linhas, a que mais parece cabeçalho — pula título
  private acharCabecalho(linhas: any[][]): { indice: number; pontos: number } {
    let melhor = { indice: 0, pontos: -1 };
    linhas.slice(0, 10).forEach((l, i) => {
      const pontos = this.pontuarCabecalho(l);
      if (pontos > melhor.pontos) melhor = { indice: i, pontos };
    });
    return melhor;
  }

  // Divide respeitando aspas: "Souza, Maria" continua sendo um campo só
  private partir(linha: string, sep: string): string[] {
    const campos: string[] = [];
    let atual = '';
    let aspas = false;
    for (let i = 0; i < linha.length; i++) {
      const ch = linha[i];
      if (ch === '"') {
        if (aspas && linha[i + 1] === '"') {
          atual += '"';
          i++;
        } else {
          aspas = !aspas;
        }
      } else if (ch === sep && !aspas) {
        campos.push(atual.trim());
        atual = '';
      } else {
        atual += ch;
      }
    }
    campos.push(atual.trim());
    return campos;
  }

  // CSV, TSV ou colagem do Excel. O separador é o que produz o cabeçalho mais
  // reconhecível — decidir só pela primeira linha erra quando ela é um título.
  private tabelaDoTexto(texto: string) {
    const cheias = String(texto).split(/\r?\n/)
      .map((l, i) => ({ numero: i + 1, l }))
      .filter((x) => x.l.trim());
    let escolha = { sep: ';', pontos: -1 };
    for (const sep of [';', '\t', ',']) {
      const amostra = cheias.slice(0, 10).map((x) => this.partir(x.l, sep));
      const { pontos } = this.acharCabecalho(amostra);
      if (pontos > escolha.pontos) escolha = { sep, pontos };
    }
    return {
      aba: null as string | null,
      linhas: cheias.map((x) => this.partir(x.l, escolha.sep)),
      numeros: cheias.map((x) => x.numero),
    };
  }

  // .xlsx pelo ExcelJS (mesma dependência dos relatórios). Lê todas as abas e
  // fica com a de cabeçalho mais reconhecível — a primeira pode ser capa.
  private async tabelaDaPlanilha(base64: string) {
    const buffer = Buffer.from(String(base64).split(',').pop() || '', 'base64');
    if (!buffer.length) throw new BadRequestException('Arquivo vazio ou ilegível');
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(buffer as any);
    } catch {
      throw new BadRequestException('Não foi possível ler a planilha — salve como .xlsx ou exporte para .csv');
    }

    // Célula pode ter fórmula, link ou texto rico: reduz tudo a texto simples
    const texto = (cell: any): string => {
      const v = cell?.value;
      if (v == null) return '';
      if (v instanceof Date) return v.toISOString().slice(0, 10);
      if (typeof v === 'object') {
        if ('richText' in v) return v.richText.map((p: any) => p.text).join('');
        if ('text' in v) return String(v.text);
        if ('result' in v) return v.result == null ? '' : String(v.result);
        return '';
      }
      return String(v);
    };

    let melhor: { aba: string; linhas: string[][]; numeros: number[]; pontos: number } | null = null;
    for (const aba of wb.worksheets) {
      const linhas: string[][] = [];
      const numeros: number[] = [];
      aba.eachRow({ includeEmpty: false }, (row, numero) => {
        const valores: string[] = [];
        row.eachCell({ includeEmpty: true }, (cell, col) => { valores[col - 1] = texto(cell); });
        for (let i = 0; i < valores.length; i++) if (valores[i] == null) valores[i] = '';
        if (valores.some((v) => v.trim())) {
          linhas.push(valores);
          numeros.push(numero);
        }
      });
      if (!linhas.length) continue;
      const { pontos } = this.acharCabecalho(linhas);
      if (!melhor || pontos > melhor.pontos) melhor = { aba: aba.name, linhas, numeros, pontos };
    }
    if (!melhor) throw new BadRequestException('A planilha está vazia');
    return { aba: melhor.aba as string | null, linhas: melhor.linhas, numeros: melhor.numeros };
  }

  // Lê o arquivo e aplica o de-para: o escolhido pelo usuário, se veio, ou o
  // sugerido. `analise` volta para a tela mostrar e deixar ajustar as colunas.
  private async lerArquivo(body: any) {
    const tabela = body?.arquivo_base64
      ? await this.tabelaDaPlanilha(body.arquivo_base64)
      : this.tabelaDoTexto(String(body?.texto || ''));
    if (tabela.linhas.length < 2) {
      throw new BadRequestException('O arquivo precisa do cabeçalho e ao menos uma linha de usuário');
    }

    const { indice } = this.acharCabecalho(tabela.linhas);
    const cabecalho = tabela.linhas[indice].map((c) => String(c ?? '').trim());
    const escolhido = body?.mapeamento && typeof body.mapeamento === 'object' ? body.mapeamento : null;
    const base = escolhido || this.sugerirMapeamento(cabecalho);

    const mapeamento: Record<string, number | null> = {};
    for (const c of UsuariosService.CAMPOS) {
      const v = base[c.campo];
      const n = v === '' || v == null ? NaN : Number(v);
      mapeamento[c.campo] = Number.isInteger(n) && n >= 0 && n < cabecalho.length ? n : null;
    }

    const analise = {
      aba: tabela.aba,
      linha_cabecalho: tabela.numeros[indice],
      colunas: cabecalho.map((titulo, i) => ({ indice: i, titulo: titulo || `Coluna ${i + 1}` })),
      campos: UsuariosService.CAMPOS.map(({ campo, rotulo, obrigatorio }) => ({ campo, rotulo, obrigatorio })),
      mapeamento,
      faltando: UsuariosService.CAMPOS
        .filter((c) => c.obrigatorio && mapeamento[c.campo] == null)
        .map((c) => c.rotulo),
    };

    const linhas = tabela.linhas.slice(indice + 1)
      .map((partes, i) => {
        // número real da linha na planilha, mesmo com título ou linhas vazias
        const registro: any = { __linha: tabela.numeros[indice + 1 + i] };
        for (const [campo, pos] of Object.entries(mapeamento)) {
          if (pos == null) continue;
          const valor = partes[pos];
          registro[campo] = valor == null ? '' : String(valor).trim();
        }
        return registro;
      })
      .filter((r) => Object.entries(r).some(([k, v]) => k !== '__linha' && v !== ''));

    return { analise, linhas };
  }

  // Empresas da linha: coluna 'empresas' (nomes ou ids separados por ; ou |)
  // quando vier preenchida; senão, as escolhidas no modal da importação.
  // Nome que ainda não existe não é erro: vai em `novas` e é cadastrado na
  // importação — a conferência pede UF e regime, que definem os impostos
  private resolverEmpresas(u: any, empresas: any[], padrao: any): { ids: number[]; novas: string[] } {
    const bruto = String(u?.empresas ?? u?.empresa ?? '').trim();
    if (!bruto) return { ids: Array.isArray(padrao) ? padrao.map(Number).filter(Boolean) : [], novas: [] };
    const ids: number[] = [];
    const novas: string[] = [];
    for (const parte of bruto.split(/[;|]/).map((p) => p.trim()).filter(Boolean)) {
      if (/^\d+$/.test(parte)) {
        const porId = empresas.find((e) => e.id === Number(parte));
        if (!porId) throw new BadRequestException(`Empresa de id ${parte} não existe`);
        ids.push(porId.id);
        continue;
      }
      const achada = this.acharEmpresa(empresas, parte);
      if (achada) ids.push(achada.id);
      else if (!novas.some((n) => this.chaveNome(n) === this.chaveNome(parte))) novas.push(parte);
    }
    return { ids: [...new Set(ids)], novas };
  }

  // Filiais da linha: coluna 'filiais' (nomes, códigos ou ids separados por ;
  // ou |), procuradas só entre as filiais das empresas da linha. Sem coluna,
  // valem as escolhidas no modal — descartando as que não são dessas empresas.
  // Nome que ainda não existe é cadastrado na importação, desde que a linha
  // cite uma única empresa (senão não dá para saber de qual empresa ela é)
  private resolverFiliais(
    u: any, filiais: any[], empresas: any[], emp: { ids: number[]; novas: string[] }, padrao: any,
  ): { ids: number[]; novas: Array<{ nome: string; empresa: string; empresa_id: number | null }> } {
    const daLinha = filiais.filter((f) => emp.ids.includes(Number(f.empresa_id)));
    const bruto = String(u?.filiais ?? u?.filial ?? '').trim();
    if (!bruto) {
      const ids = Array.isArray(padrao) ? padrao.map(Number).filter(Boolean) : [];
      return { ids: ids.filter((id) => daLinha.some((f) => f.id === id && f.ativa)), novas: [] };
    }
    const ids: number[] = [];
    const novas: Array<{ nome: string; empresa: string; empresa_id: number | null }> = [];
    for (const parte of bruto.split(/[;|]/).map((p) => p.trim()).filter(Boolean)) {
      const chave = this.chaveNome(parte);
      const achada =
        daLinha.find((f) => this.chaveNome(f.nome) === chave) ||
        daLinha.find((f) => f.codigo && this.chaveNome(f.codigo) === chave) ||
        (/^\d+$/.test(parte) ? daLinha.find((f) => f.id === Number(parte)) : undefined);
      if (achada) {
        if (!achada.ativa) throw new BadRequestException(`Filial "${achada.nome}" está inativa`);
        ids.push(achada.id);
        continue;
      }
      if (emp.ids.length + emp.novas.length !== 1) {
        throw new BadRequestException(
          `Filial "${parte}" não cadastrada — para cadastrá-la na importação, a linha precisa citar uma única empresa`,
        );
      }
      const existente = emp.ids.length ? empresas.find((e) => e.id === emp.ids[0]) : null;
      if (!novas.some((n) => this.chaveNome(n.nome) === chave)) {
        novas.push({
          nome: parte,
          empresa: existente ? existente.nome_fantasia || existente.razao_social : emp.novas[0],
          empresa_id: existente ? existente.id : null,
        });
      }
    }
    return { ids: [...new Set(ids)], novas };
  }

  // Cria, antes dos usuários, as empresas e filiais que a conferência apontou
  // como pendentes (`cadastros` volta da tela com UF e regime preenchidos).
  // Quem já existir é reaproveitado — rodar duas vezes não duplica nada. Os
  // arrays `empresas`/`filiais` recebem os novos registros para as linhas
  // resolverem normalmente em seguida.
  private async criarCadastros(cadastros: any, empresas: any[], filiais: any[]) {
    const listaEmpresas = Array.isArray(cadastros?.empresas) ? cadastros.empresas : [];
    const listaFiliais = Array.isArray(cadastros?.filiais) ? cadastros.filiais : [];
    for (const c of listaEmpresas) {
      const nome = String(c?.nome || '').trim();
      if (!nome || this.acharEmpresa(empresas, nome)) continue;
      const uf = String(c?.uf || '').trim().toUpperCase();
      if (!/^[A-Z]{2}$/.test(uf)) throw new BadRequestException(`Empresa "${nome}": informe a UF`);
      const regime = String(c?.regime || 'presumido');
      if (!['simples', 'presumido', 'real'].includes(regime)) {
        throw new BadRequestException(`Empresa "${nome}": regime tributário inválido`);
      }
      const razao = String(c?.razao_social || '').trim() || nome;
      const { id } = await this.empresasService.criar({
        razao_social: razao,
        nome_fantasia: nome,
        cnpj: c?.cnpj || null,
        ie: c?.ie || null,
        uf,
        municipio: c?.municipio || null,
        regime,
        aliquota_simples: Number(c?.aliquota_simples) >= 0 ? Number(c.aliquota_simples) : 6,
      });
      empresas.push({ id, razao_social: razao, nome_fantasia: nome });
    }
    for (const c of listaFiliais) {
      const nome = String(c?.nome || '').trim();
      if (!nome) continue;
      const empresa =
        (c?.empresa_id ? empresas.find((e) => e.id === Number(c.empresa_id)) : null) || this.acharEmpresa(empresas, c?.empresa);
      if (!empresa) throw new BadRequestException(`Filial "${nome}": empresa "${c?.empresa || ''}" não encontrada para o cadastro`);
      if (filiais.some((f) => f.empresa_id === empresa.id && this.chaveNome(f.nome) === this.chaveNome(nome))) continue;
      const { id } = await this.filiaisService.criar([empresa.id], {
        empresa_id: empresa.id, nome, codigo: c?.codigo || null, municipio: c?.municipio || null, uf: c?.uf || null,
      });
      filiais.push({ id, empresa_id: empresa.id, nome, codigo: c?.codigo || null, ativa: 1 });
    }
  }

  private chaveNome(v: any): string {
    return String(v || '').trim().toLowerCase();
  }

  private acharEmpresa(empresas: any[], nome: any) {
    const k = this.chaveNome(nome);
    if (!k) return undefined;
    return empresas.find((e) => this.chaveNome(e.nome_fantasia) === k || this.chaveNome(e.razao_social) === k);
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

  // Filial é escopo dentro da empresa: só entra filial de empresa vinculada.
  // Sem filial é válido (nem toda empresa cadastra unidades); admin não tem
  // vínculo porque acessa todas. Devolve null quando o campo não veio, para
  // uma atualização parcial não apagar os vínculos que já existem.
  private async validarFiliais(papel: string, empresaIds: any, filialIds: any): Promise<number[] | null> {
    if (papel === 'admin') return [];
    if (!Array.isArray(filialIds)) return null;
    const ids = [...new Set(filialIds.map(Number).filter(Boolean))];
    if (!ids.length) return [];
    const [rows]: any = await this.pool.query('SELECT id, empresa_id, nome FROM filiais WHERE id IN (?)', [ids]);
    const empresas = new Set((Array.isArray(empresaIds) ? empresaIds : []).map(Number));
    for (const id of ids) {
      const f = rows.find((r: any) => r.id === id);
      if (!f) throw new BadRequestException(`Filial de id ${id} não existe`);
      if (!empresas.has(Number(f.empresa_id))) {
        throw new BadRequestException(`Filial "${f.nome}" não pertence a uma empresa vinculada ao usuário`);
      }
    }
    return ids;
  }

  private async vincular(usuarioId: number, papel: string, empresaIds: any, filialIds: number[] | null) {
    if (Array.isArray(empresaIds)) {
      await this.pool.query('DELETE FROM usuario_empresas WHERE usuario_id=?', [usuarioId]);
      if (papel !== 'admin') { // admin acessa todas as empresas
        for (const e of empresaIds) {
          await this.pool.query('INSERT IGNORE INTO usuario_empresas (usuario_id, empresa_id) VALUES (?,?)', [usuarioId, Number(e)]);
        }
      }
    }
    if (filialIds) {
      await this.pool.query('DELETE FROM usuario_filiais WHERE usuario_id=?', [usuarioId]);
      for (const f of filialIds) {
        await this.pool.query('INSERT IGNORE INTO usuario_filiais (usuario_id, filial_id) VALUES (?,?)', [usuarioId, f]);
      }
    }
    // Filial de empresa que saiu do vínculo não faz sentido: limpa
    await this.pool.query(
      `DELETE uf FROM usuario_filiais uf
        JOIN filiais f ON f.id = uf.filial_id
       WHERE uf.usuario_id = ?
         AND f.empresa_id NOT IN (SELECT empresa_id FROM usuario_empresas WHERE usuario_id = ?)`,
      [usuarioId, usuarioId],
    );
  }
}

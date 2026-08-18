import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { POOL, Pool } from '../db/database.module';
import { aliquotaInterestadual, custoColaborador, formarPreco, round2, round4 } from '../shared/calculos';

// Alíquotas federais por regime (legislação brasileira):
//  - Lucro Presumido: PIS 0,65% e COFINS 3,00% (regime cumulativo, Lei 9.718/98)
//  - Lucro Real: PIS 1,65% e COFINS 7,60% (não cumulativo, Leis 10.637/02 e 10.833/03)
//  - Simples Nacional: tributos unificados no DAS (LC 123/06) — alíquota efetiva configurada na empresa
const PIS_COFINS = {
  presumido: { pis: 0.65, cofins: 3.0 },
  real: { pis: 1.65, cofins: 7.6 },
};

@Injectable()
export class CustosService {
  constructor(@Inject(POOL) private pool: Pool) {}

  // ------------------------------------------------------------------
  // Custo completo do produto: fórmula + mão de obra + processo + manutenção
  // ------------------------------------------------------------------
  async custoProduto(empresaId: number, produtoId: number, opts: { margem_pct?: number; uf_destino?: string } = {}) {
    const [produtos]: any = await this.pool.query(
      `SELECT p.*, n.descricao AS ncm_descricao, n.ipi_pct AS ncm_ipi_pct
       FROM produtos p LEFT JOIN ncm n ON n.codigo = p.ncm_codigo
       WHERE p.id=? AND p.empresa_id=?`,
      [produtoId, empresaId],
    );
    if (!produtos.length) throw new NotFoundException('Produto não encontrado');
    const produto = produtos[0];

    const [empresas]: any = await this.pool.query('SELECT * FROM empresas WHERE id=?', [empresaId]);
    const empresa = empresas[0];

    let linha: any = null;
    if (produto.linha_id) {
      const [linhas]: any = await this.pool.query('SELECT * FROM linhas_processo WHERE id=?', [produto.linha_id]);
      linha = linhas[0] || null;
    }

    // --- 1) Custo de fórmula (matérias-primas) ---
    // A MP entra pela quantidade da fórmula: o rendimento por matéria-prima varia de
    // lote para lote, então não é mais um percentual fixo de cadastro. As perdas do
    // processo continuam no rendimento da linha, aplicado logo abaixo.
    const [itensFormula]: any = await this.pool.query(
      `SELECT fi.quantidade, mp.id AS materia_prima_id, mp.nome, mp.unidade, mp.custo_unitario
       FROM formula_itens fi JOIN materias_primas mp ON mp.id = fi.materia_prima_id
       WHERE fi.produto_id=? ORDER BY mp.nome`,
      [produtoId],
    );
    const itens = itensFormula.map((i: any) => ({
      materia_prima_id: i.materia_prima_id,
      nome: i.nome,
      unidade: i.unidade,
      quantidade: Number(i.quantidade),
      custo_unitario: Number(i.custo_unitario),
      custo: round4(Number(i.quantidade) * Number(i.custo_unitario)),
    }));
    const custoFormulaBruto = itens.reduce((s: number, i: any) => s + i.custo, 0);
    const rendimentoLinha =
      Number(produto.rendimento_linha_pct) > 0
        ? Number(produto.rendimento_linha_pct)
        : Number(linha?.rendimento_pct) > 0
          ? Number(linha.rendimento_pct)
          : 100;
    const custoFormula = custoFormulaBruto / (rendimentoLinha / 100);

    // --- 2) Mão de obra (colaboradores da linha × horas do lote) ---
    const horas = Number(produto.horas_producao) || 0;
    let equipe: any[] = [];
    if (linha) {
      const [colabs]: any = await this.pool.query(
        `SELECT lc.dedicacao_pct, c.*
         FROM linha_usuarios lc JOIN usuarios c ON c.id = lc.usuario_id
         WHERE lc.linha_id=? AND c.ativo=1 ORDER BY c.nome`,
        [linha.id],
      );
      equipe = colabs.map((c: any) => {
        const { custo_hora } = custoColaborador(c);
        const efetivo = custo_hora * (Number(c.dedicacao_pct) / 100);
        return {
          nome: c.nome,
          cargo: c.cargo,
          dedicacao_pct: Number(c.dedicacao_pct),
          custo_hora,
          custo_hora_efetivo: round4(efetivo),
          custo_no_lote: round4(efetivo * horas),
        };
      });
    }
    const custoMoHora = equipe.reduce((s, c) => s + c.custo_hora_efetivo, 0);
    const custoMaoDeObra = custoMoHora * horas;

    // --- 3) Custo de processo (utilidades consumidas por hora trabalhada) ---
    let consumos: any[] = [];
    if (linha) {
      const [utils]: any = await this.pool.query(
        `SELECT lu.consumo_hora, u.nome, u.unidade, u.custo_unitario, u.tipo
         FROM linha_utilidades lu JOIN utilidades u ON u.id = lu.utilidade_id
         WHERE lu.linha_id=? ORDER BY u.nome`,
        [linha.id],
      );
      consumos = utils.map((u: any) => {
        const custoHora = Number(u.consumo_hora) * Number(u.custo_unitario);
        return {
          nome: u.nome,
          tipo: u.tipo,
          unidade: u.unidade,
          consumo_hora: Number(u.consumo_hora),
          custo_unitario: Number(u.custo_unitario),
          custo_hora: round4(custoHora),
          custo_no_lote: round4(custoHora * horas),
        };
      });
    }
    const custoUtilHora = consumos.reduce((s, u) => s + u.custo_hora, 0);
    const custoProcesso = custoUtilHora * horas;

    // --- 4) Manutenção e totais ---
    const subtotal = custoFormula + custoMaoDeObra + custoProcesso;
    const manutencaoPct = Number(produto.manutencao_pct) || 0;
    const manutencao = subtotal * (manutencaoPct / 100);
    const custoLote = subtotal + manutencao;
    const tamanhoLote = Number(produto.tamanho_lote) > 0 ? Number(produto.tamanho_lote) : 1;
    const custoUnitario = custoLote / tamanhoLote;
    const pesoKg = Number(produto.peso_kg) || 0;

    // --- 5) Impostos e formação de preço ---
    const impostos = await this.impostosProduto(empresa, produto, opts.uf_destino);
    const margem = opts.margem_pct != null ? Number(opts.margem_pct) : Number(produto.margem_pct) || 0;
    const preco = formarPreco(custoUnitario, margem, impostos.por_dentro_pct, impostos.ipi_pct_destacado);

    return {
      produto: {
        id: produto.id,
        nome: produto.nome,
        unidade: produto.unidade,
        peso_kg: pesoKg,
        ncm_codigo: produto.ncm_codigo,
        ncm_descricao: produto.ncm_descricao,
        tamanho_lote: tamanhoLote,
        horas_producao: horas,
        linha_id: produto.linha_id,
        linha_nome: linha?.nome || null,
      },
      formula: {
        itens,
        custo_bruto: round2(custoFormulaBruto),
        rendimento_linha_pct: rendimentoLinha,
        perda_rendimento: round2(custoFormula - custoFormulaBruto),
        custo_total: round2(custoFormula),
      },
      mao_de_obra: {
        funcionarios: equipe,
        custo_hora_total: round4(custoMoHora),
        horas,
        custo_total: round2(custoMaoDeObra),
      },
      processo: {
        utilidades: consumos,
        custo_hora_total: round4(custoUtilHora),
        horas,
        custo_total: round2(custoProcesso),
      },
      manutencao: { pct: manutencaoPct, valor: round2(manutencao) },
      resumo: {
        custo_lote: round2(custoLote),
        tamanho_lote: tamanhoLote,
        custo_unitario: round4(custoUnitario),
        custo_kg: pesoKg > 0 ? round4(custoUnitario / pesoKg) : null,
        composicao: {
          formula: round2(custoFormula),
          mao_de_obra: round2(custoMaoDeObra),
          processo: round2(custoProcesso),
          manutencao: round2(manutencao),
        },
      },
      impostos,
      preco: preco
        ? { ...preco, margem_aplicada_pct: margem }
        : { erro: 'Margem + impostos ≥ 95% — preço inviável', margem_aplicada_pct: margem },
    };
  }

  // Resumo de custos de todos os produtos ativos (usado na listagem, exportações e dashboards)
  async listarResumo(empresaId: number) {
    const [produtos]: any = await this.pool.query(
      'SELECT id FROM produtos WHERE empresa_id=? AND ativo=1 ORDER BY nome',
      [empresaId],
    );
    const resultado: any[] = [];
    for (const p of produtos) {
      try {
        const c = await this.custoProduto(empresaId, p.id);
        resultado.push({
          produto_id: c.produto.id,
          nome: c.produto.nome,
          unidade: c.produto.unidade,
          linha_nome: c.produto.linha_nome,
          custo_lote: c.resumo.custo_lote,
          tamanho_lote: c.resumo.tamanho_lote,
          custo_unitario: c.resumo.custo_unitario,
          custo_kg: c.resumo.custo_kg,
          composicao: c.resumo.composicao,
          regime: c.impostos.regime,
          preco_sugerido: (c.preco as any).preco_final ?? null,
          margem_pct: (c.preco as any).margem_aplicada_pct,
          carga_tributaria_unit: (c.preco as any).impostos_totais ?? null,
        });
      } catch {
        // produto sem dados suficientes não interrompe a listagem
      }
    }
    return resultado;
  }

  // ------------------------------------------------------------------
  // Impostos conforme regime tributário (ICMS, PIS, COFINS, IPI)
  // ------------------------------------------------------------------
  async impostosProduto(empresa: any, produto: any, ufDestino?: string) {
    const notas: string[] = [];
    const ipiNcm = Number(produto.ncm_ipi_pct ?? produto.ipi_pct ?? 0) || 0;
    const destino = (ufDestino || empresa.uf || 'SP').toUpperCase();

    if (empresa.regime === 'simples') {
      const aliquota = Number(empresa.aliquota_simples) || 0;
      notas.push(`Simples Nacional (LC 123/2006): tributos unificados no DAS com alíquota efetiva de ${aliquota}%.`);
      notas.push('Indústrias enquadram-se no Anexo II; ICMS, PIS, COFINS e IPI são recolhidos dentro do DAS.');
      if (ipiNcm > 0) notas.push(`NCM com IPI de ${ipiNcm}% na TIPI — no Simples, o IPI já está incluso no DAS (sem destaque).`);
      return {
        regime: 'simples',
        regime_nome: 'Simples Nacional',
        uf_origem: empresa.uf,
        uf_destino: destino,
        simples_pct: aliquota,
        icms_pct: null,
        pis_pct: null,
        cofins_pct: null,
        ipi_pct: ipiNcm,
        ipi_pct_destacado: 0,
        por_dentro_pct: aliquota,
        notas,
      };
    }

    const federais = PIS_COFINS[empresa.regime as 'presumido' | 'real'] || PIS_COFINS.presumido;
    const icms = await this.aliquotaIcms(empresa.uf, destino, produto.icms_pct_override);
    const regimeNome = empresa.regime === 'real' ? 'Lucro Real' : 'Lucro Presumido';
    notas.push(
      empresa.regime === 'real'
        ? 'Lucro Real: PIS 1,65% e COFINS 7,60% não cumulativos (Leis 10.637/2002 e 10.833/2003) — geram crédito sobre insumos.'
        : 'Lucro Presumido: PIS 0,65% e COFINS 3,00% cumulativos (Lei 9.718/1998).',
    );
    notas.push(
      empresa.uf === destino
        ? `ICMS interno de ${icms.aliquota}% (${destino}).`
        : `ICMS interestadual ${empresa.uf} → ${destino}: ${icms.aliquota}% (Resolução SF 22/1989).`,
    );
    if (ipiNcm > 0) notas.push(`IPI de ${ipiNcm}% conforme NCM ${produto.ncm_codigo} (TIPI) — calculado "por fora".`);
    notas.push('Simplificações: não contempla ST, DIFAL, FCP nem benefícios fiscais estaduais.');

    return {
      regime: empresa.regime,
      regime_nome: regimeNome,
      uf_origem: empresa.uf,
      uf_destino: destino,
      simples_pct: null,
      icms_pct: icms.aliquota,
      icms_tipo: icms.tipo,
      pis_pct: federais.pis,
      cofins_pct: federais.cofins,
      ipi_pct: ipiNcm,
      ipi_pct_destacado: ipiNcm,
      por_dentro_pct: round4(icms.aliquota + federais.pis + federais.cofins),
      notas,
    };
  }

  private async aliquotaIcms(ufOrigem: string, ufDestino: string, override?: any) {
    if (override != null && override !== '') {
      return { aliquota: Number(override), tipo: 'definida no produto' };
    }
    const [rows]: any = await this.pool.query('SELECT * FROM icms_uf WHERE uf IN (?,?)', [ufOrigem, ufDestino]);
    const origem = rows.find((r: any) => r.uf === ufOrigem);
    const destino = rows.find((r: any) => r.uf === ufDestino);
    if (!origem || !destino) throw new BadRequestException('UF não cadastrada na tabela de ICMS');
    if (ufOrigem === ufDestino) {
      return { aliquota: Number(destino.aliquota_interna), tipo: 'interna' };
    }
    return {
      aliquota: aliquotaInterestadual(origem.regiao, origem.uf, destino.regiao, destino.uf),
      tipo: 'interestadual',
    };
  }

  // ------------------------------------------------------------------
  // Simulação tributária por estado (todas as UFs)
  // ------------------------------------------------------------------
  async simulacaoUf(empresaId: number, produtoId: number, margemPct?: number) {
    const base = await this.custoProduto(empresaId, produtoId, { margem_pct: margemPct });
    const [ufs]: any = await this.pool.query('SELECT * FROM icms_uf ORDER BY uf');
    const [empresas]: any = await this.pool.query('SELECT * FROM empresas WHERE id=?', [empresaId]);
    const empresa = empresas[0];
    const margem = margemPct != null ? Number(margemPct) : Number((base.preco as any).margem_aplicada_pct) || 0;
    const custoUnit = base.resumo.custo_unitario;

    const linhas = [];
    for (const uf of ufs) {
      let icmsAliquota: number | null;
      let tipo: string;
      if (empresa.regime === 'simples') {
        icmsAliquota = null;
        tipo = 'DAS';
      } else if (uf.uf === empresa.uf) {
        icmsAliquota = Number(uf.aliquota_interna);
        tipo = 'interna';
      } else {
        const origem = ufs.find((r: any) => r.uf === empresa.uf);
        icmsAliquota = aliquotaInterestadual(origem.regiao, origem.uf, uf.regiao, uf.uf);
        tipo = 'interestadual';
      }
      const porDentro =
        empresa.regime === 'simples'
          ? Number(empresa.aliquota_simples)
          : icmsAliquota + Number(base.impostos.pis_pct) + Number(base.impostos.cofins_pct);
      const preco = formarPreco(custoUnit, margem, porDentro, base.impostos.ipi_pct_destacado);
      linhas.push({
        uf: uf.uf,
        nome: uf.nome,
        regiao: uf.regiao,
        tipo_operacao: tipo,
        icms_pct: icmsAliquota,
        aliquota_interna_uf: Number(uf.aliquota_interna),
        por_dentro_pct: round4(porDentro),
        preco_final: preco ? preco.preco_final : null,
        impostos_unit: preco ? preco.impostos_totais : null,
        carga_pct: preco && preco.preco_final > 0 ? round2((preco.impostos_totais / preco.preco_final) * 100) : null,
      });
    }
    return {
      produto: base.produto,
      custo_unitario: custoUnit,
      margem_pct: margem,
      regime: base.impostos.regime,
      uf_origem: empresa.uf,
      observacao:
        empresa.regime === 'simples'
          ? 'No Simples Nacional a alíquota do DAS não varia por UF de destino (ST e sublimites estaduais não considerados).'
          : 'Vendas interestaduais: 7% de Sul/Sudeste para N/NE/CO/ES e 12% nos demais casos (Res. SF 22/1989). DIFAL, ST e FCP não considerados.',
      linhas,
    };
  }
}

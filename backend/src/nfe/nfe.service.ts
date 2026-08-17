import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { POOL, Pool } from '../db/database.module';
import { CustosService } from '../custos/custos.service';
import { round2 } from '../shared/calculos';

@Injectable()
export class NfeService {
  constructor(
    @Inject(POOL) private pool: Pool,
    private custos: CustosService,
  ) {}

  async listar(empresaId: number) {
    const [rows]: any = await this.pool.query(
      `SELECT nf.id, nf.numero, nf.serie, nf.chave_acesso, nf.natureza, nf.destinatario, nf.dest_cnpj, nf.dest_uf,
              nf.valor_produtos, nf.valor_icms, nf.valor_pis, nf.valor_cofins, nf.valor_ipi, nf.valor_total,
              nf.status, nf.ambiente, nf.emitida_em, p.numero AS pedido_numero
       FROM notas_fiscais nf LEFT JOIN pedidos p ON p.id = nf.pedido_id
       WHERE nf.empresa_id=? ORDER BY nf.id DESC`,
      [empresaId],
    );
    return rows;
  }

  // Emissão em ambiente de homologação (simulada): gera chave de acesso e XML no layout 4.00.
  // A transmissão real à SEFAZ exige certificado digital A1/A3 e autorização — ver README.
  async emitir(empresaId: number, body: { pedido_id: number; serie?: number }) {
    const pedidoId = Number(body?.pedido_id);
    if (!pedidoId) throw new BadRequestException('Informe o pedido');
    const serie = Number(body?.serie) || 1;

    const [empresas]: any = await this.pool.query('SELECT * FROM empresas WHERE id=?', [empresaId]);
    const empresa = empresas[0];
    if (!empresa?.cnpj || empresa.cnpj.length !== 14) {
      throw new BadRequestException('Cadastre o CNPJ da empresa emitente (14 dígitos) em Configurações');
    }

    const [pedidos]: any = await this.pool.query('SELECT * FROM pedidos WHERE id=? AND empresa_id=?', [pedidoId, empresaId]);
    if (!pedidos.length) throw new NotFoundException('Pedido não encontrado');
    const pedido = pedidos[0];

    const [itens]: any = await this.pool.query(
      `SELECT pi.quantidade, pi.preco_unitario, p.id AS produto_id, p.nome, p.unidade, p.ncm_codigo,
              p.icms_pct_override, n.ipi_pct AS ncm_ipi_pct
       FROM pedido_itens pi
       JOIN produtos p ON p.id = pi.produto_id
       LEFT JOIN ncm n ON n.codigo = p.ncm_codigo
       WHERE pi.pedido_id=?`,
      [pedidoId],
    );
    if (!itens.length) throw new BadRequestException('Pedido sem itens');

    const destino = pedido.cliente_uf || empresa.uf;
    const interestadual = destino !== empresa.uf;
    const cfop = interestadual ? '6101' : '5101';

    let vProd = 0, vICMS = 0, vPIS = 0, vCOFINS = 0, vIPI = 0;
    const detalhes: any[] = [];
    for (let i = 0; i < itens.length; i++) {
      const item = itens[i];
      const imp = await this.custos.impostosProduto(empresa, item, destino);
      const valor = round2(Number(item.quantidade) * Number(item.preco_unitario));
      const icms = imp.icms_pct != null ? round2(valor * (imp.icms_pct / 100)) : 0;
      const pis = imp.pis_pct != null ? round2(valor * (imp.pis_pct / 100)) : 0;
      const cofins = imp.cofins_pct != null ? round2(valor * (imp.cofins_pct / 100)) : 0;
      const ipi = imp.ipi_pct_destacado ? round2(valor * (imp.ipi_pct_destacado / 100)) : 0;
      vProd += valor; vICMS += icms; vPIS += pis; vCOFINS += cofins; vIPI += ipi;
      detalhes.push({ nItem: i + 1, item, imp, valor, icms, pis, cofins, ipi, cfop });
    }
    vProd = round2(vProd); vICMS = round2(vICMS); vPIS = round2(vPIS); vCOFINS = round2(vCOFINS); vIPI = round2(vIPI);
    const vNF = round2(vProd + vIPI); // ICMS/PIS/COFINS são "por dentro"; IPI soma ao total

    const [seq]: any = await this.pool.query(
      'SELECT COALESCE(MAX(numero),0)+1 AS proximo FROM notas_fiscais WHERE empresa_id=? AND serie=?',
      [empresaId, serie],
    );
    const numero = seq[0].proximo;

    const [ufRows]: any = await this.pool.query('SELECT codigo_ibge FROM icms_uf WHERE uf=?', [empresa.uf]);
    const cUF = ufRows[0]?.codigo_ibge || '35';
    const agora = new Date();
    const chave = gerarChaveAcesso(cUF, agora, empresa.cnpj, 55, serie, numero);
    const xml = montarXml({ chave, cUF, agora, empresa, pedido, detalhes, serie, numero, vProd, vICMS, vPIS, vCOFINS, vIPI, vNF });

    const [res]: any = await this.pool.query(
      `INSERT INTO notas_fiscais
       (empresa_id, pedido_id, numero, serie, chave_acesso, destinatario, dest_cnpj, dest_uf,
        valor_produtos, valor_icms, valor_pis, valor_cofins, valor_ipi, valor_total,
        status, ambiente, xml, emitida_em)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'emitida_homologacao','homologacao',?,NOW())`,
      [
        empresaId, pedidoId, numero, serie, chave, pedido.cliente, pedido.cliente_cnpj, destino,
        vProd, vICMS, vPIS, vCOFINS, vIPI, vNF, xml,
      ],
    );
    await this.pool.query("UPDATE pedidos SET status='faturado' WHERE id=? AND status IN ('aberto','em_producao')", [pedidoId]);
    return { id: res.insertId, numero, serie, chave_acesso: chave, valor_total: vNF };
  }

  async cancelar(empresaId: number, id: number) {
    await this.pool.query(
      "UPDATE notas_fiscais SET status='cancelada' WHERE id=? AND empresa_id=?",
      [id, empresaId],
    );
    return { ok: true };
  }

  async xml(empresaId: number, id: number) {
    const [rows]: any = await this.pool.query(
      'SELECT numero, serie, chave_acesso, xml FROM notas_fiscais WHERE id=? AND empresa_id=?',
      [id, empresaId],
    );
    if (!rows.length) throw new NotFoundException('NF-e não encontrada');
    return rows[0];
  }
}

// ---------------------------------------------------------------------
// Chave de acesso (44 dígitos): cUF + AAMM + CNPJ + modelo + série + nNF + tpEmis + cNF + DV
// DV calculado por módulo 11 (Manual de Orientação do Contribuinte)
// ---------------------------------------------------------------------
function gerarChaveAcesso(cUF: string, data: Date, cnpj: string, modelo: number, serie: number, numero: number): string {
  const aamm = `${String(data.getFullYear()).slice(2)}${String(data.getMonth() + 1).padStart(2, '0')}`;
  const cNF = String(Math.floor(Math.random() * 100000000)).padStart(8, '0');
  const base =
    String(cUF).padStart(2, '0') + aamm + cnpj.padStart(14, '0') +
    String(modelo).padStart(2, '0') + String(serie).padStart(3, '0') +
    String(numero).padStart(9, '0') + '1' + cNF;
  return base + String(digitoVerificador(base));
}

function digitoVerificador(base: string): number {
  let peso = 2;
  let soma = 0;
  for (let i = base.length - 1; i >= 0; i--) {
    soma += Number(base[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

function esc(v: any): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function n2(v: number): string {
  return Number(v || 0).toFixed(2);
}

function montarXml(ctx: any): string {
  const { chave, cUF, agora, empresa, pedido, detalhes, serie, numero, vProd, vICMS, vPIS, vCOFINS, vIPI, vNF } = ctx;
  const dhEmi = `${agora.toISOString().slice(0, 19)}-03:00`;
  const simples = empresa.regime === 'simples';

  const dets = detalhes.map((d: any) => {
    const impostoIcms = simples
      ? `<ICMS><ICMSSN102><orig>0</orig><CSOSN>102</CSOSN></ICMSSN102></ICMS>`
      : `<ICMS><ICMS00><orig>0</orig><CST>00</CST><modBC>3</modBC><vBC>${n2(d.valor)}</vBC><pICMS>${n2(d.imp.icms_pct)}</pICMS><vICMS>${n2(d.icms)}</vICMS></ICMS00></ICMS>`;
    const impostoIpi = d.ipi > 0
      ? `<IPI><cEnq>999</cEnq><IPITrib><CST>50</CST><vBC>${n2(d.valor)}</vBC><pIPI>${n2(d.imp.ipi_pct_destacado)}</pIPI><vIPI>${n2(d.ipi)}</vIPI></IPITrib></IPI>`
      : '';
    const impostoPis = simples
      ? `<PIS><PISNT><CST>07</CST></PISNT></PIS>`
      : `<PIS><PISAliq><CST>01</CST><vBC>${n2(d.valor)}</vBC><pPIS>${n2(d.imp.pis_pct)}</pPIS><vPIS>${n2(d.pis)}</vPIS></PISAliq></PIS>`;
    const impostoCofins = simples
      ? `<COFINS><COFINSNT><CST>07</CST></COFINSNT></COFINS>`
      : `<COFINS><COFINSAliq><CST>01</CST><vBC>${n2(d.valor)}</vBC><pCOFINS>${n2(d.imp.cofins_pct)}</pCOFINS><vCOFINS>${n2(d.cofins)}</vCOFINS></COFINSAliq></COFINS>`;
    return `<det nItem="${d.nItem}"><prod><cProd>${d.item.produto_id}</cProd><cEAN>SEM GTIN</cEAN><xProd>${esc(d.item.nome)}</xProd><NCM>${d.item.ncm_codigo || '00000000'}</NCM><CFOP>${d.cfop}</CFOP><uCom>${esc(d.item.unidade)}</uCom><qCom>${Number(d.item.quantidade).toFixed(4)}</qCom><vUnCom>${Number(d.item.preco_unitario).toFixed(4)}</vUnCom><vProd>${n2(d.valor)}</vProd><cEANTrib>SEM GTIN</cEANTrib><uTrib>${esc(d.item.unidade)}</uTrib><qTrib>${Number(d.item.quantidade).toFixed(4)}</qTrib><vUnTrib>${Number(d.item.preco_unitario).toFixed(4)}</vUnTrib><indTot>1</indTot></prod><imposto>${impostoIcms}${impostoIpi}${impostoPis}${impostoCofins}</imposto></det>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe Id="NFe${chave}" versao="4.00">
    <ide><cUF>${cUF}</cUF><cNF>${chave.slice(35, 43)}</cNF><natOp>Venda de producao do estabelecimento</natOp><mod>55</mod><serie>${serie}</serie><nNF>${numero}</nNF><dhEmi>${dhEmi}</dhEmi><tpNF>1</tpNF><idDest>${pedido.cliente_uf === empresa.uf ? 1 : 2}</idDest><tpImp>1</tpImp><tpEmis>1</tpEmis><cDV>${chave.slice(43)}</cDV><tpAmb>2</tpAmb><finNFe>1</finNFe><indFinal>0</indFinal><indPres>9</indPres><procEmi>0</procEmi><verProc>benio-1.0</verProc></ide>
    <emit><CNPJ>${empresa.cnpj}</CNPJ><xNome>${esc(empresa.razao_social)}</xNome><enderEmit><xLgr>${esc(empresa.endereco || 'Nao informado')}</xLgr><nro>S/N</nro><xMun>${esc(empresa.municipio || '')}</xMun><UF>${empresa.uf}</UF></enderEmit><IE>${empresa.ie || 'ISENTO'}</IE><CRT>${empresa.regime === 'simples' ? 1 : 3}</CRT></emit>
    <dest>${pedido.cliente_cnpj ? `<CNPJ>${pedido.cliente_cnpj}</CNPJ>` : ''}<xNome>${esc(pedido.cliente)}</xNome><enderDest><UF>${pedido.cliente_uf || empresa.uf}</UF></enderDest><indIEDest>9</indIEDest></dest>
    ${dets}
    <total><ICMSTot><vBC>${simples ? '0.00' : n2(vProd)}</vBC><vICMS>${n2(simples ? 0 : vICMS)}</vICMS><vICMSDeson>0.00</vICMSDeson><vFCP>0.00</vFCP><vBCST>0.00</vBCST><vST>0.00</vST><vProd>${n2(vProd)}</vProd><vFrete>0.00</vFrete><vSeg>0.00</vSeg><vDesc>0.00</vDesc><vII>0.00</vII><vIPI>${n2(vIPI)}</vIPI><vPIS>${n2(simples ? 0 : vPIS)}</vPIS><vCOFINS>${n2(simples ? 0 : vCOFINS)}</vCOFINS><vOutro>0.00</vOutro><vNF>${n2(vNF)}</vNF></ICMSTot></total>
    <transp><modFrete>9</modFrete></transp>
    <pag><detPag><indPag>0</indPag><tPag>99</tPag><vPag>${n2(vNF)}</vPag></detPag></pag>
    <infAdic><infCpl>DOCUMENTO GERADO EM AMBIENTE DE HOMOLOGACAO PELO SISTEMA BENIO INDUSTRIAL - SEM VALOR FISCAL. Pedido ${esc(pedido.numero)}.</infCpl></infAdic>
  </infNFe>
</NFe>`;
}

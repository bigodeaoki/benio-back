import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import * as ExcelJS from 'exceljs';
import { POOL, Pool } from '../db/database.module';
import { CustosService } from '../custos/custos.service';
import { custoColaborador, round2 } from '../shared/calculos';

const PDFDocument = require('pdfkit');

function brl(n: any): string {
  const v = Number(n);
  if (!isFinite(v)) return '—';
  try {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  } catch {
    return `R$ ${v.toFixed(2)}`;
  }
}

@Injectable()
export class ExportService {
  constructor(
    @Inject(POOL) private pool: Pool,
    private custos: CustosService,
  ) {}

  // ----------------------------- Excel -----------------------------

  async custosXlsx(empresaId: number, res: Response) {
    const dados = await this.custos.listarResumo(empresaId);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Custos por Produto');
    ws.columns = [
      { header: 'Produto', key: 'nome', width: 36 },
      { header: 'Linha', key: 'linha', width: 28 },
      { header: 'Custo Fórmula (lote)', key: 'formula', width: 20 },
      { header: 'Mão de Obra (lote)', key: 'mo', width: 20 },
      { header: 'Processo (lote)', key: 'proc', width: 18 },
      { header: 'Manutenção (lote)', key: 'manut', width: 18 },
      { header: 'Custo do Lote', key: 'lote', width: 16 },
      { header: 'Tamanho do Lote', key: 'tam', width: 16 },
      { header: 'Custo Unitário', key: 'unit', width: 16 },
      { header: 'Custo por Kg', key: 'kg', width: 14 },
      { header: 'Preço Sugerido', key: 'preco', width: 16 },
      { header: 'Margem %', key: 'margem', width: 12 },
      { header: 'Impostos/un', key: 'imp', width: 14 },
      { header: 'Regime', key: 'regime', width: 14 },
    ];
    for (const c of dados) {
      ws.addRow({
        nome: c.nome, linha: c.linha_nome || '—',
        formula: c.composicao.formula, mo: c.composicao.mao_de_obra,
        proc: c.composicao.processo, manut: c.composicao.manutencao,
        lote: c.custo_lote, tam: c.tamanho_lote, unit: c.custo_unitario,
        kg: c.custo_kg, preco: c.preco_sugerido, margem: c.margem_pct,
        imp: c.carga_tributaria_unit, regime: c.regime,
      });
    }
    this.estilizar(ws);
    await this.enviarXlsx(wb, res, 'custos-produtos.xlsx');
  }

  async pedidosXlsx(empresaId: number, res: Response) {
    const [rows]: any = await this.pool.query(
      `SELECT p.numero, p.cliente, p.cliente_uf, p.data_pedido, p.data_entrega, p.status,
              pr.nome AS produto, pi.quantidade, pi.preco_unitario,
              (pi.quantidade * pi.preco_unitario) AS subtotal
       FROM pedidos p
       JOIN pedido_itens pi ON pi.pedido_id = p.id
       JOIN produtos pr ON pr.id = pi.produto_id
       WHERE p.empresa_id=? ORDER BY p.data_pedido DESC, p.id, pi.id`,
      [empresaId],
    );
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Pedidos');
    ws.columns = [
      { header: 'Pedido', key: 'numero', width: 12 },
      { header: 'Cliente', key: 'cliente', width: 36 },
      { header: 'UF', key: 'uf', width: 6 },
      { header: 'Data Pedido', key: 'dp', width: 14 },
      { header: 'Data Entrega', key: 'de', width: 14 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Produto', key: 'produto', width: 36 },
      { header: 'Quantidade', key: 'qtd', width: 12 },
      { header: 'Preço Unit.', key: 'preco', width: 12 },
      { header: 'Subtotal', key: 'sub', width: 14 },
    ];
    for (const r of rows) {
      ws.addRow({
        numero: r.numero, cliente: r.cliente, uf: r.cliente_uf, dp: r.data_pedido,
        de: r.data_entrega, status: r.status, produto: r.produto,
        qtd: Number(r.quantidade), preco: Number(r.preco_unitario), sub: round2(Number(r.subtotal)),
      });
    }
    this.estilizar(ws);
    await this.enviarXlsx(wb, res, 'pedidos.xlsx');
  }

  async estoqueXlsx(empresaId: number, res: Response) {
    const [rows]: any = await this.pool.query(
      `SELECT nome, unidade, custo_unitario, estoque_atual, estoque_minimo,
              (estoque_atual * custo_unitario) AS valor
       FROM materias_primas WHERE empresa_id=? ORDER BY nome`,
      [empresaId],
    );
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Estoque');
    ws.columns = [
      { header: 'Matéria-prima', key: 'nome', width: 36 },
      { header: 'Unidade', key: 'un', width: 10 },
      { header: 'Custo Unitário', key: 'custo', width: 14 },
      { header: 'Estoque Atual', key: 'atual', width: 14 },
      { header: 'Estoque Mínimo', key: 'min', width: 14 },
      { header: 'Valor em Estoque', key: 'valor', width: 16 },
      { header: 'Situação', key: 'sit', width: 16 },
    ];
    for (const r of rows) {
      ws.addRow({
        nome: r.nome, un: r.unidade, custo: Number(r.custo_unitario),
        atual: Number(r.estoque_atual), min: Number(r.estoque_minimo),
        valor: round2(Number(r.valor)),
        sit: Number(r.estoque_atual) < Number(r.estoque_minimo) ? 'ABAIXO DO MÍNIMO' : 'OK',
      });
    }
    this.estilizar(ws);
    await this.enviarXlsx(wb, res, 'estoque.xlsx');
  }

  async colaboradoresXlsx(empresaId: number, res: Response) {
    const [rows]: any = await this.pool.query('SELECT * FROM colaboradores WHERE empresa_id=? ORDER BY nome', [empresaId]);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Colaboradores');
    ws.columns = [
      { header: 'Nome', key: 'nome', width: 30 },
      { header: 'Cargo', key: 'cargo', width: 26 },
      { header: 'Salário Base', key: 'base', width: 14 },
      { header: 'Encargos %', key: 'enc', width: 12 },
      { header: 'V. Transporte', key: 'vt', width: 14 },
      { header: 'V. Alimentação', key: 'va', width: 14 },
      { header: 'Outros', key: 'outros', width: 12 },
      { header: 'Salário Total (c/ benefícios)', key: 'total', width: 24 },
      { header: 'Horas/Mês', key: 'horas', width: 12 },
      { header: 'Salário por Hora', key: 'hora', width: 16 },
    ];
    for (const c of rows) {
      const calc = custoColaborador(c);
      ws.addRow({
        nome: c.nome, cargo: c.cargo, base: Number(c.salario_base), enc: Number(c.encargos_pct),
        vt: Number(c.vale_transporte), va: Number(c.vale_alimentacao), outros: Number(c.outros_beneficios),
        total: calc.custo_total_mensal, horas: Number(c.horas_mes), hora: calc.custo_hora,
      });
    }
    this.estilizar(ws);
    await this.enviarXlsx(wb, res, 'colaboradores.xlsx');
  }

  private estilizar(ws: ExcelJS.Worksheet) {
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EDF5' } };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
  }

  private async enviarXlsx(wb: ExcelJS.Workbook, res: Response, nome: string) {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${nome}"`);
    await wb.xlsx.write(res);
    res.end();
  }

  // ----------------------------- PDF -----------------------------

  async custoProdutoPdf(empresaId: number, produtoId: number, res: Response) {
    const c = await this.custos.custoProduto(empresaId, produtoId);
    const doc = this.iniciarPdf(res, `custo-${c.produto.nome}.pdf`);

    doc.fontSize(18).font('Helvetica-Bold').text('Relatório de Custo do Produto');
    doc.fontSize(11).font('Helvetica').fillColor('#555')
      .text(`${c.produto.nome} — lote de ${c.resumo.tamanho_lote} ${c.produto.unidade} — linha: ${c.produto.linha_nome || 'não definida'}`);
    doc.moveDown();

    this.secao(doc, 'Composição do custo (por lote)');
    this.linhaPdf(doc, 'Fórmula (matérias-primas)', brl(c.formula.custo_total));
    this.linhaPdf(doc, 'Mão de obra', brl(c.mao_de_obra.custo_total));
    this.linhaPdf(doc, 'Processo (utilidades)', brl(c.processo.custo_total));
    this.linhaPdf(doc, `Manutenção (${c.manutencao.pct}%)`, brl(c.manutencao.valor));
    this.linhaPdf(doc, 'CUSTO DO LOTE', brl(c.resumo.custo_lote), true);
    this.linhaPdf(doc, `Custo unitário (${c.produto.unidade})`, brl(c.resumo.custo_unitario), true);
    if (c.resumo.custo_kg != null) this.linhaPdf(doc, 'Custo por kg', brl(c.resumo.custo_kg));
    doc.moveDown();

    this.secao(doc, 'Fórmula — matérias-primas');
    for (const i of c.formula.itens) {
      this.linhaPdf(
        doc,
        `${i.nome} — ${i.quantidade} ${i.unidade} (rend. ${i.rendimento_pct}% → bruto ${i.quantidade_bruta})`,
        brl(i.custo),
      );
    }
    this.linhaPdf(doc, `Perda por rendimento da linha (${c.formula.rendimento_linha_pct}%)`, brl(c.formula.perda_rendimento));
    doc.moveDown();

    this.secao(doc, `Impostos — ${c.impostos.regime_nome} (${c.impostos.uf_origem} → ${c.impostos.uf_destino})`);
    if (c.impostos.regime === 'simples') {
      this.linhaPdf(doc, 'Alíquota efetiva do DAS', `${c.impostos.simples_pct}%`);
    } else {
      this.linhaPdf(doc, `ICMS (${c.impostos.icms_tipo})`, `${c.impostos.icms_pct}%`);
      this.linhaPdf(doc, 'PIS', `${c.impostos.pis_pct}%`);
      this.linhaPdf(doc, 'COFINS', `${c.impostos.cofins_pct}%`);
      this.linhaPdf(doc, `IPI (NCM ${c.produto.ncm_codigo || '—'})`, `${c.impostos.ipi_pct}%`);
    }
    doc.moveDown();

    const preco: any = c.preco;
    if (!preco.erro) {
      this.secao(doc, `Formação de preço (margem ${preco.margem_aplicada_pct}%)`);
      this.linhaPdf(doc, 'Preço sem IPI', brl(preco.preco_sem_ipi));
      this.linhaPdf(doc, 'IPI', brl(preco.ipi_valor));
      this.linhaPdf(doc, 'PREÇO FINAL SUGERIDO', brl(preco.preco_final), true);
      this.linhaPdf(doc, 'Impostos por unidade', brl(preco.impostos_totais));
      this.linhaPdf(doc, 'Lucro por unidade', brl(preco.lucro_unitario));
      this.linhaPdf(doc, 'Markup equivalente', `${preco.markup_pct}%`);
    }

    doc.moveDown(2);
    doc.fontSize(8).fillColor('#888').text(
      `Gerado pelo Grimorium Industrial em ${new Date().toLocaleString('pt-BR')}. ` +
      'Valores tributários simplificados (sem ST, DIFAL ou FCP) — valide com sua contabilidade.',
    );
    doc.end();
  }

  async pedidoPdf(empresaId: number, pedidoId: number, res: Response) {
    const [pedidos]: any = await this.pool.query('SELECT * FROM pedidos WHERE id=? AND empresa_id=?', [pedidoId, empresaId]);
    if (!pedidos.length) throw new NotFoundException('Pedido não encontrado');
    const pedido = pedidos[0];
    const [itens]: any = await this.pool.query(
      `SELECT pi.*, p.nome, p.unidade FROM pedido_itens pi JOIN produtos p ON p.id = pi.produto_id WHERE pi.pedido_id=?`,
      [pedidoId],
    );
    const [empresas]: any = await this.pool.query('SELECT * FROM empresas WHERE id=?', [empresaId]);
    const empresa = empresas[0];

    const doc = this.iniciarPdf(res, `pedido-${pedido.numero}.pdf`);
    doc.fontSize(18).font('Helvetica-Bold').text(`Pedido ${pedido.numero}`);
    doc.fontSize(10).font('Helvetica').fillColor('#555').text(empresa.razao_social);
    doc.moveDown();
    this.linhaPdf(doc, 'Cliente', `${pedido.cliente} (${pedido.cliente_uf})`);
    this.linhaPdf(doc, 'Data do pedido', String(pedido.data_pedido));
    this.linhaPdf(doc, 'Data de entrega', String(pedido.data_entrega || '—'));
    this.linhaPdf(doc, 'Status', pedido.status);
    doc.moveDown();

    this.secao(doc, 'Itens');
    let total = 0;
    for (const i of itens) {
      const sub = Number(i.quantidade) * Number(i.preco_unitario);
      total += sub;
      this.linhaPdf(doc, `${i.nome} — ${Number(i.quantidade)} ${i.unidade} × ${brl(i.preco_unitario)}`, brl(sub));
    }
    this.linhaPdf(doc, 'TOTAL DO PEDIDO', brl(total), true);
    if (pedido.observacao) {
      doc.moveDown();
      this.secao(doc, 'Observações');
      doc.fontSize(10).fillColor('#333').text(pedido.observacao);
    }
    doc.end();
  }

  private iniciarPdf(res: Response, nome: string) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nome}"`);
    const doc = new PDFDocument({ size: 'A4', margin: 46 });
    doc.pipe(res);
    return doc;
  }

  private secao(doc: any, titulo: string) {
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#1a3a5c').text(titulo);
    doc.moveTo(doc.x, doc.y + 2).lineTo(549, doc.y + 2).strokeColor('#c8d4e4').stroke();
    doc.moveDown(0.4);
  }

  private linhaPdf(doc: any, rotulo: string, valor: string, destaque = false) {
    const y = doc.y;
    doc.fontSize(destaque ? 11 : 10)
      .font(destaque ? 'Helvetica-Bold' : 'Helvetica')
      .fillColor('#333')
      .text(rotulo, 46, y, { width: 360 });
    doc.font(destaque ? 'Helvetica-Bold' : 'Helvetica')
      .text(valor, 410, y, { width: 139, align: 'right' });
    doc.moveDown(0.25);
  }
}

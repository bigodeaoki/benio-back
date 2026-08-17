import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { POOL, Pool } from '../db/database.module';

@Injectable()
export class ProdutosService {
  constructor(@Inject(POOL) private pool: Pool) {}

  async listar(empresaId: number) {
    const [rows]: any = await this.pool.query(
      `SELECT p.*, l.nome AS linha_nome, l.rendimento_pct AS linha_rendimento_pct,
              n.descricao AS ncm_descricao, n.ipi_pct,
              (SELECT COUNT(*) FROM formula_itens fi WHERE fi.produto_id = p.id) AS qtd_itens_formula
       FROM produtos p
       LEFT JOIN linhas_processo l ON l.id = p.linha_id
       LEFT JOIN ncm n ON n.codigo = p.ncm_codigo
       WHERE p.empresa_id=? ORDER BY p.nome`,
      [empresaId],
    );
    return rows;
  }

  async obter(empresaId: number, id: number) {
    const [rows]: any = await this.pool.query(
      `SELECT p.*, l.nome AS linha_nome, n.descricao AS ncm_descricao, n.ipi_pct
       FROM produtos p
       LEFT JOIN linhas_processo l ON l.id = p.linha_id
       LEFT JOIN ncm n ON n.codigo = p.ncm_codigo
       WHERE p.id=? AND p.empresa_id=?`,
      [id, empresaId],
    );
    if (!rows.length) throw new NotFoundException('Produto não encontrado');
    const [itens]: any = await this.pool.query(
      `SELECT fi.id, fi.materia_prima_id, fi.quantidade,
              mp.nome, mp.unidade, mp.custo_unitario, mp.rendimento_pct
       FROM formula_itens fi JOIN materias_primas mp ON mp.id = fi.materia_prima_id
       WHERE fi.produto_id=? ORDER BY mp.nome`,
      [id],
    );
    return { ...rows[0], itens };
  }

  async criar(empresaId: number, body: any) {
    this.validar(body);
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      const [res]: any = await conn.query(
        `INSERT INTO produtos
         (empresa_id, nome, unidade, peso_kg, ncm_codigo, linha_id, rendimento_linha_pct,
          horas_producao, tamanho_lote, manutencao_pct, margem_pct, icms_pct_override, ativo)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        this.parametros(empresaId, body),
      );
      await this.salvarFormula(conn, res.insertId, body.itens);
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
    this.validar(body);
    const [existe]: any = await this.pool.query('SELECT id FROM produtos WHERE id=? AND empresa_id=?', [id, empresaId]);
    if (!existe.length) throw new NotFoundException('Produto não encontrado');
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      const params = this.parametros(empresaId, body);
      params.shift(); // remove empresa_id (não muda no update)
      await conn.query(
        `UPDATE produtos SET nome=?, unidade=?, peso_kg=?, ncm_codigo=?, linha_id=?, rendimento_linha_pct=?,
         horas_producao=?, tamanho_lote=?, manutencao_pct=?, margem_pct=?, icms_pct_override=?, ativo=?
         WHERE id=?`,
        [...params, id],
      );
      await conn.query('DELETE FROM formula_itens WHERE produto_id=?', [id]);
      await this.salvarFormula(conn, id, body.itens);
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
    try {
      await this.pool.query('DELETE FROM produtos WHERE id=? AND empresa_id=?', [id, empresaId]);
    } catch (e: any) {
      if (e?.code === 'ER_ROW_IS_REFERENCED_2') {
        throw new BadRequestException('Produto em uso em pedidos/ordens — remova-os antes');
      }
      throw e;
    }
    return { ok: true };
  }

  private validar(body: any) {
    if (!body?.nome) throw new BadRequestException('Nome do produto é obrigatório');
    if (Number(body.tamanho_lote) <= 0) throw new BadRequestException('Tamanho do lote deve ser maior que zero');
  }

  private parametros(empresaId: number, body: any): any[] {
    return [
      empresaId, body.nome, body.unidade || 'un', body.peso_kg ?? 0,
      body.ncm_codigo || null, body.linha_id || null, body.rendimento_linha_pct ?? 100,
      body.horas_producao ?? 0, body.tamanho_lote ?? 1, body.manutencao_pct ?? 0,
      body.margem_pct ?? 25, body.icms_pct_override ?? null, body.ativo ?? 1,
    ];
  }

  private async salvarFormula(conn: any, produtoId: number, itens: any[]) {
    for (const item of itens || []) {
      if (!item?.materia_prima_id || !(Number(item.quantidade) > 0)) continue;
      await conn.query(
        'INSERT INTO formula_itens (produto_id, materia_prima_id, quantidade) VALUES (?,?,?)',
        [produtoId, Number(item.materia_prima_id), Number(item.quantidade)],
      );
    }
  }
}

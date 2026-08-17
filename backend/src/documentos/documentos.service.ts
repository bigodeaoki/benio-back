import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { POOL, Pool } from '../db/database.module';

export const TIPOS_DOCUMENTO = [
  'obrigatorio',
  'especificacao_tecnica',
  'ficha_tecnica',
  'certificado',
  'laudo',
  'manual',
  'desenho',
  'fiscal',
  'outro',
] as const;

const TAMANHO_MAXIMO = 5 * 1024 * 1024; // 5 MB por documento

@Injectable()
export class DocumentosService {
  constructor(@Inject(POOL) private pool: Pool) {}

  // Lista sem o conteúdo (o binário só sai no download)
  async listar(empresaId: number, filtros: { tipo?: string; tag_id?: number; busca?: string }) {
    const condicoes: string[] = ['d.empresa_id = ?'];
    const params: any[] = [empresaId];
    if (filtros.tipo) {
      condicoes.push('d.tipo = ?');
      params.push(filtros.tipo);
    }
    if (filtros.tag_id) {
      condicoes.push('EXISTS (SELECT 1 FROM documento_tag_vinculos v WHERE v.documento_id = d.id AND v.tag_id = ?)');
      params.push(filtros.tag_id);
    }
    if (filtros.busca) {
      condicoes.push('(d.nome LIKE ? OR d.arquivo_nome LIKE ? OR d.descricao LIKE ?)');
      const termo = `%${filtros.busca}%`;
      params.push(termo, termo, termo);
    }
    const [docs]: any = await this.pool.query(
      `SELECT d.id, d.nome, d.tipo, d.descricao, d.arquivo_nome, d.mime, d.tamanho_bytes, d.criado_em,
              u.nome AS criado_por_nome
       FROM documentos d LEFT JOIN usuarios u ON u.id = d.criado_por
       WHERE ${condicoes.join(' AND ')}
       ORDER BY d.criado_em DESC, d.id DESC`,
      params,
    );
    if (!docs.length) return [];
    const ids = docs.map((d: any) => d.id);
    const [vinculos]: any = await this.pool.query(
      `SELECT v.documento_id, t.id, t.nome
       FROM documento_tag_vinculos v JOIN documento_tags t ON t.id = v.tag_id
       WHERE v.documento_id IN (?) ORDER BY t.nome`,
      [ids],
    );
    return docs.map((d: any) => ({
      ...d,
      tags: vinculos.filter((v: any) => v.documento_id === d.id).map((v: any) => ({ id: v.id, nome: v.nome })),
    }));
  }

  // Tags da empresa com contagem de uso (para o select de filtro)
  async listarTags(empresaId: number) {
    const [rows]: any = await this.pool.query(
      `SELECT t.id, t.nome, COUNT(v.documento_id) AS usos
       FROM documento_tags t
       LEFT JOIN documento_tag_vinculos v ON v.tag_id = t.id
       WHERE t.empresa_id = ?
       GROUP BY t.id, t.nome
       ORDER BY t.nome`,
      [empresaId],
    );
    return rows;
  }

  async criar(empresaId: number, usuarioId: number, body: any) {
    this.validarMetadados(body);
    const arquivo = this.decodificarArquivo(body, true);
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      const [res]: any = await conn.query(
        `INSERT INTO documentos (empresa_id, nome, tipo, descricao, arquivo_nome, mime, tamanho_bytes, conteudo, criado_por)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [
          empresaId, body.nome, body.tipo, body.descricao || null,
          arquivo.nome, arquivo.mime, arquivo.conteudo.length, arquivo.conteudo, usuarioId,
        ],
      );
      await this.sincronizarTags(conn, empresaId, res.insertId, body.tags);
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
    this.validarMetadados(body);
    const [existe]: any = await this.pool.query('SELECT id FROM documentos WHERE id=? AND empresa_id=?', [id, empresaId]);
    if (!existe.length) throw new NotFoundException('Documento não encontrado');
    const arquivo = this.decodificarArquivo(body, false);
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('UPDATE documentos SET nome=?, tipo=?, descricao=? WHERE id=?', [
        body.nome, body.tipo, body.descricao || null, id,
      ]);
      if (arquivo) {
        await conn.query('UPDATE documentos SET arquivo_nome=?, mime=?, tamanho_bytes=?, conteudo=? WHERE id=?', [
          arquivo.nome, arquivo.mime, arquivo.conteudo.length, arquivo.conteudo, id,
        ]);
      }
      await conn.query('DELETE FROM documento_tag_vinculos WHERE documento_id=?', [id]);
      await this.sincronizarTags(conn, empresaId, id, body.tags);
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
    await this.pool.query('DELETE FROM documentos WHERE id=? AND empresa_id=?', [id, empresaId]);
    await this.removerTagsOrfas(empresaId);
    return { ok: true };
  }

  async arquivo(empresaId: number, id: number) {
    const [rows]: any = await this.pool.query(
      'SELECT arquivo_nome, mime, conteudo FROM documentos WHERE id=? AND empresa_id=?',
      [id, empresaId],
    );
    if (!rows.length) throw new NotFoundException('Documento não encontrado');
    return rows[0];
  }

  private validarMetadados(body: any) {
    if (!body?.nome?.trim()) throw new BadRequestException('Nome do documento é obrigatório');
    if (!TIPOS_DOCUMENTO.includes(body?.tipo)) {
      throw new BadRequestException('Tipo de documento inválido');
    }
  }

  private decodificarArquivo(body: any, obrigatorio: boolean) {
    if (!body?.conteudo_base64) {
      if (obrigatorio) throw new BadRequestException('Selecione o arquivo do documento');
      return null;
    }
    let conteudo: Buffer;
    try {
      conteudo = Buffer.from(String(body.conteudo_base64), 'base64');
    } catch {
      throw new BadRequestException('Arquivo inválido (falha ao decodificar)');
    }
    if (!conteudo.length) throw new BadRequestException('Arquivo vazio');
    if (conteudo.length > TAMANHO_MAXIMO) {
      throw new BadRequestException(
        `Arquivo com ${(conteudo.length / 1024 / 1024).toFixed(1)} MB — o limite é ${TAMANHO_MAXIMO / 1024 / 1024} MB por documento`,
      );
    }
    return {
      conteudo,
      nome: String(body.arquivo_nome || 'documento').slice(0, 255),
      mime: String(body.mime || 'application/octet-stream').slice(0, 120),
    };
  }

  // Cria as tags que não existem (por empresa) e vincula ao documento
  private async sincronizarTags(conn: any, empresaId: number, documentoId: number, tags: any) {
    const nomes = [...new Set(
      (Array.isArray(tags) ? tags : [])
        .map((t: any) => String(t || '').trim().replace(/\s+/g, ' ').slice(0, 60))
        .filter(Boolean),
    )];
    for (const nome of nomes) {
      await conn.query('INSERT IGNORE INTO documento_tags (empresa_id, nome) VALUES (?,?)', [empresaId, nome]);
      const [tag]: any = await conn.query('SELECT id FROM documento_tags WHERE empresa_id=? AND nome=?', [empresaId, nome]);
      await conn.query('INSERT IGNORE INTO documento_tag_vinculos (documento_id, tag_id) VALUES (?,?)', [documentoId, tag[0].id]);
    }
  }

  // Remove tags que ficaram sem nenhum documento (mantém o select de filtros limpo)
  private async removerTagsOrfas(empresaId: number) {
    await this.pool.query(
      `DELETE FROM documento_tags WHERE empresa_id=? AND id NOT IN (SELECT DISTINCT tag_id FROM documento_tag_vinculos)`,
      [empresaId],
    );
  }
}

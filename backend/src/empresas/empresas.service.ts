import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { POOL, Pool } from '../db/database.module';
import { limparCnpj } from '../shared/cnpj';

@Injectable()
export class EmpresasService {
  constructor(@Inject(POOL) private pool: Pool) {}

  async listar(empresaIds: number[]) {
    const [rows]: any = await this.pool.query('SELECT * FROM empresas WHERE id IN (?) ORDER BY id', [empresaIds]);
    return rows;
  }

  async criar(body: any) {
    this.validar(body);
    const [res]: any = await this.pool.query(
      `INSERT INTO empresas (razao_social, nome_fantasia, cnpj, ie, uf, municipio, endereco, regime, aliquota_simples)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        body.razao_social, body.nome_fantasia || null, limparCnpj(body.cnpj), body.ie || null,
        body.uf || 'SP', body.municipio || null, body.endereco || null,
        body.regime || 'presumido', body.aliquota_simples ?? 6,
      ],
    );
    return { id: res.insertId };
  }

  async atualizar(id: number, body: any) {
    this.validar(body);
    await this.pool.query(
      `UPDATE empresas SET razao_social=?, nome_fantasia=?, cnpj=?, ie=?, uf=?, municipio=?, endereco=?, regime=?, aliquota_simples=?
       WHERE id=?`,
      [
        body.razao_social, body.nome_fantasia || null, limparCnpj(body.cnpj), body.ie || null,
        body.uf || 'SP', body.municipio || null, body.endereco || null,
        body.regime || 'presumido', body.aliquota_simples ?? 6, id,
      ],
    );
    return { ok: true };
  }

  async remover(id: number) {
    const [rows]: any = await this.pool.query('SELECT COUNT(*) AS c FROM empresas');
    if (rows[0].c <= 1) throw new BadRequestException('Não é possível remover a última empresa');
    await this.pool.query('DELETE FROM empresas WHERE id=?', [id]);
    return { ok: true };
  }

  private validar(body: any) {
    if (!body?.razao_social) throw new BadRequestException('Razão social é obrigatória');
  }
}

import { BadRequestException, Body, Controller, Delete, Get, Inject, Param, Post, Put } from '@nestjs/common';
import { POOL, Pool } from '../db/database.module';
import { Papeis } from '../auth/decorators';
import { PERM } from '../auth/papeis';

// Tabelas fiscais globais: NCM (com IPI da TIPI) e alíquotas internas de ICMS por UF
@Controller('fiscal')
export class FiscalController {
  constructor(@Inject(POOL) private pool: Pool) {}

  @Get('ncm')
  async listarNcm() {
    const [rows]: any = await this.pool.query('SELECT * FROM ncm ORDER BY codigo');
    return rows;
  }

  @Papeis(...PERM.fiscal)
  @Post('ncm')
  async criarNcm(@Body() body: any) {
    const codigo = String(body?.codigo || '').replace(/\D/g, '');
    if (codigo.length !== 8) throw new BadRequestException('NCM deve ter 8 dígitos');
    if (!body?.descricao) throw new BadRequestException('Descrição é obrigatória');
    await this.pool.query(
      'INSERT INTO ncm (codigo, descricao, ipi_pct) VALUES (?,?,?) ON DUPLICATE KEY UPDATE descricao=VALUES(descricao), ipi_pct=VALUES(ipi_pct)',
      [codigo, body.descricao, body.ipi_pct ?? 0],
    );
    return { codigo };
  }

  @Papeis(...PERM.fiscal)
  @Put('ncm/:codigo')
  async atualizarNcm(@Param('codigo') codigo: string, @Body() body: any) {
    await this.pool.query('UPDATE ncm SET descricao=?, ipi_pct=? WHERE codigo=?', [
      body.descricao, body.ipi_pct ?? 0, codigo,
    ]);
    return { ok: true };
  }

  @Papeis(...PERM.fiscal)
  @Delete('ncm/:codigo')
  async removerNcm(@Param('codigo') codigo: string) {
    await this.pool.query('DELETE FROM ncm WHERE codigo=?', [codigo]);
    return { ok: true };
  }

  @Get('icms')
  async listarIcms() {
    const [rows]: any = await this.pool.query('SELECT * FROM icms_uf ORDER BY uf');
    return rows;
  }

  @Papeis(...PERM.fiscal)
  @Put('icms/:uf')
  async atualizarIcms(@Param('uf') uf: string, @Body() body: any) {
    const aliquota = Number(body?.aliquota_interna);
    if (!(aliquota > 0 && aliquota < 40)) throw new BadRequestException('Alíquota inválida');
    await this.pool.query('UPDATE icms_uf SET aliquota_interna=? WHERE uf=?', [aliquota, uf.toUpperCase()]);
    return { ok: true };
  }
}

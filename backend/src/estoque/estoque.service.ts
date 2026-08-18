import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { POOL, Pool } from '../db/database.module';
import { MateriasService } from '../materias/materias.service';
import { round4 } from '../shared/calculos';

@Injectable()
export class EstoqueService {
  constructor(@Inject(POOL) private pool: Pool) {}

  async posicao(empresaId: number) {
    const [rows]: any = await this.pool.query(
      `SELECT id, nome, unidade, custo_unitario, estoque_atual, estoque_minimo
       FROM materias_primas WHERE empresa_id=? ORDER BY nome`,
      [empresaId],
    );
    return rows.map((r: any) => ({
      ...r,
      valor_estoque: Math.round(Number(r.estoque_atual) * Number(r.custo_unitario) * 100) / 100,
      situacao: Number(r.estoque_atual) <= 0 ? 'zerado' : Number(r.estoque_atual) < Number(r.estoque_minimo) ? 'abaixo_minimo' : 'ok',
    }));
  }

  async movimentos(empresaId: number, materiaPrimaId?: number) {
    const filtro = materiaPrimaId ? 'AND em.materia_prima_id=?' : '';
    const params: any[] = [empresaId];
    if (materiaPrimaId) params.push(materiaPrimaId);
    const [rows]: any = await this.pool.query(
      `SELECT em.*, mp.nome AS materia_prima_nome, mp.unidade
       FROM estoque_movimentos em JOIN materias_primas mp ON mp.id = em.materia_prima_id
       WHERE em.empresa_id=? ${filtro} ORDER BY em.data DESC, em.id DESC LIMIT 300`,
      params,
    );
    return rows;
  }

  // Entrada só entra por compra (aba Matérias-primas), para que todo saldo tenha
  // lote de origem. Saída consome os lotes em ordem de data (FIFO); ajuste leva o
  // saldo ao valor informado, consumindo ou devolvendo aos lotes conforme o caso.
  async movimentar(empresaId: number, body: any) {
    const materiaPrimaId = Number(body?.materia_prima_id);
    const quantidade = Number(body?.quantidade);
    const tipo = body?.tipo;
    if (tipo === 'entrada') {
      throw new BadRequestException(
        'Entrada de estoque é lançada como compra, na aba Matérias-primas (com fornecedor, nota e valor)',
      );
    }
    if (!materiaPrimaId || !['saida', 'ajuste'].includes(tipo)) {
      throw new BadRequestException('Informe matéria-prima e tipo (saida/ajuste)');
    }
    if (!(quantidade >= 0) || (tipo !== 'ajuste' && !(quantidade > 0))) {
      throw new BadRequestException('Quantidade inválida');
    }
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      const [mps]: any = await conn.query(
        'SELECT * FROM materias_primas WHERE id=? AND empresa_id=? FOR UPDATE',
        [materiaPrimaId, empresaId],
      );
      if (!mps.length) throw new NotFoundException('Matéria-prima não encontrada');
      const saldoAtual = Number(mps[0].estoque_atual);

      let quantidadeMovimento: number;
      if (tipo === 'saida') {
        await MateriasService.consumirFifo(conn, materiaPrimaId, quantidade);
        quantidadeMovimento = quantidade;
      } else {
        const diferenca = round4(quantidade - saldoAtual);
        if (diferenca < 0) {
          await MateriasService.consumirFifo(conn, materiaPrimaId, Math.abs(diferenca));
        } else if (diferenca > 0) {
          // devolve aos lotes já consumidos; sem lote com espaço, não há de onde tirar
          const { nao_alocado } = await MateriasService.estornarFifo(conn, materiaPrimaId, diferenca);
          if (nao_alocado > 0) {
            throw new BadRequestException(
              `Não há lote para acomodar ${nao_alocado} — lance uma compra na aba Matérias-primas`,
            );
          }
        }
        quantidadeMovimento = diferenca;
      }

      await conn.query(
        'INSERT INTO estoque_movimentos (empresa_id, materia_prima_id, tipo, quantidade, custo_unitario, origem) VALUES (?,?,?,?,?,?)',
        [empresaId, materiaPrimaId, tipo, quantidadeMovimento, body.custo_unitario ?? null, body.origem || null],
      );
      const { estoque_atual } = await MateriasService.recalcular(conn, materiaPrimaId);
      await conn.commit();
      return { ok: true, saldo: estoque_atual };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }
}

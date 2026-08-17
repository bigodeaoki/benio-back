import { BadGatewayException, BadRequestException, Inject, Injectable } from '@nestjs/common';
import { POOL, Pool } from '../db/database.module';
import { limparCnpj } from '../shared/cnpj';

// Consultas públicas da BrasilAPI (dados da Receita Federal e tabela NCM).
// Requer acesso à internet a partir do container do backend.
const BRASILAPI = 'https://brasilapi.com.br/api';

@Injectable()
export class IntegracaoService {
  constructor(@Inject(POOL) private pool: Pool) {}

  async consultarCnpj(cnpj: string) {
    const doc = limparCnpj(cnpj);
    if (!doc) throw new BadRequestException('Informe o CNPJ para consultar');
    const dados: any = await buscar(
      `${BRASILAPI}/cnpj/v1/${doc}`,
      8000,
      'CNPJ não encontrado na Receita Federal — confira o número informado',
    );
    return {
      cnpj: doc,
      razao_social: dados.razao_social,
      nome_fantasia: dados.nome_fantasia || null,
      situacao: dados.descricao_situacao_cadastral,
      uf: dados.uf,
      municipio: dados.municipio,
      endereco: [dados.descricao_tipo_de_logradouro, dados.logradouro, dados.numero].filter(Boolean).join(' '),
      cnae_principal: dados.cnae_fiscal_descricao,
      porte: dados.porte,
      simples: dados.opcao_pelo_simples ?? null,
      fonte: 'BrasilAPI / Receita Federal',
    };
  }

  // Busca NCM na tabela local e complementa com a BrasilAPI (se disponível)
  async buscarNcm(q: string) {
    const termo = String(q || '').trim();
    if (!termo) return [];
    const [locais]: any = await this.pool.query(
      'SELECT codigo, descricao, ipi_pct, 1 AS local FROM ncm WHERE codigo LIKE ? OR descricao LIKE ? ORDER BY codigo LIMIT 15',
      [`${termo.replace(/\D/g, '') || termo}%`, `%${termo}%`],
    );
    let externos: any[] = [];
    try {
      const dados: any = await buscar(`${BRASILAPI}/ncm/v1?search=${encodeURIComponent(termo)}`, 6000);
      externos = (Array.isArray(dados) ? dados : []).slice(0, 15).map((n: any) => ({
        codigo: String(n.codigo || '').replace(/\D/g, ''),
        descricao: n.descricao,
        ipi_pct: null,
        local: 0,
      }));
    } catch {
      // sem internet ou API fora: segue apenas com a tabela local
    }
    const vistos = new Set(locais.map((l: any) => l.codigo));
    return [...locais, ...externos.filter((e) => e.codigo && !vistos.has(e.codigo))].slice(0, 25);
  }
}

async function buscar(url: string, timeoutMs = 8000, msg404 = 'Registro não encontrado na base pública'): Promise<any> {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { signal: controle.signal, headers: { accept: 'application/json' } });
    if (resp.status === 404) throw new BadRequestException(msg404);
    if (!resp.ok) throw new BadGatewayException(`Serviço externo respondeu ${resp.status}`);
    return await resp.json();
  } catch (e: any) {
    if (e instanceof BadRequestException || e instanceof BadGatewayException) throw e;
    throw new BadGatewayException('Falha ao consultar serviço externo (verifique a conexão do servidor)');
  } finally {
    clearTimeout(timer);
  }
}

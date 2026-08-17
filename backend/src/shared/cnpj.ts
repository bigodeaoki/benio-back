import { BadRequestException } from '@nestjs/common';

// Limpa e valida um CNPJ. Aceita o formato numérico tradicional e o
// alfanumérico (em vigor desde jul/2026 — letras nas 12 primeiras posições,
// dígitos verificadores sempre numéricos, calculados por módulo 11 sobre
// o valor ASCII − 48 de cada caractere).
// Retorna null para vazio; lança BadRequestException descritiva se inválido.
export function limparCnpj(valor: any, rotulo = 'CNPJ'): string | null {
  const cnpj = String(valor ?? '').replace(/[.\-\/\s]/g, '').toUpperCase();
  if (!cnpj) return null;
  if (cnpj.length !== 14) {
    throw new BadRequestException(
      `${rotulo} inválido: deve ter 14 caracteres sem pontuação — o informado tem ${cnpj.length}`,
    );
  }
  if (!/^[A-Z0-9]{12}\d{2}$/.test(cnpj)) {
    throw new BadRequestException(
      `${rotulo} inválido: use apenas números (ou letras, no formato alfanumérico) e 2 dígitos finais`,
    );
  }
  if (/^(.)\1{13}$/.test(cnpj)) {
    throw new BadRequestException(`${rotulo} inválido: sequência com todos os caracteres repetidos`);
  }
  if (digitoVerificador(cnpj.slice(0, 12)) !== Number(cnpj[12]) || digitoVerificador(cnpj.slice(0, 13)) !== Number(cnpj[13])) {
    throw new BadRequestException(`${rotulo} inválido: dígitos verificadores não conferem — confira o número digitado`);
  }
  return cnpj;
}

function digitoVerificador(base: string): number {
  let peso = 2;
  let soma = 0;
  for (let i = base.length - 1; i >= 0; i--) {
    soma += (base.charCodeAt(i) - 48) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

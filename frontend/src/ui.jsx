import React from 'react';

export const fmtBRL = (v) =>
  v == null || isNaN(v) ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const fmtNum = (v, casas = 2) =>
  v == null || isNaN(v) ? '—' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: casas });

export const fmtPct = (v) => (v == null || isNaN(v) ? '—' : `${fmtNum(v)}%`);

export const fmtData = (v) => {
  if (!v) return '—';
  const [ano, mes, dia] = String(v).slice(0, 10).split('-');
  return dia ? `${dia}/${mes}/${ano}` : String(v);
};

const CORES_STATUS = {
  aberto: 'azul', em_producao: 'amarelo', faturado: 'roxo', entregue: 'verde', cancelado: 'cinza',
  planejada: 'cinza', liberada: 'azul', concluida: 'verde', cancelada: 'cinza',
  emitida_homologacao: 'verde', rascunho: 'cinza',
  ok: 'verde', abaixo_minimo: 'vermelho', zerado: 'vermelho', comprar: 'vermelho', suficiente: 'verde',
  vigente: 'verde', obsoleto: 'cinza',
};

const ROTULOS = {
  aberto: 'Aberto', em_producao: 'Em produção', faturado: 'Faturado', entregue: 'Entregue', cancelado: 'Cancelado',
  planejada: 'Planejada', liberada: 'Liberada', concluida: 'Concluída', cancelada: 'Cancelada',
  emitida_homologacao: 'Emitida (homolog.)', rascunho: 'Rascunho',
  ok: 'OK', abaixo_minimo: 'Abaixo do mínimo', zerado: 'Zerado', comprar: 'Comprar', suficiente: 'Suficiente',
  vigente: 'Vigente', obsoleto: 'Obsoleto',
};

export const PAPEL_ROTULOS = {
  admin: 'Admin', producao: 'Produção', qualidade: 'Qualidade',
  compras: 'Compras', vendas: 'Vendas', operador: 'Operador',
  financeiro: 'Financeiro'
};

export function Badge({ valor }) {
  return <span className={`badge badge-${CORES_STATUS[valor] || 'cinza'}`}>{ROTULOS[valor] || valor}</span>;
}

export function Modal({ titulo, largura = 640, onFechar, children, rodape }) {
  return (
    <div className="modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <div className="modal" style={{ maxWidth: largura }}>
        <div className="modal-cabecalho">
          <h3>{titulo}</h3>
          <button className="botao-fechar" onClick={onFechar} aria-label="Fechar">×</button>
        </div>
        <div className="modal-corpo">{children}</div>
        {rodape && <div className="modal-rodape">{rodape}</div>}
      </div>
    </div>
  );
}

export function Campo({ rotulo, dica, children, largura }) {
  return (
    <label className="campo" style={largura ? { width: largura, flex: 'none' } : undefined}>
      <span className="campo-rotulo">{rotulo}</span>
      {children}
      {dica && <span className="campo-dica">{dica}</span>}
    </label>
  );
}

export function Erro({ msg }) {
  if (!msg) return null;
  return <div className="alerta alerta-erro">{msg}</div>;
}

export function Aviso({ children }) {
  return <div className="alerta alerta-aviso">{children}</div>;
}

export function Vazio({ msg = 'Nenhum registro encontrado' }) {
  return <div className="vazio">{msg}</div>;
}

export function Carregando() {
  return <div className="vazio">Carregando…</div>;
}

export function BotaoDownload({ href, children }) {
  return (
    <a className="botao botao-secundario" href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

// Hook simples de carregamento de dados
export function useDados(fn, deps = []) {
  const [dados, setDados] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  const [carregando, setCarregando] = React.useState(true);
  const recarregar = React.useCallback(() => {
    setCarregando(true);
    setErro(null);
    fn()
      .then(setDados)
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, deps); // eslint-disable-line
  React.useEffect(recarregar, [recarregar]);
  return { dados, erro, carregando, recarregar, setDados };
}

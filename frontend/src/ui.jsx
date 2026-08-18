import React from 'react';
import { AlertTriangle, CheckCircle2, HelpCircle, Info, X, XCircle } from 'lucide-react';

/* ============ Toasts ============ */
// API global: toast.sucesso('...'), toast.erro('...'), toast.info('...')
let ouvinteToast = null;
let sequenciaToast = 0;

function emitirToast(tipo, mensagem) {
  if (ouvinteToast) ouvinteToast({ id: ++sequenciaToast, tipo, mensagem: String(mensagem) });
}

export const toast = {
  sucesso: (m) => emitirToast('sucesso', m),
  erro: (m) => emitirToast('erro', m),
  info: (m) => emitirToast('info', m),
};

const ICONE_TOAST = { sucesso: CheckCircle2, erro: XCircle, info: Info };

export function Toasts() {
  const [lista, setLista] = React.useState([]);

  React.useEffect(() => {
    ouvinteToast = (t) => {
      setLista((s) => [...s.slice(-4), t]); // no máximo 5 na tela
      setTimeout(() => setLista((s) => s.filter((x) => x.id !== t.id)), t.tipo === 'erro' ? 6500 : 4200);
    };
    return () => { ouvinteToast = null; };
  }, []);

  if (!lista.length) return null;
  return (
    <div className="toasts">
      {lista.map((t) => {
        const Icone = ICONE_TOAST[t.tipo] || Info;
        return (
          <div key={t.id} className={`toast toast-${t.tipo}`}>
            <Icone size={17} className="toast-icone" />
            <span className="toast-texto">{t.mensagem}</span>
            <button
              className="toast-fechar"
              onClick={() => setLista((s) => s.filter((x) => x.id !== t.id))}
              aria-label="Fechar aviso"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

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

// Máscaras de exibição: (11) 98888-7777 e 111.444.777-35 (CPF); outros formatos ficam como estão
export const fmtTelefone = (v) => {
  const d = String(v || '').replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return v || null;
};

export const fmtDocumento = (v) => {
  const d = String(v || '').replace(/\D/g, '');
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  return v || null;
};

const CORES_STATUS = {
  aberto: 'azul', em_producao: 'amarelo', faturado: 'roxo', entregue: 'verde', cancelado: 'cinza',
  planejada: 'cinza', liberada: 'azul', concluida: 'verde', cancelada: 'cinza',
  emitida_homologacao: 'verde', rascunho: 'cinza',
  ok: 'verde', abaixo_minimo: 'vermelho', zerado: 'vermelho', comprar: 'vermelho', suficiente: 'verde',
  vigente: 'verde', obsoleto: 'cinza',
  ativo_usuario: 'verde', inativo_usuario: 'cinza',
};

const ROTULOS = {
  aberto: 'Aberto', em_producao: 'Em produção', faturado: 'Faturado', entregue: 'Entregue', cancelado: 'Cancelado',
  planejada: 'Planejada', liberada: 'Liberada', concluida: 'Concluída', cancelada: 'Cancelada',
  emitida_homologacao: 'Emitida (homolog.)', rascunho: 'Rascunho',
  ok: 'OK', abaixo_minimo: 'Abaixo do mínimo', zerado: 'Zerado', comprar: 'Comprar', suficiente: 'Suficiente',
  vigente: 'Vigente', obsoleto: 'Obsoleto',
  ativo_usuario: 'Ativo', inativo_usuario: 'Inativo',
};

// Logo Grimorium: livro-caixa antigo minimalista (fecho de alça + ornamento na capa)
export function LogoGrimorium({ size = 19 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="Grimorium"
    >
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M20 9h-4.2a1.9 1.9 0 1 0 0 3.8H20" />
      <path d="m11.5 4.6 1.7 1.7-1.7 1.7-1.7-1.7Z" />
    </svg>
  );
}

/* ============ Confirmação (substitui o confirm() do navegador) ============ */
// Uso: if (!(await confirmar({ titulo, mensagem, confirmarTexto, cancelarTexto, perigo }))) return;
let ouvinteConfirmacao = null;

export function confirmar(opcoes) {
  return new Promise((resolver) => {
    if (!ouvinteConfirmacao) {
      resolver(window.confirm(opcoes?.mensagem || 'Confirmar?')); // fallback se o modal não estiver montado
      return;
    }
    ouvinteConfirmacao({ ...opcoes, resolver });
  });
}

export function Confirmacao() {
  const [pedido, setPedido] = React.useState(null);

  React.useEffect(() => {
    ouvinteConfirmacao = setPedido;
    return () => { ouvinteConfirmacao = null; };
  }, []);

  React.useEffect(() => {
    if (!pedido) return;
    const aoTeclar = (e) => {
      if (e.key === 'Escape') fechar(false);
      if (e.key === 'Enter') fechar(true);
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  });

  if (!pedido) return null;

  function fechar(resposta) {
    pedido.resolver(resposta);
    setPedido(null);
  }

  const Icone = pedido.perigo ? AlertTriangle : HelpCircle;
  return (
    <div className="confirmacao-fundo" onMouseDown={(e) => e.target === e.currentTarget && fechar(false)}>
      <div className="confirmacao" role="alertdialog" aria-modal="true">
        <span className={`confirmacao-icone ${pedido.perigo ? 'perigo' : ''}`}>
          <Icone size={22} />
        </span>
        <div className="confirmacao-conteudo">
          <h3>{pedido.titulo || 'Confirmar ação'}</h3>
          <p>{pedido.mensagem}</p>
          <div className="confirmacao-botoes">
            <button className="botao botao-secundario" onClick={() => fechar(false)}>
              {pedido.cancelarTexto || 'Cancelar'}
            </button>
            <button
              className={`botao ${pedido.perigo ? 'botao-perigo-solido' : ''}`}
              onClick={() => fechar(true)}
              autoFocus
            >
              {pedido.confirmarTexto || 'Confirmar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

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

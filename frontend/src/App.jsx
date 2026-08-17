import React from 'react';
import { api, setSessao, limparSessao, getEmpresaId } from './api.js';
import { PAPEL_ROTULOS } from './ui.jsx';
import Login from './pages/Login.jsx';
import Pedidos from './pages/Pedidos.jsx';
import Formulas from './pages/Formulas.jsx';
import Linhas from './pages/Linhas.jsx';
import Colaboradores from './pages/Colaboradores.jsx';
import Utilidades from './pages/Utilidades.jsx';
import Custos from './pages/Custos.jsx';
import Estoque from './pages/Estoque.jsx';
import Producao from './pages/Producao.jsx';
import Nfe from './pages/Nfe.jsx';
import Dashboards from './pages/Dashboards.jsx';
import Documentos from './pages/Documentos.jsx';
import Usuarios from './pages/Usuarios.jsx';
import Empresas from './pages/Empresas.jsx';
import Config from './pages/Config.jsx';

const MENU = [
  { id: 'dashboards', titulo: 'Dashboards', Componente: Dashboards, classe: 'item-menu-destaque' },
  { grupo: 'Operação' },
  { id: 'pedidos', numero: 1, titulo: 'Pedidos', Componente: Pedidos },
  { id: 'formulas', numero: 2, titulo: 'Fórmulas', Componente: Formulas },
  { id: 'linhas', numero: 3, titulo: 'Linhas de Processo', Componente: Linhas },
  { id: 'colaboradores', numero: 4, titulo: 'Colaboradores', Componente: Colaboradores },
  { id: 'utilidades', numero: 5, titulo: 'Utilidades', Componente: Utilidades },
  { id: 'custos', numero: 6, titulo: 'Custos & Impostos', Componente: Custos },
  { grupo: 'Gestão' },
  { id: 'estoque', titulo: 'Estoque', Componente: Estoque },
  { id: 'producao', titulo: 'Produção (MRP/PCP)', Componente: Producao },
  { id: 'nfe', titulo: 'Notas Fiscais', Componente: Nfe },
  { id: 'documentos', titulo: 'Documentos', Componente: Documentos },
  { grupo: 'Sistema' },
  { id: 'empresas', titulo: 'Empresas', Componente: Empresas },
  { id: 'usuarios', titulo: 'Usuários', Componente: Usuarios, apenasAdmin: true },
  { id: 'config', titulo: 'Configurações', Componente: Config },
];

// A aba ativa vive na URL (/pedidos, /custos, ...) — F5 e voltar/avançar preservam a página
const ABAS_VALIDAS = new Set(MENU.filter((m) => m.id).map((m) => m.id));
const abaDaUrl = () => {
  const caminho = window.location.pathname.replace(/^\/+|\/+$/g, '');
  return ABAS_VALIDAS.has(caminho) ? caminho : 'pedidos';
};

export default function App() {
  const [autenticado, setAutenticado] = React.useState(null); // null = verificando
  const [usuario, setUsuario] = React.useState(null);
  const [empresas, setEmpresas] = React.useState([]);
  const [empresaId, setEmpresaId] = React.useState(getEmpresaId());
  const [aba, setAba] = React.useState(abaDaUrl);

  const navegar = React.useCallback((id) => {
    if (window.location.pathname !== `/${id}`) window.history.pushState(null, '', `/${id}`);
    setAba(id);
  }, []);

  React.useEffect(() => {
    // normaliza a URL na carga ('/' vira '/pedidos') e reage ao voltar/avançar
    if (window.location.pathname !== `/${abaDaUrl()}`) {
      window.history.replaceState(null, '', `/${abaDaUrl()}`);
    }
    const aoNavegarHistorico = () => setAba(abaDaUrl());
    window.addEventListener('popstate', aoNavegarHistorico);
    return () => window.removeEventListener('popstate', aoNavegarHistorico);
  }, []);

  const carregarSessao = React.useCallback(async () => {
    try {
      const dados = await api('/auth/me');
      setUsuario(dados.usuario);
      setEmpresas(dados.empresas);
      const id = dados.empresas.some((e) => e.id === getEmpresaId())
        ? getEmpresaId()
        : dados.empresas[0]?.id;
      setEmpresaId(id);
      setSessao(localStorage.getItem('grimorium_token'), id);
      setAutenticado(true);
    } catch {
      setAutenticado(false);
    }
  }, []);

  React.useEffect(() => {
    if (localStorage.getItem('grimorium_token')) carregarSessao();
    else setAutenticado(false);
    const aoSair = () => setAutenticado(false);
    window.addEventListener('grimorium:logout', aoSair);
    return () => window.removeEventListener('grimorium:logout', aoSair);
  }, [carregarSessao]);

  if (autenticado === null) return <div className="vazio" style={{ paddingTop: 80 }}>Carregando…</div>;
  if (!autenticado) {
    return (
      <Login
        aoEntrar={(dados) => {
          setSessao(dados.token, dados.empresas[0]?.id);
          setUsuario(dados.usuario);
          setEmpresas(dados.empresas);
          setEmpresaId(dados.empresas[0]?.id);
          setAutenticado(true);
        }}
      />
    );
  }

  const itemAtivo = MENU.find((m) => m.id === aba) || MENU[1];
  const Pagina = itemAtivo.Componente;
  const empresaAtiva = empresas.find((e) => e.id === empresaId);

  return (
    <div className="aplicacao">
      <aside className="lateral">
        <div className="lateral-logo">
          Grimorium Industrial
          <small>custos de produção · ERP</small>
        </div>
        {MENU.filter((item) => !item.apenasAdmin || usuario?.papel === 'admin').map((item, i) =>
          item.grupo ? (
            <div key={`g${i}`} className="grupo-menu">{item.grupo}</div>
          ) : (
            <button
              key={item.id}
              className={`item-menu ${item.classe || ''} ${aba === item.id ? 'ativo' : ''}`}
              onClick={() => navegar(item.id)}
            >
              {item.numero && <span className="numero">{item.numero}</span>}
              {item.titulo}
            </button>
          ),
        )}
      </aside>
      <div className="principal">
        <header className="topo">
          <h2>{itemAtivo.titulo}</h2>
          {empresas.length > 1 && (
            <select
              value={empresaId || ''}
              onChange={(e) => {
                const id = Number(e.target.value);
                setEmpresaId(id);
                setSessao(localStorage.getItem('grimorium_token'), id);
              }}
              title="Empresa ativa (multiempresa)"
            >
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome_fantasia || e.razao_social}
                </option>
              ))}
            </select>
          )}
          <span className="usuario">
            {usuario?.nome} · {PAPEL_ROTULOS[usuario?.papel] || usuario?.papel}
          </span>
          <button
            className="botao botao-secundario botao-mini"
            onClick={() => {
              limparSessao();
              setAutenticado(false);
            }}
          >
            Sair
          </button>
        </header>
        <main className="conteudo">
          <Pagina key={`${empresaId}-${aba}`} empresa={empresaAtiva} usuario={usuario} aoTrocarAba={navegar} />
        </main>
      </div>
    </div>
  );
}

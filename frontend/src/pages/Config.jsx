import React from 'react';
import { api } from '../api.js';
import { Campo, Carregando, Erro, Modal, Vazio, fmtNum, useDados } from '../ui.jsx';
import { BuscaNcm } from './Formulas.jsx';

export default function Config({ usuario }) {
  const ehAdmin = usuario?.papel === 'admin';
  const [subAba, setSubAba] = React.useState('empresas');
  return (
    <>
      <div className="sub-abas">
        <button className={`sub-aba ${subAba === 'empresas' ? 'ativa' : ''}`} onClick={() => setSubAba('empresas')}>Empresas</button>
        {ehAdmin && (
          <button className={`sub-aba ${subAba === 'usuarios' ? 'ativa' : ''}`} onClick={() => setSubAba('usuarios')}>Usuários</button>
        )}
        <button className={`sub-aba ${subAba === 'ncm' ? 'ativa' : ''}`} onClick={() => setSubAba('ncm')}>Tabela NCM / IPI</button>
        <button className={`sub-aba ${subAba === 'icms' ? 'ativa' : ''}`} onClick={() => setSubAba('icms')}>ICMS por UF</button>
      </div>
      {subAba === 'empresas' && <Empresas ehAdmin={ehAdmin} />}
      {subAba === 'usuarios' && ehAdmin && <Usuarios />}
      {subAba === 'ncm' && <TabelaNcm />}
      {subAba === 'icms' && <TabelaIcms />}
    </>
  );
}

/* ---------------------- Empresas (multiempresa) ---------------------- */

const REGIMES = [
  { valor: 'simples', rotulo: 'Simples Nacional' },
  { valor: 'presumido', rotulo: 'Lucro Presumido' },
  { valor: 'real', rotulo: 'Lucro Real' },
];

function Empresas({ ehAdmin }) {
  const { dados, erro, carregando, recarregar } = useDados(() => api('/empresas'));
  const { dados: ufs } = useDados(() => api('/fiscal/icms'));
  const [editando, setEditando] = React.useState(null);
  const [msg, setMsg] = React.useState(null);

  async function excluir(e) {
    if (!confirm(`Remover a empresa ${e.razao_social}? TODOS os dados dela serão apagados.`)) return;
    try {
      await api(`/empresas/${e.id}`, { method: 'DELETE' });
      recarregar();
    } catch (err) {
      setMsg(err.message);
    }
  }

  return (
    <div className="cartao">
      <div className="cartao-cabecalho">
        <h3>Empresas</h3>
        {ehAdmin && <button className="botao" onClick={() => setEditando({ novo: true })}>+ Nova empresa</button>}
      </div>
      <div className="alerta alerta-info">
        O <strong>regime tributário</strong> define os impostos do cálculo de preço: Simples Nacional (alíquota efetiva do DAS),
        Lucro Presumido (PIS 0,65% + COFINS 3%) ou Lucro Real (PIS 1,65% + COFINS 7,6%), sempre com ICMS por UF e IPI por NCM.
      </div>
      <Erro msg={erro || msg} />
      {carregando ? <Carregando /> : (
        <div className="tabela-envolucro">
          <table className="tabela">
            <thead>
              <tr>
                <th>Razão social</th>
                <th>Nome fantasia</th>
                <th>CNPJ</th>
                <th>UF</th>
                <th>Regime</th>
                <th className="num">Alíq. Simples</th>
                <th className="acoes">Ações</th>
              </tr>
            </thead>
            <tbody>
              {(dados || []).map((e) => (
                <tr key={e.id}>
                  <td className="negrito">{e.razao_social}</td>
                  <td>{e.nome_fantasia || '—'}</td>
                  <td className="mono">{e.cnpj || '—'}</td>
                  <td>{e.uf}</td>
                  <td>{REGIMES.find((r) => r.valor === e.regime)?.rotulo}</td>
                  <td className="num">{e.regime === 'simples' ? `${fmtNum(e.aliquota_simples)}%` : '—'}</td>
                  <td className="acoes">
                    {ehAdmin && <button className="botao botao-secundario botao-mini" onClick={() => setEditando(e)}>Editar</button>}
                    {ehAdmin && <button className="botao botao-perigo botao-mini" onClick={() => excluir(e)}>Excluir</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editando && (
        <FormEmpresa
          empresa={editando.novo ? null : editando}
          ufs={ufs || []}
          aoFechar={() => setEditando(null)}
          aoSalvar={() => { setEditando(null); recarregar(); }}
        />
      )}
    </div>
  );
}

function FormEmpresa({ empresa, ufs, aoFechar, aoSalvar }) {
  const [f, setF] = React.useState(
    empresa || {
      razao_social: '', nome_fantasia: '', cnpj: '', ie: '', uf: 'SP',
      municipio: '', endereco: '', regime: 'presumido', aliquota_simples: 6,
    },
  );
  const [erro, setErro] = React.useState(null);
  const [buscando, setBuscando] = React.useState(false);
  const mudar = (campo, valor) => setF((s) => ({ ...s, [campo]: valor }));

  async function buscarCnpj() {
    setBuscando(true);
    setErro(null);
    try {
      const d = await api(`/integracao/cnpj/${String(f.cnpj).replace(/[^0-9A-Za-z]/g, '')}`);
      setF((s) => ({
        ...s,
        razao_social: d.razao_social || s.razao_social,
        nome_fantasia: d.nome_fantasia || s.nome_fantasia,
        uf: d.uf || s.uf,
        municipio: d.municipio || s.municipio,
        endereco: d.endereco || s.endereco,
      }));
    } catch (e) {
      setErro(`Consulta CNPJ: ${e.message}`);
    } finally {
      setBuscando(false);
    }
  }

  async function salvar() {
    setErro(null);
    const doc = String(f.cnpj || '').replace(/[.\-\/\s]/g, '');
    if (doc && doc.length !== 14) {
      setErro(`CNPJ inválido: deve ter 14 caracteres sem pontuação — o informado tem ${doc.length}`);
      return;
    }
    try {
      if (empresa) await api(`/empresas/${empresa.id}`, { method: 'PUT', body: f });
      else await api('/empresas', { method: 'POST', body: f });
      aoSalvar();
    } catch (e) {
      setErro(e.message);
    }
  }

  return (
    <Modal titulo={empresa ? `Editar ${empresa.razao_social}` : 'Nova empresa'} largura={700} onFechar={aoFechar}
      rodape={
        <>
          <button className="botao botao-secundario" onClick={aoFechar}>Cancelar</button>
          <button className="botao" onClick={salvar}>Salvar</button>
        </>
      }
    >
      <Erro msg={erro} />
      <div className="linha-campos">
        <Campo rotulo="CNPJ" largura={200}>
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={f.cnpj || ''} onChange={(e) => mudar('cnpj', e.target.value)} placeholder="somente números" />
            <button className="botao botao-secundario" onClick={buscarCnpj} disabled={buscando} title="Buscar na Receita Federal (BrasilAPI)">
              {buscando ? '…' : '🔎'}
            </button>
          </div>
        </Campo>
        <Campo rotulo="Inscrição estadual"><input value={f.ie || ''} onChange={(e) => mudar('ie', e.target.value)} /></Campo>
      </div>
      <div className="linha-campos">
        <Campo rotulo="Razão social *"><input value={f.razao_social} onChange={(e) => mudar('razao_social', e.target.value)} /></Campo>
        <Campo rotulo="Nome fantasia"><input value={f.nome_fantasia || ''} onChange={(e) => mudar('nome_fantasia', e.target.value)} /></Campo>
      </div>
      <div className="linha-campos">
        <Campo rotulo="UF" largura={90}>
          <select value={f.uf} onChange={(e) => mudar('uf', e.target.value)}>
            {ufs.map((u) => <option key={u.uf} value={u.uf}>{u.uf}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Município"><input value={f.municipio || ''} onChange={(e) => mudar('municipio', e.target.value)} /></Campo>
        <Campo rotulo="Endereço"><input value={f.endereco || ''} onChange={(e) => mudar('endereco', e.target.value)} /></Campo>
      </div>
      <div className="linha-campos">
        <Campo rotulo="Regime tributário">
          <select value={f.regime} onChange={(e) => mudar('regime', e.target.value)}>
            {REGIMES.map((r) => <option key={r.valor} value={r.valor}>{r.rotulo}</option>)}
          </select>
        </Campo>
        {f.regime === 'simples' && (
          <Campo rotulo="Alíquota efetiva do DAS (%)" dica="conforme anexo e faixa de faturamento">
            <input type="number" step="any" value={f.aliquota_simples} onChange={(e) => mudar('aliquota_simples', e.target.value)} />
          </Campo>
        )}
      </div>
    </Modal>
  );
}

/* ---------------------- Usuários (multiusuário) ---------------------- */

function Usuarios() {
  const { dados, erro, carregando, recarregar } = useDados(() => api('/usuarios'));
  const { dados: empresas } = useDados(() => api('/empresas'));
  const [editando, setEditando] = React.useState(null);
  const [msg, setMsg] = React.useState(null);

  async function excluir(u) {
    if (!confirm(`Remover o usuário ${u.nome}?`)) return;
    try {
      await api(`/usuarios/${u.id}`, { method: 'DELETE' });
      recarregar();
    } catch (e) {
      setMsg(e.message);
    }
  }

  return (
    <div className="cartao">
      <div className="cartao-cabecalho">
        <h3>Usuários</h3>
        <button className="botao" onClick={() => setEditando({ novo: true })}>+ Novo usuário</button>
      </div>
      <div className="alerta alerta-info">
        Papéis: <strong>admin</strong> (tudo, todas as empresas), <strong>gestor</strong> (cadastros e operações das empresas vinculadas),
        <strong> operador</strong> (consulta + pedidos e apontamentos).
      </div>
      <Erro msg={erro || msg} />
      {carregando ? <Carregando /> : !dados?.length ? <Vazio /> : (
        <table className="tabela">
          <thead>
            <tr><th>Nome</th><th>E-mail</th><th>Papel</th><th>Empresas</th><th>Ativo</th><th className="acoes">Ações</th></tr>
          </thead>
          <tbody>
            {dados.map((u) => (
              <tr key={u.id}>
                <td className="negrito">{u.nome}</td>
                <td>{u.email}</td>
                <td><span className="badge badge-azul">{u.papel}</span></td>
                <td>
                  {u.papel === 'admin'
                    ? <span className="texto-suave">todas</span>
                    : (empresas || []).filter((e) => u.empresa_ids.includes(e.id)).map((e) => e.nome_fantasia || e.razao_social).join(', ') || '—'}
                </td>
                <td>{u.ativo ? 'Sim' : 'Não'}</td>
                <td className="acoes">
                  <button className="botao botao-secundario botao-mini" onClick={() => setEditando(u)}>Editar</button>
                  <button className="botao botao-perigo botao-mini" onClick={() => excluir(u)}>Excluir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {editando && (
        <FormUsuario
          usuario={editando.novo ? null : editando}
          empresas={empresas || []}
          aoFechar={() => setEditando(null)}
          aoSalvar={() => { setEditando(null); recarregar(); }}
        />
      )}
    </div>
  );
}

function FormUsuario({ usuario, empresas, aoFechar, aoSalvar }) {
  const [f, setF] = React.useState(
    usuario
      ? { ...usuario, senha: '' }
      : { nome: '', email: '', senha: '', papel: 'gestor', ativo: 1, empresa_ids: [] },
  );
  const [erro, setErro] = React.useState(null);
  const mudar = (campo, valor) => setF((s) => ({ ...s, [campo]: valor }));

  function alternarEmpresa(id) {
    setF((s) => ({
      ...s,
      empresa_ids: s.empresa_ids.includes(id) ? s.empresa_ids.filter((x) => x !== id) : [...s.empresa_ids, id],
    }));
  }

  async function salvar() {
    setErro(null);
    try {
      const corpo = { ...f };
      if (!corpo.senha) delete corpo.senha;
      if (usuario) await api(`/usuarios/${usuario.id}`, { method: 'PUT', body: corpo });
      else await api('/usuarios', { method: 'POST', body: corpo });
      aoSalvar();
    } catch (e) {
      setErro(e.message);
    }
  }

  return (
    <Modal titulo={usuario ? `Editar ${usuario.nome}` : 'Novo usuário'} onFechar={aoFechar}
      rodape={
        <>
          <button className="botao botao-secundario" onClick={aoFechar}>Cancelar</button>
          <button className="botao" onClick={salvar}>Salvar</button>
        </>
      }
    >
      <Erro msg={erro} />
      <div className="linha-campos">
        <Campo rotulo="Nome *"><input value={f.nome} onChange={(e) => mudar('nome', e.target.value)} /></Campo>
        <Campo rotulo="E-mail *"><input type="email" value={f.email} onChange={(e) => mudar('email', e.target.value)} /></Campo>
      </div>
      <div className="linha-campos">
        <Campo rotulo={usuario ? 'Nova senha (vazio = manter)' : 'Senha *'}>
          <input type="password" value={f.senha} onChange={(e) => mudar('senha', e.target.value)} />
        </Campo>
        <Campo rotulo="Papel">
          <select value={f.papel} onChange={(e) => mudar('papel', e.target.value)}>
            <option value="admin">admin</option>
            <option value="gestor">gestor</option>
            <option value="operador">operador</option>
          </select>
        </Campo>
        <Campo rotulo="Ativo" largura={90}>
          <select value={f.ativo ? 1 : 0} onChange={(e) => mudar('ativo', Number(e.target.value))}>
            <option value={1}>Sim</option>
            <option value={0}>Não</option>
          </select>
        </Campo>
      </div>
      {f.papel !== 'admin' && (
        <Campo rotulo="Empresas com acesso">
          <div>
            {empresas.map((e) => (
              <label key={e.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0' }}>
                <input type="checkbox" checked={f.empresa_ids.includes(e.id)} onChange={() => alternarEmpresa(e.id)} />
                {e.nome_fantasia || e.razao_social}
              </label>
            ))}
          </div>
        </Campo>
      )}
    </Modal>
  );
}

/* ---------------------- NCM ---------------------- */

function TabelaNcm() {
  const { dados, erro, carregando, recarregar } = useDados(() => api('/fiscal/ncm'));
  const [filtro, setFiltro] = React.useState('');
  const [novo, setNovo] = React.useState({ codigo: '', descricao: '', ipi_pct: 0 });
  const [msg, setMsg] = React.useState(null);

  const filtrados = (dados || []).filter(
    (n) => !filtro || n.codigo.includes(filtro.replace(/\D/g, '')) || n.descricao.toLowerCase().includes(filtro.toLowerCase()),
  );

  async function adicionar() {
    setMsg(null);
    try {
      await api('/fiscal/ncm', { method: 'POST', body: novo });
      setNovo({ codigo: '', descricao: '', ipi_pct: 0 });
      recarregar();
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function salvarIpi(n, ipi) {
    try {
      await api(`/fiscal/ncm/${n.codigo}`, { method: 'PUT', body: { descricao: n.descricao, ipi_pct: ipi } });
    } catch (e) {
      setMsg(e.message);
      recarregar();
    }
  }

  async function remover(n) {
    if (!confirm(`Remover NCM ${n.codigo}?`)) return;
    try {
      await api(`/fiscal/ncm/${n.codigo}`, { method: 'DELETE' });
      recarregar();
    } catch (e) {
      setMsg(e.message);
    }
  }

  return (
    <div className="cartao">
      <div className="cartao-cabecalho">
        <h3>Tabela NCM com IPI (TIPI)</h3>
        <input style={{ maxWidth: 260 }} placeholder="filtrar por código ou descrição…" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
      </div>
      <div className="alerta alerta-info">
        Valores de IPI de referência — confira a TIPI vigente. A busca nas fórmulas também consulta a BrasilAPI e novos códigos podem ser adicionados aqui.
      </div>
      <Erro msg={erro || msg} />
      <div className="linha-campos" style={{ alignItems: 'flex-end' }}>
        <Campo rotulo="Novo NCM (8 dígitos)" largura={150}>
          <input value={novo.codigo} onChange={(e) => setNovo((s) => ({ ...s, codigo: e.target.value }))} />
        </Campo>
        <Campo rotulo="Descrição"><input value={novo.descricao} onChange={(e) => setNovo((s) => ({ ...s, descricao: e.target.value }))} /></Campo>
        <Campo rotulo="IPI (%)" largura={100}>
          <input type="number" step="any" value={novo.ipi_pct} onChange={(e) => setNovo((s) => ({ ...s, ipi_pct: e.target.value }))} />
        </Campo>
        <Campo rotulo=" " largura={120}><button className="botao" style={{ height: 34 }} onClick={adicionar}>Adicionar</button></Campo>
      </div>
      {carregando ? <Carregando /> : (
        <div className="tabela-envolucro" style={{ maxHeight: 420, overflowY: 'auto' }}>
          <table className="tabela">
            <thead><tr><th>Código</th><th>Descrição</th><th className="num">IPI (%)</th><th className="acoes"></th></tr></thead>
            <tbody>
              {filtrados.map((n) => (
                <tr key={n.codigo}>
                  <td className="mono negrito">{n.codigo}</td>
                  <td>{n.descricao}</td>
                  <td className="num" style={{ width: 120 }}>
                    <input
                      type="number" step="any" defaultValue={n.ipi_pct}
                      style={{ width: 90, textAlign: 'right' }}
                      onBlur={(e) => Number(e.target.value) !== Number(n.ipi_pct) && salvarIpi(n, e.target.value)}
                    />
                  </td>
                  <td className="acoes"><button className="botao botao-perigo botao-mini" onClick={() => remover(n)}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------------------- ICMS por UF ---------------------- */

function TabelaIcms() {
  const { dados, erro, carregando, recarregar } = useDados(() => api('/fiscal/icms'));
  const [msg, setMsg] = React.useState(null);

  async function salvar(uf, aliquota) {
    setMsg(null);
    try {
      await api(`/fiscal/icms/${uf}`, { method: 'PUT', body: { aliquota_interna: aliquota } });
    } catch (e) {
      setMsg(e.message);
      recarregar();
    }
  }

  return (
    <div className="cartao">
      <h3>Alíquotas internas de ICMS por UF</h3>
      <div className="alerta alerta-info">
        Usadas nas vendas dentro do estado de destino. Nas interestaduais aplica-se 7% (Sul/Sudeste → N/NE/CO/ES) ou 12%
        (Resolução SF 22/1989). Edite conforme a legislação vigente de cada estado.
      </div>
      <Erro msg={erro || msg} />
      {carregando ? <Carregando /> : (
        <div className="tabela-envolucro" style={{ maxHeight: 480, overflowY: 'auto' }}>
          <table className="tabela">
            <thead><tr><th>UF</th><th>Estado</th><th>Região</th><th className="num">Alíquota interna (%)</th></tr></thead>
            <tbody>
              {(dados || []).map((u) => (
                <tr key={u.uf}>
                  <td className="negrito">{u.uf}</td>
                  <td>{u.nome}</td>
                  <td>{u.regiao}</td>
                  <td className="num" style={{ width: 160 }}>
                    <input
                      type="number" step="any" defaultValue={u.aliquota_interna}
                      style={{ width: 100, textAlign: 'right' }}
                      onBlur={(e) => Number(e.target.value) !== Number(u.aliquota_interna) && salvar(u.uf, e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

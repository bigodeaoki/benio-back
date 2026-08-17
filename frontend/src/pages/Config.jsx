import React from 'react';
import { api } from '../api.js';
import { Campo, Carregando, Erro, Vazio, useDados } from '../ui.jsx';
import { BuscaNcm } from './Formulas.jsx';

export default function Config() {
  const [subAba, setSubAba] = React.useState('ncm');
  return (
    <>
      <div className="sub-abas">
        <button className={`sub-aba ${subAba === 'ncm' ? 'ativa' : ''}`} onClick={() => setSubAba('ncm')}>Tabela NCM / IPI</button>
        <button className={`sub-aba ${subAba === 'icms' ? 'ativa' : ''}`} onClick={() => setSubAba('icms')}>ICMS por UF</button>
      </div>
      {subAba === 'ncm' && <TabelaNcm />}
      {subAba === 'icms' && <TabelaIcms />}
    </>
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

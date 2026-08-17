import React from 'react';
import { api } from '../api.js';
import { Campo, Carregando, Erro, Modal, Vazio, fmtNum, useDados } from '../ui.jsx';

const REGIMES = [
  { valor: 'simples', rotulo: 'Simples Nacional' },
  { valor: 'presumido', rotulo: 'Lucro Presumido' },
  { valor: 'real', rotulo: 'Lucro Real' },
];

export default function Empresas({ usuario }) {
  const ehAdmin = usuario?.papel === 'admin';
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
    <>
      <div className="cartao">
        <div className="cartao-cabecalho">
          <h3>Empresas do grupo</h3>
          {ehAdmin && <button className="botao" onClick={() => setEditando({ novo: true })}>+ Nova empresa</button>}
        </div>
        <div className="alerta alerta-info">
          Cada usuário acessa apenas as empresas às quais está vinculado (definido na aba <strong>Usuários</strong>);
          admins acessam todas. A empresa ativa é trocada no seletor do topo. O <strong>regime tributário</strong> define
          os impostos do cálculo de preço: Simples Nacional (alíquota efetiva do DAS), Lucro Presumido (PIS 0,65% +
          COFINS 3%) ou Lucro Real (PIS 1,65% + COFINS 7,6%), sempre com ICMS por UF e IPI por NCM.
        </div>
        <Erro msg={erro || msg} />
        {carregando ? <Carregando /> : !dados?.length ? <Vazio /> : (
          <div className="tabela-envolucro">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Razão social</th>
                  <th>Nome fantasia</th>
                  <th>CNPJ</th>
                  <th>UF</th>
                  <th>Município</th>
                  <th>Regime</th>
                  <th className="num">Alíq. Simples</th>
                  {ehAdmin && <th className="acoes">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {dados.map((e) => (
                  <tr key={e.id}>
                    <td className="negrito">{e.razao_social}</td>
                    <td>{e.nome_fantasia || '—'}</td>
                    <td className="mono">{e.cnpj || '—'}</td>
                    <td>{e.uf}</td>
                    <td>{e.municipio || '—'}</td>
                    <td>{REGIMES.find((r) => r.valor === e.regime)?.rotulo}</td>
                    <td className="num">{e.regime === 'simples' ? `${fmtNum(e.aliquota_simples)}%` : '—'}</td>
                    {ehAdmin && (
                      <td className="acoes">
                        <button className="botao botao-secundario botao-mini" onClick={() => setEditando(e)}>Editar</button>
                        <button className="botao botao-perigo botao-mini" onClick={() => excluir(e)}>Excluir</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {editando && (
        <FormEmpresa
          empresa={editando.novo ? null : editando}
          ufs={ufs || []}
          aoFechar={() => setEditando(null)}
          aoSalvar={() => { setEditando(null); recarregar(); }}
        />
      )}
    </>
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

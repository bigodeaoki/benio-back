import React from 'react';
import { api } from '../api.js';
import { Campo, Carregando, Erro, Modal, Vazio, fmtBRL, useDados } from '../ui.jsx';

const TIPOS = [
  { valor: 'energia', rotulo: 'Energia elétrica', unidadePadrao: 'kWh' },
  { valor: 'gas', rotulo: 'Gás', unidadePadrao: 'm³' },
  { valor: 'oleo', rotulo: 'Óleo de caldeira', unidadePadrao: 'litro' },
  { valor: 'agua', rotulo: 'Água', unidadePadrao: 'm³' },
  { valor: 'outro', rotulo: 'Outro', unidadePadrao: 'un' },
];

export default function Utilidades() {
  const { dados, erro, carregando, recarregar } = useDados(() => api('/utilidades'));
  const [editando, setEditando] = React.useState(null);
  const [msg, setMsg] = React.useState(null);

  async function excluir(u) {
    if (!confirm(`Remover ${u.nome}? Os consumos vinculados às linhas serão removidos.`)) return;
    try {
      await api(`/utilidades/${u.id}`, { method: 'DELETE' });
      recarregar();
    } catch (e) {
      setMsg(e.message);
    }
  }

  return (
    <>
      <div className="cartao">
        <div className="cartao-cabecalho">
          <h3>Custos das utilidades</h3>
          <button className="botao" onClick={() => setEditando({ novo: true })}>+ Nova utilidade</button>
        </div>
        <div className="alerta alerta-info">
          Cadastre aqui a <strong>conta de energia elétrica e o custo por kWh</strong>, a <strong>conta de gás</strong>,
          o <strong>preço do litro do óleo para caldeira</strong> e demais utilidades. Os consumos por hora são definidos
          em cada linha de processo (aba 3).
        </div>
        <Erro msg={erro || msg} />
        {carregando ? (
          <Carregando />
        ) : !dados?.length ? (
          <Vazio />
        ) : (
          <div className="tabela-envolucro">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Utilidade</th>
                  <th>Tipo</th>
                  <th>Unidade</th>
                  <th className="num">Custo unitário</th>
                  <th className="num">Conta mensal (referência)</th>
                  <th className="acoes">Ações</th>
                </tr>
              </thead>
              <tbody>
                {dados.map((u) => (
                  <tr key={u.id}>
                    <td className="negrito">{u.nome}</td>
                    <td>{TIPOS.find((t) => t.valor === u.tipo)?.rotulo || u.tipo}</td>
                    <td>{u.unidade}</td>
                    <td className="num negrito">{fmtBRL(u.custo_unitario)} / {u.unidade}</td>
                    <td className="num">{fmtBRL(u.conta_mensal)}</td>
                    <td className="acoes">
                      <button className="botao botao-secundario botao-mini" onClick={() => setEditando(u)}>Editar</button>
                      <button className="botao botao-perigo botao-mini" onClick={() => excluir(u)}>Excluir</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {editando && (
        <FormUtilidade
          utilidade={editando.novo ? null : editando}
          aoFechar={() => setEditando(null)}
          aoSalvar={() => { setEditando(null); recarregar(); }}
        />
      )}
    </>
  );
}

function FormUtilidade({ utilidade, aoFechar, aoSalvar }) {
  const [f, setF] = React.useState(utilidade || { nome: '', tipo: 'energia', unidade: 'kWh', custo_unitario: '', conta_mensal: '' });
  const [erro, setErro] = React.useState(null);
  const mudar = (campo, valor) => setF((s) => ({ ...s, [campo]: valor }));

  async function salvar() {
    setErro(null);
    try {
      if (utilidade) await api(`/utilidades/${utilidade.id}`, { method: 'PUT', body: f });
      else await api('/utilidades', { method: 'POST', body: f });
      aoSalvar();
    } catch (e) {
      setErro(e.message);
    }
  }

  return (
    <Modal titulo={utilidade ? `Editar ${utilidade.nome}` : 'Nova utilidade'} onFechar={aoFechar}
      rodape={
        <>
          <button className="botao botao-secundario" onClick={aoFechar}>Cancelar</button>
          <button className="botao" onClick={salvar}>Salvar</button>
        </>
      }
    >
      <Erro msg={erro} />
      <Campo rotulo="Nome *"><input value={f.nome} onChange={(e) => mudar('nome', e.target.value)} placeholder="ex.: Energia Elétrica" /></Campo>
      <div className="linha-campos">
        <Campo rotulo="Tipo">
          <select
            value={f.tipo}
            onChange={(e) => {
              const t = TIPOS.find((x) => x.valor === e.target.value);
              setF((s) => ({ ...s, tipo: e.target.value, unidade: t?.unidadePadrao || s.unidade }));
            }}
          >
            {TIPOS.map((t) => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Unidade de medida"><input value={f.unidade} onChange={(e) => mudar('unidade', e.target.value)} /></Campo>
      </div>
      <div className="linha-campos">
        <Campo rotulo={`Custo por ${f.unidade || 'unidade'} (R$)`} dica="ex.: custo do kWh, preço do litro de óleo">
          <input type="number" step="any" value={f.custo_unitario} onChange={(e) => mudar('custo_unitario', e.target.value)} />
        </Campo>
        <Campo rotulo="Valor da conta mensal (R$)" dica="referência para acompanhamento">
          <input type="number" step="any" value={f.conta_mensal} onChange={(e) => mudar('conta_mensal', e.target.value)} />
        </Campo>
      </div>
    </Modal>
  );
}

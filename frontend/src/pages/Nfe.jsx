import React from 'react';
import { api, urlDownload } from '../api.js';
import { Badge, Campo, Carregando, Erro, Vazio, fmtBRL, fmtData, useDados } from '../ui.jsx';

export default function Nfe() {
  const { dados: notas, erro, carregando, recarregar } = useDados(() => api('/nfe'));
  const { dados: pedidos } = useDados(() => api('/pedidos'));
  const [pedidoId, setPedidoId] = React.useState('');
  const [serie, setSerie] = React.useState(1);
  const [emitindo, setEmitindo] = React.useState(false);
  const [msg, setMsg] = React.useState(null);
  const [erroEmissao, setErroEmissao] = React.useState(null);

  async function emitir() {
    if (!pedidoId) return setErroEmissao('Selecione um pedido');
    setEmitindo(true);
    setErroEmissao(null);
    setMsg(null);
    try {
      const r = await api('/nfe/emitir', { method: 'POST', body: { pedido_id: Number(pedidoId), serie: Number(serie) } });
      setMsg(`✔ NF-e nº ${r.numero} (série ${r.serie}) gerada em homologação — total ${fmtBRL(r.valor_total)} · chave ${r.chave_acesso}`);
      setPedidoId('');
      recarregar();
    } catch (e) {
      setErroEmissao(e.message);
    } finally {
      setEmitindo(false);
    }
  }

  async function cancelar(nota) {
    if (!confirm(`Cancelar a NF-e nº ${nota.numero}?`)) return;
    try {
      await api(`/nfe/${nota.id}/cancelar`, { method: 'POST' });
      recarregar();
    } catch (e) {
      setMsg(e.message);
    }
  }

  const pedidosFaturaveis = (pedidos || []).filter((p) => !['cancelado'].includes(p.status));

  return (
    <>
      <div className="alerta alerta-aviso">
        <strong>Ambiente de homologação.</strong> As notas são geradas com chave de acesso e XML no layout 4.00 para conferência
        de valores e impostos, <strong>sem valor fiscal</strong>. A transmissão real à SEFAZ exige certificado digital A1/A3 e
        credenciamento — os passos estão no README do projeto.
      </div>

      <div className="cartao">
        <h3>Emitir NF-e a partir de um pedido</h3>
        <Erro msg={erroEmissao} />
        {msg && <div className="alerta alerta-info">{msg}</div>}
        <div className="linha-campos">
          <Campo rotulo="Pedido">
            <select value={pedidoId} onChange={(e) => setPedidoId(e.target.value)}>
              <option value="">— selecione —</option>
              {pedidosFaturaveis.map((p) => (
                <option key={p.id} value={p.id}>{p.numero} — {p.cliente} ({fmtBRL(p.valor_total)})</option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Série" largura={90}>
            <input type="number" min="1" value={serie} onChange={(e) => setSerie(e.target.value)} />
          </Campo>
          <Campo rotulo=" " largura={160}>
            <button className="botao" style={{ height: 34 }} onClick={emitir} disabled={emitindo}>
              {emitindo ? 'Gerando…' : 'Emitir (homologação)'}
            </button>
          </Campo>
        </div>
        <div className="texto-suave" style={{ fontSize: 12.5 }}>
          Os impostos (ICMS, PIS, COFINS, IPI) são calculados conforme o regime tributário da empresa, o NCM de cada produto
          e a UF do cliente. No Simples Nacional a nota sai com CSOSN 102, sem destaque de impostos.
        </div>
      </div>

      <div className="cartao">
        <h3>Notas emitidas</h3>
        <Erro msg={erro} />
        {carregando ? <Carregando /> : !notas?.length ? <Vazio msg="Nenhuma NF-e emitida ainda" /> : (
          <div className="tabela-envolucro">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Nº / Série</th>
                  <th>Pedido</th>
                  <th>Destinatário</th>
                  <th>UF</th>
                  <th className="num">Produtos</th>
                  <th className="num">ICMS</th>
                  <th className="num">IPI</th>
                  <th className="num">Total NF</th>
                  <th>Status</th>
                  <th>Emitida em</th>
                  <th className="acoes">Ações</th>
                </tr>
              </thead>
              <tbody>
                {notas.map((n) => (
                  <tr key={n.id}>
                    <td className="negrito" title={n.chave_acesso ? `Chave: ${n.chave_acesso}` : ''}>{n.numero} / {n.serie}</td>
                    <td>{n.pedido_numero || '—'}</td>
                    <td>{n.destinatario}</td>
                    <td>{n.dest_uf}</td>
                    <td className="num">{fmtBRL(n.valor_produtos)}</td>
                    <td className="num">{fmtBRL(n.valor_icms)}</td>
                    <td className="num">{fmtBRL(n.valor_ipi)}</td>
                    <td className="num negrito">{fmtBRL(n.valor_total)}</td>
                    <td><Badge valor={n.status} /></td>
                    <td>{fmtData(n.emitida_em)}</td>
                    <td className="acoes">
                      <a className="botao botao-secundario botao-mini" href={urlDownload(`/nfe/${n.id}/xml`)} target="_blank" rel="noreferrer">XML</a>
                      {n.status === 'emitida_homologacao' && (
                        <button className="botao botao-perigo botao-mini" onClick={() => cancelar(n)}>Cancelar</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

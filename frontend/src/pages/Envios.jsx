import React from 'react';
import { Truck } from 'lucide-react';
import { api } from '../api.js';
import { Badge, Campo, Carregando, Erro, Modal, Vazio, fmtData, fmtNum, useDados, toast, confirmar } from '../ui.jsx';

const PROXIMO_STATUS = { preparando: 'enviado', enviado: 'entregue' };
const ROTULO_ACAO = { preparando: 'Despachar', enviado: 'Confirmar entrega' };

export default function Envios() {
  const { dados, erro, carregando, recarregar } = useDados(() => api('/envios'));
  const { dados: ordens, recarregar: recarregarOrdens } = useDados(() => api('/envios/ordens-disponiveis'));
  const [editando, setEditando] = React.useState(null);

  async function mudarStatus(envio, status) {
    if (status === 'enviado' && !(await confirmar({
      titulo: 'Despachar remessa',
      mensagem: `Confirmar o despacho do lote ${envio.lote}?`,
      confirmarTexto: 'Despachar',
    }))) return;
    try {
      await api(`/envios/${envio.id}/status`, { method: 'PUT', body: { status } });
      recarregar();
      toast.sucesso(`Lote ${envio.lote} — ${status === 'enviado' ? 'despachado' : 'entrega confirmada'}`);
    } catch (e) {
      toast.erro(e.message);
    }
  }

  // Só ordens com saldo ainda por despachar entram no formulário
  const ordensComSaldo = (ordens || []).filter((o) => o.saldo > 0);

  return (
    <>
      <div className="cartao">
        <div className="cartao-cabecalho">
          <h3><Truck size={15} className="icone-cartao" />Controle de envio</h3>
          <button className="botao" onClick={() => setEditando({ novo: true })} disabled={!ordensComSaldo.length}>
            + Nova remessa
          </button>
        </div>
        <Erro msg={erro} />
        {!ordensComSaldo.length && (
          <div className="texto-suave" style={{ marginBottom: 8 }}>
            Nenhuma ordem de produção com saldo a despachar — inicie ou conclua uma ordem na aba 5.
          </div>
        )}
        {carregando ? <Carregando /> : !dados?.length ? <Vazio msg="Nenhuma remessa registrada" /> : (
          <div className="tabela-envolucro">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Lote</th>
                  <th>Ordem</th>
                  <th>Produto</th>
                  <th className="num">Quantidade</th>
                  <th>Destinatário</th>
                  <th>Transportadora</th>
                  <th>Rastreio</th>
                  <th>Envio</th>
                  <th>Status</th>
                  <th className="acoes">Ações</th>
                </tr>
              </thead>
              <tbody>
                {dados.map((e) => (
                  <tr key={e.id}>
                    <td className="mono negrito">{e.lote}</td>
                    <td>
                      {e.ordem_numero}
                      {e.pedido_numero && <span className="texto-suave"> · {e.pedido_numero}</span>}
                    </td>
                    <td>{e.produto_nome}</td>
                    <td className="num">{fmtNum(e.quantidade, 0)} {e.unidade}</td>
                    <td>
                      {e.destinatario || <span className="texto-suave">—</span>}
                      {e.uf && <span className="texto-suave"> · {e.uf}</span>}
                    </td>
                    <td>{e.transportadora || <span className="texto-suave">—</span>}</td>
                    <td className="mono">{e.rastreio || <span className="texto-suave">—</span>}</td>
                    <td>{fmtData(e.data_envio)}</td>
                    <td><Badge valor={e.status} /></td>
                    <td className="acoes">
                      {PROXIMO_STATUS[e.status] && (
                        <button className="botao botao-mini" onClick={() => mudarStatus(e, PROXIMO_STATUS[e.status])}>
                          {ROTULO_ACAO[e.status]}
                        </button>
                      )}
                      <button className="botao botao-secundario botao-mini" onClick={() => setEditando(e)}>Editar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {editando && (
        <FormEnvio
          envio={editando.novo ? null : editando}
          ordens={ordensComSaldo}
          aoFechar={() => setEditando(null)}
          aoSalvar={() => {
            setEditando(null);
            recarregar();
            recarregarOrdens();
            toast.sucesso('Remessa salva');
          }}
        />
      )}
    </>
  );
}

function FormEnvio({ envio, ordens, aoFechar, aoSalvar }) {
  const [f, setF] = React.useState(
    envio || {
      ordem_id: '', lote: '', quantidade: '', destinatario: '', endereco: '', uf: '',
      transportadora: '', rastreio: '', data_envio: '', observacao: '',
    },
  );
  const [erro, setErro] = React.useState(null);
  const mudar = (campo, valor) => setF((s) => ({ ...s, [campo]: valor }));

  // Escolher a ordem preenche quantidade e destinatário com o que veio do pedido
  function escolherOrdem(ordemId) {
    const o = ordens.find((x) => x.id === Number(ordemId));
    setF((s) => ({
      ...s,
      ordem_id: ordemId,
      quantidade: o ? o.saldo : s.quantidade,
      destinatario: o?.cliente || s.destinatario,
      uf: o?.cliente_uf || s.uf,
    }));
  }

  const ordemEscolhida = ordens.find((x) => x.id === Number(f.ordem_id));

  async function salvar() {
    setErro(null);
    try {
      if (envio) await api(`/envios/${envio.id}`, { method: 'PUT', body: f });
      else await api('/envios', { method: 'POST', body: f });
      aoSalvar();
    } catch (e) {
      setErro(e.message);
    }
  }

  return (
    <Modal
      titulo={envio ? `Remessa ${envio.lote}` : 'Nova remessa'}
      onFechar={aoFechar}
      rodape={
        <>
          <button className="botao botao-secundario" onClick={aoFechar}>Cancelar</button>
          <button className="botao" onClick={salvar}>Salvar</button>
        </>
      }
    >
      <Erro msg={erro} />
      <div className="linha-campos">
        {envio ? (
          <Campo rotulo="Ordem de produção">
            <div style={{ padding: '7px 0' }}>{envio.ordem_numero} · {envio.produto_nome}</div>
          </Campo>
        ) : (
          <Campo rotulo="Ordem de produção *" dica="origem da remessa">
            <select value={f.ordem_id || ''} onChange={(e) => escolherOrdem(e.target.value)}>
              <option value="">— selecione —</option>
              {ordens.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.numero} · {o.produto_nome} · saldo {fmtNum(o.saldo, 0)} {o.unidade}
                </option>
              ))}
            </select>
          </Campo>
        )}
        <Campo rotulo="Lote (nº de série)" largura={170} dica={envio ? '' : 'vazio = gerado automático'}>
          <input value={f.lote || ''} onChange={(e) => mudar('lote', e.target.value)} placeholder="ex.: L-0001" />
        </Campo>
      </div>
      <div className="linha-campos">
        <Campo
          rotulo="Quantidade *"
          largura={170}
          dica={ordemEscolhida ? `saldo da ordem: ${fmtNum(ordemEscolhida.saldo, 0)} ${ordemEscolhida.unidade}` : ''}
        >
          <input type="number" step="any" value={f.quantidade} onChange={(e) => mudar('quantidade', e.target.value)} />
        </Campo>
        <Campo rotulo="Data de envio" largura={170}>
          <input type="date" value={(f.data_envio || '').slice(0, 10)} onChange={(e) => mudar('data_envio', e.target.value)} />
        </Campo>
      </div>
      <div className="linha-campos">
        <Campo rotulo="Destinatário"><input value={f.destinatario || ''} onChange={(e) => mudar('destinatario', e.target.value)} /></Campo>
        <Campo rotulo="UF" largura={80}>
          <input value={f.uf || ''} maxLength={2} onChange={(e) => mudar('uf', e.target.value.toUpperCase())} />
        </Campo>
      </div>
      <Campo rotulo="Endereço de entrega">
        <input value={f.endereco || ''} onChange={(e) => mudar('endereco', e.target.value)} />
      </Campo>
      <div className="linha-campos">
        <Campo rotulo="Transportadora"><input value={f.transportadora || ''} onChange={(e) => mudar('transportadora', e.target.value)} /></Campo>
        <Campo rotulo="Código de rastreio"><input value={f.rastreio || ''} onChange={(e) => mudar('rastreio', e.target.value)} /></Campo>
      </div>
      <Campo rotulo="Observação">
        <input value={f.observacao || ''} onChange={(e) => mudar('observacao', e.target.value)} />
      </Campo>
    </Modal>
  );
}

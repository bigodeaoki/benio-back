import React from 'react';
import { api, urlDownload } from '../api.js';
import { Badge, BotaoDownload, Campo, Carregando, Erro, Modal, Vazio, fmtBRL, fmtData, fmtNum, useDados } from '../ui.jsx';

const ITEM_VAZIO = { produto_id: '', quantidade: '', preco_unitario: '' };

export default function Pedidos() {
  const { dados: pedidos, erro, carregando, recarregar } = useDados(() => api('/pedidos'));
  const { dados: produtos } = useDados(() => api('/produtos'));
  const { dados: ufs } = useDados(() => api('/fiscal/icms'));
  const [editando, setEditando] = React.useState(null);
  const [aberto, setAberto] = React.useState(null);
  const [msg, setMsg] = React.useState(null);

  async function excluir(p) {
    if (!confirm(`Excluir o pedido ${p.numero}?`)) return;
    try {
      await api(`/pedidos/${p.id}`, { method: 'DELETE' });
      recarregar();
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function gerarOrdens(p) {
    try {
      const r = await api(`/pedidos/${p.id}/gerar-ordens`, { method: 'POST' });
      setMsg(`✔ ${r.ordens.length} ordem(ns) de produção criada(s): ${r.ordens.map((o) => o.numero).join(', ')} — veja em Produção (MRP/PCP)`);
      recarregar();
    } catch (e) {
      setMsg(e.message);
    }
  }

  return (
    <>
      <div className="cartao">
        <div className="cartao-cabecalho">
          <h3>Entrada de Pedidos</h3>
          <BotaoDownload href={urlDownload('/export/pedidos.xlsx')}>⇩ Excel</BotaoDownload>
          <button className="botao" onClick={() => setEditando({ novo: true })}>+ Novo pedido</button>
        </div>
        <Erro msg={erro || msg} />
        {carregando ? (
          <Carregando />
        ) : !pedidos?.length ? (
          <Vazio msg="Nenhum pedido cadastrado — clique em Novo pedido" />
        ) : (
          <div className="tabela-envolucro">
            <table className="tabela">
              <thead>
                <tr>
                  <th></th>
                  <th>Número</th>
                  <th>Cliente</th>
                  <th>UF</th>
                  <th>Data do pedido</th>
                  <th>Data de entrega</th>
                  <th>Status</th>
                  <th className="num">Valor total</th>
                  <th className="acoes">Ações</th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map((p) => (
                  <React.Fragment key={p.id}>
                    <tr>
                      <td>
                        <button className="botao-mini botao botao-secundario" onClick={() => setAberto(aberto === p.id ? null : p.id)}>
                          {aberto === p.id ? '▾' : '▸'}
                        </button>
                      </td>
                      <td className="negrito">{p.numero}</td>
                      <td>{p.cliente}</td>
                      <td>{p.cliente_uf}</td>
                      <td>{fmtData(p.data_pedido)}</td>
                      <td>{fmtData(p.data_entrega)}</td>
                      <td><Badge valor={p.status} /></td>
                      <td className="num negrito">{fmtBRL(p.valor_total)}</td>
                      <td className="acoes">
                        <button className="botao botao-secundario botao-mini" onClick={() => setEditando(p)}>Editar</button>
                        <button className="botao botao-secundario botao-mini" onClick={() => gerarOrdens(p)} title="Gerar ordens de produção">→ OP</button>
                        <a className="botao botao-secundario botao-mini" href={urlDownload(`/export/pedido/${p.id}.pdf`)} target="_blank" rel="noreferrer">PDF</a>
                        <button className="botao botao-perigo botao-mini" onClick={() => excluir(p)}>Excluir</button>
                      </td>
                    </tr>
                    {aberto === p.id && (
                      <tr className="linha-detalhe">
                        <td></td>
                        <td colSpan={8}>
                          <table className="tabela">
                            <thead>
                              <tr>
                                <th>Item do pedido</th>
                                <th className="num">Quantidade</th>
                                <th className="num">Preço unitário</th>
                                <th className="num">Subtotal</th>
                                <th className="num">Horas de produção (est.)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {p.itens.map((i) => (
                                <tr key={i.id}>
                                  <td>{i.produto_nome}</td>
                                  <td className="num">{fmtNum(i.quantidade, 3)} {i.unidade}</td>
                                  <td className="num">{fmtBRL(i.preco_unitario)}</td>
                                  <td className="num">{fmtBRL(i.subtotal)}</td>
                                  <td className="num">{i.horas_estimadas != null ? `${fmtNum(i.horas_estimadas)} h` : '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {p.observacao && <div className="texto-suave" style={{ padding: '6px 10px' }}>Obs.: {p.observacao}</div>}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {editando && (
        <FormPedido
          pedido={editando.novo ? null : editando}
          produtos={produtos || []}
          ufs={ufs || []}
          aoFechar={() => setEditando(null)}
          aoSalvar={() => {
            setEditando(null);
            recarregar();
          }}
        />
      )}
    </>
  );
}

function FormPedido({ pedido, produtos, ufs, aoFechar, aoSalvar }) {
  const [f, setF] = React.useState(() =>
    pedido
      ? {
          ...pedido,
          data_pedido: String(pedido.data_pedido).slice(0, 10),
          data_entrega: pedido.data_entrega ? String(pedido.data_entrega).slice(0, 10) : '',
          itens: pedido.itens.map((i) => ({ produto_id: i.produto_id, quantidade: i.quantidade, preco_unitario: i.preco_unitario })),
        }
      : {
          cliente: '', cliente_cnpj: '', cliente_uf: 'SP',
          data_pedido: new Date().toISOString().slice(0, 10),
          data_entrega: '', status: 'aberto', observacao: '',
          itens: [{ ...ITEM_VAZIO }],
        },
  );
  const [erro, setErro] = React.useState(null);
  const [buscandoCnpj, setBuscandoCnpj] = React.useState(false);

  const mudar = (campo, valor) => setF((s) => ({ ...s, [campo]: valor }));
  const mudarItem = (i, campo, valor) => {
    const itens = f.itens.slice();
    itens[i] = { ...itens[i], [campo]: valor };
    setF((s) => ({ ...s, itens }));
  };

  async function buscarCnpj() {
    setBuscandoCnpj(true);
    setErro(null);
    try {
      const d = await api(`/integracao/cnpj/${f.cliente_cnpj.replace(/[^0-9A-Za-z]/g, '')}`);
      setF((s) => ({ ...s, cliente: d.razao_social || s.cliente, cliente_uf: d.uf || s.cliente_uf }));
    } catch (e) {
      setErro(`Consulta CNPJ: ${e.message}`);
    } finally {
      setBuscandoCnpj(false);
    }
  }

  async function salvar() {
    setErro(null);
    const doc = String(f.cliente_cnpj || '').replace(/[.\-\/\s]/g, '');
    if (doc && doc.length !== 14) {
      setErro(`CNPJ do cliente inválido: deve ter 14 caracteres sem pontuação — o informado tem ${doc.length}`);
      return;
    }
    try {
      if (pedido) await api(`/pedidos/${pedido.id}`, { method: 'PUT', body: f });
      else await api('/pedidos', { method: 'POST', body: f });
      aoSalvar();
    } catch (e) {
      setErro(e.message);
    }
  }

  const total = f.itens.reduce((s, i) => s + (Number(i.quantidade) || 0) * (Number(i.preco_unitario) || 0), 0);

  return (
    <Modal titulo={pedido ? `Editar pedido ${pedido.numero}` : 'Novo pedido'} largura={780} onFechar={aoFechar}
      rodape={
        <>
          <button className="botao botao-secundario" onClick={aoFechar}>Cancelar</button>
          <button className="botao" onClick={salvar}>Salvar pedido</button>
        </>
      }
    >
      <Erro msg={erro} />
      <div className="linha-campos">
        <Campo rotulo="CNPJ do cliente" largura={200}>
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={f.cliente_cnpj || ''} onChange={(e) => mudar('cliente_cnpj', e.target.value)} placeholder="somente números" />
            <button className="botao botao-secundario" onClick={buscarCnpj} disabled={buscandoCnpj} title="Buscar na Receita Federal (BrasilAPI)">
              {buscandoCnpj ? '…' : '🔎'}
            </button>
          </div>
        </Campo>
        <Campo rotulo="Cliente *">
          <input value={f.cliente} onChange={(e) => mudar('cliente', e.target.value)} />
        </Campo>
        <Campo rotulo="UF" largura={90}>
          <select value={f.cliente_uf} onChange={(e) => mudar('cliente_uf', e.target.value)}>
            {ufs.map((u) => <option key={u.uf} value={u.uf}>{u.uf}</option>)}
          </select>
        </Campo>
      </div>
      <div className="linha-campos">
        <Campo rotulo="Data do pedido *"><input type="date" value={f.data_pedido} onChange={(e) => mudar('data_pedido', e.target.value)} /></Campo>
        <Campo rotulo="Data de entrega"><input type="date" value={f.data_entrega} onChange={(e) => mudar('data_entrega', e.target.value)} /></Campo>
        <Campo rotulo="Status">
          <select value={f.status} onChange={(e) => mudar('status', e.target.value)}>
            <option value="aberto">Aberto</option>
            <option value="em_producao">Em produção</option>
            <option value="faturado">Faturado</option>
            <option value="entregue">Entregue</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </Campo>
      </div>
      <Campo rotulo="Observação"><input value={f.observacao || ''} onChange={(e) => mudar('observacao', e.target.value)} /></Campo>

      <h3 style={{ margin: '10px 0' }}>Itens do pedido</h3>
      {f.itens.map((item, i) => {
        const produto = produtos.find((p) => p.id === Number(item.produto_id));
        return (
          <div className="linha-campos" key={i}>
            <Campo rotulo={i === 0 ? 'Produto' : ''}>
              <select value={item.produto_id} onChange={(e) => mudarItem(i, 'produto_id', e.target.value)}>
                <option value="">— selecione —</option>
                {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </Campo>
            <Campo rotulo={i === 0 ? `Quantidade ${produto ? `(${produto.unidade})` : ''}` : ''} largura={130}>
              <input type="number" min="0" step="any" value={item.quantidade} onChange={(e) => mudarItem(i, 'quantidade', e.target.value)} />
            </Campo>
            <Campo rotulo={i === 0 ? 'Preço unitário (R$)' : ''} largura={140}>
              <input type="number" min="0" step="any" value={item.preco_unitario} onChange={(e) => mudarItem(i, 'preco_unitario', e.target.value)} />
            </Campo>
            <Campo rotulo={i === 0 ? ' ' : ''} largura={44}>
              <button className="botao botao-perigo botao-mini" style={{ height: 34 }}
                onClick={() => setF((s) => ({ ...s, itens: s.itens.filter((_, j) => j !== i) }))} disabled={f.itens.length === 1}>
                ×
              </button>
            </Campo>
          </div>
        );
      })}
      <button className="botao botao-secundario botao-mini" onClick={() => setF((s) => ({ ...s, itens: [...s.itens, { ...ITEM_VAZIO }] }))}>
        + Adicionar item
      </button>
      <div className="direita negrito" style={{ fontSize: 15, marginTop: 10 }}>Total: {fmtBRL(total)}</div>
    </Modal>
  );
}

import React from 'react';
import { ClipboardList, Cog, Gauge } from 'lucide-react';
import { api } from '../api.js';
import { Badge, Campo, Carregando, Erro, Modal, Vazio, fmtBRL, fmtData, fmtNum, fmtPct, useDados, toast, confirmar } from '../ui.jsx';

export default function Producao() {
  const [subAba, setSubAba] = React.useState('ordens');
  return (
    <>
      <div className="sub-abas">
        <button className={`sub-aba ${subAba === 'ordens' ? 'ativa' : ''}`} onClick={() => setSubAba('ordens')}>Ordens de produção (PCP)</button>
        <button className={`sub-aba ${subAba === 'mrp' ? 'ativa' : ''}`} onClick={() => setSubAba('mrp')}>Necessidades de materiais (MRP)</button>
      </div>
      {subAba === 'ordens' ? <Ordens /> : <Mrp />}
    </>
  );
}

const PROXIMO_STATUS = { planejada: 'liberada', liberada: 'em_producao', em_producao: 'concluida' };
const ROTULO_ACAO = { planejada: 'Liberar', liberada: 'Iniciar', em_producao: 'Concluir' };
const STATUS_ORDEM = {
  planejada: 'Planejada', liberada: 'Liberada', em_producao: 'Em produção',
  concluida: 'Concluída', cancelada: 'Cancelada', finalizada: 'Finalizada',
};
const STATUS_ABERTOS = ['planejada', 'liberada', 'em_producao'];

function Ordens() {
  const { dados, erro, carregando, recarregar } = useDados(() => api('/producao/ordens'));
  const { dados: produtos } = useDados(() => api('/produtos'));
  const { dados: linhas } = useDados(() => api('/linhas'));
  const [filtroStatus, setFiltroStatus] = React.useState('todos');
  const [criando, setCriando] = React.useState(false);
  const [expandida, setExpandida] = React.useState(null);
  const [concluindo, setConcluindo] = React.useState(null);
  const [msg, setMsg] = React.useState(null);

  async function mudarStatus(op, status, quantidadeProduzida) {
    // Concluir passa pelo modal, que pergunta quanto saiu de verdade
    if (status === 'concluida' && quantidadeProduzida === undefined) {
      setConcluindo(op);
      return;
    }
    setMsg(null);
    try {
      const r = await api(`/producao/ordens/${op.id}/status`, {
        method: 'PUT',
        body: { status, quantidade_produzida: quantidadeProduzida },
      });
      recarregar();
      toast.sucesso(status === 'concluida'
        ? `${op.numero} concluída — rendimento ${fmtPct(r?.rendimento_pct)}, estoque baixado${r?.remessa ? ` e remessa ${r.remessa.lote} aberta` : ''}`
        : `${op.numero} atualizada`);
    } catch (e) {
      toast.erro(e.message);
    }
  }

  // Ordem não é apagada: encerra virando histórico com status finalizada
  async function finalizar(op) {
    if (!(await confirmar({ titulo: 'Finalizar ordem', mensagem: `Finalizar a ordem ${op.numero}? Ela sai do planejamento e fica no histórico — o estoque não é movimentado.`, confirmarTexto: 'Finalizar' }))) return;
    try {
      await api(`/producao/ordens/${op.id}/finalizar`, { method: 'PUT' });
      recarregar();
      toast.sucesso(`Ordem ${op.numero} finalizada`);
    } catch (e) {
      toast.erro(e.message);
    }
  }

  // Filtro por status na própria lista já carregada — o endpoint devolve todas as ordens
  const contagem = (dados || []).reduce((c, op) => ({ ...c, [op.status]: (c[op.status] || 0) + 1 }), {});
  const ordens = (dados || []).filter((op) =>
    filtroStatus === 'todos' ? true
      : filtroStatus === 'abertas' ? STATUS_ABERTOS.includes(op.status)
        : op.status === filtroStatus);

  return (
    <div className="cartao">
      <div className="cartao-cabecalho">
        <h3><Cog size={15} className="icone-cartao" />Ordens de produção</h3>
        <button className="botao" onClick={() => setCriando(true)}>+ Nova ordem</button>
      </div>
      <div className="linha-campos">
        <Campo rotulo="Status" largura={220}>
          <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
            <option value="todos">— todos os status — ({(dados || []).length})</option>
            <option value="abertas">
              Em aberto ({STATUS_ABERTOS.reduce((s, k) => s + (contagem[k] || 0), 0)})
            </option>
            {Object.entries(STATUS_ORDEM).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>{rotulo} ({contagem[valor] || 0})</option>
            ))}
          </select>
        </Campo>
      </div>
      <Erro msg={erro || msg} />
      {carregando ? <Carregando /> : !ordens.length ? (
        <Vazio msg={dados?.length
          ? 'Nenhuma ordem com esse status'
          : 'Nenhuma ordem — crie uma aqui ou gere a partir de um pedido (aba 1)'} />
      ) : (
        <div className="tabela-envolucro">
          <table className="tabela">
            <thead>
              <tr>
                <th style={{ width: 34 }}></th>
                <th>Número</th>
                <th>Produto</th>
                <th>Pedido</th>
                <th>Linha</th>
                <th className="num">Planejado</th>
                <th className="num">Produzido</th>
                <th className="num">Rendimento</th>
                <th className="num">Horas est.</th>
                <th>Início</th>
                <th>Fim</th>
                <th>Status</th>
                <th className="acoes">Ações</th>
              </tr>
            </thead>
            <tbody>
              {ordens.map((op) => {
                const rendimento = op.quantidade_produzida != null && Number(op.quantidade) > 0
                  ? (Number(op.quantidade_produzida) / Number(op.quantidade)) * 100
                  : null;
                return (
                <React.Fragment key={op.id}>
                <tr>
                  <td>
                    <button
                      className="botao botao-secundario botao-mini"
                      style={{ width: 26, height: 26, padding: 0, justifyContent: 'center', lineHeight: 1 }}
                      title={expandida === op.id ? 'Ocultar fórmula' : 'Ver/ajustar a fórmula desta ordem'}
                      onClick={() => setExpandida(expandida === op.id ? null : op.id)}
                    >
                      {expandida === op.id ? '−' : '+'}
                    </button>
                  </td>
                  <td className="negrito">{op.numero}</td>
                  <td>{op.produto_nome}</td>
                  <td>{op.pedido_numero ? `${op.pedido_numero} · ${op.cliente}` : '—'}</td>
                  <td>{op.linha_nome || '—'}</td>
                  <td className="num">{fmtNum(op.quantidade, 0)} {op.unidade}</td>
                  <td className="num">{op.quantidade_produzida != null ? `${fmtNum(op.quantidade_produzida, 0)} ${op.unidade}` : '—'}</td>
                  <td className="num">{rendimento != null ? fmtPct(rendimento) : '—'}</td>
                  <td className="num">{op.horas_estimadas != null ? `${fmtNum(op.horas_estimadas)} h` : '—'}</td>
                  <td>{fmtData(op.data_inicio)}</td>
                  <td>{fmtData(op.data_fim)}</td>
                  <td><Badge valor={op.status} /></td>
                  <td className="acoes">
                    {PROXIMO_STATUS[op.status] && (
                      <button className="botao botao-mini" onClick={() => mudarStatus(op, PROXIMO_STATUS[op.status])}>
                        {ROTULO_ACAO[op.status]}
                      </button>
                    )}
                    {['planejada', 'liberada'].includes(op.status) && (
                      <button className="botao botao-secundario botao-mini" onClick={() => mudarStatus(op, 'cancelada')}>Cancelar</button>
                    )}
                    {['planejada', 'cancelada'].includes(op.status) && (
                      <button className="botao botao-secundario botao-mini" onClick={() => finalizar(op)}>Finalizar</button>
                    )}
                  </td>
                </tr>
                {expandida === op.id && (
                  <tr>
                    <td colSpan={13} style={{ background: '#f8fafc' }}>
                      <FormulaDaOrdem ordem={op} aoMudar={recarregar} />
                    </td>
                  </tr>
                )}
                </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {criando && (
        <FormOrdem
          produtos={produtos || []}
          linhas={linhas || []}
          aoFechar={() => setCriando(false)}
          aoSalvar={() => { setCriando(false); recarregar(); toast.sucesso('Ordem de produção criada'); }}
        />
      )}
      {concluindo && (
        <FormConclusao
          ordem={concluindo}
          aoFechar={() => setConcluindo(null)}
          aoConfirmar={(qtd) => { const op = concluindo; setConcluindo(null); mudarStatus(op, 'concluida', qtd); }}
        />
      )}
    </div>
  );
}

/* ---------------------- Fórmula da ordem (cópia editável) ---------------------- */

function FormulaDaOrdem({ ordem, aoMudar }) {
  const { dados, erro, carregando, recarregar } = useDados(
    () => api(`/producao/ordens/${ordem.id}/formula`), [ordem.id],
  );
  const { dados: materias } = useDados(() => api('/materias'));
  const [itens, setItens] = React.useState(null);
  const [salvando, setSalvando] = React.useState(false);

  // Só entra em modo de edição quando o usuário clica; até lá mostra o salvo
  const editando = itens !== null;
  const lista = editando ? itens : (dados?.itens || []);
  const lotes = dados?.ordem?.lotes || 0;

  function mudarItem(i, campo, valor) {
    setItens((s) => s.map((x, j) => (j === i ? { ...x, [campo]: valor } : x)));
  }

  async function salvar() {
    setSalvando(true);
    try {
      await api(`/producao/ordens/${ordem.id}/formula`, {
        method: 'PUT',
        body: { itens: itens.map((i) => ({ materia_prima_id: i.materia_prima_id, quantidade: i.quantidade })) },
      });
      setItens(null);
      recarregar();
      aoMudar();
      toast.sucesso(`Fórmula de ${ordem.numero} ajustada — a fórmula do produto não mudou`);
    } catch (e) {
      toast.erro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) return <div style={{ padding: 10 }}><Carregando /></div>;

  return (
    <div style={{ padding: '10px 6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <strong style={{ fontSize: 13 }}>Fórmula desta ordem</strong>
        <span className="texto-suave" style={{ flex: 1 }}>
          {dados?.editavel
            ? `cópia da fórmula do produto — ajustar aqui vale só para ${ordem.numero}`
            : 'ordem encerrada — fórmula congelada como foi consumida'}
        </span>
        {dados?.editavel && !editando && (
          <button className="botao botao-secundario botao-mini" onClick={() => setItens(lista.map((i) => ({ ...i })))}>
            Ajustar
          </button>
        )}
        {editando && (
          <>
            <button className="botao botao-secundario botao-mini" onClick={() => setItens(null)}>Cancelar</button>
            <button className="botao botao-mini" onClick={salvar} disabled={salvando}>
              {salvando ? 'Salvando…' : 'Salvar fórmula'}
            </button>
          </>
        )}
      </div>
      <Erro msg={erro} />
      {!lista.length ? <div className="texto-suave">Ordem sem itens de fórmula.</div> : (
        <table className="tabela">
          <thead>
            <tr>
              <th>Matéria-prima</th>
              <th className="num">Por lote</th>
              <th className="num">Total ({fmtNum(lotes, 2)} lotes)</th>
              <th className="num">Estoque atual</th>
              {editando && <th className="acoes">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {lista.map((i, idx) => {
              const mp = (materias || []).find((m) => m.id === Number(i.materia_prima_id));
              const total = Number(i.quantidade || 0) * lotes;
              const falta = mp && total > Number(mp.estoque_atual);
              return (
                <tr key={i.id ?? `novo-${idx}`}>
                  <td>
                    {editando && !i.id ? (
                      <select value={i.materia_prima_id || ''} onChange={(e) => mudarItem(idx, 'materia_prima_id', e.target.value)}>
                        <option value="">— selecione —</option>
                        {(materias || []).map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                      </select>
                    ) : (i.nome || mp?.nome)}
                  </td>
                  <td className="num">
                    {editando ? (
                      <input type="number" step="any" style={{ width: 110 }} value={i.quantidade}
                        onChange={(e) => mudarItem(idx, 'quantidade', e.target.value)} />
                    ) : `${fmtNum(i.quantidade, 3)} ${i.unidade || mp?.unidade || ''}`}
                  </td>
                  <td className="num">{fmtNum(total, 3)}</td>
                  <td className="num" style={falta ? { color: 'var(--vermelho)' } : undefined}>
                    {mp ? fmtNum(mp.estoque_atual, 3) : '—'}
                  </td>
                  {editando && (
                    <td className="acoes">
                      <button className="botao botao-perigo botao-mini"
                        onClick={() => setItens((s) => s.filter((_, j) => j !== idx))}>×</button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {editando && (
        <button className="botao botao-secundario botao-mini" style={{ marginTop: 8 }}
          onClick={() => setItens((s) => [...s, { materia_prima_id: '', quantidade: '' }])}>
          + Adicionar matéria-prima
        </button>
      )}
    </div>
  );
}

function FormConclusao({ ordem, aoFechar, aoConfirmar }) {
  const [qtd, setQtd] = React.useState(String(ordem.quantidade));
  const produzido = Number(qtd);
  const planejado = Number(ordem.quantidade);
  const rendimento = planejado > 0 && produzido > 0 ? (produzido / planejado) * 100 : null;

  return (
    <Modal
      titulo={`Concluir ${ordem.numero}`}
      largura={520}
      onFechar={aoFechar}
      rodape={
        <>
          <button className="botao botao-secundario" onClick={aoFechar}>Cancelar</button>
          <button className="botao" onClick={() => aoConfirmar(qtd)} disabled={!(produzido > 0)}>Concluir</button>
        </>
      }
    >
      <Campo rotulo={`Quantidade produzida (${ordem.unidade})`} dica={`planejado: ${fmtNum(planejado, 0)} ${ordem.unidade}`}>
        <input type="number" step="any" value={qtd} onChange={(e) => setQtd(e.target.value)} />
      </Campo>
      {rendimento != null && (
        <div style={{ margin: '10px 0' }}>
          Rendimento desta ordem: <strong>{fmtPct(rendimento)}</strong>
          <div className="texto-suave" style={{ marginTop: 2 }}>
            Entra na média histórica da linha {ordem.linha_nome ? `“${ordem.linha_nome}”` : ''} e passa a valer nos custos.
          </div>
        </div>
      )}
      <div className="texto-suave">
        As matérias-primas da fórmula desta ordem serão baixadas do estoque pelo consumo real,
        nos lotes mais antigos primeiro, e a remessa será aberta no Controle de envio.
      </div>
    </Modal>
  );
}

function FormOrdem({ produtos, linhas, aoFechar, aoSalvar }) {
  const [f, setF] = React.useState({ produto_id: '', quantidade: '', linha_id: '', data_inicio: '', data_fim: '' });
  const [erro, setErro] = React.useState(null);
  const mudar = (campo, valor) => setF((s) => ({ ...s, [campo]: valor }));

  async function salvar() {
    setErro(null);
    try {
      await api('/producao/ordens', { method: 'POST', body: { ...f, linha_id: f.linha_id || null } });
      aoSalvar();
    } catch (e) {
      setErro(e.message);
    }
  }

  return (
    <Modal titulo="Nova ordem de produção" onFechar={aoFechar}
      rodape={
        <>
          <button className="botao botao-secundario" onClick={aoFechar}>Cancelar</button>
          <button className="botao" onClick={salvar}>Criar ordem</button>
        </>
      }
    >
      <Erro msg={erro} />
      <Campo rotulo="Produto *">
        <select value={f.produto_id} onChange={(e) => {
          const p = produtos.find((x) => x.id === Number(e.target.value));
          setF((s) => ({ ...s, produto_id: e.target.value, linha_id: p?.linha_id || '' }));
        }}>
          <option value="">— selecione —</option>
          {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
      </Campo>
      <div className="linha-campos">
        <Campo rotulo="Quantidade *"><input type="number" step="any" value={f.quantidade} onChange={(e) => mudar('quantidade', e.target.value)} /></Campo>
        <Campo rotulo="Linha">
          <select value={f.linha_id || ''} onChange={(e) => mudar('linha_id', e.target.value)}>
            <option value="">— da fórmula —</option>
            {linhas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
        </Campo>
      </div>
      <div className="linha-campos">
        <Campo rotulo="Data de início"><input type="date" value={f.data_inicio} onChange={(e) => mudar('data_inicio', e.target.value)} /></Campo>
        <Campo rotulo="Data de fim"><input type="date" value={f.data_fim} onChange={(e) => mudar('data_fim', e.target.value)} /></Campo>
      </div>
    </Modal>
  );
}

function Mrp() {
  const { dados, erro, carregando, recarregar } = useDados(() => api('/producao/mrp'));

  return (
    <>
      <Erro msg={erro} />
      {carregando ? <Carregando /> : !dados ? null : (
        <>
          <div className="grade-kpis">
            <div className="kpi">
              <div className="kpi-rotulo">Ordens abertas consideradas</div>
              <div className="kpi-valor">{dados.ordens_consideradas}</div>
            </div>
            <div className="kpi">
              <div className="kpi-rotulo">Materiais com falta</div>
              <div className="kpi-valor" style={{ color: dados.necessidades.some((n) => n.falta > 0) ? 'var(--vermelho)' : undefined }}>
                {dados.necessidades.filter((n) => n.falta > 0).length}
              </div>
            </div>
            <div className="kpi">
              <div className="kpi-rotulo">Compras estimadas</div>
              <div className="kpi-valor">{fmtBRL(dados.compras_total_estimado)}</div>
            </div>
          </div>

          <div className="cartao">
            <div className="cartao-cabecalho">
              <h3><ClipboardList size={15} className="icone-cartao" />Necessidades de materiais (ordens planejadas/liberadas/em produção)</h3>
              <button className="botao botao-secundario botao-mini" onClick={recarregar}>Atualizar</button>
            </div>
            {!dados.necessidades.length ? <Vazio msg="Sem ordens abertas — nada a planejar" /> : (
              <div className="tabela-envolucro">
                <table className="tabela">
                  <thead>
                    <tr>
                      <th>Matéria-prima</th>
                      <th className="num">Necessidade bruta</th>
                      <th className="num">Estoque atual</th>
                      <th className="num">Falta</th>
                      <th className="num">Sugestão de compra</th>
                      <th className="num">Custo estimado</th>
                      <th>Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.necessidades.map((n) => (
                      <tr key={n.materia_prima_id}>
                        <td className="negrito">{n.nome}</td>
                        <td className="num">{fmtNum(n.necessidade_bruta, 3)} {n.unidade}</td>
                        <td className="num">{fmtNum(n.estoque_atual, 3)}</td>
                        <td className="num" style={n.falta > 0 ? { color: 'var(--vermelho)', fontWeight: 700 } : undefined}>
                          {fmtNum(n.falta, 3)}
                        </td>
                        <td className="num">{n.sugestao_compra ? fmtNum(n.sugestao_compra, 3) : '—'}</td>
                        <td className="num">{n.custo_compra_estimado ? fmtBRL(n.custo_compra_estimado) : '—'}</td>
                        <td><Badge valor={n.situacao} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="cartao">
            <h3><Gauge size={15} className="icone-cartao" />Capacidade das linhas (PCP)</h3>
            {!dados.capacidade.length ? <Vazio msg="Sem ordens abertas" /> : (
              <div className="tabela-envolucro">
                <table className="tabela">
                  <thead>
                    <tr>
                      <th>Linha</th>
                      <th className="num">Ordens</th>
                      <th className="num">Horas necessárias</th>
                      <th className="num">Horas disponíveis/semana</th>
                      <th>Ocupação da semana</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.capacidade.map((c) => {
                      const pct = c.ocupacao_semana_pct;
                      const cor = pct == null ? '#8b96a5' : pct > 100 ? 'var(--vermelho)' : pct > 80 ? 'var(--amarelo)' : 'var(--aqua)';
                      return (
                        <tr key={c.linha}>
                          <td className="negrito">{c.linha}</td>
                          <td className="num">{c.ordens}</td>
                          <td className="num">{fmtNum(c.horas_necessarias)} h</td>
                          <td className="num">{c.horas_disponiveis_semana ? `${fmtNum(c.horas_disponiveis_semana, 0)} h` : '—'}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div className="ocupacao" style={{ flex: 1 }}>
                                <span style={{ width: `${Math.min(100, pct || 0)}%`, background: cor }} />
                              </div>
                              <span className="negrito" style={{ color: cor, minWidth: 52, textAlign: 'right' }}>{fmtPct(pct)}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

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

function Ordens() {
  const { dados, erro, carregando, recarregar } = useDados(() => api('/producao/ordens'));
  const { dados: produtos } = useDados(() => api('/produtos'));
  const { dados: linhas } = useDados(() => api('/linhas'));
  const [criando, setCriando] = React.useState(false);
  const [msg, setMsg] = React.useState(null);

  async function mudarStatus(op, status) {
    if (status === 'concluida' && !(await confirmar({ titulo: 'Concluir ordem', mensagem: `Concluir ${op.numero}? As matérias-primas da fórmula serão baixadas do estoque.`, confirmarTexto: 'Concluir', perigo: false }))) return;
    setMsg(null);
    try {
      await api(`/producao/ordens/${op.id}/status`, { method: 'PUT', body: { status } });
      recarregar();
      toast.sucesso(status === 'concluida' ? `${op.numero} concluída — matérias-primas baixadas do estoque` : `${op.numero} atualizada`);
    } catch (e) {
      toast.erro(e.message);
    }
  }

  async function excluir(op) {
    if (!(await confirmar({ titulo: 'Excluir ordem', mensagem: `Excluir a ordem ${op.numero}?`, confirmarTexto: 'Excluir', perigo: true }))) return;
    try {
      await api(`/producao/ordens/${op.id}`, { method: 'DELETE' });
      recarregar();
      toast.sucesso(`Ordem ${op.numero} excluída`);
    } catch (e) {
      toast.erro(e.message);
    }
  }

  return (
    <div className="cartao">
      <div className="cartao-cabecalho">
        <h3><Cog size={15} className="icone-cartao" />Ordens de produção</h3>
        <button className="botao" onClick={() => setCriando(true)}>+ Nova ordem</button>
      </div>
      <Erro msg={erro || msg} />
      {carregando ? <Carregando /> : !dados?.length ? <Vazio msg="Nenhuma ordem — crie uma aqui ou gere a partir de um pedido (aba 1)" /> : (
        <div className="tabela-envolucro">
          <table className="tabela">
            <thead>
              <tr>
                <th>Número</th>
                <th>Produto</th>
                <th>Pedido</th>
                <th>Linha</th>
                <th className="num">Quantidade</th>
                <th className="num">Lotes</th>
                <th className="num">Horas est.</th>
                <th>Início</th>
                <th>Fim</th>
                <th>Status</th>
                <th className="acoes">Ações</th>
              </tr>
            </thead>
            <tbody>
              {dados.map((op) => (
                <tr key={op.id}>
                  <td className="negrito">{op.numero}</td>
                  <td>{op.produto_nome}</td>
                  <td>{op.pedido_numero ? `${op.pedido_numero} · ${op.cliente}` : '—'}</td>
                  <td>{op.linha_nome || '—'}</td>
                  <td className="num">{fmtNum(op.quantidade, 0)} {op.unidade}</td>
                  <td className="num">{op.lotes != null ? fmtNum(op.lotes, 2) : '—'}</td>
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
                      <button className="botao botao-perigo botao-mini" onClick={() => excluir(op)}>Excluir</button>
                    )}
                  </td>
                </tr>
              ))}
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
    </div>
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

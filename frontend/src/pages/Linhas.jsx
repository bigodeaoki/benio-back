import React from 'react';
import { api } from '../api.js';
import { Campo, Carregando, Erro, Modal, Vazio, fmtBRL, fmtNum, fmtPct, useDados } from '../ui.jsx';

export default function Linhas() {
  const { dados, erro, carregando, recarregar } = useDados(() => api('/linhas'));
  const { dados: colaboradores } = useDados(() => api('/colaboradores'));
  const { dados: utilidades } = useDados(() => api('/utilidades'));
  const [editando, setEditando] = React.useState(null);
  const [msg, setMsg] = React.useState(null);

  async function excluir(l) {
    if (!confirm(`Remover a linha ${l.nome}?`)) return;
    try {
      await api(`/linhas/${l.id}`, { method: 'DELETE' });
      recarregar();
    } catch (e) {
      setMsg(e.message);
    }
  }

  return (
    <>
      <div className="cartao-cabecalho" style={{ marginBottom: 4 }}>
        <h3 style={{ flex: 1 }}>Linhas de processo</h3>
        <button className="botao" onClick={() => setEditando({ novo: true })}>+ Nova linha</button>
      </div>
      <Erro msg={erro || msg} />
      {carregando ? <Carregando /> : !dados?.length ? <div className="cartao"><Vazio /></div> : null}
      {dados?.map((l) => (
        <div className="cartao" key={l.id}>
          <div className="cartao-cabecalho">
            <h3>{l.nome} {!l.ativa && <span className="badge badge-cinza">inativa</span>}</h3>
            <span className="texto-suave">{l.descricao}</span>
            <button className="botao botao-secundario botao-mini" onClick={() => setEditando(l)}>Editar</button>
            <button className="botao botao-perigo botao-mini" onClick={() => excluir(l)}>Excluir</button>
          </div>
          <div className="grade-kpis">
            <div className="kpi">
              <div className="kpi-rotulo">Produção em 1h de trabalho</div>
              <div className="kpi-valor">{fmtNum(l.producao_hora, 0)} {l.unidade_producao}</div>
            </div>
            <div className="kpi">
              <div className="kpi-rotulo">Rendimento da linha</div>
              <div className="kpi-valor">{fmtPct(l.rendimento_pct)}</div>
            </div>
            <div className="kpi">
              <div className="kpi-rotulo">Mão de obra por hora</div>
              <div className="kpi-valor">{fmtBRL(l.custo_hora_mao_de_obra)}</div>
              <div className="kpi-extra">{l.colaboradores.length} colaborador(es)</div>
            </div>
            <div className="kpi">
              <div className="kpi-rotulo">Utilidades por hora</div>
              <div className="kpi-valor">{fmtBRL(l.custo_hora_utilidades)}</div>
              <div className="kpi-extra">{l.utilidades.length} consumo(s)</div>
            </div>
            <div className="kpi">
              <div className="kpi-rotulo">Disponibilidade semanal</div>
              <div className="kpi-valor">{fmtNum(l.horas_disponiveis_semana, 0)} h</div>
            </div>
          </div>
          <div className="grade-2">
            <div>
              <h4 style={{ margin: '4px 0 8px', fontSize: 13 }}>Equipamentos</h4>
              {!l.equipamentos.length ? <div className="texto-suave">Nenhum equipamento</div> : (
                <table className="tabela">
                  <thead><tr><th>Equipamento</th><th className="num">Potência (kW)</th><th>Observação</th></tr></thead>
                  <tbody>
                    {l.equipamentos.map((e) => (
                      <tr key={e.id}>
                        <td>{e.nome}</td>
                        <td className="num">{fmtNum(e.potencia_kw)}</td>
                        <td className="texto-suave">{e.observacao || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <h4 style={{ margin: '14px 0 8px', fontSize: 13 }}>Consumos de utilidades por hora trabalhada</h4>
              {!l.utilidades.length ? <div className="texto-suave">Nenhum consumo cadastrado</div> : (
                <table className="tabela">
                  <thead><tr><th>Utilidade</th><th className="num">Consumo/h</th><th className="num">Custo/h</th></tr></thead>
                  <tbody>
                    {l.utilidades.map((u) => (
                      <tr key={u.utilidade_id}>
                        <td>{u.nome}</td>
                        <td className="num">{fmtNum(u.consumo_hora, 3)} {u.unidade}</td>
                        <td className="num">{fmtBRL(u.custo_hora)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div>
              <h4 style={{ margin: '4px 0 8px', fontSize: 13 }}>Colaboradores da linha (aba 4)</h4>
              {!l.colaboradores.length ? <div className="texto-suave">Nenhum colaborador vinculado</div> : (
                <table className="tabela">
                  <thead><tr><th>Colaborador</th><th>Cargo</th><th className="num">Dedicação</th><th className="num">Custo/h efetivo</th></tr></thead>
                  <tbody>
                    {l.colaboradores.map((c) => (
                      <tr key={c.colaborador_id}>
                        <td>{c.nome}</td>
                        <td className="texto-suave">{c.cargo}</td>
                        <td className="num">{fmtPct(c.dedicacao_pct)}</td>
                        <td className="num">{fmtBRL(c.custo_hora_efetivo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      ))}
      {editando && (
        <FormLinha
          linha={editando.novo ? null : editando}
          colaboradores={colaboradores || []}
          utilidades={utilidades || []}
          aoFechar={() => setEditando(null)}
          aoSalvar={() => { setEditando(null); recarregar(); }}
        />
      )}
    </>
  );
}

function FormLinha({ linha, colaboradores, utilidades, aoFechar, aoSalvar }) {
  const [f, setF] = React.useState(() =>
    linha
      ? {
          ...linha,
          equipamentos: linha.equipamentos.map((e) => ({ nome: e.nome, potencia_kw: e.potencia_kw, observacao: e.observacao || '' })),
          colaboradores: linha.colaboradores.map((c) => ({ colaborador_id: c.colaborador_id, dedicacao_pct: c.dedicacao_pct })),
          utilidades: linha.utilidades.map((u) => ({ utilidade_id: u.utilidade_id, consumo_hora: u.consumo_hora })),
        }
      : {
          nome: '', descricao: '', producao_hora: '', unidade_producao: 'un',
          rendimento_pct: 100, horas_disponiveis_semana: 44, ativa: 1,
          equipamentos: [], colaboradores: [], utilidades: [],
        },
  );
  const [erro, setErro] = React.useState(null);
  const mudar = (campo, valor) => setF((s) => ({ ...s, [campo]: valor }));

  function alternarColaborador(id) {
    setF((s) => {
      const existe = s.colaboradores.find((c) => c.colaborador_id === id);
      return {
        ...s,
        colaboradores: existe
          ? s.colaboradores.filter((c) => c.colaborador_id !== id)
          : [...s.colaboradores, { colaborador_id: id, dedicacao_pct: 100 }],
      };
    });
  }

  function alternarUtilidade(id) {
    setF((s) => {
      const existe = s.utilidades.find((u) => u.utilidade_id === id);
      return {
        ...s,
        utilidades: existe
          ? s.utilidades.filter((u) => u.utilidade_id !== id)
          : [...s.utilidades, { utilidade_id: id, consumo_hora: 0 }],
      };
    });
  }

  async function salvar() {
    setErro(null);
    try {
      if (linha) await api(`/linhas/${linha.id}`, { method: 'PUT', body: f });
      else await api('/linhas', { method: 'POST', body: f });
      aoSalvar();
    } catch (e) {
      setErro(e.message);
    }
  }

  return (
    <Modal titulo={linha ? `Editar ${linha.nome}` : 'Nova linha de processo'} largura={820} onFechar={aoFechar}
      rodape={
        <>
          <button className="botao botao-secundario" onClick={aoFechar}>Cancelar</button>
          <button className="botao" onClick={salvar}>Salvar linha</button>
        </>
      }
    >
      <Erro msg={erro} />
      <div className="linha-campos">
        <Campo rotulo="Nome da linha *"><input value={f.nome} onChange={(e) => mudar('nome', e.target.value)} /></Campo>
        <Campo rotulo="Descrição"><input value={f.descricao || ''} onChange={(e) => mudar('descricao', e.target.value)} /></Campo>
      </div>
      <div className="linha-campos">
        <Campo rotulo="Quantidade produzida em 1h">
          <input type="number" step="any" value={f.producao_hora} onChange={(e) => mudar('producao_hora', e.target.value)} />
        </Campo>
        <Campo rotulo="Unidade" largura={90}><input value={f.unidade_producao} onChange={(e) => mudar('unidade_producao', e.target.value)} /></Campo>
        <Campo rotulo="Rendimento da linha (%)">
          <input type="number" step="any" value={f.rendimento_pct} onChange={(e) => mudar('rendimento_pct', e.target.value)} />
        </Campo>
        <Campo rotulo="Horas disponíveis/semana">
          <input type="number" step="any" value={f.horas_disponiveis_semana} onChange={(e) => mudar('horas_disponiveis_semana', e.target.value)} />
        </Campo>
        <Campo rotulo="Ativa" largura={90}>
          <select value={f.ativa ? 1 : 0} onChange={(e) => mudar('ativa', Number(e.target.value))}>
            <option value={1}>Sim</option>
            <option value={0}>Não</option>
          </select>
        </Campo>
      </div>

      <h3 style={{ margin: '12px 0 8px' }}>Equipamentos utilizados</h3>
      {f.equipamentos.map((eq, i) => (
        <div className="linha-campos" key={i}>
          <Campo rotulo={i === 0 ? 'Equipamento' : ''}>
            <input value={eq.nome} onChange={(e) => {
              const equipamentos = f.equipamentos.slice();
              equipamentos[i] = { ...eq, nome: e.target.value };
              setF((s) => ({ ...s, equipamentos }));
            }} />
          </Campo>
          <Campo rotulo={i === 0 ? 'Potência (kW)' : ''} largura={120}>
            <input type="number" step="any" value={eq.potencia_kw} onChange={(e) => {
              const equipamentos = f.equipamentos.slice();
              equipamentos[i] = { ...eq, potencia_kw: e.target.value };
              setF((s) => ({ ...s, equipamentos }));
            }} />
          </Campo>
          <Campo rotulo={i === 0 ? 'Observação' : ''}>
            <input value={eq.observacao} onChange={(e) => {
              const equipamentos = f.equipamentos.slice();
              equipamentos[i] = { ...eq, observacao: e.target.value };
              setF((s) => ({ ...s, equipamentos }));
            }} />
          </Campo>
          <Campo rotulo={i === 0 ? ' ' : ''} largura={44}>
            <button className="botao botao-perigo botao-mini" style={{ height: 34 }}
              onClick={() => setF((s) => ({ ...s, equipamentos: s.equipamentos.filter((_, j) => j !== i) }))}>
              ×
            </button>
          </Campo>
        </div>
      ))}
      <button className="botao botao-secundario botao-mini"
        onClick={() => setF((s) => ({ ...s, equipamentos: [...s.equipamentos, { nome: '', potencia_kw: '', observacao: '' }] }))}>
        + Adicionar equipamento
      </button>

      <h3 style={{ margin: '16px 0 8px' }}>Colaboradores que participam da linha</h3>
      {!colaboradores.length && <div className="texto-suave">Cadastre colaboradores na aba 4 primeiro.</div>}
      {colaboradores.filter((c) => c.ativo).map((c) => {
        const vinculo = f.colaboradores.find((x) => x.colaborador_id === c.id);
        return (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', borderBottom: '1px solid #f0f3f8' }}>
            <input type="checkbox" checked={!!vinculo} onChange={() => alternarColaborador(c.id)} />
            <span style={{ flex: 1 }}>{c.nome} <span className="texto-suave">· {c.cargo} · {fmtBRL(c.custo_hora)}/h</span></span>
            {vinculo && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="texto-suave">dedicação</span>
                <input type="number" step="any" style={{ width: 80 }} value={vinculo.dedicacao_pct}
                  onChange={(e) => setF((s) => ({
                    ...s,
                    colaboradores: s.colaboradores.map((x) =>
                      x.colaborador_id === c.id ? { ...x, dedicacao_pct: e.target.value } : x),
                  }))} />
                <span className="texto-suave">%</span>
              </span>
            )}
          </div>
        );
      })}

      <h3 style={{ margin: '16px 0 8px' }}>Consumos de utilidade por hora trabalhada</h3>
      {!utilidades.length && <div className="texto-suave">Cadastre utilidades na aba 5 primeiro.</div>}
      {utilidades.map((u) => {
        const vinculo = f.utilidades.find((x) => x.utilidade_id === u.id);
        return (
          <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', borderBottom: '1px solid #f0f3f8' }}>
            <input type="checkbox" checked={!!vinculo} onChange={() => alternarUtilidade(u.id)} />
            <span style={{ flex: 1 }}>{u.nome} <span className="texto-suave">· {fmtBRL(u.custo_unitario)}/{u.unidade}</span></span>
            {vinculo && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="texto-suave">consumo</span>
                <input type="number" step="any" style={{ width: 100 }} value={vinculo.consumo_hora}
                  onChange={(e) => setF((s) => ({
                    ...s,
                    utilidades: s.utilidades.map((x) =>
                      x.utilidade_id === u.id ? { ...x, consumo_hora: e.target.value } : x),
                  }))} />
                <span className="texto-suave">{u.unidade}/h</span>
              </span>
            )}
          </div>
        );
      })}
    </Modal>
  );
}

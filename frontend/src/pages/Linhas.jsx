import React from 'react';
import { Factory } from 'lucide-react';
import { api } from '../api.js';
import { Campo, Carregando, Erro, Modal, Vazio, fmtBRL, fmtNum, fmtPct, useDados, toast, confirmar } from '../ui.jsx';

export default function Linhas() {
  const { dados, erro, carregando, recarregar } = useDados(() => api('/linhas'));
  const { dados: funcionarios } = useDados(() => api('/usuarios/equipe'));
  const { dados: utilidades } = useDados(() => api('/utilidades'));
  const [editando, setEditando] = React.useState(null);
  const [msg, setMsg] = React.useState(null);

  async function excluir(l) {
    if (!(await confirmar({ titulo: 'Remover linha', mensagem: `Remover a linha ${l.nome}? Equipamentos, equipe e consumos vinculados saem junto.`, confirmarTexto: 'Remover', perigo: true }))) return;
    try {
      await api(`/linhas/${l.id}`, { method: 'DELETE' });
      recarregar();
      toast.sucesso(`Linha ${l.nome} removida`);
    } catch (e) {
      toast.erro(e.message);
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
            <h3><Factory size={15} className="icone-cartao" />{l.nome} {!l.ativa && <span className="badge badge-cinza">inativa</span>}</h3>
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
              <div className="kpi-extra">{l.funcionarios.length} funcionário(s)</div>
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
              <h4 style={{ margin: '4px 0 8px', fontSize: 13 }}>Funcionários da linha</h4>
              {!l.funcionarios.length ? <div className="texto-suave">Nenhum funcionário vinculado</div> : (
                <table className="tabela">
                  <thead><tr><th>Funcionário</th><th>Cargo</th><th className="num">Dedicação</th><th className="num">Custo/h efetivo</th></tr></thead>
                  <tbody>
                    {l.funcionarios.map((c) => (
                      <tr key={c.usuario_id}>
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
          funcionarios={funcionarios || []}
          utilidades={utilidades || []}
          aoFechar={() => setEditando(null)}
          aoSalvar={() => { setEditando(null); recarregar(); toast.sucesso('Linha de processo salva'); }}
        />
      )}
    </>
  );
}

function FormLinha({ linha, funcionarios, utilidades, aoFechar, aoSalvar }) {
  const [f, setF] = React.useState(() =>
    linha
      ? {
          ...linha,
          equipamentos: linha.equipamentos.map((e) => ({ nome: e.nome, potencia_kw: e.potencia_kw, observacao: e.observacao || '' })),
          funcionarios: linha.funcionarios.map((c) => ({ usuario_id: c.usuario_id, dedicacao_pct: c.dedicacao_pct })),
          utilidades: linha.utilidades.map((u) => ({ utilidade_id: u.utilidade_id, consumo_hora: u.consumo_hora })),
        }
      : {
          nome: '', descricao: '', producao_hora: '', unidade_producao: 'un',
          rendimento_pct: 100, horas_disponiveis_semana: 44, ativa: 1,
          equipamentos: [], funcionarios: [], utilidades: [],
        },
  );
  const [erro, setErro] = React.useState(null);
  const mudar = (campo, valor) => setF((s) => ({ ...s, [campo]: valor }));

  // Autocomplete de funcionários: digitar filtra a lista; selecionar habilita o botão de adicionar
  const [buscaColab, setBuscaColab] = React.useState('');
  const [colabSelecionado, setColabSelecionado] = React.useState(null);
  const [mostrarSugestoes, setMostrarSugestoes] = React.useState(false);

  const sugestoes = funcionarios.filter((c) => {
    if (f.funcionarios.some((v) => v.usuario_id === c.id)) return false;
    const termo = buscaColab.trim().toLowerCase();
    return !termo || c.nome.toLowerCase().includes(termo) || (c.cargo || '').toLowerCase().includes(termo);
  });

  function selecionarColaborador(c) {
    setColabSelecionado(c);
    setBuscaColab(c.nome);
    setMostrarSugestoes(false);
  }

  function adicionarColaborador() {
    if (!colabSelecionado) return;
    setF((s) => ({
      ...s,
      funcionarios: [...s.funcionarios, { usuario_id: colabSelecionado.id, dedicacao_pct: 100 }],
    }));
    setColabSelecionado(null);
    setBuscaColab('');
  }

  function removerColaborador(id) {
    setF((s) => ({ ...s, funcionarios: s.funcionarios.filter((c) => c.usuario_id !== id) }));
  }

  // O custo por funcionário não aparece na tela — só o total da linha.
  // Mesma conta do backend (linhas.service.ts): custo_hora × dedicação
  const totalMaoDeObraHora = f.funcionarios.reduce((soma, vinculo) => {
    const c = funcionarios.find((x) => x.id === vinculo.usuario_id);
    if (!c) return soma;
    return soma + Number(c.custo_hora || 0) * (Number(vinculo.dedicacao_pct || 0) / 100);
  }, 0);

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
      {!funcionarios.length && <div className="texto-suave">Cadastre usuários vinculados a esta empresa na aba Usuários primeiro.</div>}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6 }}>
        <div className="autocomplete" style={{ flex: 1 }}>
          <input
            value={buscaColab}
            onChange={(e) => { setBuscaColab(e.target.value); setColabSelecionado(null); setMostrarSugestoes(true); }}
            onFocus={() => setMostrarSugestoes(true)}
            onBlur={() => setTimeout(() => setMostrarSugestoes(false), 150)}
            placeholder="digite o nome do funcionário…"
          />
          {mostrarSugestoes && !colabSelecionado && (
            <div className="autocomplete-lista">
              {!sugestoes.length ? (
                <div className="autocomplete-vazio">Nenhum funcionário disponível com esse nome</div>
              ) : (
                sugestoes.map((c) => (
                  <button type="button" key={c.id} className="autocomplete-opcao" onMouseDown={() => selecionarColaborador(c)}>
                    <strong>{c.nome}</strong>
                    <span className="texto-suave"> · {c.cargo || 'sem cargo'}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        <button type="button" className="botao" disabled={!colabSelecionado} onClick={adicionarColaborador} style={{ height: 34 }}>
          + Adicionar
        </button>
      </div>
      {!f.funcionarios.length ? (
        <div className="texto-suave" style={{ padding: '6px 0' }}>Nenhum funcionário vinculado à linha ainda.</div>
      ) : (
        f.funcionarios.map((vinculo) => {
          const c = funcionarios.find((x) => x.id === vinculo.usuario_id);
          if (!c) return null;
          return (
            <div key={vinculo.usuario_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid #f0f3f8' }}>
              <span style={{ flex: 1 }}>{c.nome} <span className="texto-suave">· {c.cargo}</span></span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="texto-suave">dedicação</span>
                <input type="number" step="any" style={{ width: 80 }} value={vinculo.dedicacao_pct}
                  onChange={(e) => setF((s) => ({
                    ...s,
                    funcionarios: s.funcionarios.map((x) =>
                      x.usuario_id === vinculo.usuario_id ? { ...x, dedicacao_pct: e.target.value } : x),
                  }))} />
                <span className="texto-suave">%</span>
              </span>
              <button type="button" className="botao botao-perigo botao-mini" onClick={() => removerColaborador(vinculo.usuario_id)} title="Remover da linha">
                ×
              </button>
            </div>
          );
        })
      )}
      {!!f.funcionarios.length && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '8px 0' }}>
          <span className="texto-suave">Total de mão de obra da linha</span>
          <strong>{fmtBRL(totalMaoDeObraHora)}/h</strong>
        </div>
      )}

      <h3 style={{ margin: '16px 0 8px' }}>Consumos de utilidade por hora trabalhada</h3>
      {!utilidades.length && <div className="texto-suave">Cadastre utilidades na aba Utilidades (em Gestão) primeiro.</div>}
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

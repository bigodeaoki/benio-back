import React from 'react';
import { Droplets } from 'lucide-react';
import { api } from '../api.js';
import { Campo, Carregando, Erro, Modal, Vazio, fmtBRL, fmtNum, fmtPct, useDados, toast, confirmar } from '../ui.jsx';

// Envase: etapa de envase/embalagem que a linha de processo pode ter (várias por
// linha). Tudo é "por hora de envase": funcionários (custo-hora × dedicação),
// equipamentos (kW × preço do kWh da utilidade de energia) e matérias-primas
// consumidas por hora; o rendimento entra nos materiais. O total em R$/h vai
// para a linha e para o custo do produto (× horas do lote).
export default function Envases() {
  const { dados, erro, carregando, recarregar } = useDados(() => api('/envases'));
  // Todos os usuários ativos do sistema, não só os vinculados à empresa ativa
  const { dados: funcionarios } = useDados(() => api('/usuarios/equipe?todos=1'));
  const { dados: materias } = useDados(() => api('/materias'));
  const { dados: utilidades } = useDados(() => api('/utilidades'));
  const [editando, setEditando] = React.useState(null);
  const energia = (utilidades || []).find((u) => u.tipo === 'energia') || null;

  async function excluir(e) {
    const emUso = e.linhas.length ? ` Ele sai da(s) linha(s): ${e.linhas.map((l) => l.nome).join(', ')}.` : '';
    if (!(await confirmar({ titulo: 'Remover envase', mensagem: `Remover o envase ${e.titulo}?${emUso}`, confirmarTexto: 'Remover', perigo: true }))) return;
    try {
      await api(`/envases/${e.id}`, { method: 'DELETE' });
      recarregar();
      toast.sucesso(`Envase ${e.titulo} removido`);
    } catch (err) {
      toast.erro(err.message);
    }
  }

  return (
    <>
      <div className="cartao-cabecalho" style={{ marginBottom: 4 }}>
        <h3 style={{ flex: 1 }}>Etapas de envase</h3>
        <button className="botao" onClick={() => setEditando({ novo: true })}>+ Novo envase</button>
      </div>
      <div className="alerta alerta-info">
        Cada envase é uma etapa que a <strong>linha de processo</strong> pode ter (várias por linha) e custa <strong>por hora</strong>:
        {' '}funcionários (custo-hora × dedicação), equipamentos (potência × preço do kWh) e matérias-primas consumidas por hora,
        {' '}com o <strong>rendimento</strong> aplicado aos materiais. Esse total entra no custo do produto multiplicado pelas horas do lote.
        {' '}{energia
          ? <>Energia dos equipamentos pelo preço de <strong>{energia.nome}</strong> ({fmtBRL(energia.custo_unitario)}/{energia.unidade}).</>
          : <>Cadastre uma utilidade do tipo <strong>energia</strong> para custear os equipamentos.</>}
      </div>
      <Erro msg={erro} />
      {carregando ? <Carregando /> : !dados?.length ? <div className="cartao"><Vazio msg="Nenhum envase cadastrado" /></div> : null}
      {dados?.map((e) => (
        <div className="cartao" key={e.id}>
          <div className="cartao-cabecalho">
            <h3><Droplets size={15} className="icone-cartao" />{e.titulo} {!e.ativo && <span className="badge badge-cinza">inativo</span>}</h3>
            <span className="texto-suave" style={{ flex: 1 }}>
              {e.descricao}{e.descricao && e.linhas.length ? ' · ' : ''}
              {e.linhas.length ? `usado em: ${e.linhas.map((l) => l.nome).join(', ')}` : 'ainda não vinculado a nenhuma linha'}
            </span>
            <button className="botao botao-secundario botao-mini" onClick={() => setEditando(e)}>Editar</button>
            <button className="botao botao-perigo botao-mini" onClick={() => excluir(e)}>Excluir</button>
          </div>
          <div className="grade-kpis">
            <div className="kpi">
              <div className="kpi-rotulo">Mão de obra por hora</div>
              <div className="kpi-valor">{fmtBRL(e.custo_hora_mao_de_obra)}</div>
              <div className="kpi-extra">{e.funcionarios.length} funcionário(s)</div>
            </div>
            <div className="kpi">
              <div className="kpi-rotulo">Equipamentos (energia) por hora</div>
              <div className="kpi-valor">{fmtBRL(e.custo_hora_energia)}</div>
              <div className="kpi-extra">{fmtNum(e.equipamentos.reduce((s, q) => s + q.potencia_kw, 0))} kW × {fmtBRL(e.preco_kwh)}/kWh</div>
            </div>
            <div className="kpi">
              <div className="kpi-rotulo">Materiais por hora</div>
              <div className="kpi-valor">{fmtBRL(e.custo_hora_materiais)}</div>
              <div className="kpi-extra">{fmtBRL(e.custo_hora_materiais_bruto)} + perda de {fmtBRL(e.perda_rendimento_hora)}</div>
            </div>
            <div className="kpi">
              <div className="kpi-rotulo">Rendimento</div>
              <div className="kpi-valor">{fmtPct(e.rendimento_pct)}</div>
              <div className="kpi-extra">aplicado aos materiais</div>
            </div>
            <div className="kpi">
              <div className="kpi-rotulo">Total gasto por hora</div>
              <div className="kpi-valor">{fmtBRL(e.custo_hora_total)}</div>
              <div className="kpi-extra">mão de obra + energia + materiais</div>
            </div>
          </div>
          <div className="grade-2">
            <div>
              <h4 style={{ margin: '4px 0 8px', fontSize: 13 }}>Equipamentos utilizados</h4>
              {!e.equipamentos.length ? <div className="texto-suave">Nenhum equipamento</div> : (
                <table className="tabela">
                  <thead><tr><th>Equipamento</th><th className="num">Potência (kW)</th><th className="num">Energia/h</th><th>Observação</th></tr></thead>
                  <tbody>
                    {e.equipamentos.map((q) => (
                      <tr key={q.id}>
                        <td>{q.nome}</td>
                        <td className="num">{fmtNum(q.potencia_kw)}</td>
                        <td className="num">{fmtBRL(q.custo_hora_energia)}</td>
                        <td className="texto-suave">{q.observacao || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <h4 style={{ margin: '14px 0 8px', fontSize: 13 }}>Matérias-primas consumidas por hora</h4>
              {!e.materias.length ? <div className="texto-suave">Nenhuma matéria-prima</div> : (
                <table className="tabela">
                  <thead><tr><th>Matéria-prima</th><th className="num">Quantidade/h</th><th className="num">Custo unit.</th><th className="num">Custo/h</th></tr></thead>
                  <tbody>
                    {e.materias.map((m) => (
                      <tr key={m.materia_prima_id}>
                        <td>{m.nome}</td>
                        <td className="num">{fmtNum(m.quantidade_hora, 3)} {m.unidade}</td>
                        <td className="num">{fmtBRL(m.custo_unitario)}</td>
                        <td className="num">{fmtBRL(m.custo_hora)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div>
              <h4 style={{ margin: '4px 0 8px', fontSize: 13 }}>Funcionários do envase</h4>
              {!e.funcionarios.length ? <div className="texto-suave">Nenhum funcionário vinculado</div> : (
                <table className="tabela">
                  <thead><tr><th>Funcionário</th><th>Cargo</th><th className="num">Dedicação</th></tr></thead>
                  <tbody>
                    {e.funcionarios.map((c) => (
                      <tr key={c.usuario_id}>
                        <td>{c.nome}</td>
                        <td className="texto-suave">{c.cargo}</td>
                        <td className="num">{fmtPct(c.dedicacao_pct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '8px 0' }}>
                <span className="texto-suave">Total de mão de obra</span>
                <strong>{fmtBRL(e.custo_hora_mao_de_obra)}/h</strong>
              </div>
            </div>
          </div>
        </div>
      ))}
      {editando && (
        <FormEnvase
          envase={editando.novo ? null : editando}
          funcionarios={funcionarios || []}
          materias={materias || []}
          energia={energia}
          aoFechar={() => setEditando(null)}
          aoSalvar={() => { setEditando(null); recarregar(); toast.sucesso('Envase salvo'); }}
        />
      )}
    </>
  );
}

function FormEnvase({ envase, funcionarios, materias, energia, aoFechar, aoSalvar }) {
  const [f, setF] = React.useState(() =>
    envase
      ? {
          titulo: envase.titulo, descricao: envase.descricao || '', rendimento_pct: envase.rendimento_pct, ativo: envase.ativo,
          equipamentos: envase.equipamentos.map((q) => ({ nome: q.nome, potencia_kw: q.potencia_kw, observacao: q.observacao || '' })),
          funcionarios: envase.funcionarios.map((c) => ({ usuario_id: c.usuario_id, dedicacao_pct: c.dedicacao_pct })),
          materias: envase.materias.map((m) => ({ materia_prima_id: m.materia_prima_id, quantidade_hora: m.quantidade_hora })),
        }
      : { titulo: '', descricao: '', rendimento_pct: 100, ativo: 1, equipamentos: [], funcionarios: [], materias: [] },
  );
  const [erro, setErro] = React.useState(null);
  const mudar = (campo, valor) => setF((s) => ({ ...s, [campo]: valor }));

  // Autocomplete de funcionários: lista todos os usuários e filtra só pelo nome
  // (o cargo aparece como informação, mas não entra na busca); sem salário na tela
  const [buscaColab, setBuscaColab] = React.useState('');
  const [colabSelecionado, setColabSelecionado] = React.useState(null);
  const [mostrarSugestoes, setMostrarSugestoes] = React.useState(false);
  const sugestoes = funcionarios.filter((c) => {
    if (f.funcionarios.some((v) => v.usuario_id === c.id)) return false;
    const termo = buscaColab.trim().toLowerCase();
    return !termo || c.nome.toLowerCase().includes(termo);
  });
  function selecionarColaborador(c) {
    setColabSelecionado(c);
    setBuscaColab(c.nome);
    setMostrarSugestoes(false);
  }
  function adicionarColaborador() {
    if (!colabSelecionado) return;
    setF((s) => ({ ...s, funcionarios: [...s.funcionarios, { usuario_id: colabSelecionado.id, dedicacao_pct: 100 }] }));
    setColabSelecionado(null);
    setBuscaColab('');
  }
  const mudarLista = (lista, i, campo, valor) =>
    setF((s) => ({ ...s, [lista]: s[lista].map((item, j) => (j === i ? { ...item, [campo]: valor } : item)) }));
  const removerDaLista = (lista, i) => setF((s) => ({ ...s, [lista]: s[lista].filter((_, j) => j !== i) }));

  // Mesma conta do backend (envases.service.ts), só para o total aparecer enquanto edita
  const precoKwh = Number(energia?.custo_unitario || 0);
  const totalMaoDeObra = f.funcionarios.reduce((s, v) => {
    const c = funcionarios.find((x) => x.id === v.usuario_id);
    return c ? s + Number(c.custo_hora || 0) * (Number(v.dedicacao_pct || 0) / 100) : s;
  }, 0);
  const totalEnergia = f.equipamentos.reduce((s, q) => s + (Number(q.potencia_kw) || 0) * precoKwh, 0);
  const materiaisBruto = f.materias.reduce((s, m) => {
    const mp = materias.find((x) => x.id === Number(m.materia_prima_id));
    return mp ? s + (Number(m.quantidade_hora) || 0) * Number(mp.custo_unitario || 0) : s;
  }, 0);
  const rendimento = Number(f.rendimento_pct) > 0 ? Number(f.rendimento_pct) : 100;
  const totalMateriais = materiaisBruto / (rendimento / 100);
  const totalHora = totalMaoDeObra + totalEnergia + totalMateriais;

  async function salvar() {
    setErro(null);
    try {
      if (envase) await api(`/envases/${envase.id}`, { method: 'PUT', body: f });
      else await api('/envases', { method: 'POST', body: f });
      aoSalvar();
    } catch (e) {
      setErro(e.message);
    }
  }

  return (
    <Modal titulo={envase ? `Editar ${envase.titulo}` : 'Novo envase'} largura={820} onFechar={aoFechar}
      rodape={
        <>
          <button className="botao botao-secundario" onClick={aoFechar}>Cancelar</button>
          <button className="botao" onClick={salvar}>Salvar envase</button>
        </>
      }
    >
      <Erro msg={erro} />
      <div className="linha-campos">
        <Campo rotulo="Título *"><input value={f.titulo} onChange={(e) => mudar('titulo', e.target.value)} placeholder="ex.: Envase pote 400 g" /></Campo>
        <Campo rotulo="Descrição"><input value={f.descricao} onChange={(e) => mudar('descricao', e.target.value)} /></Campo>
        <Campo rotulo="Rendimento (%)" largura={130} dica="perda de material no envase">
          <input type="number" step="any" value={f.rendimento_pct} onChange={(e) => mudar('rendimento_pct', e.target.value)} />
        </Campo>
        <Campo rotulo="Ativo" largura={90}>
          <select value={f.ativo ? 1 : 0} onChange={(e) => mudar('ativo', Number(e.target.value))}>
            <option value={1}>Sim</option>
            <option value={0}>Não</option>
          </select>
        </Campo>
      </div>

      <h3 style={{ margin: '12px 0 8px' }}>Equipamentos utilizados</h3>
      {!energia && (
        <div className="texto-suave" style={{ marginBottom: 6 }}>
          Sem utilidade do tipo energia cadastrada: a potência fica registrada, mas o custo dos equipamentos sai como zero.
        </div>
      )}
      {f.equipamentos.map((q, i) => (
        <div className="linha-campos" key={i}>
          <Campo rotulo={i === 0 ? 'Equipamento' : ''}>
            <input value={q.nome} onChange={(e) => mudarLista('equipamentos', i, 'nome', e.target.value)} />
          </Campo>
          <Campo rotulo={i === 0 ? 'Potência (kW)' : ''} largura={120}>
            <input type="number" step="any" value={q.potencia_kw} onChange={(e) => mudarLista('equipamentos', i, 'potencia_kw', e.target.value)} />
          </Campo>
          <Campo rotulo={i === 0 ? 'Observação' : ''}>
            <input value={q.observacao} onChange={(e) => mudarLista('equipamentos', i, 'observacao', e.target.value)} />
          </Campo>
          <Campo rotulo={i === 0 ? ' ' : ''} largura={44}>
            <button type="button" className="botao botao-perigo botao-mini" style={{ height: 34 }} onClick={() => removerDaLista('equipamentos', i)}>×</button>
          </Campo>
        </div>
      ))}
      <button type="button" className="botao botao-secundario botao-mini"
        onClick={() => setF((s) => ({ ...s, equipamentos: [...s.equipamentos, { nome: '', potencia_kw: '', observacao: '' }] }))}>
        + Adicionar equipamento
      </button>

      <h3 style={{ margin: '16px 0 8px' }}>Funcionários do envase</h3>
      {!funcionarios.length && <div className="texto-suave">Cadastre usuários na aba Usuários primeiro.</div>}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6 }}>
        <div className="autocomplete" style={{ flex: 1 }}>
          <input
            value={buscaColab}
            onChange={(e) => { setBuscaColab(e.target.value); setColabSelecionado(null); setMostrarSugestoes(true); }}
            onFocus={() => setMostrarSugestoes(true)}
            onBlur={() => setTimeout(() => setMostrarSugestoes(false), 150)}
            placeholder="digite o nome do usuário…"
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
        <button type="button" className="botao" disabled={!colabSelecionado} onClick={adicionarColaborador} style={{ height: 34 }}>+ Adicionar</button>
      </div>
      {!f.funcionarios.length ? (
        <div className="texto-suave" style={{ padding: '6px 0' }}>Nenhum funcionário vinculado ao envase ainda.</div>
      ) : (
        f.funcionarios.map((v, i) => {
          const c = funcionarios.find((x) => x.id === v.usuario_id);
          if (!c) return null;
          return (
            <div key={v.usuario_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid #f0f3f8' }}>
              <span style={{ flex: 1 }}>{c.nome} <span className="texto-suave">· {c.cargo}</span></span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="texto-suave">dedicação</span>
                <input type="number" step="any" style={{ width: 80 }} value={v.dedicacao_pct}
                  onChange={(e) => mudarLista('funcionarios', i, 'dedicacao_pct', e.target.value)} />
                <span className="texto-suave">%</span>
              </span>
              <button type="button" className="botao botao-perigo botao-mini" onClick={() => removerDaLista('funcionarios', i)} title="Remover do envase">×</button>
            </div>
          );
        })
      )}

      <h3 style={{ margin: '16px 0 8px' }}>Matérias-primas consumidas por hora</h3>
      {!materias.length && <div className="texto-suave">Cadastre matérias-primas (em Gestão) primeiro.</div>}
      {f.materias.map((m, i) => {
        const mp = materias.find((x) => x.id === Number(m.materia_prima_id));
        return (
          <div className="linha-campos" key={i}>
            <Campo rotulo={i === 0 ? 'Matéria-prima' : ''}>
              <select value={m.materia_prima_id || ''} onChange={(e) => mudarLista('materias', i, 'materia_prima_id', Number(e.target.value))}>
                <option value="">— escolha —</option>
                {materias.map((x) => <option key={x.id} value={x.id}>{x.nome} ({fmtBRL(x.custo_unitario)}/{x.unidade})</option>)}
              </select>
            </Campo>
            <Campo rotulo={i === 0 ? `Quantidade por hora${mp ? ` (${mp.unidade})` : ''}` : ''} largura={170}>
              <input type="number" step="any" value={m.quantidade_hora} onChange={(e) => mudarLista('materias', i, 'quantidade_hora', e.target.value)} />
            </Campo>
            <Campo rotulo={i === 0 ? 'Custo/h' : ''} largura={120}>
              <input value={fmtBRL(mp ? (Number(m.quantidade_hora) || 0) * Number(mp.custo_unitario || 0) : 0)} readOnly />
            </Campo>
            <Campo rotulo={i === 0 ? ' ' : ''} largura={44}>
              <button type="button" className="botao botao-perigo botao-mini" style={{ height: 34 }} onClick={() => removerDaLista('materias', i)}>×</button>
            </Campo>
          </div>
        );
      })}
      <button type="button" className="botao botao-secundario botao-mini"
        onClick={() => setF((s) => ({ ...s, materias: [...s.materias, { materia_prima_id: '', quantidade_hora: '' }] }))}>
        + Adicionar matéria-prima
      </button>

      <div className="alerta alerta-info" style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
        <span>Mão de obra: <strong>{fmtBRL(totalMaoDeObra)}/h</strong></span>
        <span>Energia: <strong>{fmtBRL(totalEnergia)}/h</strong></span>
        <span>Materiais (rend. {fmtPct(rendimento)}): <strong>{fmtBRL(totalMateriais)}/h</strong></span>
        <span>Total gasto: <strong>{fmtBRL(totalHora)}/h</strong></span>
      </div>
    </Modal>
  );
}

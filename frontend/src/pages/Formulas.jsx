import React from 'react';
import { FlaskConical, Package } from 'lucide-react';
import { api } from '../api.js';
import { Campo, Carregando, Erro, Modal, Vazio, fmtBRL, fmtNum, fmtPct, useDados, toast, confirmar } from '../ui.jsx';

export default function Formulas() {
  const [subAba, setSubAba] = React.useState('produtos');
  return (
    <>
      <div className="sub-abas">
        <button className={`sub-aba ${subAba === 'produtos' ? 'ativa' : ''}`} onClick={() => setSubAba('produtos')}>
          Produtos & Fórmulas
        </button>
        <button className={`sub-aba ${subAba === 'materias' ? 'ativa' : ''}`} onClick={() => setSubAba('materias')}>
          Matérias-Primas
        </button>
      </div>
      {subAba === 'produtos' ? <Produtos /> : <Materias />}
    </>
  );
}

/* ---------------------- Matérias-primas ---------------------- */

function Materias() {
  const { dados, erro, carregando, recarregar } = useDados(() => api('/materias'));
  const [editando, setEditando] = React.useState(null);
  const [msg, setMsg] = React.useState(null);

  async function excluir(m) {
    if (!(await confirmar({ titulo: 'Remover matéria-prima', mensagem: `Remover ${m.nome} do cadastro?`, confirmarTexto: 'Remover', perigo: true }))) return;
    try {
      await api(`/materias/${m.id}`, { method: 'DELETE' });
      recarregar();
      toast.sucesso(`Matéria-prima ${m.nome} removida`);
    } catch (e) {
      toast.erro(e.message);
    }
  }

  return (
    <div className="cartao">
      <div className="cartao-cabecalho">
        <h3><Package size={15} className="icone-cartao" />Matérias-primas — preços e rendimentos</h3>
        <button className="botao" onClick={() => setEditando({ novo: true })}>+ Nova matéria-prima</button>
      </div>
      <Erro msg={erro || msg} />
      {carregando ? <Carregando /> : !dados?.length ? <Vazio /> : (
        <div className="tabela-envolucro">
          <table className="tabela">
            <thead>
              <tr>
                <th>Matéria-prima</th>
                <th>Unidade</th>
                <th className="num">Preço</th>
                <th className="num">Rendimento</th>
                <th>NCM</th>
                <th className="num">Estoque atual</th>
                <th className="num">Estoque mínimo</th>
                <th className="acoes">Ações</th>
              </tr>
            </thead>
            <tbody>
              {dados.map((m) => (
                <tr key={m.id}>
                  <td className="negrito">{m.nome}</td>
                  <td>{m.unidade}</td>
                  <td className="num">{fmtBRL(m.custo_unitario)} / {m.unidade}</td>
                  <td className="num">{fmtPct(m.rendimento_pct)}</td>
                  <td>{m.ncm_codigo ? <span title={m.ncm_descricao}>{m.ncm_codigo}</span> : '—'}</td>
                  <td className="num">{fmtNum(m.estoque_atual, 3)}</td>
                  <td className="num">{fmtNum(m.estoque_minimo, 3)}</td>
                  <td className="acoes">
                    <button className="botao botao-secundario botao-mini" onClick={() => setEditando(m)}>Editar</button>
                    <button className="botao botao-perigo botao-mini" onClick={() => excluir(m)}>Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editando && (
        <FormMateria
          materia={editando.novo ? null : editando}
          aoFechar={() => setEditando(null)}
          aoSalvar={() => { setEditando(null); recarregar(); toast.sucesso('Matéria-prima salva'); }}
        />
      )}
    </div>
  );
}

function FormMateria({ materia, aoFechar, aoSalvar }) {
  const [f, setF] = React.useState(
    materia || { nome: '', unidade: 'kg', custo_unitario: '', rendimento_pct: 100, ncm_codigo: '', estoque_atual: 0, estoque_minimo: 0 },
  );
  const [erro, setErro] = React.useState(null);
  const mudar = (campo, valor) => setF((s) => ({ ...s, [campo]: valor }));

  async function salvar() {
    setErro(null);
    try {
      if (materia) await api(`/materias/${materia.id}`, { method: 'PUT', body: f });
      else await api('/materias', { method: 'POST', body: f });
      aoSalvar();
    } catch (e) {
      setErro(e.message);
    }
  }

  return (
    <Modal titulo={materia ? `Editar ${materia.nome}` : 'Nova matéria-prima'} onFechar={aoFechar}
      rodape={
        <>
          <button className="botao botao-secundario" onClick={aoFechar}>Cancelar</button>
          <button className="botao" onClick={salvar}>Salvar</button>
        </>
      }
    >
      <Erro msg={erro} />
      <div className="linha-campos">
        <Campo rotulo="Nome *"><input value={f.nome} onChange={(e) => mudar('nome', e.target.value)} /></Campo>
        <Campo rotulo="Unidade" largura={110}><input value={f.unidade} onChange={(e) => mudar('unidade', e.target.value)} /></Campo>
      </div>
      <div className="linha-campos">
        <Campo rotulo={`Preço por ${f.unidade || 'un'} (R$)`}>
          <input type="number" step="any" value={f.custo_unitario} onChange={(e) => mudar('custo_unitario', e.target.value)} />
        </Campo>
        <Campo rotulo="Rendimento (%)" dica="aproveitamento real da MP — perdas aumentam o custo">
          <input type="number" step="any" value={f.rendimento_pct} onChange={(e) => mudar('rendimento_pct', e.target.value)} />
        </Campo>
      </div>
      <BuscaNcm valor={f.ncm_codigo} aoEscolher={(codigo) => mudar('ncm_codigo', codigo)} />
      <div className="linha-campos">
        {!materia && (
          <Campo rotulo="Estoque inicial">
            <input type="number" step="any" value={f.estoque_atual} onChange={(e) => mudar('estoque_atual', e.target.value)} />
          </Campo>
        )}
        <Campo rotulo="Estoque mínimo">
          <input type="number" step="any" value={f.estoque_minimo} onChange={(e) => mudar('estoque_minimo', e.target.value)} />
        </Campo>
      </div>
    </Modal>
  );
}

/* ---------------------- Busca NCM (tabela local + BrasilAPI) ---------------------- */

export function BuscaNcm({ valor, aoEscolher }) {
  const [busca, setBusca] = React.useState('');
  const [resultados, setResultados] = React.useState(null);
  const [buscando, setBuscando] = React.useState(false);

  async function buscar() {
    if (!busca.trim()) return;
    setBuscando(true);
    try {
      setResultados(await api(`/integracao/ncm?q=${encodeURIComponent(busca)}`));
    } catch {
      setResultados([]);
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div style={{ marginBottom: 10 }}>
      <div className="linha-campos">
        <Campo rotulo="NCM" largura={130}>
          <input value={valor || ''} onChange={(e) => aoEscolher(e.target.value.replace(/\D/g, ''))} placeholder="8 dígitos" />
        </Campo>
        <Campo rotulo="Buscar NCM (código ou descrição)">
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), buscar())}
              placeholder="ex.: goiabada, 2007..."
            />
            <button type="button" className="botao botao-secundario" onClick={buscar} disabled={buscando}>
              {buscando ? '…' : '🔎'}
            </button>
          </div>
        </Campo>
      </div>
      {resultados && (
        <div style={{ maxHeight: 150, overflowY: 'auto', border: '1px solid var(--borda)', borderRadius: 8 }}>
          {!resultados.length && <div className="vazio" style={{ padding: 10 }}>Nada encontrado</div>}
          {resultados.map((n) => (
            <button
              key={n.codigo}
              type="button"
              className="item-menu"
              style={{ color: 'var(--texto)', width: '100%', margin: 0, borderRadius: 0 }}
              onClick={() => { aoEscolher(n.codigo); setResultados(null); }}
            >
              <span className="mono">{n.codigo}</span> {n.descricao}
              {n.ipi_pct != null && <span className="texto-suave"> · IPI {fmtNum(n.ipi_pct)}%</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------- Produtos & fórmulas ---------------------- */

function Produtos() {
  const { dados, erro, carregando, recarregar } = useDados(() => api('/produtos'));
  const { dados: linhas } = useDados(() => api('/linhas'));
  const { dados: materias } = useDados(() => api('/materias'));
  const [editando, setEditando] = React.useState(null);
  const [msg, setMsg] = React.useState(null);

  async function excluir(p) {
    if (!(await confirmar({ titulo: 'Remover produto', mensagem: `Remover o produto ${p.nome} e sua fórmula?`, confirmarTexto: 'Remover', perigo: true }))) return;
    try {
      await api(`/produtos/${p.id}`, { method: 'DELETE' });
      recarregar();
      toast.sucesso(`Produto ${p.nome} removido`);
    } catch (e) {
      toast.erro(e.message);
    }
  }

  async function abrirEdicao(p) {
    try {
      setEditando(await api(`/produtos/${p.id}`));
    } catch (e) {
      toast.erro(e.message);
    }
  }

  return (
    <div className="cartao">
      <div className="cartao-cabecalho">
        <h3><FlaskConical size={15} className="icone-cartao" />Fórmulas de produtos</h3>
        <button className="botao" onClick={() => setEditando({ novo: true })}>+ Novo produto</button>
      </div>
      <Erro msg={erro || msg} />
      {carregando ? <Carregando /> : !dados?.length ? <Vazio /> : (
        <div className="tabela-envolucro">
          <table className="tabela">
            <thead>
              <tr>
                <th>Produto</th>
                <th>NCM</th>
                <th>Linha de processo</th>
                <th className="num">Rend. linha</th>
                <th className="num">Lote</th>
                <th className="num">Horas/lote</th>
                <th className="num">Manutenção</th>
                <th className="num">Margem</th>
                <th className="num">Itens fórmula</th>
                <th className="acoes">Ações</th>
              </tr>
            </thead>
            <tbody>
              {dados.map((p) => (
                <tr key={p.id} style={p.ativo ? undefined : { opacity: 0.5 }}>
                  <td className="negrito">{p.nome}{!p.ativo && ' (inativo)'}</td>
                  <td>{p.ncm_codigo ? <span title={`${p.ncm_descricao || ''} — IPI ${fmtNum(p.ipi_pct)}%`}>{p.ncm_codigo}</span> : '—'}</td>
                  <td>{p.linha_nome || <span className="texto-suave">não definida</span>}</td>
                  <td className="num">{fmtPct(p.rendimento_linha_pct)}</td>
                  <td className="num">{fmtNum(p.tamanho_lote, 0)} {p.unidade}</td>
                  <td className="num">{fmtNum(p.horas_producao)} h</td>
                  <td className="num">{fmtPct(p.manutencao_pct)}</td>
                  <td className="num">{fmtPct(p.margem_pct)}</td>
                  <td className="num">{p.qtd_itens_formula}</td>
                  <td className="acoes">
                    <button className="botao botao-secundario botao-mini" onClick={() => abrirEdicao(p)}>Editar</button>
                    <button className="botao botao-perigo botao-mini" onClick={() => excluir(p)}>Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editando && (
        <FormProduto
          produto={editando.novo ? null : editando}
          linhas={linhas || []}
          materias={materias || []}
          aoFechar={() => setEditando(null)}
          aoSalvar={() => { setEditando(null); recarregar(); toast.sucesso('Produto e fórmula salvos'); }}
        />
      )}
    </div>
  );
}

function FormProduto({ produto, linhas, materias, aoFechar, aoSalvar }) {
  const [f, setF] = React.useState(() =>
    produto
      ? { ...produto, itens: produto.itens.map((i) => ({ materia_prima_id: i.materia_prima_id, quantidade: i.quantidade })) }
      : {
          nome: '', unidade: 'un', peso_kg: '', ncm_codigo: '', linha_id: '',
          rendimento_linha_pct: 100, horas_producao: '', tamanho_lote: '', manutencao_pct: 0,
          margem_pct: 25, icms_pct_override: '', ativo: 1,
          itens: [{ materia_prima_id: '', quantidade: '' }],
        },
  );
  const [erro, setErro] = React.useState(null);
  const mudar = (campo, valor) => setF((s) => ({ ...s, [campo]: valor }));
  const mudarItem = (i, campo, valor) => {
    const itens = f.itens.slice();
    itens[i] = { ...itens[i], [campo]: valor };
    setF((s) => ({ ...s, itens }));
  };

  // seleção da linha preenche o rendimento com o valor cadastrado na aba 3 (editável por produto)
  function escolherLinha(linhaId) {
    const linha = linhas.find((l) => l.id === Number(linhaId));
    setF((s) => ({ ...s, linha_id: linhaId, rendimento_linha_pct: linha ? linha.rendimento_pct : s.rendimento_linha_pct }));
  }

  const custoFormula = f.itens.reduce((s, item) => {
    const mp = materias.find((m) => m.id === Number(item.materia_prima_id));
    if (!mp || !Number(item.quantidade)) return s;
    const rend = Number(mp.rendimento_pct) > 0 ? Number(mp.rendimento_pct) / 100 : 1;
    return s + (Number(item.quantidade) / rend) * Number(mp.custo_unitario);
  }, 0);

  async function salvar() {
    setErro(null);
    try {
      const corpo = { ...f, icms_pct_override: f.icms_pct_override === '' ? null : f.icms_pct_override };
      if (produto) await api(`/produtos/${produto.id}`, { method: 'PUT', body: corpo });
      else await api('/produtos', { method: 'POST', body: corpo });
      aoSalvar();
    } catch (e) {
      setErro(e.message);
    }
  }

  return (
    <Modal titulo={produto ? `Editar ${produto.nome}` : 'Novo produto com fórmula'} largura={820} onFechar={aoFechar}
      rodape={
        <>
          <button className="botao botao-secundario" onClick={aoFechar}>Cancelar</button>
          <button className="botao" onClick={salvar}>Salvar produto</button>
        </>
      }
    >
      <Erro msg={erro} />
      <div className="linha-campos">
        <Campo rotulo="Nome do produto *"><input value={f.nome} onChange={(e) => mudar('nome', e.target.value)} /></Campo>
        <Campo rotulo="Unidade" largura={90}><input value={f.unidade} onChange={(e) => mudar('unidade', e.target.value)} /></Campo>
        <Campo rotulo="Peso por unidade (kg)" largura={150} dica="para custo por kg">
          <input type="number" step="any" value={f.peso_kg} onChange={(e) => mudar('peso_kg', e.target.value)} />
        </Campo>
      </div>
      <BuscaNcm valor={f.ncm_codigo} aoEscolher={(codigo) => mudar('ncm_codigo', codigo)} />
      <div className="linha-campos">
        <Campo rotulo="Linha de processo" dica="cadastradas na aba 3">
          <select value={f.linha_id || ''} onChange={(e) => escolherLinha(e.target.value)}>
            <option value="">— selecione —</option>
            {linhas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Rendimento da linha (%)" largura={160} dica="preenchido pela linha; ajustável">
          <input type="number" step="any" value={f.rendimento_linha_pct} onChange={(e) => mudar('rendimento_linha_pct', e.target.value)} />
        </Campo>
      </div>
      <div className="linha-campos">
        <Campo rotulo="Horas para produzir o lote">
          <input type="number" step="any" value={f.horas_producao} onChange={(e) => mudar('horas_producao', e.target.value)} />
        </Campo>
        <Campo rotulo={`Tamanho do lote (${f.unidade || 'un'})`}>
          <input type="number" step="any" value={f.tamanho_lote} onChange={(e) => mudar('tamanho_lote', e.target.value)} />
        </Campo>
        <Campo rotulo="Custos de manutenção (%)" dica="percentual extra sobre o custo">
          <input type="number" step="any" value={f.manutencao_pct} onChange={(e) => mudar('manutencao_pct', e.target.value)} />
        </Campo>
      </div>
      <div className="linha-campos">
        <Campo rotulo="Margem desejada (%)" dica="sobre o preço de venda">
          <input type="number" step="any" value={f.margem_pct} onChange={(e) => mudar('margem_pct', e.target.value)} />
        </Campo>
        <Campo rotulo="ICMS específico (%)" dica="vazio = alíquota da UF">
          <input type="number" step="any" value={f.icms_pct_override ?? ''} onChange={(e) => mudar('icms_pct_override', e.target.value)} />
        </Campo>
        <Campo rotulo="Ativo" largura={100}>
          <select value={f.ativo ? 1 : 0} onChange={(e) => mudar('ativo', Number(e.target.value))}>
            <option value={1}>Sim</option>
            <option value={0}>Não</option>
          </select>
        </Campo>
      </div>

      <h3 style={{ margin: '10px 0' }}>Fórmula — matérias-primas por lote</h3>
      {f.itens.map((item, i) => {
        const mp = materias.find((m) => m.id === Number(item.materia_prima_id));
        const rend = mp && Number(mp.rendimento_pct) > 0 ? Number(mp.rendimento_pct) / 100 : 1;
        const custo = mp && Number(item.quantidade) ? (Number(item.quantidade) / rend) * Number(mp.custo_unitario) : null;
        return (
          <div className="linha-campos" key={i}>
            <Campo rotulo={i === 0 ? 'Matéria-prima' : ''}>
              <select value={item.materia_prima_id} onChange={(e) => mudarItem(i, 'materia_prima_id', e.target.value)}>
                <option value="">— selecione —</option>
                {materias.map((m) => (
                  <option key={m.id} value={m.id}>{m.nome} ({fmtBRL(m.custo_unitario)}/{m.unidade} · rend. {fmtNum(m.rendimento_pct)}%)</option>
                ))}
              </select>
            </Campo>
            <Campo rotulo={i === 0 ? `Quantidade ${mp ? `(${mp.unidade})` : ''}` : ''} largura={130}>
              <input type="number" step="any" value={item.quantidade} onChange={(e) => mudarItem(i, 'quantidade', e.target.value)} />
            </Campo>
            <Campo rotulo={i === 0 ? 'Custo (c/ rendimento)' : ''} largura={150}>
              <div style={{ padding: '7px 0' }} className="negrito">{custo != null ? fmtBRL(custo) : '—'}</div>
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
      <button className="botao botao-secundario botao-mini" onClick={() => setF((s) => ({ ...s, itens: [...s.itens, { materia_prima_id: '', quantidade: '' }] }))}>
        + Adicionar matéria-prima
      </button>
      <div className="direita negrito" style={{ fontSize: 15, marginTop: 10 }}>
        Custo de fórmula do lote (antes do rendimento da linha): {fmtBRL(custoFormula)}
      </div>
    </Modal>
  );
}

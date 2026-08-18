import React from 'react';
import { Package } from 'lucide-react';
import { api } from '../api.js';
import { Badge, Campo, Carregando, Erro, Modal, Vazio, fmtBRL, fmtData, fmtNum, useDados, toast, confirmar } from '../ui.jsx';
import { BuscaNcm } from './Formulas.jsx';

export default function Materias() {
  const { dados, erro, carregando, recarregar } = useDados(() => api('/materias'));
  const [editando, setEditando] = React.useState(null);
  const [comprando, setComprando] = React.useState(null);
  const [expandida, setExpandida] = React.useState(null);
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
        <h3><Package size={15} className="icone-cartao" />Matérias-primas — estoque por lote de compra</h3>
        <button className="botao" onClick={() => setEditando({ novo: true })}>+ Nova matéria-prima</button>
      </div>
      <Erro msg={erro || msg} />
      {carregando ? <Carregando /> : !dados?.length ? <Vazio /> : (
        <div className="tabela-envolucro">
          <table className="tabela">
            <thead>
              <tr>
                <th style={{ width: 34 }}></th>
                <th>Matéria-prima</th>
                <th>Unidade</th>
                <th>NCM</th>
                <th className="num">Estoque</th>
                <th className="num">Estoque mínimo</th>
                <th className="num">Custo médio</th>
                <th className="num">Última compra</th>
                <th className="acoes">Ações</th>
              </tr>
            </thead>
            <tbody>
              {dados.map((m) => (
                <React.Fragment key={m.id}>
                  <tr>
                    <td>
                      <button
                        className="botao botao-secundario botao-mini"
                        style={{ width: 26, padding: 0 }}
                        title={expandida === m.id ? 'Ocultar compras' : 'Ver compras deste item'}
                        onClick={() => setExpandida(expandida === m.id ? null : m.id)}
                      >
                        {expandida === m.id ? '−' : '+'}
                      </button>
                    </td>
                    <td className="negrito">{m.nome}</td>
                    <td>{m.unidade}</td>
                    <td>{m.ncm_codigo ? <span title={m.ncm_descricao}>{m.ncm_codigo}</span> : '—'}</td>
                    <td className="num">{fmtNum(m.estoque_atual, 3)}</td>
                    <td className="num">{fmtNum(m.estoque_minimo, 3)}</td>
                    <td className="num">{Number(m.estoque_atual) > 0 ? `${fmtBRL(m.custo_unitario)} / ${m.unidade}` : '—'}</td>
                    <td className="num">{fmtData(m.ultima_compra_em)}</td>
                    <td className="acoes">
                      <button className="botao botao-mini" onClick={() => setComprando(m)}>+ Compra</button>
                      <button className="botao botao-secundario botao-mini" onClick={() => setEditando(m)}>Editar</button>
                      <button className="botao botao-perigo botao-mini" onClick={() => excluir(m)}>Excluir</button>
                    </td>
                  </tr>
                  {expandida === m.id && (
                    <tr>
                      <td colSpan={9} style={{ background: '#f8fafc' }}>
                        <Compras
                          materia={m}
                          aoMudar={recarregar}
                          aoComprar={() => setComprando(m)}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
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
      {comprando && (
        <FormCompra
          materia={comprando}
          aoFechar={() => setComprando(null)}
          aoSalvar={() => {
            setComprando(null);
            setExpandida(comprando.id);
            recarregar();
            toast.sucesso('Compra lançada — estoque atualizado');
          }}
        />
      )}
    </div>
  );
}

/* ---------------------- Compras (lotes) da matéria-prima ---------------------- */

function Compras({ materia, aoMudar, aoComprar }) {
  const { dados, erro, carregando, recarregar } = useDados(
    () => api(`/materias/${materia.id}/compras`), [materia.id],
  );

  async function remover(c) {
    if (!(await confirmar({
      titulo: 'Remover compra',
      mensagem: `Remover a compra de ${c.fornecedor}${c.numero_nota ? ` (NF ${c.numero_nota})` : ''}? O estoque será reduzido.`,
      confirmarTexto: 'Remover',
      perigo: true,
    }))) return;
    try {
      await api(`/materias/compras/${c.id}`, { method: 'DELETE' });
      recarregar();
      aoMudar();
      toast.sucesso('Compra removida');
    } catch (e) {
      toast.erro(e.message);
    }
  }

  return (
    <div style={{ padding: '10px 6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <strong style={{ fontSize: 13 }}>Compras de {materia.nome}</strong>
        <span className="texto-suave" style={{ flex: 1 }}>consumo na ordem de data (mais antiga primeiro)</span>
        <button className="botao botao-mini" onClick={aoComprar}>+ Compra</button>
      </div>
      <Erro msg={erro} />
      {carregando ? <Carregando /> : !dados?.length ? (
        <div className="texto-suave">Nenhuma compra lançada — o estoque deste item é zero.</div>
      ) : (
        <table className="tabela">
          <thead>
            <tr>
              <th>Data</th>
              <th>Fornecedor</th>
              <th>Nota</th>
              <th className="num">Comprado</th>
              <th className="num">Restante</th>
              <th className="num">Valor unit.</th>
              <th className="num">Valor total</th>
              <th>Status</th>
              <th className="acoes">Ações</th>
            </tr>
          </thead>
          <tbody>
            {dados.map((c) => (
              <tr key={c.id} style={c.status === 'inativo' ? { opacity: 0.55 } : undefined}>
                <td>{fmtData(c.data_compra)}</td>
                <td>{c.fornecedor}</td>
                <td className="mono">{c.numero_nota || '—'}</td>
                <td className="num">{fmtNum(c.quantidade, 3)} {materia.unidade}</td>
                <td className="num">{fmtNum(c.quantidade_restante, 3)}</td>
                <td className="num">{fmtBRL(c.valor_unitario)}</td>
                <td className="num">{fmtBRL(c.valor_total)}</td>
                <td><Badge valor={c.status === 'ativo' ? 'estoque_ativo' : 'estoque_inativo'} /></td>
                <td className="acoes">
                  <button className="botao botao-perigo botao-mini" onClick={() => remover(c)}>Excluir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function FormCompra({ materia, aoFechar, aoSalvar }) {
  const [f, setF] = React.useState({
    fornecedor: '', numero_nota: '', data_compra: '', quantidade: '', valor_unitario: '', observacao: '',
  });
  const [erro, setErro] = React.useState(null);
  const mudar = (campo, valor) => setF((s) => ({ ...s, [campo]: valor }));
  const total = Number(f.quantidade) * Number(f.valor_unitario);

  async function salvar() {
    setErro(null);
    try {
      await api(`/materias/${materia.id}/compras`, { method: 'POST', body: f });
      aoSalvar();
    } catch (e) {
      setErro(e.message);
    }
  }

  return (
    <Modal
      titulo={`Nova compra — ${materia.nome}`}
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
        <Campo rotulo="Fornecedor *"><input value={f.fornecedor} onChange={(e) => mudar('fornecedor', e.target.value)} /></Campo>
        <Campo rotulo="Número da nota" largura={160}>
          <input value={f.numero_nota} onChange={(e) => mudar('numero_nota', e.target.value)} />
        </Campo>
      </div>
      <div className="linha-campos">
        <Campo rotulo="Data da compra *" largura={170} dica="define a ordem de consumo">
          <input type="date" value={f.data_compra} onChange={(e) => mudar('data_compra', e.target.value)} />
        </Campo>
        <Campo rotulo={`Quantidade * (${materia.unidade})`}>
          <input type="number" step="any" value={f.quantidade} onChange={(e) => mudar('quantidade', e.target.value)} />
        </Campo>
        <Campo rotulo={`Valor por ${materia.unidade} (R$) *`}>
          <input type="number" step="any" value={f.valor_unitario} onChange={(e) => mudar('valor_unitario', e.target.value)} />
        </Campo>
      </div>
      {total > 0 && (
        <div className="texto-suave" style={{ marginBottom: 10 }}>Total da nota: <strong>{fmtBRL(total)}</strong></div>
      )}
      <Campo rotulo="Observação">
        <input value={f.observacao} onChange={(e) => mudar('observacao', e.target.value)} />
      </Campo>
    </Modal>
  );
}

/* ---------------------- Cadastro da matéria-prima ---------------------- */

function FormMateria({ materia, aoFechar, aoSalvar }) {
  const [f, setF] = React.useState(
    materia || { nome: '', unidade: 'kg', ncm_codigo: '', estoque_minimo: 0 },
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
      <BuscaNcm valor={f.ncm_codigo} aoEscolher={(codigo) => mudar('ncm_codigo', codigo)} />
      <Campo rotulo="Estoque mínimo" largura={170} dica="alerta de reposição no painel e no MRP">
        <input type="number" step="any" value={f.estoque_minimo} onChange={(e) => mudar('estoque_minimo', e.target.value)} />
      </Campo>
      {!materia && (
        <div className="texto-suave" style={{ marginTop: 10 }}>
          O item nasce com estoque zero. O estoque passa a existir conforme você lança as compras,
          pelo botão <strong>+ Compra</strong> na linha do item.
        </div>
      )}
    </Modal>
  );
}

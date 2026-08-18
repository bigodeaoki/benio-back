import React from 'react';
import { Package } from 'lucide-react';
import { api } from '../api.js';
import { Campo, Carregando, Erro, Modal, Vazio, fmtBRL, fmtData, fmtNum, useDados, toast, confirmar } from '../ui.jsx';
import { BuscaNcm } from './Formulas.jsx';

export default function Materias() {
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
        <h3><Package size={15} className="icone-cartao" />Matérias-primas — preços e estoques</h3>
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
                <th className="num">Última compra</th>
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
                  <td className="num">{fmtData(m.ultima_compra_em)}</td>
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
    materia || { nome: '', unidade: 'kg', custo_unitario: '', ultima_compra_em: '', ncm_codigo: '', estoque_atual: 0, estoque_minimo: 0 },
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
        <Campo rotulo="Última compra" dica="data da última entrada desse preço">
          <input type="date" value={(f.ultima_compra_em || '').slice(0, 10)} onChange={(e) => mudar('ultima_compra_em', e.target.value)} />
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

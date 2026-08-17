import React from 'react';
import { api, urlDownload } from '../api.js';
import { BotaoDownload, Campo, Carregando, Erro, Modal, Vazio, fmtBRL, fmtNum, useDados } from '../ui.jsx';

export default function Colaboradores() {
  const { dados, erro, carregando, recarregar } = useDados(() => api('/colaboradores'));
  const [editando, setEditando] = React.useState(null);
  const [msg, setMsg] = React.useState(null);

  async function excluir(c) {
    if (!confirm(`Remover ${c.nome}?`)) return;
    try {
      await api(`/colaboradores/${c.id}`, { method: 'DELETE' });
      recarregar();
    } catch (e) {
      setMsg(e.message);
    }
  }

  return (
    <>
      <div className="cartao">
        <div className="cartao-cabecalho">
          <h3>Colaboradores e cargos</h3>
          <BotaoDownload href={urlDownload('/export/colaboradores.xlsx')}>⇩ Excel</BotaoDownload>
          <button className="botao" onClick={() => setEditando({ novo: true })}>+ Novo colaborador</button>
        </div>
        <div className="alerta alerta-info">
          O <strong>salário total</strong> soma o salário base + encargos (INSS patronal, FGTS, provisões de 13º e férias) +
          vale-transporte, alimentação e outros benefícios. O <strong>salário por hora</strong> divide esse total pelas horas mensais.
        </div>
        <Erro msg={erro || msg} />
        {carregando ? (
          <Carregando />
        ) : !dados?.length ? (
          <Vazio />
        ) : (
          <div className="tabela-envolucro">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Cargo</th>
                  <th className="num">Salário base</th>
                  <th className="num">Encargos</th>
                  <th className="num">V. transporte</th>
                  <th className="num">V. alimentação</th>
                  <th className="num">Outros</th>
                  <th className="num">Salário total (c/ benefícios)</th>
                  <th className="num">Horas/mês</th>
                  <th className="num">Salário por hora</th>
                  <th className="acoes">Ações</th>
                </tr>
              </thead>
              <tbody>
                {dados.map((c) => (
                  <tr key={c.id} style={c.ativo ? undefined : { opacity: 0.5 }}>
                    <td className="negrito">{c.nome}{!c.ativo && ' (inativo)'}</td>
                    <td>{c.cargo || '—'}</td>
                    <td className="num">{fmtBRL(c.salario_base)}</td>
                    <td className="num">{fmtNum(c.encargos_pct)}%</td>
                    <td className="num">{fmtBRL(c.vale_transporte)}</td>
                    <td className="num">{fmtBRL(c.vale_alimentacao)}</td>
                    <td className="num">{fmtBRL(c.outros_beneficios)}</td>
                    <td className="num negrito">{fmtBRL(c.custo_total_mensal)}</td>
                    <td className="num">{fmtNum(c.horas_mes, 0)}</td>
                    <td className="num negrito">{fmtBRL(c.custo_hora)}</td>
                    <td className="acoes">
                      <button className="botao botao-secundario botao-mini" onClick={() => setEditando(c)}>Editar</button>
                      <button className="botao botao-perigo botao-mini" onClick={() => excluir(c)}>Excluir</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {editando && (
        <FormColaborador
          colaborador={editando.novo ? null : editando}
          aoFechar={() => setEditando(null)}
          aoSalvar={() => { setEditando(null); recarregar(); }}
        />
      )}
    </>
  );
}

function FormColaborador({ colaborador, aoFechar, aoSalvar }) {
  const [f, setF] = React.useState(
    colaborador || {
      nome: '', cargo: '', salario_base: '', encargos_pct: 70,
      vale_transporte: 0, vale_alimentacao: 0, outros_beneficios: 0, horas_mes: 220, ativo: 1,
    },
  );
  const [erro, setErro] = React.useState(null);
  const mudar = (campo, valor) => setF((s) => ({ ...s, [campo]: valor }));

  const totalPrevisto =
    (Number(f.salario_base) || 0) * (1 + (Number(f.encargos_pct) || 0) / 100) +
    (Number(f.vale_transporte) || 0) + (Number(f.vale_alimentacao) || 0) + (Number(f.outros_beneficios) || 0);

  async function salvar() {
    setErro(null);
    try {
      if (colaborador) await api(`/colaboradores/${colaborador.id}`, { method: 'PUT', body: f });
      else await api('/colaboradores', { method: 'POST', body: f });
      aoSalvar();
    } catch (e) {
      setErro(e.message);
    }
  }

  return (
    <Modal titulo={colaborador ? `Editar ${colaborador.nome}` : 'Novo colaborador'} onFechar={aoFechar}
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
        <Campo rotulo="Cargo"><input value={f.cargo || ''} onChange={(e) => mudar('cargo', e.target.value)} /></Campo>
      </div>
      <div className="linha-campos">
        <Campo rotulo="Salário base (R$)"><input type="number" step="any" value={f.salario_base} onChange={(e) => mudar('salario_base', e.target.value)} /></Campo>
        <Campo rotulo="Encargos (%)" dica="INSS patronal + FGTS + provisões (13º, férias)">
          <input type="number" step="any" value={f.encargos_pct} onChange={(e) => mudar('encargos_pct', e.target.value)} />
        </Campo>
        <Campo rotulo="Horas/mês"><input type="number" step="any" value={f.horas_mes} onChange={(e) => mudar('horas_mes', e.target.value)} /></Campo>
      </div>
      <div className="linha-campos">
        <Campo rotulo="Vale-transporte (R$)"><input type="number" step="any" value={f.vale_transporte} onChange={(e) => mudar('vale_transporte', e.target.value)} /></Campo>
        <Campo rotulo="Vale-alimentação (R$)"><input type="number" step="any" value={f.vale_alimentacao} onChange={(e) => mudar('vale_alimentacao', e.target.value)} /></Campo>
        <Campo rotulo="Outros benefícios (R$)"><input type="number" step="any" value={f.outros_beneficios} onChange={(e) => mudar('outros_beneficios', e.target.value)} /></Campo>
      </div>
      <div className="linha-campos">
        <Campo rotulo="Ativo" largura={110}>
          <select value={f.ativo ? 1 : 0} onChange={(e) => mudar('ativo', Number(e.target.value))}>
            <option value={1}>Sim</option>
            <option value={0}>Não</option>
          </select>
        </Campo>
        <Campo rotulo="Salário total previsto" largura={220}>
          <div className="negrito" style={{ padding: '7px 0', fontSize: 15 }}>
            {fmtBRL(totalPrevisto)} <span className="texto-suave">({fmtBRL(totalPrevisto / (Number(f.horas_mes) || 220))}/h)</span>
          </div>
        </Campo>
      </div>
    </Modal>
  );
}

import React from 'react';
import { Boxes } from 'lucide-react';
import { api, urlDownload } from '../api.js';
import { Badge, BotaoDownload, Campo, Carregando, Erro, Modal, Vazio, fmtBRL, fmtData, fmtNum, useDados, toast } from '../ui.jsx';

export default function Estoque() {
  const { dados, erro, carregando, recarregar } = useDados(() => api('/estoque'));
  const [movimentando, setMovimentando] = React.useState(false);
  const [historicoDe, setHistoricoDe] = React.useState(null);

  const valorTotal = (dados || []).reduce((s, m) => s + m.valor_estoque, 0);
  const alertas = (dados || []).filter((m) => m.situacao !== 'ok');

  return (
    <>
      <div className="grade-kpis">
        <div className="kpi">
          <div className="kpi-rotulo">Valor em estoque</div>
          <div className="kpi-valor">{fmtBRL(valorTotal)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-rotulo">Itens monitorados</div>
          <div className="kpi-valor">{dados?.length ?? '—'}</div>
        </div>
        <div className="kpi">
          <div className="kpi-rotulo">Alertas (abaixo do mínimo)</div>
          <div className="kpi-valor" style={{ color: alertas.length ? 'var(--vermelho)' : undefined }}>{alertas.length}</div>
        </div>
      </div>

      <div className="cartao">
        <div className="cartao-cabecalho">
          <h3><Boxes size={15} className="icone-cartao" />Posição de estoque — matérias-primas</h3>
          <BotaoDownload href={urlDownload('/export/estoque.xlsx')}>⇩ Excel</BotaoDownload>
          <button className="botao" onClick={() => setMovimentando(true)}>+ Movimentar estoque</button>
        </div>
        <Erro msg={erro} />
        {carregando ? <Carregando /> : !dados?.length ? <Vazio /> : (
          <div className="tabela-envolucro">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Matéria-prima</th>
                  <th className="num">Estoque atual</th>
                  <th className="num">Mínimo</th>
                  <th className="num">Custo unitário</th>
                  <th className="num">Valor em estoque</th>
                  <th>Situação</th>
                  <th className="acoes">Histórico</th>
                </tr>
              </thead>
              <tbody>
                {dados.map((m) => (
                  <tr key={m.id}>
                    <td className="negrito">{m.nome}</td>
                    <td className="num">{fmtNum(m.estoque_atual, 3)} {m.unidade}</td>
                    <td className="num">{fmtNum(m.estoque_minimo, 3)}</td>
                    <td className="num">{fmtBRL(m.custo_unitario)}</td>
                    <td className="num">{fmtBRL(m.valor_estoque)}</td>
                    <td><Badge valor={m.situacao} /></td>
                    <td className="acoes">
                      <button className="botao botao-secundario botao-mini" onClick={() => setHistoricoDe(m)}>Ver</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {movimentando && (
        <FormMovimento
          materias={dados || []}
          aoFechar={() => setMovimentando(false)}
          aoSalvar={() => { setMovimentando(false); recarregar(); toast.sucesso('Movimento de estoque registrado'); }}
        />
      )}
      {historicoDe && <Historico materia={historicoDe} aoFechar={() => setHistoricoDe(null)} />}
    </>
  );
}

function FormMovimento({ materias, aoFechar, aoSalvar }) {
  const [f, setF] = React.useState({ materia_prima_id: '', tipo: 'entrada', quantidade: '', custo_unitario: '', origem: '' });
  const [erro, setErro] = React.useState(null);
  const mudar = (campo, valor) => setF((s) => ({ ...s, [campo]: valor }));
  const mp = materias.find((m) => m.id === Number(f.materia_prima_id));

  async function salvar() {
    setErro(null);
    try {
      await api('/estoque/movimentos', {
        method: 'POST',
        body: { ...f, custo_unitario: f.custo_unitario === '' ? null : f.custo_unitario },
      });
      aoSalvar();
    } catch (e) {
      setErro(e.message);
    }
  }

  return (
    <Modal titulo="Movimentar estoque" onFechar={aoFechar}
      rodape={
        <>
          <button className="botao botao-secundario" onClick={aoFechar}>Cancelar</button>
          <button className="botao" onClick={salvar}>Registrar</button>
        </>
      }
    >
      <Erro msg={erro} />
      <Campo rotulo="Matéria-prima *">
        <select value={f.materia_prima_id} onChange={(e) => mudar('materia_prima_id', e.target.value)}>
          <option value="">— selecione —</option>
          {materias.map((m) => (
            <option key={m.id} value={m.id}>{m.nome} (saldo: {fmtNum(m.estoque_atual, 3)} {m.unidade})</option>
          ))}
        </select>
      </Campo>
      <div className="linha-campos">
        <Campo rotulo="Tipo">
          <select value={f.tipo} onChange={(e) => mudar('tipo', e.target.value)}>
            <option value="entrada">Entrada (compra/devolução)</option>
            <option value="saida">Saída (consumo/perda)</option>
            <option value="ajuste">Ajuste de inventário (define o saldo)</option>
          </select>
        </Campo>
        <Campo rotulo={f.tipo === 'ajuste' ? `Novo saldo ${mp ? `(${mp.unidade})` : ''}` : `Quantidade ${mp ? `(${mp.unidade})` : ''}`}>
          <input type="number" step="any" value={f.quantidade} onChange={(e) => mudar('quantidade', e.target.value)} />
        </Campo>
      </div>
      <div className="linha-campos">
        {f.tipo === 'entrada' && (
          <Campo rotulo="Custo unitário da compra (R$)" dica="se informado, atualiza o preço da matéria-prima">
            <input type="number" step="any" value={f.custo_unitario} onChange={(e) => mudar('custo_unitario', e.target.value)} />
          </Campo>
        )}
        <Campo rotulo="Origem / observação">
          <input value={f.origem} onChange={(e) => mudar('origem', e.target.value)} placeholder="ex.: NF 1234 — Fornecedor X" />
        </Campo>
      </div>
    </Modal>
  );
}

function Historico({ materia, aoFechar }) {
  const { dados, carregando } = useDados(() => api(`/estoque/movimentos?materia_prima_id=${materia.id}`));
  return (
    <Modal titulo={`Histórico — ${materia.nome}`} largura={700} onFechar={aoFechar}>
      {carregando ? <Carregando /> : !dados?.length ? <Vazio /> : (
        <div className="tabela-envolucro">
          <table className="tabela">
            <thead>
              <tr><th>Data</th><th>Tipo</th><th className="num">Quantidade</th><th className="num">Custo unit.</th><th>Origem</th></tr>
            </thead>
            <tbody>
              {dados.map((m) => (
                <tr key={m.id}>
                  <td>{fmtData(m.data)} <span className="texto-suave">{String(m.data).slice(11, 16)}</span></td>
                  <td><Badge valor={m.tipo === 'entrada' ? 'ok' : m.tipo === 'saida' ? 'comprar' : 'planejada'} />{' '}
                    <span className="texto-suave">{m.tipo}</span></td>
                  <td className="num">{fmtNum(m.quantidade, 3)} {m.unidade}</td>
                  <td className="num">{m.custo_unitario != null ? fmtBRL(m.custo_unitario) : '—'}</td>
                  <td className="texto-suave">{m.origem || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

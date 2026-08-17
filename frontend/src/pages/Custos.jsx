import React from 'react';
import { api, urlDownload } from '../api.js';
import { BotaoDownload, Campo, Carregando, Erro, Vazio, fmtBRL, fmtNum, fmtPct, useDados } from '../ui.jsx';

const CORES = { formula: '#2a78d6', mao_de_obra: '#eb6834', processo: '#1baf7a', manutencao: '#eda100' };
const ROTULOS = { formula: 'Fórmula', mao_de_obra: 'Mão de obra', processo: 'Processo', manutencao: 'Manutenção' };

export default function Custos() {
  const { dados: produtos, carregando } = useDados(() => api('/produtos'));
  const { dados: ufs } = useDados(() => api('/fiscal/icms'));
  const [produtoId, setProdutoId] = React.useState(null);
  const [margem, setMargem] = React.useState('');
  const [ufDestino, setUfDestino] = React.useState('');
  const [custo, setCusto] = React.useState(null);
  const [simulacao, setSimulacao] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  const [calculando, setCalculando] = React.useState(false);

  const calcular = React.useCallback(async (id, margemPct, uf) => {
    if (!id) return;
    setCalculando(true);
    setErro(null);
    setSimulacao(null);
    try {
      const query = new URLSearchParams();
      if (margemPct !== '') query.set('margem_pct', margemPct);
      if (uf) query.set('uf_destino', uf);
      setCusto(await api(`/custos/produto/${id}?${query}`));
    } catch (e) {
      setErro(e.message);
      setCusto(null);
    } finally {
      setCalculando(false);
    }
  }, []);

  React.useEffect(() => {
    if (produtos?.length && !produtoId) {
      setProdutoId(produtos[0].id);
      calcular(produtos[0].id, '', '');
    }
  }, [produtos]); // eslint-disable-line

  async function simular() {
    setErro(null);
    try {
      const query = margem !== '' ? `?margem_pct=${margem}` : '';
      setSimulacao(await api(`/custos/produto/${produtoId}/simulacao-uf${query}`));
    } catch (e) {
      setErro(e.message);
    }
  }

  if (carregando) return <Carregando />;
  if (!produtos?.length) return <div className="cartao"><Vazio msg="Cadastre produtos com fórmula na aba 2 para calcular custos" /></div>;

  const r = custo?.resumo;
  const imp = custo?.impostos;
  const preco = custo?.preco;
  const composicao = r ? Object.entries(r.composicao) : [];
  const totalComposicao = r ? composicao.reduce((s, [, v]) => s + v, 0) || 1 : 1;

  return (
    <>
      <div className="cartao">
        <div className="cartao-cabecalho">
          <h3>Custo do produto</h3>
          <BotaoDownload href={urlDownload('/export/custos.xlsx')}>⇩ Excel (todos)</BotaoDownload>
          {produtoId && <BotaoDownload href={urlDownload(`/export/custo-produto/${produtoId}.pdf`)}>⇩ PDF</BotaoDownload>}
        </div>
        <div className="linha-campos">
          <Campo rotulo="Produto">
            <select value={produtoId || ''} onChange={(e) => { setProdutoId(Number(e.target.value)); calcular(Number(e.target.value), margem, ufDestino); }}>
              {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Margem (%)" largura={120} dica="vazio = margem do produto">
            <input type="number" step="any" value={margem} onChange={(e) => setMargem(e.target.value)} />
          </Campo>
          <Campo rotulo="UF de destino" largura={130} dica="vazio = UF da empresa">
            <select value={ufDestino} onChange={(e) => setUfDestino(e.target.value)}>
              <option value="">— própria UF —</option>
              {(ufs || []).map((u) => <option key={u.uf} value={u.uf}>{u.uf}</option>)}
            </select>
          </Campo>
          <Campo rotulo=" " largura={130}>
            <button className="botao" style={{ height: 34 }} onClick={() => calcular(produtoId, margem, ufDestino)} disabled={calculando}>
              {calculando ? 'Calculando…' : 'Recalcular'}
            </button>
          </Campo>
        </div>
        <Erro msg={erro} />
      </div>

      {custo && (
        <>
          <div className="grade-kpis">
            <div className="kpi">
              <div className="kpi-rotulo">Custo do lote ({fmtNum(r.tamanho_lote, 0)} {custo.produto.unidade})</div>
              <div className="kpi-valor">{fmtBRL(r.custo_lote)}</div>
            </div>
            <div className="kpi">
              <div className="kpi-rotulo">Custo por {custo.produto.unidade}</div>
              <div className="kpi-valor">{fmtBRL(r.custo_unitario)}</div>
            </div>
            <div className="kpi">
              <div className="kpi-rotulo">Custo por kg</div>
              <div className="kpi-valor">{r.custo_kg != null ? fmtBRL(r.custo_kg) : '—'}</div>
            </div>
            <div className="kpi">
              <div className="kpi-rotulo">Preço final sugerido</div>
              <div className="kpi-valor" style={{ color: '#0a7d0a' }}>{preco.erro ? '—' : fmtBRL(preco.preco_final)}</div>
              <div className="kpi-extra">margem {fmtPct(preco.margem_aplicada_pct)}</div>
            </div>
            <div className="kpi">
              <div className="kpi-rotulo">Lucro por {custo.produto.unidade}</div>
              <div className="kpi-valor">{preco.erro ? '—' : fmtBRL(preco.lucro_unitario)}</div>
              <div className="kpi-extra">markup {preco.erro ? '—' : fmtPct(preco.markup_pct)}</div>
            </div>
          </div>

          <div className="cartao">
            <h3>Composição do custo — {custo.produto.nome}</h3>
            <div className="barra-composicao" title="participação de cada componente no custo do lote">
              {composicao.map(([chave, valor]) => (
                <span key={chave} style={{ width: `${(valor / totalComposicao) * 100}%`, background: CORES[chave] }} />
              ))}
            </div>
            <div className="legenda-composicao">
              {composicao.map(([chave, valor]) => (
                <span key={chave}>
                  <i style={{ background: CORES[chave] }} />
                  {ROTULOS[chave]}: <strong>{fmtBRL(valor)}</strong> ({fmtNum((valor / totalComposicao) * 100, 1)}%)
                </span>
              ))}
            </div>
          </div>

          <div className="grade-2">
            <div className="cartao">
              <h3>Fórmula — {fmtBRL(custo.formula.custo_total)} por lote</h3>
              <div className="tabela-envolucro">
                <table className="tabela">
                  <thead>
                    <tr>
                      <th>Matéria-prima</th>
                      <th className="num">Qtd. líquida</th>
                      <th className="num">Rend.</th>
                      <th className="num">Qtd. bruta</th>
                      <th className="num">Custo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {custo.formula.itens.map((i, idx) => (
                      <tr key={idx}>
                        <td>{i.nome}</td>
                        <td className="num">{fmtNum(i.quantidade, 3)} {i.unidade}</td>
                        <td className="num">{fmtPct(i.rendimento_pct)}</td>
                        <td className="num">{fmtNum(i.quantidade_bruta, 3)}</td>
                        <td className="num">{fmtBRL(i.custo)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={4}>Perda pelo rendimento da linha ({fmtPct(custo.formula.rendimento_linha_pct)})</td>
                      <td className="num">{fmtBRL(custo.formula.perda_rendimento)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="cartao">
              <h3>Mão de obra ({fmtNum(custo.mao_de_obra.horas)} h) — {fmtBRL(custo.mao_de_obra.custo_total)}</h3>
              {!custo.mao_de_obra.colaboradores.length ? (
                <div className="texto-suave">Produto sem linha de processo ou linha sem colaboradores.</div>
              ) : (
                <table className="tabela">
                  <thead>
                    <tr><th>Colaborador</th><th className="num">Dedicação</th><th className="num">Custo/h</th><th className="num">No lote</th></tr>
                  </thead>
                  <tbody>
                    {custo.mao_de_obra.colaboradores.map((c, i) => (
                      <tr key={i}>
                        <td>{c.nome} <span className="texto-suave">· {c.cargo}</span></td>
                        <td className="num">{fmtPct(c.dedicacao_pct)}</td>
                        <td className="num">{fmtBRL(c.custo_hora_efetivo)}</td>
                        <td className="num">{fmtBRL(c.custo_no_lote)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <h3 style={{ margin: '14px 0 8px' }}>Processo / utilidades — {fmtBRL(custo.processo.custo_total)}</h3>
              {!custo.processo.utilidades.length ? (
                <div className="texto-suave">Linha sem consumos de utilidades.</div>
              ) : (
                <table className="tabela">
                  <thead>
                    <tr><th>Utilidade</th><th className="num">Consumo/h</th><th className="num">Custo/h</th><th className="num">No lote</th></tr>
                  </thead>
                  <tbody>
                    {custo.processo.utilidades.map((u, i) => (
                      <tr key={i}>
                        <td>{u.nome}</td>
                        <td className="num">{fmtNum(u.consumo_hora, 3)} {u.unidade}</td>
                        <td className="num">{fmtBRL(u.custo_hora)}</td>
                        <td className="num">{fmtBRL(u.custo_no_lote)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="direita" style={{ marginTop: 10 }}>
                Manutenção ({fmtPct(custo.manutencao.pct)}): <strong>{fmtBRL(custo.manutencao.valor)}</strong>
              </div>
            </div>
          </div>

          <div className="grade-2">
            <div className="cartao">
              <h3>Impostos — {imp.regime_nome} <span className="texto-suave">({imp.uf_origem} → {imp.uf_destino})</span></h3>
              <table className="tabela">
                <tbody>
                  {imp.regime === 'simples' ? (
                    <tr><td>Alíquota efetiva do DAS (Simples Nacional)</td><td className="num negrito">{fmtPct(imp.simples_pct)}</td></tr>
                  ) : (
                    <>
                      <tr><td>ICMS ({imp.icms_tipo})</td><td className="num negrito">{fmtPct(imp.icms_pct)}</td></tr>
                      <tr><td>PIS</td><td className="num negrito">{fmtPct(imp.pis_pct)}</td></tr>
                      <tr><td>COFINS</td><td className="num negrito">{fmtPct(imp.cofins_pct)}</td></tr>
                      <tr><td>IPI (NCM {custo.produto.ncm_codigo || '—'})</td><td className="num negrito">{fmtPct(imp.ipi_pct)}</td></tr>
                      <tr><td className="negrito">Total "por dentro" (ICMS+PIS+COFINS)</td><td className="num negrito">{fmtPct(imp.por_dentro_pct)}</td></tr>
                    </>
                  )}
                </tbody>
              </table>
              <div style={{ marginTop: 10 }}>
                {imp.notas.map((n, i) => (
                  <div key={i} className="texto-suave" style={{ fontSize: 12.5, marginBottom: 4 }}>• {n}</div>
                ))}
              </div>
            </div>

            <div className="cartao">
              <h3>Formação do preço de venda</h3>
              {preco.erro ? (
                <div className="alerta alerta-erro">{preco.erro}</div>
              ) : (
                <table className="tabela">
                  <tbody>
                    <tr><td>Custo unitário</td><td className="num">{fmtBRL(r.custo_unitario)}</td></tr>
                    <tr><td>Margem desejada (sobre a venda)</td><td className="num">{fmtPct(preco.margem_aplicada_pct)}</td></tr>
                    <tr><td>Preço sem IPI (impostos "por dentro")</td><td className="num">{fmtBRL(preco.preco_sem_ipi)}</td></tr>
                    <tr><td>IPI ("por fora")</td><td className="num">{fmtBRL(preco.ipi_valor)}</td></tr>
                    <tr><td className="negrito">Preço final sugerido</td><td className="num negrito" style={{ fontSize: 16 }}>{fmtBRL(preco.preco_final)}</td></tr>
                    <tr><td>Impostos por unidade</td><td className="num">{fmtBRL(preco.impostos_totais)}</td></tr>
                    <tr><td>Lucro por unidade</td><td className="num">{fmtBRL(preco.lucro_unitario)}</td></tr>
                    <tr><td>Markup equivalente sobre o custo</td><td className="num">{fmtPct(preco.markup_pct)}</td></tr>
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="cartao">
            <div className="cartao-cabecalho">
              <h3>Simulação tributária por estado</h3>
              <button className="botao botao-secundario" onClick={simular}>Simular todas as UFs</button>
            </div>
            {simulacao && (
              <>
                <div className="alerta alerta-info">{simulacao.observacao}</div>
                <div className="tabela-envolucro">
                  <table className="tabela">
                    <thead>
                      <tr>
                        <th>UF</th>
                        <th>Estado</th>
                        <th>Operação</th>
                        <th className="num">ICMS aplicado</th>
                        <th className="num">Impostos "por dentro"</th>
                        <th className="num">Preço final</th>
                        <th className="num">Impostos/un</th>
                        <th className="num">Carga tributária</th>
                      </tr>
                    </thead>
                    <tbody>
                      {simulacao.linhas.map((l) => (
                        <tr key={l.uf} style={l.uf === simulacao.uf_origem ? { background: 'var(--azul-100)' } : undefined}>
                          <td className="negrito">{l.uf}{l.uf === simulacao.uf_origem && ' ★'}</td>
                          <td>{l.nome}</td>
                          <td>{l.tipo_operacao}</td>
                          <td className="num">{l.icms_pct != null ? fmtPct(l.icms_pct) : 'DAS'}</td>
                          <td className="num">{fmtPct(l.por_dentro_pct)}</td>
                          <td className="num negrito">{fmtBRL(l.preco_final)}</td>
                          <td className="num">{fmtBRL(l.impostos_unit)}</td>
                          <td className="num">{fmtPct(l.carga_pct)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {!simulacao && <div className="texto-suave">Clique em “Simular todas as UFs” para comparar o preço e a carga tributária de venda para cada estado.</div>}
          </div>
        </>
      )}
    </>
  );
}

import React from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { api } from '../api.js';
import { Badge, Carregando, Erro, Vazio, fmtBRL, fmtData, fmtNum, useDados } from '../ui.jsx';

// Paleta categórica validada (ordem fixa — não ciclar)
const S1 = '#2a78d6', S2 = '#eb6834', S3 = '#1baf7a', S4 = '#eda100';
const INK_MUTED = '#898781', GRID = '#e1e0d9', BASELINE = '#c3c2b7';

const eixoX = { tick: { fill: INK_MUTED, fontSize: 12 }, axisLine: { stroke: BASELINE }, tickLine: false };
const eixoY = { tick: { fill: INK_MUTED, fontSize: 12 }, axisLine: false, tickLine: false };

function TooltipCartao({ active, payload, label, formatador = fmtBRL }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid var(--borda)', borderRadius: 8, padding: '8px 12px', boxShadow: 'var(--sombra)', fontSize: 13 }}>
      <div className="negrito" style={{ marginBottom: 4 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <i style={{ width: 9, height: 9, borderRadius: 3, background: p.color, display: 'inline-block' }} />
          <span style={{ color: 'var(--texto-2)' }}>{p.name}:</span>
          <strong>{formatador(p.value)}</strong>
        </div>
      ))}
    </div>
  );
}

export default function Dashboards() {
  const { dados, erro, carregando, recarregar } = useDados(() => api('/dashboards/resumo'));

  if (carregando) return <Carregando />;
  if (erro) return <Erro msg={erro} />;
  if (!dados) return null;

  const { kpis } = dados;
  const mesesFmt = dados.pedidos_por_mes.map((m) => ({ ...m, rotulo: `${m.mes.slice(5)}/${m.mes.slice(2, 4)}` }));

  // Donut de utilidades: no máximo 3 fatias nomeadas + "Outras" (limite all-pairs da paleta)
  const utilidades = [...dados.utilidades_participacao];
  const principais = utilidades.slice(0, 3);
  const resto = utilidades.slice(3);
  if (resto.length) principais.push({ nome: 'Outras', custo_hora: resto.reduce((s, u) => s + u.custo_hora, 0) });
  const coresDonut = [S1, S2, S3, S4];

  return (
    <>
      <div className="grade-kpis">
        <Kpi rotulo="Pedidos em aberto" valor={kpis.pedidos_abertos} />
        <Kpi rotulo="Carteira (aberto + produção)" valor={fmtBRL(kpis.valor_carteira)} />
        <Kpi rotulo="Ordens de produção abertas" valor={kpis.ordens_abertas} />
        <Kpi rotulo="Alertas de estoque" valor={kpis.alertas_estoque} destaque={kpis.alertas_estoque > 0 ? 'var(--vermelho)' : undefined} />
        <Kpi rotulo="NF-e emitidas" valor={kpis.nfe_emitidas} extra={fmtBRL(kpis.nfe_valor_total)} />
        <Kpi rotulo="Produtos ativos" valor={kpis.produtos_ativos} />
      </div>

      <div className="grade-2">
        <div className="cartao">
          <h3>Faturamento de pedidos por mês</h3>
          {!mesesFmt.length ? <Vazio /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={mesesFmt} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="rotulo" {...eixoX} />
                <YAxis {...eixoY} tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={44} />
                <Tooltip content={<TooltipCartao />} cursor={{ fill: 'rgba(42,120,214,0.06)' }} />
                <Bar isAnimationActive={false} dataKey="valor" name="Valor dos pedidos" fill={S1} radius={[4, 4, 0, 0]} maxBarSize={42} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="cartao">
          <h3>Utilidades — participação no custo-hora de processo</h3>
          {!principais.length ? <Vazio /> : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  isAnimationActive={false}
                  data={principais}
                  dataKey="custo_hora"
                  nameKey="nome"
                  innerRadius={62}
                  outerRadius={95}
                  paddingAngle={2}
                  stroke="#fff"
                  strokeWidth={2}
                >
                  {principais.map((_, i) => <Cell key={i} fill={coresDonut[i % coresDonut.length]} />)}
                </Pie>
                <Tooltip content={<TooltipCartao formatador={(v) => `${fmtBRL(v)}/h`} />} />
                <Legend formatter={(v) => <span style={{ color: 'var(--texto-2)', fontSize: 13 }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="cartao">
        <h3>Composição do custo por produto (por lote)</h3>
        {!dados.composicao_custos.length ? <Vazio msg="Cadastre fórmulas para ver a composição" /> : (
          <ResponsiveContainer width="100%" height={90 + dados.composicao_custos.length * 56}>
            <BarChart data={dados.composicao_custos} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid horizontal={false} stroke={GRID} />
              <XAxis type="number" {...eixoX} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <YAxis type="category" dataKey="nome" {...eixoY} width={210} />
              <Tooltip content={<TooltipCartao />} cursor={{ fill: 'rgba(42,120,214,0.06)' }} />
              <Legend formatter={(v) => <span style={{ color: 'var(--texto-2)', fontSize: 13 }}>{v}</span>} />
              <Bar isAnimationActive={false} dataKey="formula" name="Fórmula" stackId="c" fill={S1} stroke="#fff" strokeWidth={2} maxBarSize={26} />
              <Bar isAnimationActive={false} dataKey="mao_de_obra" name="Mão de obra" stackId="c" fill={S2} stroke="#fff" strokeWidth={2} maxBarSize={26} />
              <Bar isAnimationActive={false} dataKey="processo" name="Processo" stackId="c" fill={S3} stroke="#fff" strokeWidth={2} maxBarSize={26} />
              <Bar isAnimationActive={false} dataKey="manutencao" name="Manutenção" stackId="c" fill={S4} stroke="#fff" strokeWidth={2} maxBarSize={26} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="cartao">
        <h3>Custo unitário × preço sugerido</h3>
        {!dados.margens_produtos.length ? <Vazio /> : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dados.margens_produtos} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="nome" {...eixoX} interval={0} tick={{ fill: INK_MUTED, fontSize: 11.5 }} />
              <YAxis {...eixoY} width={54} />
              <Tooltip content={<TooltipCartao />} cursor={{ fill: 'rgba(42,120,214,0.06)' }} />
              <Legend formatter={(v) => <span style={{ color: 'var(--texto-2)', fontSize: 13 }}>{v}</span>} />
              <Bar isAnimationActive={false} dataKey="custo_unitario" name="Custo unitário" fill={S1} radius={[4, 4, 0, 0]} maxBarSize={34} />
              <Bar isAnimationActive={false} dataKey="preco_sugerido" name="Preço sugerido" fill={S2} radius={[4, 4, 0, 0]} maxBarSize={34} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grade-2">
        <div className="cartao">
          <div className="cartao-cabecalho">
            <h3>Próximas entregas</h3>
            <button className="botao botao-secundario botao-mini" onClick={recarregar}>Atualizar</button>
          </div>
          {!dados.entregas_proximas.length ? <Vazio msg="Sem entregas pendentes" /> : (
            <table className="tabela">
              <thead><tr><th>Pedido</th><th>Cliente</th><th>Entrega</th><th>Status</th><th className="num">Valor</th></tr></thead>
              <tbody>
                {dados.entregas_proximas.map((e) => (
                  <tr key={e.id}>
                    <td className="negrito">{e.numero}</td>
                    <td>{e.cliente}</td>
                    <td>{fmtData(e.data_entrega)}</td>
                    <td><Badge valor={e.status} /></td>
                    <td className="num">{fmtBRL(e.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="cartao">
          <h3>Estoque crítico</h3>
          {!dados.estoque_critico.length ? <Vazio msg="Nenhum item abaixo do mínimo 🎉" /> : (
            <table className="tabela">
              <thead><tr><th>Matéria-prima</th><th className="num">Atual</th><th className="num">Mínimo</th><th className="num">Déficit</th></tr></thead>
              <tbody>
                {dados.estoque_critico.map((m) => (
                  <tr key={m.id}>
                    <td className="negrito">{m.nome}</td>
                    <td className="num">{fmtNum(m.estoque_atual, 2)} {m.unidade}</td>
                    <td className="num">{fmtNum(m.estoque_minimo, 2)}</td>
                    <td className="num" style={{ color: 'var(--vermelho)', fontWeight: 700 }}>
                      {fmtNum(m.estoque_minimo - m.estoque_atual, 2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

function Kpi({ rotulo, valor, extra, destaque }) {
  return (
    <div className="kpi">
      <div className="kpi-rotulo">{rotulo}</div>
      <div className="kpi-valor" style={destaque ? { color: destaque } : undefined}>{valor}</div>
      {extra && <div className="kpi-extra">{extra}</div>}
    </div>
  );
}

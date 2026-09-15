import React from 'react';
import { api } from '../api.js';
import { Campo, Erro, Modal, fmtBRL, fmtPct } from '../ui.jsx';

// Cabeçalho "de gente" no modelo: a leitura reconhece variações de nome de
// coluna, então ninguém precisa digitar os nomes internos do sistema
const MODELO_CSV = [
  'Nome completo;E-mail;Telefone;CPF;Papel;Cargo;Salário base;Encargos (%);Vale-transporte;Vale-alimentação;Horas/mês',
  'Maria Souza;maria.souza@empresa.com;(11) 98888-7777;111.444.777-35;operador;Operadora de Produção;2200;68;220;550;220',
  'Carlos Lima;carlos.lima@empresa.com;(11) 3333-4444;12345678;producao;Técnico de Caldeira;3200;68;220;550;220',
].join('\n');

export default function ImportarUsuarios({ empresas, filiais = [], papeis, aoFechar, aoImportar }) {
  const [texto, setTexto] = React.useState('');
  const [planilha, setPlanilha] = React.useState(null);
  const [senhaPadrao, setSenhaPadrao] = React.useState('');
  const [empresaIds, setEmpresaIds] = React.useState(empresas.length === 1 ? [empresas[0].id] : []);
  const [filialIds, setFilialIds] = React.useState([]);
  // arquivo → mapear (só se alguma coluna obrigatória não foi reconhecida) → previa
  const [etapa, setEtapa] = React.useState('arquivo');
  const [analise, setAnalise] = React.useState(null);
  const [mapeamento, setMapeamento] = React.useState(null);
  const [previa, setPrevia] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  const [ocupado, setOcupado] = React.useState(false);

  // Conteúdo novo pode ter outras colunas: descarta o de-para anterior
  function novoConteudo() {
    setAnalise(null);
    setMapeamento(null);
    setPrevia(null);
    setErro(null);
  }

  // .xlsx vai em base64 para o backend (ExcelJS); csv/txt vira texto na caixa
  function escolherArquivo(e) {
    const arq = e.target.files?.[0];
    if (!arq) return;
    novoConteudo();
    const leitor = new FileReader();
    leitor.onerror = () => setErro('Falha ao ler o arquivo');
    if (/\.xlsx?$/i.test(arq.name)) {
      leitor.onload = () => {
        setPlanilha({ nome: arq.name, base64: String(leitor.result).split(',')[1] || '' });
        setTexto('');
      };
      leitor.readAsDataURL(arq);
    } else {
      leitor.onload = () => { setTexto(String(leitor.result)); setPlanilha(null); };
      leitor.readAsText(arq, 'utf-8');
    }
  }

  function baixarModelo() {
    const url = URL.createObjectURL(new Blob(['﻿' + MODELO_CSV], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo-usuarios.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const corpo = (dryRun) => ({
    ...(planilha ? { arquivo_base64: planilha.base64 } : { texto }),
    senha_padrao: senhaPadrao,
    empresa_ids: empresaIds,
    filial_ids: filialIds,
    dry_run: dryRun,
    ...(mapeamento ? { mapeamento } : {}),
  });

  // Conferência: o backend lê o arquivo, aplica o de-para e valida cada linha
  // com as mesmas regras do cadastro individual, sem gravar nada
  async function conferir() {
    setErro(null);
    setOcupado(true);
    try {
      const r = await api('/usuarios/importar', { method: 'POST', body: corpo(true) });
      setAnalise(r.analise || null);
      setMapeamento(r.analise?.mapeamento || null);
      if (r.precisa_mapear) {
        setPrevia(null);
        setEtapa('mapear');
      } else {
        setPrevia(r);
        setEtapa('previa');
      }
    } catch (e) {
      setErro(e.message);
    } finally {
      setOcupado(false);
    }
  }

  async function importar() {
    setErro(null);
    setOcupado(true);
    try {
      const r = await api('/usuarios/importar', { method: 'POST', body: corpo(false) });
      if (r.precisa_mapear) {
        setAnalise(r.analise);
        setEtapa('mapear');
        setOcupado(false);
        return;
      }
      aoImportar(r.importados);
    } catch (e) {
      setErro(e.message);
      setOcupado(false);
    }
  }

  const mudarMapeamento = (campo, indice) => setMapeamento((m) => ({ ...(m || {}), [campo]: indice }));
  const pendentes = (analise?.campos || [])
    .filter((c) => c.obrigatorio && mapeamento?.[c.campo] == null)
    .map((c) => c.rotulo);
  const tituloColuna = (indice) => analise?.colunas.find((c) => c.indice === indice)?.titulo;
  const ondeEstaOCabecalho = analise
    ? <>linha <strong>{analise.linha_cabecalho}</strong>{analise.aba ? <> da aba <strong>{analise.aba}</strong></> : null}</>
    : null;

  // Filiais ativas das empresas marcadas — filial é escopo da empresa
  const filiaisEscolhiveis = filiais.filter((f) => f.ativa && empresaIds.includes(f.empresa_id));
  const nomeFilial = (f, empresasDaLinha) => (empresasDaLinha.length > 1 ? `${f.empresa_nome} › ${f.nome}` : f.nome);

  const invalidas = previa?.linhas.filter((l) => !l.ok) || [];
  const validas = previa?.linhas.filter((l) => l.ok) || [];

  const rodape = (
    <>
      <button className="botao botao-secundario" onClick={aoFechar}>Cancelar</button>
      {etapa === 'arquivo' && (
        <button className="botao" onClick={conferir} disabled={ocupado || (!texto.trim() && !planilha)}>
          {ocupado ? 'Conferindo…' : 'Conferir'}
        </button>
      )}
      {etapa === 'mapear' && (
        <>
          <button className="botao botao-secundario" onClick={() => setEtapa('arquivo')}>Voltar</button>
          <button className="botao" onClick={conferir} disabled={ocupado || pendentes.length > 0}>
            {ocupado ? 'Conferindo…' : 'Conferir com estas colunas'}
          </button>
        </>
      )}
      {etapa === 'previa' && (
        <>
          <button className="botao botao-secundario" onClick={() => setEtapa('arquivo')}>Voltar</button>
          <button className="botao botao-secundario" onClick={() => setEtapa('mapear')}>Ajustar colunas</button>
          <button className="botao" onClick={importar} disabled={ocupado || !validas.length}>
            {ocupado ? 'Importando…' : `Importar ${validas.length} válido(s)`}
          </button>
        </>
      )}
    </>
  );

  return (
    <Modal titulo="Importar lista de usuários" largura={860} onFechar={aoFechar} rodape={rodape}>
      <Erro msg={erro} />

      {etapa === 'arquivo' && (
        <>
          <div className="alerta alerta-info">
            Obrigatórios: <strong>nome completo, e-mail, telefone, documento, papel, salário base e encargos (%)</strong>.
            {' '}Os nomes das colunas não precisam ser exatos — variações como “Salário Bruto (R$)” ou
            {' '}“Nome do Funcionário” são reconhecidas, e o cabeçalho é encontrado mesmo com título acima.
            {' '}Se alguma coluna não for reconhecida, você indica qual é na próxima etapa.
            {' '}Opcionais: cargo, senha, vales, horas/mês, <strong>empresa</strong> e <strong>filial</strong> (pelo nome, como cadastradas).
          </div>
          <div className="linha-campos">
            <Campo rotulo="Senha padrão da leva *" dica="mínimo 6 caracteres; uma coluna de senha na planilha tem prioridade">
              <input value={senhaPadrao} onChange={(e) => setSenhaPadrao(e.target.value)} placeholder="ex.: Trocar@123" />
            </Campo>
            <Campo rotulo="Arquivo (.xlsx ou .csv)">
              <input
                type="file"
                accept=".xlsx,.xls,.csv,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={escolherArquivo}
              />
            </Campo>
          </div>
          <Campo rotulo="Empresas dos importados" dica="vale para todos; uma coluna de empresa na planilha sobrescreve linha a linha">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: '4px 0' }}>
              {empresas.map((e) => (
                <label key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={empresaIds.includes(e.id)}
                    onChange={(ev) => {
                      setEmpresaIds((s) => (ev.target.checked ? [...s, e.id] : s.filter((x) => x !== e.id)));
                      // filial é escopo da empresa: sai a empresa, saem as filiais dela
                      if (!ev.target.checked) setFilialIds((s) => s.filter((id) => filiais.find((f) => f.id === id)?.empresa_id !== e.id));
                    }}
                  />
                  {e.nome_fantasia || e.razao_social}
                </label>
              ))}
            </div>
          </Campo>
          {filiaisEscolhiveis.length > 0 && (
            <Campo rotulo="Filiais dos importados" dica="vale para todos; uma coluna de filial na planilha sobrescreve linha a linha">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: '4px 0' }}>
                {filiaisEscolhiveis.map((f) => (
                  <label key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={filialIds.includes(f.id)}
                      onChange={(ev) => setFilialIds((s) => (ev.target.checked ? [...s, f.id] : s.filter((x) => x !== f.id)))}
                    />
                    {nomeFilial(f, empresaIds)}
                  </label>
                ))}
              </div>
            </Campo>
          )}
          {planilha ? (
            <div className="alerta alerta-info" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ flex: 1 }}>
                Planilha selecionada: <strong>{planilha.nome}</strong> — a aba com cabeçalho reconhecível é escolhida sozinha.
              </span>
              <button className="botao botao-secundario botao-mini" onClick={() => { setPlanilha(null); novoConteudo(); }}>
                Remover
              </button>
            </div>
          ) : (
            <Campo rotulo="Ou cole aqui a lista (com a linha de cabeçalho)">
              <textarea
                rows={9}
                style={{ width: '100%', fontFamily: 'ui-monospace, monospace', fontSize: 12.5 }}
                value={texto}
                onChange={(e) => { setTexto(e.target.value); novoConteudo(); }}
                placeholder={MODELO_CSV}
              />
            </Campo>
          )}
          <button className="botao botao-secundario botao-mini" onClick={baixarModelo}>Baixar modelo CSV</button>
        </>
      )}

      {etapa === 'mapear' && analise && (
        <>
          <div className={pendentes.length ? 'alerta alerta-aviso' : 'alerta alerta-info'}>
            {pendentes.length
              ? <>Não reconheci {pendentes.length === 1 ? 'a coluna' : 'as colunas'} <strong>{pendentes.join(', ')}</strong>.{' '}</>
              : <>Todas as colunas obrigatórias estão indicadas.{' '}</>}
            Cabeçalho lido na {ondeEstaOCabecalho}. Escolha, para cada campo, a coluna correspondente
            {' '}da sua planilha — as que reconheci já vêm marcadas.
          </div>
          <DeParaColunas analise={analise} mapeamento={mapeamento} aoMudar={mudarMapeamento} />
        </>
      )}

      {etapa === 'previa' && previa && (
        <>
          <div className={invalidas.length ? 'alerta alerta-aviso' : 'alerta alerta-info'}>
            {previa.total} linha(s) lida(s): <strong>{validas.length} pronta(s) para importar</strong>
            {invalidas.length > 0 && <> e <strong>{invalidas.length} com erro</strong>, que serão ignoradas</>}.
          </div>
          {analise && (
            <details style={{ margin: '0 0 10px' }}>
              <summary className="texto-suave" style={{ cursor: 'pointer' }}>
                Colunas usadas — cabeçalho na {ondeEstaOCabecalho}
              </summary>
              <div style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '2px 12px', padding: '8px 4px', fontSize: 13 }}>
                {analise.campos.filter((c) => mapeamento?.[c.campo] != null).map((c) => (
                  <React.Fragment key={c.campo}>
                    <span className="texto-suave">{c.rotulo}</span>
                    <span>← {tituloColuna(mapeamento[c.campo])}</span>
                  </React.Fragment>
                ))}
              </div>
            </details>
          )}
          {invalidas.length > 0 && (
            <>
              <h4 style={{ margin: '12px 0 6px', fontSize: 13 }}>Linhas com erro</h4>
              <div className="tabela-envolucro" style={{ maxHeight: 200 }}>
                <table className="tabela">
                  <thead><tr><th className="num">Linha</th><th>Nome</th><th>E-mail</th><th>Motivo</th></tr></thead>
                  <tbody>
                    {invalidas.map((l) => (
                      <tr key={l.linha}>
                        <td className="num">{l.linha}</td>
                        <td>{l.nome || '—'}</td>
                        <td>{l.email || '—'}</td>
                        <td style={{ color: 'var(--vermelho)' }}>{l.erro}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {validas.length > 0 && (
            <>
              <h4 style={{ margin: '12px 0 6px', fontSize: 13 }}>Serão importados</h4>
              <div className="tabela-envolucro" style={{ maxHeight: 240 }}>
                <table className="tabela">
                  <thead>
                    <tr>
                      <th className="num">Linha</th>
                      <th>Nome</th>
                      <th>E-mail</th>
                      <th>Papel</th>
                      <th>Cargo</th>
                      <th className="num">Salário base</th>
                      <th className="num">Encargos</th>
                      <th>Empresas</th>
                      <th>Filiais</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validas.map((l) => (
                      <tr key={l.linha}>
                        <td className="num">{l.linha}</td>
                        <td className="negrito">{l.nome}</td>
                        <td>{l.email}</td>
                        <td>{papeis.find((p) => p.valor === l.papel)?.rotulo || l.papel}</td>
                        <td>{l.cargo || <span className="texto-suave">—</span>}</td>
                        <td className="num">{fmtBRL(l.salario_base)}</td>
                        <td className="num">{fmtPct(l.encargos_pct)}</td>
                        <td>
                          {l.papel === 'admin'
                            ? <span className="texto-suave">todas</span>
                            : empresas.filter((e) => l.empresa_ids.includes(e.id)).map((e) => e.nome_fantasia || e.razao_social).join(', ')}
                        </td>
                        <td>
                          {l.papel === 'admin'
                            ? <span className="texto-suave">todas</span>
                            : filiais.filter((f) => (l.filial_ids || []).includes(f.id)).map((f) => nomeFilial(f, l.empresa_ids)).join(', ')
                              || <span className="texto-suave">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </Modal>
  );
}

// De-para: para cada campo do sistema, qual coluna da planilha usar
function DeParaColunas({ analise, mapeamento, aoMudar }) {
  // Coluna usada em dois campos quase sempre é engano: sinaliza
  const usos = {};
  Object.values(mapeamento || {}).forEach((i) => { if (i != null) usos[i] = (usos[i] || 0) + 1; });

  return (
    <div className="tabela-envolucro" style={{ maxHeight: 380 }}>
      <table className="tabela">
        <thead><tr><th>Campo do sistema</th><th>Coluna da sua planilha</th></tr></thead>
        <tbody>
          {analise.campos.map((c) => {
            const valor = mapeamento?.[c.campo];
            const pendente = c.obrigatorio && valor == null;
            const repetida = valor != null && usos[valor] > 1;
            return (
              <tr key={c.campo}>
                <td>
                  {c.rotulo}
                  {c.obrigatorio && <span style={{ color: 'var(--vermelho)' }}> *</span>}
                </td>
                <td>
                  <select
                    value={valor ?? ''}
                    onChange={(e) => aoMudar(c.campo, e.target.value === '' ? null : Number(e.target.value))}
                    style={pendente || repetida ? { borderColor: 'var(--vermelho)' } : undefined}
                  >
                    <option value="">{c.obrigatorio ? '— escolha a coluna —' : '— não importar —'}</option>
                    {analise.colunas.map((col) => (
                      <option key={col.indice} value={col.indice}>{col.titulo}</option>
                    ))}
                  </select>
                  {repetida && <span className="texto-suave" style={{ marginLeft: 8 }}>coluna usada em mais de um campo</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

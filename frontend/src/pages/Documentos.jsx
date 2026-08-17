import React from 'react';
import { api, urlDownload } from '../api.js';
import { Badge, Campo, Carregando, Erro, Modal, Vazio, fmtData, useDados } from '../ui.jsx';

export const TIPOS_DOCUMENTO = {
  obrigatorio: 'Obrigatório',
  especificacao_tecnica: 'Especificação técnica',
  ficha_tecnica: 'Ficha técnica',
  certificado: 'Certificado / Alvará',
  laudo: 'Laudo / Análise',
  manual: 'Manual / POP',
  desenho: 'Desenho técnico',
  fiscal: 'Fiscal / Contábil',
  outro: 'Outro',
};

const TAMANHO_MAXIMO_MB = 5;

const fmtBytes = (b) => {
  if (b == null) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

export default function Documentos({ usuario }) {
  const [filtroTag, setFiltroTag] = React.useState('');
  const [filtroTipo, setFiltroTipo] = React.useState('');
  const [filtroStatus, setFiltroStatus] = React.useState('vigente');
  const [busca, setBusca] = React.useState('');
  const { dados: tags, recarregar: recarregarTags } = useDados(() => api('/documentos/tags'));
  const { dados: docs, erro, carregando, recarregar } = useDados(
    () => {
      const q = new URLSearchParams();
      if (filtroTag) q.set('tag_id', filtroTag);
      if (filtroTipo) q.set('tipo', filtroTipo);
      if (busca.trim()) q.set('busca', busca.trim());
      q.set('status', filtroStatus);
      return api(`/documentos?${q}`);
    },
    [filtroTag, filtroTipo, busca, filtroStatus],
  );
  const [editando, setEditando] = React.useState(null);
  const [msg, setMsg] = React.useState(null);

  const podeEditar = ['admin', 'gestor'].includes(usuario?.papel);

  function aposSalvar() {
    setEditando(null);
    recarregar();
    recarregarTags();
  }

  // "Excluir" é lógico: o documento vira obsoleto (sai da listagem padrão, fica no histórico)
  async function alterarStatus(d, status) {
    const pergunta =
      status === 'obsoleto'
        ? `Marcar "${d.nome}" como obsoleto? Ele sai da listagem padrão, mas fica no histórico com seu nome como responsável.`
        : `Reativar "${d.nome}" como vigente?`;
    if (!confirm(pergunta)) return;
    setMsg(null);
    try {
      await api(`/documentos/${d.id}/status`, { method: 'PUT', body: { status } });
      recarregar();
    } catch (e) {
      setMsg(e.message);
    }
  }

  return (
    <>
      <div className="cartao">
        <div className="cartao-cabecalho">
          <h3>Documentos</h3>
          <button className="botao" onClick={() => setEditando({ novo: true })}>+ Adicionar documento</button>
        </div>
        {/* Filtros — tags e tipo em selects, antes da listagem */}
        <div className="linha-campos">
          <Campo rotulo="Tag" largura={220}>
            <select value={filtroTag} onChange={(e) => setFiltroTag(e.target.value)}>
              <option value="">— todas as tags —</option>
              {(tags || []).map((t) => (
                <option key={t.id} value={t.id}>{t.nome} ({t.usos})</option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Tipo de documento" largura={220}>
            <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
              <option value="">— todos os tipos —</option>
              {Object.entries(TIPOS_DOCUMENTO).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>{rotulo}</option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Status" largura={150}>
            <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
              <option value="vigente">Vigentes</option>
              <option value="obsoleto">Obsoletos</option>
              <option value="todos">Todos</option>
            </select>
          </Campo>
          <Campo rotulo="Buscar">
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="nome, arquivo ou descrição…" />
          </Campo>
        </div>
        <Erro msg={erro || msg} />
        {carregando ? (
          <Carregando />
        ) : !docs?.length ? (
          <Vazio msg={filtroTag || filtroTipo || busca ? 'Nenhum documento com estes filtros' : 'Nenhum documento — clique em Adicionar documento'} />
        ) : (
          <div className="tabela-envolucro">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Documento</th>
                  <th>Tipo</th>
                  <th>Status</th>
                  <th>Tags</th>
                  <th>Arquivo</th>
                  <th className="num">Tamanho</th>
                  <th>Enviado por</th>
                  <th className="acoes">Ações</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id} style={d.status === 'obsoleto' ? { opacity: 0.6 } : undefined}>
                    <td>
                      <span className="negrito">{d.nome}</span>
                      {d.descricao && <div className="texto-suave" style={{ fontSize: 12 }}>{d.descricao}</div>}
                    </td>
                    <td><span className="badge badge-azul">{TIPOS_DOCUMENTO[d.tipo] || d.tipo}</span></td>
                    <td>
                      <Badge valor={d.status} />
                      {d.status_alterado_por_nome && (
                        <div className="texto-suave" style={{ fontSize: 11.5 }}>
                          por {d.status_alterado_por_nome} em {fmtData(d.status_alterado_em)}
                        </div>
                      )}
                    </td>
                    <td>
                      {!d.tags.length ? <span className="texto-suave">—</span> : d.tags.map((t) => (
                        <span key={t.id} className="badge badge-cinza" style={{ marginRight: 4 }}>{t.nome}</span>
                      ))}
                    </td>
                    <td className="texto-suave">{d.arquivo_nome}</td>
                    <td className="num">{fmtBytes(d.tamanho_bytes)}</td>
                    <td>
                      <span className="negrito">{d.criado_por_nome || '—'}</span>
                      <div className="texto-suave" style={{ fontSize: 12 }}>{fmtData(d.criado_em)}</div>
                    </td>
                    <td className="acoes">
                      <a className="botao botao-secundario botao-mini" href={urlDownload(`/documentos/${d.id}/arquivo`)} target="_blank" rel="noreferrer">
                        ⇩ Baixar
                      </a>
                      {podeEditar && (
                        <>
                          <button className="botao botao-secundario botao-mini" onClick={() => setEditando(d)}>Editar</button>
                          {d.status === 'vigente' ? (
                            <button className="botao botao-perigo botao-mini" onClick={() => alterarStatus(d, 'obsoleto')} title="Exclusão lógica — o documento fica no histórico">
                              Obsoletar
                            </button>
                          ) : (
                            <button className="botao botao-secundario botao-mini" onClick={() => alterarStatus(d, 'vigente')}>
                              Reativar
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {editando && (
        <FormDocumento
          documento={editando.novo ? null : editando}
          tagsExistentes={tags || []}
          aoFechar={() => setEditando(null)}
          aoSalvar={aposSalvar}
        />
      )}
    </>
  );
}

function FormDocumento({ documento, tagsExistentes, aoFechar, aoSalvar }) {
  const [f, setF] = React.useState(() =>
    documento
      ? { nome: documento.nome, tipo: documento.tipo, descricao: documento.descricao || '', tags: documento.tags.map((t) => t.nome) }
      : { nome: '', tipo: '', descricao: '', tags: [] },
  );
  const [arquivo, setArquivo] = React.useState(null); // { nome, mime, tamanho, base64 }
  const [novaTag, setNovaTag] = React.useState('');
  const [erro, setErro] = React.useState(null);
  const [salvando, setSalvando] = React.useState(false);
  const mudar = (campo, valor) => setF((s) => ({ ...s, [campo]: valor }));

  function escolherArquivo(e) {
    const arq = e.target.files?.[0];
    if (!arq) return;
    if (arq.size > TAMANHO_MAXIMO_MB * 1024 * 1024) {
      setErro(`Arquivo com ${fmtBytes(arq.size)} — o limite é ${TAMANHO_MAXIMO_MB} MB por documento`);
      e.target.value = '';
      return;
    }
    setErro(null);
    const leitor = new FileReader();
    leitor.onload = () => {
      const base64 = String(leitor.result).split(',')[1] || '';
      setArquivo({ nome: arq.name, mime: arq.type || 'application/octet-stream', tamanho: arq.size, base64 });
      setF((s) => ({ ...s, nome: s.nome || arq.name.replace(/\.[^.]+$/, '') }));
    };
    leitor.onerror = () => setErro('Falha ao ler o arquivo');
    leitor.readAsDataURL(arq);
  }

  function adicionarTags(texto) {
    const novas = String(texto).split(',').map((t) => t.trim()).filter(Boolean);
    if (!novas.length) return;
    setF((s) => ({ ...s, tags: [...new Set([...s.tags, ...novas])] }));
    setNovaTag('');
  }

  async function salvar() {
    setErro(null);
    if (!f.tipo) return setErro('Selecione o tipo do documento');
    if (!documento && !arquivo) return setErro('Selecione o arquivo do documento');
    setSalvando(true);
    try {
      const corpo = {
        ...f,
        ...(arquivo ? { arquivo_nome: arquivo.nome, mime: arquivo.mime, conteudo_base64: arquivo.base64 } : {}),
      };
      if (documento) await api(`/documentos/${documento.id}`, { method: 'PUT', body: corpo });
      else await api('/documentos', { method: 'POST', body: corpo });
      aoSalvar();
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal titulo={documento ? `Editar ${documento.nome}` : 'Adicionar documento'} onFechar={aoFechar}
      rodape={
        <>
          <button className="botao botao-secundario" onClick={aoFechar}>Cancelar</button>
          <button className="botao" onClick={salvar} disabled={salvando}>{salvando ? 'Enviando…' : 'Salvar documento'}</button>
        </>
      }
    >
      <Erro msg={erro} />
      <Campo rotulo={documento ? 'Substituir arquivo (opcional)' : 'Arquivo *'} dica={`até ${TAMANHO_MAXIMO_MB} MB — PDF, imagem, planilha, etc.`}>
        <input type="file" onChange={escolherArquivo} />
      </Campo>
      {arquivo && (
        <div className="alerta alerta-info">
          Selecionado: <strong>{arquivo.nome}</strong> ({fmtBytes(arquivo.tamanho)})
        </div>
      )}
      {documento && !arquivo && (
        <div className="texto-suave" style={{ marginBottom: 10 }}>Arquivo atual: {documento.arquivo_nome} ({fmtBytes(documento.tamanho_bytes)})</div>
      )}
      <div className="linha-campos">
        <Campo rotulo="Nome do documento *">
          <input value={f.nome} onChange={(e) => mudar('nome', e.target.value)} />
        </Campo>
        <Campo rotulo="Tipo *" largura={220}>
          <select value={f.tipo} onChange={(e) => mudar('tipo', e.target.value)}>
            <option value="">— selecione —</option>
            {Object.entries(TIPOS_DOCUMENTO).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>{rotulo}</option>
            ))}
          </select>
        </Campo>
      </div>
      <Campo rotulo="Descrição">
        <input value={f.descricao} onChange={(e) => mudar('descricao', e.target.value)} />
      </Campo>
      <Campo rotulo="Tags" dica="digite e pressione Enter (ou separe por vírgula) — tags novas são criadas automaticamente">
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={novaTag}
            onChange={(e) => setNovaTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                adicionarTags(novaTag);
              }
            }}
            onBlur={() => novaTag.trim() && adicionarTags(novaTag)}
            list="tags-existentes"
            placeholder="ex.: qualidade, fornecedor X"
          />
          <button type="button" className="botao botao-secundario" onClick={() => adicionarTags(novaTag)}>+</button>
        </div>
        <datalist id="tags-existentes">
          {tagsExistentes.map((t) => <option key={t.id} value={t.nome} />)}
        </datalist>
      </Campo>
      {!!f.tags.length && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {f.tags.map((t) => (
            <span key={t} className="badge badge-cinza">
              {t}{' '}
              <button
                type="button"
                onClick={() => setF((s) => ({ ...s, tags: s.tags.filter((x) => x !== t) }))}
                style={{ border: 0, background: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 700 }}
                aria-label={`remover tag ${t}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </Modal>
  );
}

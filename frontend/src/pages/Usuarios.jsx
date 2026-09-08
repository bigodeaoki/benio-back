import React from 'react';
import { Users } from 'lucide-react';
import { api } from '../api.js';
import { Badge, Campo, Carregando, Erro, Modal, Vazio, fmtData, fmtDocumento, fmtTelefone, useDados, toast, confirmar } from '../ui.jsx';

const PAPEIS = [
  { valor: 'admin', rotulo: 'Admin', descricao: 'Acesso total: usuários, empresas, configurações fiscais e todas as operações.' },
  { valor: 'producao', rotulo: 'Produção', descricao: 'Linhas de processo, utilidades, fórmulas/produtos, matérias-primas, ordens de produção (PCP/MRP) e movimentos de estoque.' },
  { valor: 'qualidade', rotulo: 'Qualidade', descricao: 'Fórmulas/produtos (especificações) e controle de documentos (editar, obsoletar e reativar).' },
  { valor: 'compras', rotulo: 'Compras', descricao: 'Matérias-primas (preços e estoque mínimo) e movimentos de estoque (entradas de compra).' },
  { valor: 'vendas', rotulo: 'Vendas', descricao: 'Pedidos, geração de ordens de produção a partir de pedidos e emissão de NF-e.' },
  { valor: 'financeiro', rotulo: 'Financeiro', descricao: 'Consulta geral: custos, preços, dashboards, pedidos e notas fiscais — sem edições por padrão.' },
  { valor: 'operador', rotulo: 'Operador', descricao: 'Apontamentos de produção (status das OPs), movimentos de estoque e consultas gerais.' },
];

export default function Usuarios({ usuario }) {
  const ehAdmin = usuario?.papel === 'admin';
  const { dados, erro, carregando, recarregar } = useDados(() => api('/usuarios'));
  const { dados: empresas } = useDados(() => api('/empresas'));
  const [editando, setEditando] = React.useState(null);
  const [importando, setImportando] = React.useState(false);
  const [msg, setMsg] = React.useState(null);
  const [filtroNome, setFiltroNome] = React.useState('');
  const [filtroStatus, setFiltroStatus] = React.useState('ativos');
  const [filtroDocumento, setFiltroDocumento] = React.useState('');

  if (!ehAdmin) {
    return <div className="cartao"><Vazio msg="Apenas administradores acessam a gestão de usuários" /></div>;
  }

  // Usuários nunca são excluídos — inativação preserva o histórico
  async function alterarAtivo(u, ativo) {
    const aceitou = await confirmar({
      titulo: ativo ? 'Reativar usuário' : 'Inativar usuário',
      mensagem: ativo
        ? `Reativar o acesso de ${u.nome}?`
        : `Inativar ${u.nome}? A pessoa perde o acesso ao sistema, mas o histórico dela é preservado.`,
      confirmarTexto: ativo ? 'Reativar' : 'Inativar',
      perigo: !ativo,
    });
    if (!aceitou) return;
    try {
      await api(`/usuarios/${u.id}/ativo`, { method: 'PUT', body: { ativo } });
      recarregar();
      toast.sucesso(ativo ? `${u.nome} reativado(a)` : `${u.nome} inativado(a)`);
    } catch (e) {
      toast.erro(e.message);
    }
  }

  const filtrados = (dados || []).filter((u) => {
    if (filtroStatus === 'ativos' && !u.ativo) return false;
    if (filtroStatus === 'inativos' && u.ativo) return false;
    if (filtroNome && !u.nome.toLowerCase().includes(filtroNome.trim().toLowerCase())) return false;
    if (filtroDocumento) {
      const busca = filtroDocumento.replace(/[.\-\/\s]/g, '').toLowerCase();
      if (!String(u.documento || '').toLowerCase().includes(busca)) return false;
    }
    return true;
  });

  return (
    <>
      <div className="cartao">
        <div className="cartao-cabecalho">
          <h3><Users size={15} className="icone-cartao" />Usuários do sistema</h3>
          <button className="botao botao-secundario" onClick={() => setImportando(true)}>Importar lista</button>
          <button className="botao" onClick={() => setEditando({ novo: true })}>+ Novo usuário</button>
        </div>
        <div className="alerta alerta-info">
          Todos os campos do cadastro são obrigatórios — o <strong>papel</strong> define as restrições de acesso:
          {' '}{PAPEIS.map((p) => p.rotulo).join(' · ')}. Usuários não são excluídos, apenas <strong>inativados</strong>,
          preservando o histórico.
        </div>
        <div className="linha-campos">
          <Campo rotulo="Filtrar por nome">
            <input value={filtroNome} onChange={(e) => setFiltroNome(e.target.value)} placeholder="nome do usuário…" />
          </Campo>
          <Campo rotulo="Status" largura={150}>
            <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
              <option value="ativos">Ativos</option>
              <option value="inativos">Inativos</option>
              <option value="todos">Todos</option>
            </select>
          </Campo>
          <Campo rotulo="Documento" largura={200}>
            <input value={filtroDocumento} onChange={(e) => setFiltroDocumento(e.target.value)} placeholder="CPF, RG…" />
          </Campo>
        </div>
        <Erro msg={erro || msg} />
        {carregando ? <Carregando /> : !filtrados.length ? (
          <Vazio msg={dados?.length ? 'Nenhum usuário com estes filtros' : 'Nenhum usuário cadastrado'} />
        ) : (
          <div className="tabela-envolucro">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Nome completo</th>
                  <th>E-mail</th>
                  <th>Telefone</th>
                  <th>Documento</th>
                  <th>Papel</th>
                  <th>Empresas</th>
                  <th>Status</th>
                  <th>Criado em</th>
                  <th className="acoes">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((u) => (
                  <tr key={u.id} style={u.ativo ? undefined : { opacity: 0.55 }}>
                    <td className="negrito">{u.nome}</td>
                    <td>{u.email}</td>
                    <td>{fmtTelefone(u.telefone) || <span className="texto-suave">pendente</span>}</td>
                    <td className="mono">{fmtDocumento(u.documento) || <span className="texto-suave">pendente</span>}</td>
                    <td><span className="badge badge-azul">{PAPEIS.find((p) => p.valor === u.papel)?.rotulo || u.papel}</span></td>
                    <td>
                      {u.papel === 'admin'
                        ? <span className="texto-suave">todas</span>
                        : (empresas || []).filter((e) => u.empresa_ids.includes(e.id)).map((e) => e.nome_fantasia || e.razao_social).join(', ') || '—'}
                    </td>
                    <td><Badge valor={u.ativo ? 'ativo_usuario' : 'inativo_usuario'} /></td>
                    <td>{fmtData(u.criado_em)}</td>
                    <td className="acoes">
                      <button className="botao botao-secundario botao-mini" onClick={() => setEditando(u)}>Editar</button>
                      {u.id !== usuario.id && (
                        u.ativo ? (
                          <button className="botao botao-perigo botao-mini" onClick={() => alterarAtivo(u, false)} title="Perde o acesso; histórico preservado">
                            Inativar
                          </button>
                        ) : (
                          <button className="botao botao-secundario botao-mini" onClick={() => alterarAtivo(u, true)}>
                            Reativar
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {importando && (
        <ImportarUsuarios
          empresas={empresas || []}
          aoFechar={() => setImportando(false)}
          aoImportar={(qtd) => { setImportando(false); recarregar(); toast.sucesso(`${qtd} usuário(s) importado(s)`); }}
        />
      )}
      {editando && (
        <FormUsuario
          usuarioEditado={editando.novo ? null : editando}
          empresas={empresas || []}
          aoFechar={() => setEditando(null)}
          aoSalvar={() => { setEditando(null); recarregar(); toast.sucesso('Usuário salvo'); }}
        />
      )}
    </>
  );
}

/* ---------------------- Importação em lote ---------------------- */

// Colunas aceitas no arquivo. A comparação ignora acento, caixa e espaço,
// então "Salário base", "salario_base" e "SALARIO BASE" caem na mesma coluna.
const COLUNAS = {
  nome: ['nome', 'nomecompleto'],
  email: ['email', 'e-mail'],
  telefone: ['telefone', 'fone', 'celular'],
  documento: ['documento', 'cpf', 'rg', 'doc'],
  papel: ['papel', 'perfil', 'funcao'],
  salario_base: ['salariobase', 'salario'],
  encargos_pct: ['encargospct', 'encargos', 'encargo'],
  senha: ['senha', 'password'],
  cargo: ['cargo'],
  vale_transporte: ['valetransporte', 'vt'],
  vale_alimentacao: ['valealimentacao', 'va'],
  outros_beneficios: ['outrosbeneficios', 'outros'],
  horas_mes: ['horasmes', 'horas'],
  empresas: ['empresas', 'empresa'],
};

const OBRIGATORIAS = ['nome', 'email', 'telefone', 'documento', 'papel', 'salario_base', 'encargos_pct'];

const MODELO_CSV = [
  'nome;email;telefone;documento;papel;cargo;salario_base;encargos_pct;vale_transporte;vale_alimentacao;horas_mes',
  'Maria Souza;maria.souza@empresa.com;11988887777;111.444.777-35;operador;Operadora de Produção;2200;68;220;550;220',
  'Carlos Lima;carlos.lima@empresa.com;1133334444;12345678;producao;Técnico de Caldeira;3200;68;220;550;220',
].join('\n');

const normalizar = (s) => String(s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[\s_.\-]/g, '');

// Detecta o separador pela primeira linha: ; , ou tabulação (colagem do Excel)
function separadorDe(texto) {
  const linha = texto.split(/\r?\n/)[0] || '';
  const candidatos = [';', '\t', ','];
  return candidatos.reduce((a, b) => (linha.split(b).length > linha.split(a).length ? b : a), ';');
}

function lerCsv(texto) {
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim());
  if (linhas.length < 2) throw new Error('Informe o cabeçalho e ao menos uma linha de usuário');
  const sep = separadorDe(texto);
  const cabecalho = linhas[0].split(sep).map((c) => normalizar(c));

  // Mapeia cada coluna do arquivo para um campo conhecido
  const indice = {};
  Object.entries(COLUNAS).forEach(([campo, apelidos]) => {
    const i = cabecalho.findIndex((c) => apelidos.includes(c));
    if (i >= 0) indice[campo] = i;
  });
  const faltando = OBRIGATORIAS.filter((c) => indice[c] === undefined);
  if (faltando.length) throw new Error(`Faltam colunas obrigatórias no cabeçalho: ${faltando.join(', ')}`);

  return linhas.slice(1).map((linha, i) => {
    const partes = linha.split(sep).map((p) => p.trim().replace(/^"(.*)"$/, '$1'));
    const registro = { __linha: i + 2 }; // +2: linha 1 é o cabeçalho
    Object.entries(indice).forEach(([campo, pos]) => { registro[campo] = partes[pos] ?? ''; });
    return registro;
  });
}

function ImportarUsuarios({ empresas, aoFechar, aoImportar }) {
  const [texto, setTexto] = React.useState('');
  const [senhaPadrao, setSenhaPadrao] = React.useState('');
  const [empresaIds, setEmpresaIds] = React.useState(empresas.length === 1 ? [empresas[0].id] : []);
  const [previa, setPrevia] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  const [ocupado, setOcupado] = React.useState(false);

  function escolherArquivo(e) {
    const arq = e.target.files?.[0];
    if (!arq) return;
    const leitor = new FileReader();
    leitor.onload = () => { setTexto(String(leitor.result)); setPrevia(null); setErro(null); };
    leitor.onerror = () => setErro('Falha ao ler o arquivo');
    leitor.readAsText(arq, 'utf-8');
  }

  function baixarModelo() {
    const url = URL.createObjectURL(new Blob(['﻿' + MODELO_CSV], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo-usuarios.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  // Conferência: o backend valida com as mesmas regras do cadastro individual
  async function conferir() {
    setErro(null);
    setOcupado(true);
    try {
      const usuarios = lerCsv(texto);
      const r = await api('/usuarios/importar', {
        method: 'POST',
        body: { usuarios, senha_padrao: senhaPadrao, empresa_ids: empresaIds, dry_run: true },
      });
      setPrevia(r);
    } catch (e) {
      setPrevia(null);
      setErro(e.message);
    } finally {
      setOcupado(false);
    }
  }

  async function importar() {
    setErro(null);
    setOcupado(true);
    try {
      const usuarios = lerCsv(texto);
      const r = await api('/usuarios/importar', {
        method: 'POST',
        body: { usuarios, senha_padrao: senhaPadrao, empresa_ids: empresaIds, dry_run: false },
      });
      aoImportar(r.importados);
    } catch (e) {
      setErro(e.message);
      setOcupado(false);
    }
  }

  const invalidas = previa?.linhas.filter((l) => !l.ok) || [];
  const validas = previa?.linhas.filter((l) => l.ok) || [];

  return (
    <Modal
      titulo="Importar lista de usuários"
      largura={860}
      onFechar={aoFechar}
      rodape={
        <>
          <button className="botao botao-secundario" onClick={aoFechar}>Cancelar</button>
          {!previa ? (
            <button className="botao" onClick={conferir} disabled={ocupado || !texto.trim()}>
              {ocupado ? 'Conferindo…' : 'Conferir'}
            </button>
          ) : (
            <>
              <button className="botao botao-secundario" onClick={() => setPrevia(null)}>Voltar</button>
              <button className="botao" onClick={importar} disabled={ocupado || !validas.length}>
                {ocupado ? 'Importando…' : `Importar ${validas.length} válido(s)`}
              </button>
            </>
          )}
        </>
      }
    >
      <Erro msg={erro} />
      {!previa ? (
        <>
          <div className="alerta alerta-info">
            Colunas obrigatórias: <strong>nome, email, telefone, documento, papel, salario_base, encargos_pct</strong>.
            {' '}Opcionais: senha, cargo, vale_transporte, vale_alimentacao, outros_beneficios, horas_mes, empresas.
            {' '}Separador ponto e vírgula, vírgula ou tabulação — dá para colar direto do Excel.
          </div>
          <div className="linha-campos">
            <Campo rotulo="Senha padrão da leva *" dica="mínimo 6 caracteres; a coluna senha, se vier, tem prioridade">
              <input value={senhaPadrao} onChange={(e) => setSenhaPadrao(e.target.value)} placeholder="ex.: Trocar@123" />
            </Campo>
            <Campo rotulo="Arquivo .csv">
              <input type="file" accept=".csv,text/csv,text/plain" onChange={escolherArquivo} />
            </Campo>
          </div>
          <Campo rotulo="Empresas dos importados" dica="vale para todos; a coluna empresas sobrescreve linha a linha">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: '4px 0' }}>
              {empresas.map((e) => (
                <label key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={empresaIds.includes(e.id)}
                    onChange={(ev) => setEmpresaIds((s) => (ev.target.checked ? [...s, e.id] : s.filter((x) => x !== e.id)))}
                  />
                  {e.nome_fantasia || e.razao_social}
                </label>
              ))}
            </div>
          </Campo>
          <Campo rotulo="Ou cole aqui a lista (com a linha de cabeçalho)">
            <textarea
              rows={9}
              style={{ width: '100%', fontFamily: 'ui-monospace, monospace', fontSize: 12.5 }}
              value={texto}
              onChange={(e) => { setTexto(e.target.value); setPrevia(null); }}
              placeholder={MODELO_CSV}
            />
          </Campo>
          <button className="botao botao-secundario botao-mini" onClick={baixarModelo}>Baixar modelo CSV</button>
        </>
      ) : (
        <>
          <div className={invalidas.length ? 'alerta alerta-aviso' : 'alerta alerta-info'}>
            {previa.total} linha(s) lida(s): <strong>{validas.length} pronta(s) para importar</strong>
            {invalidas.length > 0 && <> e <strong>{invalidas.length} com erro</strong>, que serão ignoradas</>}.
          </div>
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
                  <thead><tr><th className="num">Linha</th><th>Nome</th><th>E-mail</th><th>Papel</th><th>Empresas</th></tr></thead>
                  <tbody>
                    {validas.map((l) => (
                      <tr key={l.linha}>
                        <td className="num">{l.linha}</td>
                        <td className="negrito">{l.nome}</td>
                        <td>{l.email}</td>
                        <td>{PAPEIS.find((p) => p.valor === l.papel)?.rotulo || l.papel}</td>
                        <td>
                          {l.papel === 'admin'
                            ? <span className="texto-suave">todas</span>
                            : empresas.filter((e) => l.empresa_ids.includes(e.id)).map((e) => e.nome_fantasia || e.razao_social).join(', ')}
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

function FormUsuario({ usuarioEditado, empresas, aoFechar, aoSalvar }) {
  const [f, setF] = React.useState(
    usuarioEditado
      ? { ...usuarioEditado, telefone: usuarioEditado.telefone || '', documento: usuarioEditado.documento || '', senha: '' }
      : { nome: '', email: '', telefone: '', documento: '', senha: '', papel: 'operador', ativo: 1, empresa_ids: [], cargo: '', salario_base: 0, encargos_pct: 70, vale_transporte: 0, vale_alimentacao: 0, outros_beneficios: 0, horas_mes: 220 },
  );
  const [erro, setErro] = React.useState(null);
  const mudar = (campo, valor) => setF((s) => ({ ...s, [campo]: valor }));
  const papelInfo = PAPEIS.find((p) => p.valor === f.papel);

  function alternarEmpresa(id) {
    setF((s) => ({
      ...s,
      empresa_ids: s.empresa_ids.includes(id) ? s.empresa_ids.filter((x) => x !== id) : [...s.empresa_ids, id],
    }));
  }

  // validação imediata — todos os campos são obrigatórios
  function validarLocal() {
    const nome = f.nome.trim();
    if (nome.length < 3 || !nome.includes(' ')) return 'Informe o nome completo (nome e sobrenome)';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return 'E-mail inválido';
    const fone = f.telefone.replace(/\D/g, '');
    if (fone.length < 10 || fone.length > 15) return 'Telefone inválido — informe DDD + número';
    if (String(f.documento).replace(/[.\-\/\s]/g, '').length < 4) return 'Número de documento é obrigatório';
    if (!usuarioEditado && f.senha.length < 6) return 'Senha deve ter ao menos 6 caracteres';
    if (usuarioEditado && f.senha && f.senha.length < 6) return 'Nova senha deve ter ao menos 6 caracteres';
    if (f.papel !== 'admin' && !f.empresa_ids.length) return 'Vincule ao menos uma empresa para este papel';
    return null;
  }

  async function salvar() {
    const problema = validarLocal();
    if (problema) return setErro(problema);
    setErro(null);
    try {
      const corpo = { ...f };
      if (!corpo.senha) delete corpo.senha;
      if (usuarioEditado) await api(`/usuarios/${usuarioEditado.id}`, { method: 'PUT', body: corpo });
      else await api('/usuarios', { method: 'POST', body: corpo });
      aoSalvar();
    } catch (e) {
      setErro(e.message);
    }
  }

  return (
    <Modal titulo={usuarioEditado ? `Editar ${usuarioEditado.nome}` : 'Novo usuário'} largura={700} onFechar={aoFechar}
      rodape={
        <>
          <button className="botao botao-secundario" onClick={aoFechar}>Cancelar</button>
          <button className="botao" onClick={salvar}>Salvar usuário</button>
        </>
      }
    >
      <Erro msg={erro} />
      <div className="linha-campos">
        <Campo rotulo="Nome completo *">
          <input value={f.nome} onChange={(e) => mudar('nome', e.target.value)} placeholder="nome e sobrenome" />
        </Campo>
        <Campo rotulo="E-mail *">
          <input type="email" value={f.email} onChange={(e) => mudar('email', e.target.value)} />
        </Campo>
      </div>
      <div className="linha-campos">
        <Campo rotulo="Telefone *" dica="DDD + número">
          <input value={f.telefone} onChange={(e) => mudar('telefone', e.target.value)} placeholder="(11) 98888-7777" />
        </Campo>
        <Campo rotulo="Número de documento *" dica="CPF é validado; RG/passaporte aceitos">
          <input value={f.documento} onChange={(e) => mudar('documento', e.target.value)} placeholder="CPF, RG ou passaporte" />
        </Campo>
      </div>
      <div className="linha-campos">
        <Campo rotulo={usuarioEditado ? 'Nova senha (vazio = manter) ' : 'Senha *'} dica="mínimo de 6 caracteres">
          <input type="password" value={f.senha} onChange={(e) => mudar('senha', e.target.value)} />
        </Campo>
        <Campo rotulo="Papel (role) *">
          <select value={f.papel} onChange={(e) => mudar('papel', e.target.value)}>
            {PAPEIS.map((p) => <option key={p.valor} value={p.valor}>{p.rotulo}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Ativo" largura={90}>
          <select value={f.ativo ? 1 : 0} onChange={(e) => mudar('ativo', Number(e.target.value))}>
            <option value={1}>Sim</option>
            <option value={0}>Não</option>
          </select>
        </Campo>
      </div>
      {papelInfo && <div className="alerta alerta-info">{papelInfo.rotulo}: {papelInfo.descricao}</div>}
      <h3 style={{ margin: '4px 0 8px', fontSize: 13.5 }}>Dados de funcionário <span className="texto-suave">(usados no custo de mão de obra das linhas)</span></h3>
      <div className="linha-campos">
        <Campo rotulo="Cargo"><input value={f.cargo || ''} onChange={(e) => mudar('cargo', e.target.value)} /></Campo>
        <Campo rotulo="Salário base (R$)"><input type="number" step="any" value={f.salario_base ?? 0} onChange={(e) => mudar('salario_base', e.target.value)} /></Campo>
        <Campo rotulo="Encargos (%)" dica="INSS patronal + FGTS + provisões">
          <input type="number" step="any" value={f.encargos_pct ?? 70} onChange={(e) => mudar('encargos_pct', e.target.value)} />
        </Campo>
      </div>
      <div className="linha-campos">
        <Campo rotulo="Vale-transporte (R$)"><input type="number" step="any" value={f.vale_transporte ?? 0} onChange={(e) => mudar('vale_transporte', e.target.value)} /></Campo>
        <Campo rotulo="Vale-alimentação (R$)"><input type="number" step="any" value={f.vale_alimentacao ?? 0} onChange={(e) => mudar('vale_alimentacao', e.target.value)} /></Campo>
        <Campo rotulo="Outros benefícios (R$)"><input type="number" step="any" value={f.outros_beneficios ?? 0} onChange={(e) => mudar('outros_beneficios', e.target.value)} /></Campo>
        <Campo rotulo="Horas/mês" largura={110}><input type="number" step="any" value={f.horas_mes ?? 220} onChange={(e) => mudar('horas_mes', e.target.value)} /></Campo>
      </div>
      {f.papel !== 'admin' && (
        <Campo rotulo="Empresas com acesso *" dica="obrigatório para gestor e operador">
          <div>
            {empresas.map((e) => (
              <label key={e.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0' }}>
                <input type="checkbox" checked={f.empresa_ids.includes(e.id)} onChange={() => alternarEmpresa(e.id)} />
                {e.nome_fantasia || e.razao_social}
              </label>
            ))}
          </div>
        </Campo>
      )}
    </Modal>
  );
}

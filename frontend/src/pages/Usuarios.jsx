import React from 'react';
import { Users } from 'lucide-react';
import { api } from '../api.js';
import { Badge, Campo, Carregando, Erro, Modal, Vazio, fmtData, fmtDocumento, fmtTelefone, useDados, toast, confirmar } from '../ui.jsx';
import ImportarUsuarios from './ImportarUsuarios.jsx';

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
  const { dados: empresas, recarregar: recarregarEmpresas } = useDados(() => api('/empresas'));
  const { dados: filiais, recarregar: recarregarFiliais } = useDados(() => api('/filiais'));
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

  // Filiais do usuário; com mais de uma empresa, o nome da empresa vai na frente
  function descreverFiliais(u) {
    if (u.papel === 'admin') return <span className="texto-suave">todas</span>;
    const minhas = (filiais || []).filter((f) => (u.filial_ids || []).includes(f.id));
    if (!minhas.length) return <span className="texto-suave">—</span>;
    const variasEmpresas = u.empresa_ids.length > 1;
    return minhas.map((f) => (variasEmpresas ? `${f.empresa_nome} › ${f.nome}` : f.nome)).join(', ');
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
          preservando o histórico. A <strong>filial</strong> é o escopo dentro da empresa (cadastrada em Sistema › Empresas):
          o usuário pode participar de várias.
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
                  <th>Filiais</th>
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
                    <td>{descreverFiliais(u)}</td>
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
          papeis={PAPEIS}
          empresas={empresas || []}
          filiais={filiais || []}
          aoFechar={() => setImportando(false)}
          aoImportar={(qtd) => {
            setImportando(false);
            recarregar();
            recarregarEmpresas(); // a importação pode ter cadastrado empresas e filiais
            recarregarFiliais();
            toast.sucesso(`${qtd} usuário(s) importado(s)`);
          }}
        />
      )}
      {editando && (
        <FormUsuario
          usuarioEditado={editando.novo ? null : editando}
          empresas={empresas || []}
          filiais={filiais || []}
          aoFechar={() => setEditando(null)}
          aoSalvar={() => { setEditando(null); recarregar(); toast.sucesso('Usuário salvo'); }}
        />
      )}
    </>
  );
}

function FormUsuario({ usuarioEditado, empresas, filiais, aoFechar, aoSalvar }) {
  const [f, setF] = React.useState(
    usuarioEditado
      ? { ...usuarioEditado, telefone: usuarioEditado.telefone || '', documento: usuarioEditado.documento || '', senha: '', filial_ids: usuarioEditado.filial_ids || [] }
      : { nome: '', email: '', telefone: '', documento: '', senha: '', papel: 'operador', ativo: 1, empresa_ids: [], filial_ids: [], cargo: '', salario_base: 0, encargos_pct: 70, vale_transporte: 0, vale_alimentacao: 0, outros_beneficios: 0, horas_mes: 220 },
  );
  const [erro, setErro] = React.useState(null);
  const mudar = (campo, valor) => setF((s) => ({ ...s, [campo]: valor }));
  const papelInfo = PAPEIS.find((p) => p.valor === f.papel);

  // Desmarcar a empresa também desmarca as filiais dela — filial é escopo da empresa
  function alternarEmpresa(id) {
    setF((s) => {
      const sai = s.empresa_ids.includes(id);
      return {
        ...s,
        empresa_ids: sai ? s.empresa_ids.filter((x) => x !== id) : [...s.empresa_ids, id],
        filial_ids: sai ? s.filial_ids.filter((fid) => filiais.find((x) => x.id === fid)?.empresa_id !== id) : s.filial_ids,
      };
    });
  }

  function alternarFilial(id) {
    setF((s) => ({
      ...s,
      filial_ids: s.filial_ids.includes(id) ? s.filial_ids.filter((x) => x !== id) : [...s.filial_ids, id],
    }));
  }

  // Filiais oferecidas: as ativas das empresas marcadas (mais inativas já vinculadas)
  const filiaisPorEmpresa = empresas
    .filter((e) => f.empresa_ids.includes(e.id))
    .map((e) => ({ empresa: e, filiais: filiais.filter((x) => x.empresa_id === e.id && (x.ativa || f.filial_ids.includes(x.id))) }))
    .filter((g) => g.filiais.length);

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
        <div className="linha-campos">
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
          <Campo rotulo="Filiais em que participa" dica="escopo dentro da empresa; pode marcar várias">
            {!filiaisPorEmpresa.length ? (
              <div className="texto-suave" style={{ padding: '4px 0' }}>
                {f.empresa_ids.length
                  ? 'As empresas marcadas não têm filial cadastrada (Sistema › Empresas).'
                  : 'Marque uma empresa para ver as filiais dela.'}
              </div>
            ) : filiaisPorEmpresa.map((g) => (
              <div key={g.empresa.id} style={{ padding: '2px 0 6px' }}>
                {filiaisPorEmpresa.length > 1 && (
                  <div className="texto-suave" style={{ fontSize: 12, padding: '2px 0' }}>{g.empresa.nome_fantasia || g.empresa.razao_social}</div>
                )}
                {g.filiais.map((x) => (
                  <label key={x.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0', opacity: x.ativa ? 1 : 0.6 }}>
                    <input type="checkbox" checked={f.filial_ids.includes(x.id)} onChange={() => alternarFilial(x.id)} />
                    {x.nome}
                    {x.codigo ? <span className="texto-suave"> · {x.codigo}</span> : null}
                    {!x.ativa && <span className="texto-suave"> (inativa)</span>}
                  </label>
                ))}
              </div>
            ))}
          </Campo>
        </div>
      )}
    </Modal>
  );
}

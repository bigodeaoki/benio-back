import React from 'react';
import { api } from '../api.js';
import { Campo, Carregando, Erro, Modal, Vazio, fmtData, useDados } from '../ui.jsx';

const PAPEIS = [
  { valor: 'admin', rotulo: 'Admin', descricao: 'Acesso total: usuários, empresas, configurações fiscais, colaboradores e todas as operações.' },
  { valor: 'producao', rotulo: 'Produção', descricao: 'Linhas de processo, utilidades, fórmulas/produtos, matérias-primas, ordens de produção (PCP/MRP) e movimentos de estoque.' },
  { valor: 'qualidade', rotulo: 'Qualidade', descricao: 'Fórmulas/produtos (especificações) e controle de documentos (editar, obsoletar e reativar).' },
  { valor: 'compras', rotulo: 'Compras', descricao: 'Matérias-primas (preços e estoque mínimo) e movimentos de estoque (entradas de compra).' },
  { valor: 'vendas', rotulo: 'Vendas', descricao: 'Pedidos, geração de ordens de produção a partir de pedidos e emissão de NF-e.' },
  { valor: 'operador', rotulo: 'Operador', descricao: 'Apontamentos de produção (status das OPs), movimentos de estoque e consultas gerais.' },
];

export default function Usuarios({ usuario }) {
  const ehAdmin = usuario?.papel === 'admin';
  const { dados, erro, carregando, recarregar } = useDados(() => api('/usuarios'));
  const { dados: empresas } = useDados(() => api('/empresas'));
  const [editando, setEditando] = React.useState(null);
  const [msg, setMsg] = React.useState(null);

  if (!ehAdmin) {
    return <div className="cartao"><Vazio msg="Apenas administradores acessam a gestão de usuários" /></div>;
  }

  async function excluir(u) {
    if (!confirm(`Remover o usuário ${u.nome}? Ele perderá o acesso ao sistema.`)) return;
    try {
      await api(`/usuarios/${u.id}`, { method: 'DELETE' });
      recarregar();
    } catch (e) {
      setMsg(e.message);
    }
  }

  return (
    <>
      <div className="cartao">
        <div className="cartao-cabecalho">
          <h3>Usuários do sistema</h3>
          <button className="botao" onClick={() => setEditando({ novo: true })}>+ Novo usuário</button>
        </div>
        <div className="alerta alerta-info">
          Todos os campos do cadastro são obrigatórios — o <strong>papel</strong> define as restrições de acesso:
          {' '}{PAPEIS.map((p) => p.rotulo).join(' · ')}.
        </div>
        <Erro msg={erro || msg} />
        {carregando ? <Carregando /> : !dados?.length ? <Vazio /> : (
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
                  <th>Ativo</th>
                  <th>Criado em</th>
                  <th className="acoes">Ações</th>
                </tr>
              </thead>
              <tbody>
                {dados.map((u) => (
                  <tr key={u.id} style={u.ativo ? undefined : { opacity: 0.55 }}>
                    <td className="negrito">{u.nome}</td>
                    <td>{u.email}</td>
                    <td>{u.telefone || <span className="texto-suave">pendente</span>}</td>
                    <td className="mono">{u.documento || <span className="texto-suave">pendente</span>}</td>
                    <td><span className="badge badge-azul">{PAPEIS.find((p) => p.valor === u.papel)?.rotulo || u.papel}</span></td>
                    <td>
                      {u.papel === 'admin'
                        ? <span className="texto-suave">todas</span>
                        : (empresas || []).filter((e) => u.empresa_ids.includes(e.id)).map((e) => e.nome_fantasia || e.razao_social).join(', ') || '—'}
                    </td>
                    <td>{u.ativo ? 'Sim' : 'Não'}</td>
                    <td>{fmtData(u.criado_em)}</td>
                    <td className="acoes">
                      <button className="botao botao-secundario botao-mini" onClick={() => setEditando(u)}>Editar</button>
                      {u.id !== usuario.id && (
                        <button className="botao botao-perigo botao-mini" onClick={() => excluir(u)}>Excluir</button>
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
        <FormUsuario
          usuarioEditado={editando.novo ? null : editando}
          empresas={empresas || []}
          aoFechar={() => setEditando(null)}
          aoSalvar={() => { setEditando(null); recarregar(); }}
        />
      )}
    </>
  );
}

function FormUsuario({ usuarioEditado, empresas, aoFechar, aoSalvar }) {
  const [f, setF] = React.useState(
    usuarioEditado
      ? { ...usuarioEditado, telefone: usuarioEditado.telefone || '', documento: usuarioEditado.documento || '', senha: '' }
      : { nome: '', email: '', telefone: '', documento: '', senha: '', papel: 'operador', ativo: 1, empresa_ids: [] },
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

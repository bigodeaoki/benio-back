import React from 'react';
import { Building2 } from 'lucide-react';
import { api } from '../api.js';
import { Badge, Campo, Carregando, Erro, Modal, Vazio, fmtNum, useDados, toast, confirmar } from '../ui.jsx';

const REGIMES = [
  { valor: 'simples', rotulo: 'Simples Nacional' },
  { valor: 'presumido', rotulo: 'Lucro Presumido' },
  { valor: 'real', rotulo: 'Lucro Real' },
];

export default function Empresas({ usuario }) {
  const ehAdmin = usuario?.papel === 'admin';
  const { dados, erro, carregando, recarregar } = useDados(() => api('/empresas'));
  const { dados: ufs } = useDados(() => api('/fiscal/icms'));
  const { dados: filiais, recarregar: recarregarFiliais } = useDados(() => api('/filiais'));
  const [editando, setEditando] = React.useState(null);
  const [expandida, setExpandida] = React.useState(null);
  const [filialEditando, setFilialEditando] = React.useState(null); // { empresa, filial? }
  const [msg, setMsg] = React.useState(null);

  async function excluir(e) {
    if (!(await confirmar({ titulo: 'Remover empresa', mensagem: `Remover ${e.razao_social}? TODOS os dados dela (pedidos, fórmulas, estoque, documentos) serão apagados.`, confirmarTexto: 'Excluir tudo', perigo: true }))) return;
    try {
      await api(`/empresas/${e.id}`, { method: 'DELETE' });
      recarregar();
      toast.sucesso(`Empresa ${e.razao_social} removida`);
    } catch (err) {
      toast.erro(err.message);
    }
  }

  // Filial não é excluída — inativa-se, porque vai referenciar auditoria
  async function alterarAtiva(filial, ativa) {
    const aceitou = await confirmar({
      titulo: ativa ? 'Reativar filial' : 'Inativar filial',
      mensagem: ativa
        ? `Reativar a filial ${filial.nome}?`
        : `Inativar ${filial.nome}? Ela deixa de ser oferecida no cadastro de usuários; quem já está vinculado continua.`,
      confirmarTexto: ativa ? 'Reativar' : 'Inativar',
      perigo: !ativa,
    });
    if (!aceitou) return;
    try {
      await api(`/filiais/${filial.id}/ativa`, { method: 'PUT', body: { ativa } });
      recarregarFiliais();
      toast.sucesso(ativa ? `Filial ${filial.nome} reativada` : `Filial ${filial.nome} inativada`);
    } catch (err) {
      toast.erro(err.message);
    }
  }

  const filiaisDe = (empresaId) => (filiais || []).filter((f) => f.empresa_id === empresaId);

  return (
    <>
      <div className="cartao">
        <div className="cartao-cabecalho">
          <h3><Building2 size={15} className="icone-cartao" />Empresas do grupo</h3>
          {ehAdmin && <button className="botao" onClick={() => setEditando({ novo: true })}>+ Nova empresa</button>}
        </div>
        <div className="alerta alerta-info">
          Cada usuário acessa apenas as empresas às quais está vinculado (definido na aba <strong>Usuários</strong>);
          admins acessam todas. A empresa ativa é trocada no seletor do topo. No <strong>+</strong> da linha ficam as
          {' '}<strong>filiais</strong> da empresa (matriz, unidades, plantas): um escopo dentro dela em que cada usuário
          pode participar — base para auditoria. O <strong>regime tributário</strong> define
          os impostos do cálculo de preço: Simples Nacional (alíquota efetiva do DAS), Lucro Presumido (PIS 0,65% +
          COFINS 3%) ou Lucro Real (PIS 1,65% + COFINS 7,6%), sempre com ICMS por UF e IPI por NCM.
        </div>
        <Erro msg={erro || msg} />
        {carregando ? <Carregando /> : !dados?.length ? <Vazio /> : (
          <div className="tabela-envolucro">
            <table className="tabela">
              <thead>
                <tr>
                  <th style={{ width: 34 }}></th>
                  <th>Razão social</th>
                  <th>Nome fantasia</th>
                  <th>CNPJ</th>
                  <th>UF</th>
                  <th>Município</th>
                  <th>Regime</th>
                  <th className="num">Filiais</th>
                  <th className="num">Alíq. Simples</th>
                  {ehAdmin && <th className="acoes">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {dados.map((e) => (
                  <React.Fragment key={e.id}>
                    <tr>
                      <td>
                        <button
                          className="botao botao-secundario botao-mini"
                          style={{ width: 26, height: 26, padding: 0, justifyContent: 'center', lineHeight: 1 }}
                          title={expandida === e.id ? 'Ocultar filiais' : 'Ver filiais desta empresa'}
                          onClick={() => setExpandida(expandida === e.id ? null : e.id)}
                        >
                          {expandida === e.id ? '−' : '+'}
                        </button>
                      </td>
                      <td className="negrito">{e.razao_social}</td>
                      <td>{e.nome_fantasia || '—'}</td>
                      <td className="mono">{e.cnpj || '—'}</td>
                      <td>{e.uf}</td>
                      <td>{e.municipio || '—'}</td>
                      <td>{REGIMES.find((r) => r.valor === e.regime)?.rotulo}</td>
                      <td className="num">{filiaisDe(e.id).filter((f) => f.ativa).length || <span className="texto-suave">—</span>}</td>
                      <td className="num">{e.regime === 'simples' ? `${fmtNum(e.aliquota_simples)}%` : '—'}</td>
                      {ehAdmin && (
                        <td className="acoes">
                          <button className="botao botao-secundario botao-mini" onClick={() => setEditando(e)}>Editar</button>
                          <button className="botao botao-perigo botao-mini" onClick={() => excluir(e)}>Excluir</button>
                        </td>
                      )}
                    </tr>
                    {expandida === e.id && (
                      <tr>
                        <td colSpan={ehAdmin ? 10 : 9} style={{ background: '#f8fafc' }}>
                          <Filiais
                            empresa={e}
                            filiais={filiaisDe(e.id)}
                            ehAdmin={ehAdmin}
                            aoNova={() => setFilialEditando({ empresa: e })}
                            aoEditar={(f) => setFilialEditando({ empresa: e, filial: f })}
                            aoAlterarAtiva={alterarAtiva}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {editando && (
        <FormEmpresa
          empresa={editando.novo ? null : editando}
          ufs={ufs || []}
          aoFechar={() => setEditando(null)}
          aoSalvar={() => { setEditando(null); recarregar(); toast.sucesso('Empresa salva'); }}
        />
      )}
      {filialEditando && (
        <FormFilial
          empresa={filialEditando.empresa}
          filial={filialEditando.filial || null}
          ufs={ufs || []}
          aoFechar={() => setFilialEditando(null)}
          aoSalvar={() => {
            setExpandida(filialEditando.empresa.id);
            setFilialEditando(null);
            recarregarFiliais();
            toast.sucesso('Filial salva');
          }}
        />
      )}
    </>
  );
}

function FormEmpresa({ empresa, ufs, aoFechar, aoSalvar }) {
  const [f, setF] = React.useState(
    empresa || {
      razao_social: '', nome_fantasia: '', cnpj: '', ie: '', uf: 'SP',
      municipio: '', endereco: '', regime: 'presumido', aliquota_simples: 6,
    },
  );
  const [erro, setErro] = React.useState(null);
  const [buscando, setBuscando] = React.useState(false);
  const mudar = (campo, valor) => setF((s) => ({ ...s, [campo]: valor }));

  async function buscarCnpj() {
    setBuscando(true);
    setErro(null);
    try {
      const d = await api(`/integracao/cnpj/${String(f.cnpj).replace(/[^0-9A-Za-z]/g, '')}`);
      setF((s) => ({
        ...s,
        razao_social: d.razao_social || s.razao_social,
        nome_fantasia: d.nome_fantasia || s.nome_fantasia,
        uf: d.uf || s.uf,
        municipio: d.municipio || s.municipio,
        endereco: d.endereco || s.endereco,
      }));
    } catch (e) {
      setErro(`Consulta CNPJ: ${e.message}`);
    } finally {
      setBuscando(false);
    }
  }

  async function salvar() {
    setErro(null);
    const doc = String(f.cnpj || '').replace(/[.\-\/\s]/g, '');
    if (doc && doc.length !== 14) {
      setErro(`CNPJ inválido: deve ter 14 caracteres sem pontuação — o informado tem ${doc.length}`);
      return;
    }
    try {
      if (empresa) await api(`/empresas/${empresa.id}`, { method: 'PUT', body: f });
      else await api('/empresas', { method: 'POST', body: f });
      aoSalvar();
    } catch (e) {
      setErro(e.message);
    }
  }

  return (
    <Modal titulo={empresa ? `Editar ${empresa.razao_social}` : 'Nova empresa'} largura={700} onFechar={aoFechar}
      rodape={
        <>
          <button className="botao botao-secundario" onClick={aoFechar}>Cancelar</button>
          <button className="botao" onClick={salvar}>Salvar</button>
        </>
      }
    >
      <Erro msg={erro} />
      <div className="linha-campos">
        <Campo rotulo="CNPJ" largura={200}>
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={f.cnpj || ''} onChange={(e) => mudar('cnpj', e.target.value)} placeholder="somente números" />
            <button className="botao botao-secundario" onClick={buscarCnpj} disabled={buscando} title="Buscar na Receita Federal (BrasilAPI)">
              {buscando ? '…' : '🔎'}
            </button>
          </div>
        </Campo>
        <Campo rotulo="Inscrição estadual"><input value={f.ie || ''} onChange={(e) => mudar('ie', e.target.value)} /></Campo>
      </div>
      <div className="linha-campos">
        <Campo rotulo="Razão social *"><input value={f.razao_social} onChange={(e) => mudar('razao_social', e.target.value)} /></Campo>
        <Campo rotulo="Nome fantasia"><input value={f.nome_fantasia || ''} onChange={(e) => mudar('nome_fantasia', e.target.value)} /></Campo>
      </div>
      <div className="linha-campos">
        <Campo rotulo="UF" largura={90}>
          <select value={f.uf} onChange={(e) => mudar('uf', e.target.value)}>
            {ufs.map((u) => <option key={u.uf} value={u.uf}>{u.uf}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Município"><input value={f.municipio || ''} onChange={(e) => mudar('municipio', e.target.value)} /></Campo>
        <Campo rotulo="Endereço"><input value={f.endereco || ''} onChange={(e) => mudar('endereco', e.target.value)} /></Campo>
      </div>
      <div className="linha-campos">
        <Campo rotulo="Regime tributário">
          <select value={f.regime} onChange={(e) => mudar('regime', e.target.value)}>
            {REGIMES.map((r) => <option key={r.valor} value={r.valor}>{r.rotulo}</option>)}
          </select>
        </Campo>
        {f.regime === 'simples' && (
          <Campo rotulo="Alíquota efetiva do DAS (%)" dica="conforme anexo e faixa de faturamento">
            <input type="number" step="any" value={f.aliquota_simples} onChange={(e) => mudar('aliquota_simples', e.target.value)} />
          </Campo>
        )}
      </div>
    </Modal>
  );
}

/* ---------------------- Filiais da empresa ---------------------- */

function Filiais({ empresa, filiais, ehAdmin, aoNova, aoEditar, aoAlterarAtiva }) {
  return (
    <div style={{ padding: '10px 6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <strong style={{ fontSize: 13 }}>Filiais de {empresa.nome_fantasia || empresa.razao_social}</strong>
        <span className="texto-suave" style={{ flex: 1 }}>escopo dentro da empresa — o usuário é vinculado a elas em Sistema › Usuários</span>
        {ehAdmin && <button className="botao botao-mini" onClick={aoNova}>+ Nova filial</button>}
      </div>
      {!filiais.length ? (
        <div className="texto-suave">Nenhuma filial cadastrada — a empresa funciona sem filiais; cadastre quando quiser separar por unidade.</div>
      ) : (
        <table className="tabela">
          <thead>
            <tr>
              <th>Filial</th>
              <th>Código</th>
              <th>Município</th>
              <th>UF</th>
              <th className="num">Usuários</th>
              <th>Status</th>
              {ehAdmin && <th className="acoes">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {filiais.map((f) => (
              <tr key={f.id} style={f.ativa ? undefined : { opacity: 0.55 }}>
                <td className="negrito">{f.nome}</td>
                <td className="mono">{f.codigo || '—'}</td>
                <td>{f.municipio || '—'}</td>
                <td>{f.uf || '—'}</td>
                <td className="num">{f.usuarios}</td>
                <td><Badge valor={f.ativa ? 'ativa_filial' : 'inativa_filial'} /></td>
                {ehAdmin && (
                  <td className="acoes">
                    <button className="botao botao-secundario botao-mini" onClick={() => aoEditar(f)}>Editar</button>
                    {f.ativa ? (
                      <button className="botao botao-perigo botao-mini" onClick={() => aoAlterarAtiva(f, false)} title="Some do cadastro de usuários; vínculos preservados">
                        Inativar
                      </button>
                    ) : (
                      <button className="botao botao-secundario botao-mini" onClick={() => aoAlterarAtiva(f, true)}>Reativar</button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function FormFilial({ empresa, filial, ufs, aoFechar, aoSalvar }) {
  const [f, setF] = React.useState(
    filial
      ? { nome: filial.nome, codigo: filial.codigo || '', municipio: filial.municipio || '', uf: filial.uf || '' }
      : { nome: '', codigo: '', municipio: '', uf: empresa.uf || '' },
  );
  const [erro, setErro] = React.useState(null);
  const mudar = (campo, valor) => setF((s) => ({ ...s, [campo]: valor }));

  async function salvar() {
    setErro(null);
    if (f.nome.trim().length < 2) return setErro('Informe o nome da filial');
    try {
      if (filial) await api(`/filiais/${filial.id}`, { method: 'PUT', body: f });
      else await api('/filiais', { method: 'POST', body: { ...f, empresa_id: empresa.id } });
      aoSalvar();
    } catch (e) {
      setErro(e.message);
    }
  }

  return (
    <Modal
      titulo={filial ? `Editar filial ${filial.nome}` : `Nova filial — ${empresa.nome_fantasia || empresa.razao_social}`}
      largura={560}
      onFechar={aoFechar}
      rodape={
        <>
          <button className="botao botao-secundario" onClick={aoFechar}>Cancelar</button>
          <button className="botao" onClick={salvar}>Salvar filial</button>
        </>
      }
    >
      <Erro msg={erro} />
      <div className="linha-campos">
        <Campo rotulo="Nome da filial *" dica="ex.: Matriz, Filial Guarulhos, Planta 2">
          <input value={f.nome} onChange={(e) => mudar('nome', e.target.value)} />
        </Campo>
        <Campo rotulo="Código" largura={140} dica="opcional; ex.: 0002, SP-01">
          <input value={f.codigo} onChange={(e) => mudar('codigo', e.target.value)} />
        </Campo>
      </div>
      <div className="linha-campos">
        <Campo rotulo="Município"><input value={f.municipio} onChange={(e) => mudar('municipio', e.target.value)} /></Campo>
        <Campo rotulo="UF" largura={90}>
          <select value={f.uf} onChange={(e) => mudar('uf', e.target.value)}>
            <option value="">—</option>
            {ufs.map((u) => <option key={u.uf} value={u.uf}>{u.uf}</option>)}
          </select>
        </Campo>
      </div>
    </Modal>
  );
}

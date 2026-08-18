import React from 'react';
import { api } from '../api.js';
import { Erro, LogoGrimorium } from '../ui.jsx';

export default function Login({ aoEntrar }) {
  const [email, setEmail] = React.useState('admin@grimorium.com');
  const [senha, setSenha] = React.useState('');
  const [erro, setErro] = React.useState(null);
  const [enviando, setEnviando] = React.useState(false);

  async function entrar(e) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      const dados = await api('/auth/login', { method: 'POST', body: { email, senha } });
      aoEntrar(dados);
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="login-fundo">
      <form className="login-cartao" onSubmit={entrar}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="logo-marca"><LogoGrimorium size={20} /></span>
          Grimorium
        </h1>
        <p className="subtitulo">Custos de produção, precificação e gestão industrial</p>
        <Erro msg={erro} />
        <label className="campo">
          <span className="campo-rotulo">E-mail</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </label>
        <label className="campo">
          <span className="campo-rotulo">Senha</span>
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} />
        </label>
        <button className="botao" style={{ width: '100%', justifyContent: 'center' }} disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
        <div className="login-demo">
          Acesso inicial: <strong>admin@grimorium.com</strong> / senha <strong>admin123</strong>
        </div>
      </form>
    </div>
  );
}

// Cliente HTTP com token JWT e empresa ativa (multiempresa)
const sessao = {
  token: localStorage.getItem('scientia_token') || null,
  empresaId: Number(localStorage.getItem('scientia_empresa')) || null,
};

export function getEmpresaId() {
  return sessao.empresaId;
}

export function setSessao(token, empresaId) {
  sessao.token = token;
  sessao.empresaId = empresaId;
  if (token) localStorage.setItem('scientia_token', token);
  if (empresaId) localStorage.setItem('scientia_empresa', String(empresaId));
}

export function limparSessao() {
  sessao.token = null;
  sessao.empresaId = null;
  localStorage.removeItem('scientia_token');
  localStorage.removeItem('scientia_empresa');
}

export async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (sessao.token) headers.Authorization = `Bearer ${sessao.token}`;
  if (sessao.empresaId) headers['X-Empresa-Id'] = String(sessao.empresaId);
  const resp = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (resp.status === 401) {
    limparSessao();
    window.dispatchEvent(new Event('scientia:logout'));
    throw new Error('Sessão expirada — faça login novamente');
  }
  const dados = await resp.json().catch(() => null);
  if (!resp.ok) {
    const msg = Array.isArray(dados?.message) ? dados.message.join('; ') : dados?.message;
    throw new Error(msg || `Erro ${resp.status}`);
  }
  return dados;
}

// Downloads (Excel/PDF/XML) autenticam via query string
export function urlDownload(path) {
  const sep = path.includes('?') ? '&' : '?';
  return `/api${path}${sep}token=${encodeURIComponent(sessao.token || '')}&empresa=${sessao.empresaId || ''}`;
}

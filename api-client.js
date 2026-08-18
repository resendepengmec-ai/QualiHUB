// ── api-client.js (QualiHUB) ──────────────────────────────────────
// Mesma mecânica do SGM: JWT em sessionStorage + Authorization: Bearer.
// Diferença: o papel é POR CONTRATO. O /auth/me devolve a lista de acessos
// (contrato→papel); o app mantém um "contrato atual" selecionado e resolve o
// papel a partir dele.

const QUALI_API_URL = (() => {
  if (typeof window.QUALI_API !== 'undefined' && window.QUALI_API) return window.QUALI_API;
  const stored = localStorage.getItem('quali_api_url');
  if (stored) return stored;
  return ''; // mesmo origin
})();

const SESSION_KEY   = 'quali_jwt';
const CLIENT_ID_KEY = 'quali_client_id';
const CONTRATO_KEY  = 'quali_contrato';

// Papéis por contrato (metadados de UI). O papel real é sempre validado no
// backend; aqui é só rótulo/cor e o que cada um enxerga na navegação.
const PAPEIS = {
  administrador: { label: 'Administrador do contrato', cor: 'var(--primary)', pode: { cadastro: true,  acessos: true,  funcionarios: true, criarOc: true, resolver: true } },
  fiscal:        { label: 'Fiscal do contrato',        cor: '#5b47b0',        pode: { cadastro: false, acessos: false, funcionarios: false, criarOc: true, resolver: true } },
  gestor:        { label: 'Gestor do contrato',        cor: '#0284c7',        pode: { cadastro: false, acessos: false, funcionarios: true,  criarOc: true, resolver: true } },
  executor:      { label: 'Executor',                  cor: '#0e7c66',        pode: { cadastro: false, acessos: false, funcionarios: false, criarOc: true, resolver: true } },
};

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── HTTP ──────────────────────────────────────────────────────────
async function _call(method, path, body) {
  const token   = sessionStorage.getItem(SESSION_KEY);
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${QUALI_API_URL}/api${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  let json;
  try { json = await res.json(); }
  catch (e) { throw new Error(`O servidor não respondeu corretamente (status ${res.status}). Tente novamente em instantes.`); }
  if (!json.ok) { const e = new Error(json.error || `Erro ${res.status}`); e.status = res.status; throw e; }
  return json.data;
}
const API = {
  get: p => _call('GET', p), post: (p, b) => _call('POST', p, b),
  patch: (p, b) => _call('PATCH', p, b), delete: (p, b) => _call('DELETE', p, b),
};

// ── Sessão ────────────────────────────────────────────────────────
let _user = null;      // { id,email,role,name,picture }
let _acessos = [];     // [{ contratoId, papel }]

function _decodeJWT(token) {
  try {
    const p = JSON.parse(atob(token.split('.')[1]));
    if (Date.now() / 1000 > p.exp) return null;
    return { id: p.id, email: p.email, role: p.role, name: p.name, picture: p.picture };
  } catch { return null; }
}
function getCurrentUser() {
  if (_user) return _user;
  const token = sessionStorage.getItem(SESSION_KEY);
  if (!token) return null;
  _user = _decodeJWT(token);
  return _user;
}
function isMaster() { const u = getCurrentUser(); return u?.role === 'admin_master'; }
function saveSession(token, user) { sessionStorage.setItem(SESSION_KEY, token); _user = user; }

// Carrega perfil + acessos do backend (fonte da verdade do papel por contrato).
async function refreshMe() {
  const me = await API.get('/auth/me');
  _user = { id: me.id, email: me.email, role: me.role, name: me.name, picture: me.picture };
  _acessos = Array.isArray(me.acessos) ? me.acessos : [];
  return me;
}
function getAcessos() { return _acessos; }
function papelNoContrato(contratoId) {
  if (isMaster()) return 'administrador';
  const a = _acessos.find(x => x.contratoId === contratoId);
  return a ? a.papel : null;
}

// ── Contrato atual (seletor global) ───────────────────────────────
function getContratoAtual() { return localStorage.getItem(CONTRATO_KEY) || ''; }
function setContratoAtual(id) { if (id) localStorage.setItem(CONTRATO_KEY, id); else localStorage.removeItem(CONTRATO_KEY); }
function papelAtual() { const c = getContratoAtual(); return c ? papelNoContrato(c) : (isMaster() ? 'administrador' : null); }
function podeAtual(cap) { const p = papelAtual(); return p ? !!(PAPEIS[p]?.pode?.[cap]) : false; }

async function logout() {
  try { await API.post('/auth/logout', {}); } catch (e) {}
  sessionStorage.removeItem(SESSION_KEY); _user = null; _acessos = [];
  window.location.href = 'index.html';
}
// Guarda de página: manda pro login se não houver sessão válida.
function requireSession() {
  if (!getCurrentUser()) { window.location.href = 'index.html'; return false; }
  return true;
}

// ── Google OAuth (fluxo implícito, igual ao SGM) ──────────────────
async function fetchClientId() {
  let clientId = localStorage.getItem(CLIENT_ID_KEY);
  if (clientId) return clientId;
  try {
    const res  = await fetch(`${QUALI_API_URL}/api/auth/config/public`);
    const json = await res.json();
    if (json.ok && json.data.clientId) { clientId = json.data.clientId; localStorage.setItem(CLIENT_ID_KEY, clientId); }
  } catch (e) {}
  return clientId;
}
async function startGoogleLogin() {
  const clientId = await fetchClientId();
  if (!clientId) throw new Error('Client ID do Google não configurado. Defina GOOGLE_CLIENT_ID no backend ou informe abaixo.');
  const base   = location.origin + location.pathname.replace(/\/[^/]*$/, '/');
  const params = new URLSearchParams({
    client_id: clientId, redirect_uri: base + 'auth-callback.html',
    response_type: 'token', scope: 'openid email profile',
    include_granted_scopes: 'true', prompt: 'select_account',
  });
  window.location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + params;
}
async function loginWithGoogleToken(googleToken) {
  const data = await API.post('/auth/google', { googleToken });
  saveSession(data.token, data.user);
  return data.user;
}

// ── Data API ──────────────────────────────────────────────────────
const DB = {
  me:                 ()      => API.get('/auth/me'),
  setClientId:        (id)    => API.post('/auth/config/client-id', { clientId: id }),

  // Estabelecimentos
  getEstabelecimentos:()      => API.get('/estabelecimentos'),
  saveEstabelecimento:(e)     => API.post('/estabelecimentos', { estabelecimento: e }),

  // Contratos
  getContratos:       ()      => API.get('/contratos'),
  getContrato:        (id)    => API.get(`/contratos/${id}`),
  saveContrato:       (c)     => API.post('/contratos', { contrato: c }),
  deleteContrato:     (id)    => API.delete(`/contratos/${id}`),

  // Acessos (whitelist do contrato)
  getMembros:         (cid)   => API.get(`/contratos/${cid}/membros`),
  getAcessos:         (cid)   => API.get(`/contratos/${cid}/acessos`),
  addAcesso:          (cid, a) => API.post(`/contratos/${cid}/acessos`, a),
  removeAcesso:       (acessoId, contratoId) => API.delete(`/acessos/${acessoId}`, { contratoId }),

  // Funcionários (saúde ocupacional)
  getFuncionarios:    (cid)   => API.get(`/contratos/${cid}/funcionarios`),
  saveFuncionario:    (cid, f) => API.post(`/contratos/${cid}/funcionarios`, { funcionario: f }),
  removeFuncionario:  (id)    => API.delete(`/funcionarios/${id}`),

  // Ocorrências
  getOcorrenciasContrato: (cid) => API.get(`/contratos/${cid}/ocorrencias`),
  getAtribuidas:      ()      => API.get('/ocorrencias/atribuidas'),
  getCriadas:         ()      => API.get('/ocorrencias/criadas'),
  criarOcorrencia:    (o)     => API.post('/ocorrencias', { ocorrencia: o }),
  iniciarOcorrencia:  (id)    => API.patch(`/ocorrencias/${id}/iniciar`, {}),
  resolverOcorrencia: (id, r) => API.patch(`/ocorrencias/${id}/resolver`, r),

  // Dashboard
  getStats:           (cid)   => API.get('/stats' + (cid ? `?contrato=${cid}` : '')),
  getRelatorioOcorrencias: (q) => API.get('/relatorios/ocorrencias' + (q ? `?${q}` : '')),

  // Perfil da empresa (cabeçalho dos PDFs)
  getPerfil:          ()      => API.get('/perfil'),
  savePerfil:         (p)     => API.post('/perfil', { perfil: p }),

  // P.A.C.
  getPlanilhaTipos:       ()        => API.get('/planilha-tipos'),
  getPlanilhasDoContrato: (cid)     => API.get(`/contratos/${cid}/planilhas`),
  getRegistrosPac:        (cid, t)  => API.get(`/contratos/${cid}/pac` + (t ? `?planilha=${t}` : '')),
  criarRegistroPac:       (r)       => API.post('/pac', { registro: r }),
  decidirRegistroPac:     (id, aprovado, observacao) => API.patch(`/pac/${id}/decidir`, { aprovado, observacao }),

  // Equipamentos / controle de temperatura
  getEquipamentos:        (cid)     => API.get(`/contratos/${cid}/equipamentos`),
  saveEquipamento:        (cid, e)  => API.post(`/contratos/${cid}/equipamentos`, { equipamento: e }),
  removeEquipamento:      (id)      => API.delete(`/equipamentos/${id}`),
  regenerarTokenEquip:    (id)      => API.post(`/equipamentos/${id}/regenerar-token`, {}),
  criarTemperatura:       (contratoId, leituras) => API.post('/pac/temperatura', { contratoId, leituras }),

  // Plataforma (SaaS) — administradores de cliente (só master)
  getPlatformAdmins:  ()      => API.get('/platform/admins'),
  getPlatformTree:    ()      => API.get('/platform/tree'),
  addPlatformAdmin:   (a)     => API.post('/platform/admins', a),
  removePlatformAdmin:(email) => API.delete(`/platform/admins/${encodeURIComponent(email)}`),

  // Assinaturas
  verifySignatures:   (id)    => API.get(`/sign/${id}/verify`),
};

// ── Utilidades de status (usadas em Ocorrências e Dashboard) ──────
// Classifica uma ocorrência: em dia / vencendo / atrasada / concluída.
function statusOcorrencia(o) {
  if (o.estado === 'concluida') {
    return o.atendidaComAtraso ? { key: 'atraso', label: 'Concluída com atraso' }
                               : { key: 'ok',     label: 'Concluída no prazo' };
  }
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  if (o.prazoCorrecao) {
    const prazo = new Date(o.prazoCorrecao + 'T00:00:00');
    const dias  = Math.round((prazo - hoje) / 86400000);
    if (dias < 0)  return { key: 'vencida',  label: `Vencida há ${-dias}d` };
    if (dias <= 2) return { key: 'vencendo', label: dias === 0 ? 'Vence hoje' : `Vence em ${dias}d` };
  }
  return { key: 'aberta', label: 'Em aberto' };
}
const GRAVIDADES = ['baixa', 'média', 'alta', 'crítica'];

// Regimes de inspeção (o conjunto de planilhas do P.A.C. depende deles).
const REGIMES = [
  { key: 'varejo_rdc216', label: 'Varejo (RDC 216 / Anvisa)', curto: 'RDC216' },
  { key: 'sie_agrodefesa', label: 'SIE (Agrodefesa)', curto: 'SIE' },
  { key: 'sif', label: 'SIF (Federal)', curto: 'SIF' },
  { key: 'sim_municipal', label: 'SIM (Municipal)', curto: 'SIM' },
];
const REGIME_LABEL = Object.fromEntries(REGIMES.map(r => [r.key, r]));
const NATUREZAS = { produto: 'Produto', meio: 'Meio', saude: 'Saúde ocupacional' };
const CLASSIFICACOES = [
  { key: 'restaurante', label: 'Restaurante' },
  { key: 'lanchonete', label: 'Lanchonete' },
  { key: 'padaria', label: 'Padaria / Confeitaria' },
  { key: 'supermercado', label: 'Supermercado / Mercearia' },
  { key: 'acougue', label: 'Açougue' },
  { key: 'salgadeira', label: 'Salgadeira / Cozinha industrial' },
  { key: 'distribuidora', label: 'Distribuidora' },
  { key: 'outro', label: 'Outro' },
];
const CLASSIFICACAO_LABEL = Object.fromEntries(CLASSIFICACOES.map(c => [c.key, c.label]));
const CATEGORIAS_EQUIP = { camara_fria: 'Câmara fria', freezer: 'Freezer', balcao: 'Balcão', sala_manipulacao: 'Sala de manipulação', expositor: 'Expositor', outro: 'Outro' };
const IOT_ENDPOINT = QUALI_API_URL + '/api/iot/leitura';

// ── Captura de foto com rótulo de data/hora + geolocalização ──────
// Helper ÚNICO para TODOS os módulos (ocorrências e demais). Ao capturar,
// pega a localização do dispositivo e QUEIMA o rótulo na própria imagem, no
// espírito da última rodada do SGM — assim o carimbo viaja junto pro PDF.
let _lastPos = null, _lastPosAt = 0;
function _getPos() {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve(null);
    if (_lastPos && Date.now() - _lastPosAt < 60000) return resolve(_lastPos); // reusa por 60s
    navigator.geolocation.getCurrentPosition(
      p => { _lastPos = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }; _lastPosAt = Date.now(); resolve(_lastPos); },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 300000 }
    );
  });
}
// Dispara o pedido de permissão/posição cedo (ao abrir o formulário), pra que
// a localização já esteja pronta quando a foto for capturada — importante no
// celular, onde o GPS pode demorar a fixar.
function pedirLocalizacao() { return _getPos(); }
function _stampImage(dataUrl, capturedAt, pos) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const maxW = 1600, scale = Math.min(1, maxW / img.width);
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const dt  = new Date(capturedAt).toLocaleString('pt-BR');
      const loc = pos ? `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}${pos.acc ? '  ±' + Math.round(pos.acc) + 'm' : ''}`
                      : 'Localização indisponível';
      const lines = [dt, loc];
      const fs = Math.max(12, Math.round(w * 0.028)), pad = Math.round(w * 0.02);
      ctx.font = `600 ${fs}px -apple-system, "Segoe UI", Roboto, sans-serif`;
      const lh = fs * 1.28, barH = pad * 2 + lines.length * lh;
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, h - barH, w, barH);
      ctx.fillStyle = '#fff'; ctx.textBaseline = 'top';
      lines.forEach((ln, i) => ctx.fillText(ln, pad, h - barH + pad + i * lh));
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
async function capturarFoto(file) {
  const pos = await _getPos();
  const capturedAt = Date.now();
  const raw = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result); r.onerror = () => rej(new Error('Falha ao ler a imagem'));
    r.readAsDataURL(file);
  });
  const dataUrl = await _stampImage(raw, capturedAt, pos);
  return { dataUrl, capturedAt, lat: pos?.lat ?? null, lng: pos?.lng ?? null, nome: file.name };
}
// Compatibilidade: chamadas antigas a fileToFoto passam a carimbar também.
const fileToFoto = capturarFoto;

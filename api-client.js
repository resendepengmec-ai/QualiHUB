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

// ── Google OAuth (Authorization Code + PKCE) ──────────────────────
// Migrado do fluxo implícito (response_type=token) nesta auditoria: o
// implicit flow não provava que o token tinha sido emitido especificamente
// pra este app (o backend só confirmava "é um token Google válido", não
// "é um token Google válido PRA MIM") — qualquer token de outra aplicação
// Google com escopo email/profile também entrava. Authorization Code +
// PKCE troca isso por um id_token (JWT assinado pela Google, com `aud`
// verificável no backend — ver src/auth.js).
const PKCE_VERIFIER_KEY = 'quali_pkce_verifier';

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
function _base64url(bytes) {
  let str = '';
  bytes.forEach(b => { str += String.fromCharCode(b); });
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
// code_verifier: string aleatória (RFC 7636 — 43 a 128 chars de
// [A-Za-z0-9-._~]; usamos 32 bytes aleatórios em base64url, que já caem
// nesse alfabeto e dão 43 chars).
function _pkceVerifier() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return _base64url(bytes);
}
// code_challenge = BASE64URL(SHA-256(code_verifier)) — a Google confere que
// bate com o verifier na troca do código, provando que quem troca o código
// é quem iniciou o login (mesma aba/sessão), não um interceptador do redirect.
async function _pkceChallenge(verifier) {
  const data   = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return _base64url(new Uint8Array(digest));
}
function _redirectBase() { return location.origin + location.pathname.replace(/\/[^/]*$/, '/'); }

async function startGoogleLogin() {
  const clientId = await fetchClientId();
  if (!clientId) throw new Error('Client ID do Google não configurado. Defina GOOGLE_CLIENT_ID no backend ou informe abaixo.');
  const verifier = _pkceVerifier();
  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
  const challenge = await _pkceChallenge(verifier);
  const params = new URLSearchParams({
    client_id: clientId, redirect_uri: _redirectBase() + 'auth-callback.html',
    response_type: 'code', scope: 'openid email profile',
    code_challenge: challenge, code_challenge_method: 'S256',
    access_type: 'online', prompt: 'select_account',
  });
  window.location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + params;
}

// Troca o código de autorização pelo id_token — no BACKEND, não aqui.
// Descoberto em produção: a Google exige client_secret na troca do código
// para clients OAuth do tipo "Web application" mesmo usando PKCE (erro
// "client_secret is missing" quando a troca era feita direto do navegador,
// sem segredo). O segredo não pode morar no frontend, então quem troca o
// código é o backend (ver POST /auth/google em src/auth.js) — o code_verifier
// ainda viaja até lá, e é a própria Google quem valida ele contra o
// code_challenge da autorização.
async function loginWithGoogleCode(code) {
  const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
  sessionStorage.removeItem(PKCE_VERIFIER_KEY);
  if (!verifier) throw new Error('Sessão de login expirada. Tente novamente.');
  const data = await API.post('/auth/google', { code, codeVerifier: verifier, redirectUri: _redirectBase() + 'auth-callback.html' });
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
  getHomeResumo:      ()      => API.get('/home/resumo'),
  getRelatorioOcorrencias: (q) => API.get('/relatorios/ocorrencias' + (q ? `?${q}` : '')),
  getRelatorioPac:         (q) => API.get('/relatorios/pac' + (q ? `?${q}` : '')),

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

  // Documentos sanitários
  getDocumentos:          (cid)     => API.get(`/contratos/${cid}/documentos`),
  getDocumentosChecklist: (cid)     => API.get(`/contratos/${cid}/documentos-checklist`),
  saveDocumento:          (cid, d)  => API.post(`/contratos/${cid}/documentos`, { documento: d }),
  removeDocumento:        (id)      => API.delete(`/documentos/${id}`),
  lerDocumentoIA:         (cid, arquivo, mimeType) => API.post(`/contratos/${cid}/documentos/ler-ia`, { arquivo, mimeType }),
  getRelatorioDocumentos: (q)       => API.get('/relatorios/documentos' + (q ? `?${q}` : '')),

  // Agenda de visitas
  getVisitas:             (cid)     => API.get(`/contratos/${cid}/visitas`),
  registrarVisita:        (cid, v)  => API.post(`/contratos/${cid}/visitas`, { visita: v }),
  removerVisita:          (id)      => API.delete(`/visitas/${id}`),

  // Plataforma (SaaS) — administradores de cliente (só master)
  getPlatformAdmins:  ()      => API.get('/platform/admins'),
  getPlatformTree:    ()      => API.get('/platform/tree'),
  addPlatformAdmin:   (a)     => API.post('/platform/admins', a),
  removePlatformAdmin:(email) => API.delete(`/platform/admins/${encodeURIComponent(email)}`),

  // Usuários da plataforma (qualquer perfil que já logou) — suspender/reativar (só master)
  getPlatformUsers:   ()      => API.get('/platform/users'),
  setUserActive:      (id, active) => API.patch(`/platform/users/${id}/active`, { active }),

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
// Documentos sanitários (mesmo catálogo do backend — api.js TIPOS_DOCUMENTO).
// `periodicidadeMeses`: certificados que renovam por rotina (limpeza de caixa
// d'água, dedetização) — o backend usa emissão+periodicidade como vencimento
// implícito quando o documento não tem validade escrita.
const TIPOS_DOCUMENTO = [
  { key: 'alvara_sanitario', label: 'Alvará Sanitário / Licença de funcionamento (Prefeitura)', periodicidadeMeses: null },
  { key: 'avcb', label: 'AVCB / Licença do Corpo de Bombeiros', periodicidadeMeses: null },
  { key: 'licenca_ambiental', label: 'Licença Ambiental', periodicidadeMeses: null },
  { key: 'registro_sif_sie', label: 'Registro SIF / SIE / SIM', periodicidadeMeses: null },
  { key: 'licenca_agua', label: 'Outorga / Licença de uso de água', periodicidadeMeses: null },
  { key: 'limpeza_caixa_dagua', label: "Limpeza do reservatório de água (caixa d'água)", periodicidadeMeses: 6 },
  { key: 'controle_pragas', label: 'Controle de pragas (dedetização)', periodicidadeMeses: 3 },
  { key: 'outro', label: 'Outro', periodicidadeMeses: null },
];
const STATUS_DOC_LABEL = { ok: 'Em dia', vencendo: 'Vencendo', vencida: 'Vencido', sem_validade: 'Sem validade', faltando: 'Faltando' };
const STATUS_DOC_CHIP  = { ok: 'ok', vencendo: 'vencendo', vencida: 'vencida', sem_validade: 'neutral', faltando: 'aberta' };
// Agenda de visitas (mesmo catálogo do backend — api.js PERIODICIDADES_VISITA).
const PERIODICIDADES_VISITA = [
  { key: 'semanal', label: 'Semanal (1x por semana)' },
  { key: 'quinzenal', label: 'Quinzenal' },
  { key: 'mensal', label: 'Mensal' },
  { key: 'trimestral', label: 'Trimestral' },
  { key: 'personalizada', label: 'Personalizada (X vezes por semana)' },
];
const PERIODICIDADE_VISITA_LABEL = Object.fromEntries(PERIODICIDADES_VISITA.map(p => [p.key, p.label]));
const STATUS_VISITA_LABEL = { em_dia: 'Em dia', proxima: 'Visita próxima', atrasada: 'Visita atrasada', sem_visita: 'Nunca visitado', sem_periodicidade: 'Periodicidade não definida' };
const STATUS_VISITA_CHIP  = { em_dia: 'ok', proxima: 'vencendo', atrasada: 'vencida', sem_visita: 'aberta', sem_periodicidade: 'neutral' };
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
// Carrega imagem permitindo uso em canvas (CORS) — para os tiles do OSM.
function _loadImg(src, cors) {
  return new Promise((res, rej) => { const i = new Image(); if (cors) i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = () => rej(new Error('img')); i.src = src; });
}
// Miniatura de mapa (OpenStreetMap) centralizada no ponto, com marcador.
// Usa tiles (que enviam CORS) para não "sujar" o canvas da foto.
async function _miniMapa(lat, lng, w, h, z) {
  z = z || 16; const R = 256, n = 2 ** z;
  const wx = (lng + 180) / 360 * n * R;
  const lr = lat * Math.PI / 180;
  const wy = (1 - Math.log(Math.tan(lr) + 1 / Math.cos(lr)) / Math.PI) / 2 * n * R;
  const left = wx - w / 2, top = wy - h / 2;
  const txMin = Math.floor(left / R), txMax = Math.floor((left + w) / R);
  const tyMin = Math.floor(top / R), tyMax = Math.floor((top + h) / R);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#dfe6e2'; ctx.fillRect(0, 0, w, h);
  const jobs = [];
  for (let tx = txMin; tx <= txMax; tx++) for (let ty = tyMin; ty <= tyMax; ty++) {
    if (ty < 0 || ty >= n) continue;
    const X = ((tx % n) + n) % n;
    jobs.push(_loadImg(`https://tile.openstreetmap.org/${z}/${X}/${ty}.png`, true)
      .then(img => ctx.drawImage(img, tx * R - left, ty * R - top)).catch(() => {}));
  }
  await Promise.all(jobs);
  ctx.fillStyle = '#c0392b'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(w / 2, h / 2, 5, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1; ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  try { c.toDataURL(); return c; } catch (e) { return null; } // se algum tile sujar o canvas, desiste do mapa
}
// Endereço aproximado (reverso via Nominatim/OSM), best-effort e com timeout.
async function _endereco(lat, lng) {
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 2500);
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    clearTimeout(t); const j = await r.json(); const a = j.address || {};
    const rua = a.road || a.pedestrian || a.footway || j.name || '';
    const num = a.house_number ? ', ' + a.house_number : '';
    const bairro = a.suburb || a.neighbourhood || a.city_district || '';
    const cidade = a.city || a.town || a.village || a.municipality || '';
    return [rua + num, bairro, cidade].filter(Boolean).join(' · ') || null;
  } catch (e) { return null; }
}
function _ellipsize(ctx, txt, maxW) {
  if (ctx.measureText(txt).width <= maxW) return txt;
  let s = txt; while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
  return s + '…';
}
async function _stampImage(dataUrl, capturedAt, pos) {
  let img;
  try { img = await _loadImg(dataUrl, false); } catch (e) { return dataUrl; }
  const maxW = 1600, scale = Math.min(1, maxW / img.width);
  const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);

  const dt = new Date(capturedAt).toLocaleString('pt-BR');
  const fs = Math.max(12, Math.round(w * 0.026)), pad = Math.round(w * 0.02), lh = Math.round(fs * 1.32);

  let endereco = null;
  if (pos) endereco = await _endereco(pos.lat, pos.lng).catch(() => null);
  // linhas de texto (endereço, coordenadas, data/hora)
  const lines = [];
  if (pos) {
    if (endereco) lines.push({ t: endereco, bold: true });
    lines.push({ t: `Lat ${pos.lat.toFixed(5)}  Long ${pos.lng.toFixed(5)}${pos.acc ? '  ±' + Math.round(pos.acc) + 'm' : ''}` });
    lines.push({ t: dt });
  } else {
    lines.push({ t: 'Localização indisponível', bold: true });
    lines.push({ t: dt });
  }
  const textH = lines.length * lh;
  const mapS = pos ? Math.max(56, Math.min(Math.round(w * 0.17), textH)) : 0;
  const barH = Math.max(mapS, textH) + pad * 1.4;
  const barTop = h - barH;

  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, barTop, w, barH);

  // mapa (canto inferior esquerdo)
  let textX = pad;
  if (pos) {
    try {
      const map = await _miniMapa(pos.lat, pos.lng, mapS, mapS, 16);
      const my = barTop + (barH - mapS) / 2;
      if (map) { ctx.drawImage(map, pad, my); textX = pad + mapS + pad; }
    } catch (e) { /* sem mapa: só texto */ }
  }

  // texto ao lado do mapa
  ctx.textBaseline = 'top'; ctx.fillStyle = '#fff';
  const maxTextW = w - textX - pad;
  let ty = barTop + (barH - textH) / 2;
  lines.forEach(ln => {
    ctx.font = `${ln.bold ? 700 : 500} ${fs}px -apple-system, "Segoe UI", Roboto, sans-serif`;
    ctx.fillText(_ellipsize(ctx, ln.t, maxTextW), textX, ty);
    ty += lh;
  });

  try { return c.toDataURL('image/jpeg', 0.85); } catch (e) { return dataUrl; }
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

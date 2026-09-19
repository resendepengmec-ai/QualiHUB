// QualiHUB — infra de UI (helpers + estado compartilhado)
  // ── infra de UI ───────────────────────────────────────────────
  const $ = (s, r = document) => r.querySelector(s);
  const view = $('#view');
  let contratos = [];   // lista completa (do backend, já filtrada por acesso)
  let membrosCache = {};

  function toast(msg, err = false) {
    const t = $('#toast'); t.textContent = msg; t.className = 'toast show' + (err ? ' err' : '');
    setTimeout(() => t.className = 'toast', 2600);
  }
  function openModal(html) { $('#modal').innerHTML = html; $('#modalBg').classList.add('show'); }
  function closeModal() { $('#modalBg').classList.remove('show'); }
  $('#modalBg').addEventListener('click', e => { if (e.target === $('#modalBg')) closeModal(); });
  const fmtDate = d => d ? new Date(d + (d.length <= 10 ? 'T00:00:00' : '')).toLocaleDateString('pt-BR') : '—';

  // Espelha a regra do backend (api.js): só master ou administrador de
  // CLIENTE (plataforma) pode criar contrato/estabelecimento novo. Ser
  // administrador de UM contrato não habilita isso (ver auditoria 0.16) —
  // o backend já recusa; isto só evita mostrar um botão que vai dar 403.
  function isAdministradorAnywhere() {
    if (isMaster()) return true;
    return getCurrentUser().role === 'admin'; // administrador de cliente
  }


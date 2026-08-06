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

  function isAdministradorAnywhere() {
    if (isMaster()) return true;
    if (getCurrentUser().role === 'admin') return true; // administrador de cliente
    return getAcessos().some(a => a.papel === 'administrador');
  }


// QualiHUB — boot, navegação e seletor de contrato (carregado por ÚLTIMO)
  // ── boot ──────────────────────────────────────────────────────
  (async () => {
    if (!requireSession()) return;
    try { await refreshMe(); }
    catch (e) { return logout(); }

    const u = getCurrentUser();
    $('#who').innerHTML =
      (u.picture ? `<img src="${esc(u.picture)}" alt="">` : '') +
      `<span>${esc(u.name || u.email)}${isMaster() ? ' · <strong>Master</strong>' : ''}</span>`;
    $('#btnSair').onclick = () => logout();

    await carregarContratos();
    montarNav();
    irPara(location.hash.replace('#', '') || 'dashboard');
  })();

  async function carregarContratos() {
    contratos = await DB.getContratos();
    const sel = $('#selContrato');
    if (!contratos.length) {
      sel.innerHTML = '<option value="">— sem contratos —</option>';
    } else {
      const atual = getContratoAtual() && contratos.some(c => c.id === getContratoAtual())
        ? getContratoAtual() : contratos[0].id;
      setContratoAtual(atual);
      sel.innerHTML = contratos.map(c =>
        `<option value="${c.id}">${esc(c.numero)}${c.objeto ? ' — ' + esc(c.objeto) : ''}</option>`).join('');
      sel.value = atual;
    }
    sel.onchange = () => { setContratoAtual(sel.value); irPara(active); };
  }

  // ── navegação ─────────────────────────────────────────────────
  const TABS = [
    { id: 'dashboard',   label: 'Dashboard' },
    { id: 'ocorrencias', label: 'Ocorrências' },
    { id: 'pac',         label: 'P.A.C.', when: () => !!getContratoAtual() },
    { id: 'cadastro',    label: 'Cadastro', when: isAdministradorAnywhere },
    { id: 'empresa',     label: 'Minha Empresa', when: () => isMaster() || getCurrentUser().role === 'admin' },
    { id: 'clientes',    label: 'Clientes', when: isMaster },
  ];
  let active = 'dashboard';
  function montarNav() {
    $('#nav').innerHTML = TABS.filter(t => !t.when || t.when())
      .map(t => `<button data-tab="${t.id}">${t.label}</button>`).join('');
    $('#nav').querySelectorAll('button').forEach(b => b.onclick = () => irPara(b.dataset.tab));
  }
  function irPara(tab) {
    active = tab; location.hash = tab;
    $('#nav').querySelectorAll('button').forEach(b => b.setAttribute('aria-current', String(b.dataset.tab === tab)));
    ({ dashboard: renderDashboard, ocorrencias: renderOcorrencias, pac: renderPac, cadastro: renderCadastro, empresa: renderEmpresa, clientes: renderClientes }[tab] || renderDashboard)();
  }

  async function getMembros(cid) {
    if (membrosCache[cid]) return membrosCache[cid];
    try { membrosCache[cid] = await DB.getMembros(cid); } catch (e) { membrosCache[cid] = []; }
    return membrosCache[cid];
  }


  window.closeModal = closeModal;

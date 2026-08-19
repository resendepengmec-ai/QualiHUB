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
    const home = () => irPara('dashboard');
    const bh = $('#brandHome'); if (bh) { bh.onclick = home; bh.style.cursor = 'pointer'; }
    const btnH = $('#btnHome'); if (btnH) btnH.onclick = home;
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

  // ── navegação (sem barra de abas; hub + botão Início) ──────────
  let active = 'dashboard';
  function irPara(tab) {
    active = tab; location.hash = tab;
    const bh = $('#btnHome'); if (bh) bh.style.display = (tab === 'dashboard') ? 'none' : '';
    ({ dashboard: renderDashboard, ocorrencias: renderOcorrencias, pac: renderPac, temperatura: renderTemperatura, cadastro: renderCadastro, empresa: renderEmpresa, clientes: renderClientes }[tab] || renderDashboard)();
  }

  async function getMembros(cid) {
    if (membrosCache[cid]) return membrosCache[cid];
    try { membrosCache[cid] = await DB.getMembros(cid); } catch (e) { membrosCache[cid] = []; }
    return membrosCache[cid];
  }


  window.closeModal = closeModal;

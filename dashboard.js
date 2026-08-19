// QShub — Dashboard (hub de módulos)
  const _ICONE = {
    bell: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>',
    clipboard: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1z"/><path d="M8 6H6a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-2"/><path d="m8.5 14 2 2 4-4"/></svg>',
    thermometer: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 14.76V5a2 2 0 1 0-4 0v9.76a4 4 0 1 0 4 0z"/></svg>',
    building: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16"/><path d="M14 9h5a1 1 0 0 1 1 1v11"/><path d="M3 21h18"/><path d="M7.5 8h.01M10.5 8h.01M7.5 12h.01M10.5 12h.01"/></svg>',
    badge: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="14" height="16" rx="1.5"/><circle cx="12" cy="10" r="2"/><path d="M8.5 16a3.5 3.5 0 0 1 7 0"/></svg>',
    users: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M16 19a4 4 0 0 0-8 0"/><circle cx="12" cy="9" r="3"/><path d="M20 19a3 3 0 0 0-3.5-2.9"/><path d="M16.5 10.4a2.5 2.5 0 0 0 0-4.8"/></svg>',
    shield: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"/><path d="m9 12 2 2 4-4"/></svg>',
  };
  function _tempoRel(ts) {
    const s = (Date.now() - ts) / 1000;
    if (s < 60) return 'agora';
    if (s < 3600) return 'há ' + Math.floor(s / 60) + ' min';
    if (s < 86400) return 'há ' + Math.floor(s / 3600) + ' h';
    return 'há ' + Math.floor(s / 86400) + ' d';
  }

  async function renderDashboard() {
    const u = getCurrentUser() || {};
    const p = isMaster() ? 'Master' : (papelAtual() ? papelAtual().charAt(0).toUpperCase() + papelAtual().slice(1) : (u.role === 'admin' ? 'Administrador' : 'Usuário'));
    view.innerHTML = `
      <div class="hubhead"><div><div class="oi">Olá,</div><div class="nome">${esc(u.name || '')}</div>
        <span class="hubrole">${esc(p)}</span></div></div>
      <div class="grid cols-3" id="hubKpi">
        <div class="kpi"><div class="n">—</div><div class="lbl">Ocorrências abertas</div></div>
        <div class="kpi"><div class="n">—</div><div class="lbl">Registros do P.A.C. (mês)</div></div>
        <div class="kpi"><div class="n">—</div><div class="lbl">Temperatura fora da faixa (7d)</div></div>
      </div>
      <div class="eyebrow" style="margin:22px 0 10px">Módulos</div>
      <div class="hubgrid" id="hubMods"></div>
      <button class="hubacc" id="recToggle" aria-expanded="false"><span class="eyebrow" style="margin:0">Atividade recente</span><span class="accchev" id="recChev">▸</span></button>
      <div id="hubRec" class="card" style="padding:0;display:none"><div class="muted" style="padding:14px 16px">Carregando…</div></div>`;

    let d = {};
    try { d = await DB.getHomeResumo(); } catch (e) { /* segue com traços */ }

    $('#hubKpi').innerHTML = `
      <div class="kpi"><div class="n ${d.ocorrenciasAbertas ? 'warn' : ''}">${d.ocorrenciasAbertas ?? '—'}</div><div class="lbl">Ocorrências abertas</div></div>
      <div class="kpi"><div class="n">${d.pacMes ?? '—'}</div><div class="lbl">Registros do P.A.C. (mês)</div></div>
      <div class="kpi"><div class="n ${d.tempFora ? 'danger' : 'ok'}">${d.tempFora ?? '—'}</div><div class="lbl">Temperatura fora da faixa (7d)</div></div>`;

    const temContrato = !!getContratoAtual();
    const mods = [
      { tab: 'ocorrencias', icon: 'bell', nome: 'Ocorrências', desc: 'Não conformidades', pill: (d.ocorrenciasAbertas > 0) ? ['aberta', `${d.ocorrenciasAbertas} abertas`] : ['ok', 'em dia'], show: true },
      { tab: 'pac', icon: 'clipboard', nome: 'P.A.C.', desc: 'Planilhas de autocontrole', pill: ['ok', `${d.pacMes ?? 0} este mês`], show: temContrato },
      { tab: 'temperatura', icon: 'thermometer', nome: 'Temperatura', desc: 'Sensores e câmaras', pill: (d.tempFora > 0) ? ['atraso', `${d.sensores ?? 0} sensores · ${d.tempFora} alerta`] : ['neutral', `${d.sensores ?? 0} sensores`], show: temContrato },
      { tab: 'cadastro', icon: 'building', nome: 'Cadastro', desc: 'Contratos e equipamentos', pill: ['neutral', `${d.contratos ?? 0} contratos`], show: isAdministradorAnywhere() },
      { tab: 'empresa', icon: 'badge', nome: 'Minha empresa', desc: 'Perfil e logo', pill: ['neutral', 'branding'], show: isMaster() || u.role === 'admin' },
      { tab: 'clientes', icon: 'users', nome: 'Clientes', desc: 'Administração', pill: ['sim', `${d.clientes ?? 0} clientes`], show: isMaster() },
      { tab: null, icon: 'shield', nome: 'Documentos sanitários', desc: 'Licenças com vencimento', pill: ['neutral', 'em breve'], show: true, soon: true },
    ];
    $('#hubMods').innerHTML = mods.filter(m => m.show).map(m => `
      <div class="hubcard${m.soon ? ' soon' : ''}" ${m.tab ? `data-tab="${m.tab}"` : ''}>
        <div class="hubtop"><div class="hubico">${_ICONE[m.icon]}</div>
          <div><div class="hubname">${m.nome}</div><div class="hubdesc">${m.desc}</div></div></div>
        <span class="chip ${m.pill[0]}">${m.pill[1]}</span>
      </div>`).join('');
    $('#hubMods').querySelectorAll('[data-tab]').forEach(el => el.onclick = () => irPara(el.dataset.tab));

    const rec = d.recentes || [];
    const iconRec = { ocorrencia: 'bell', pac: 'clipboard', iot: 'thermometer' };
    $('#hubRec').innerHTML = rec.length ? rec.map((x, i) => `
      <div class="recrow"${i ? ' style="border-top:0.5px solid var(--line)"' : ''}>
        <span class="reci">${_ICONE[iconRec[x.tipo] || 'clipboard']}</span>
        <span class="recl">${esc(x.label)}</span>
        <span class="rect">${x.em ? _tempoRel(x.em) : ''}</span>
      </div>`).join('') : `<div class="muted" style="padding:14px 16px">Sem atividade recente.</div>`;
    $('#recToggle').onclick = () => {
      const box = $('#hubRec'); const open = box.style.display !== 'none';
      box.style.display = open ? 'none' : 'block';
      $('#recChev').textContent = open ? '▸' : '▾';
      $('#recToggle').setAttribute('aria-expanded', String(!open));
    };
  }

  function ordenarPorUrgencia(a, b) {
    const rank = { vencida: 0, vencendo: 1, aberta: 2, atraso: 3, ok: 4 };
    return rank[statusOcorrencia(a).key] - rank[statusOcorrencia(b).key];
  }

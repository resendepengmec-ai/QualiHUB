// QualiHUB — Cadastro (estabelecimentos, contratos, acessos)
  // ══════════════════════════════════════════════════════════════
  // CADASTRO (estabelecimentos, contratos, acessos)
  // ══════════════════════════════════════════════════════════════
  let cadSub = 'contratos';
  function renderCadastro() {
    view.innerHTML = `<div class="view-head">
      <div><div class="eyebrow">Administração</div><h1>Cadastro</h1></div>
      <div class="subtabs" id="cadSubs">
        <button data-s="contratos">Contratos</button>
        <button data-s="estabelecimentos">Estabelecimentos</button>
        <button data-s="acessos">Acessos do contrato</button>
        <button data-s="equipamentos">Equipamentos</button>
      </div></div><div id="cadBody"></div>`;
    $('#cadSubs').querySelectorAll('button').forEach(b => {
      b.setAttribute('aria-current', String(b.dataset.s === cadSub));
      b.onclick = () => { cadSub = b.dataset.s; renderCadastro(); };
    });
    ({ contratos: cadContratos, estabelecimentos: cadEstabelecimentos, acessos: cadAcessos, equipamentos: cadEquipamentos }[cadSub])();
  }

  async function cadEstabelecimentos() {
    const body = $('#cadBody'); body.innerHTML = '<p class="muted">Carregando…</p>';
    const ests = await DB.getEstabelecimentos();
    const meEmail = (getCurrentUser().email || '').toLowerCase();
    const podeEditar = (e) => isMaster() || (e.ownerEmail || '').toLowerCase() === meEmail;
    body.innerHTML = `<div style="margin-bottom:14px"><button class="btn primary" id="novoEst">Novo estabelecimento</button></div>
      ${ests.length ? ests.map(e => `<div class="card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
          <div><strong>${esc(e.nome)}</strong>
            <div class="muted" style="font-size:.82rem">${esc(e.cnpj || '')}${e.endereco ? ' · ' + esc(e.endereco) : ''}</div>
            ${(e.lat != null && e.lng != null) ? `<div class="muted" style="font-size:.8rem;margin-top:2px">📍 ${e.lat}, ${e.lng} · <a href="https://www.google.com/maps?q=${e.lat},${e.lng}" target="_blank" rel="noopener">ver no mapa</a></div>` : ''}
          </div>
          ${podeEditar(e) ? `<button class="btn sm" data-edit="${e.id}">Editar</button>` : ''}
        </div></div>`).join('')
        : `<div class="empty"><strong>Nenhum estabelecimento</strong>Cadastre o estabelecimento detentor do contrato.</div>`}`;
    $('#novoEst').onclick = () => abrirEstModal(null);
    body.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => abrirEstModal(ests.find(x => x.id === b.dataset.edit)));
  }

  function abrirEstModal(e) {
    const ed = !!e;
    const coord = (ed && e.lat != null && e.lng != null) ? `${e.lat}, ${e.lng}` : '';
    openModal(`<h2>${ed ? 'Editar' : 'Novo'} estabelecimento</h2>
      <div class="row"><label class="field"><span>Nome</span><input id="eNome" value="${ed ? esc(e.nome) : ''}"></label>
        <label class="field"><span>CNPJ</span><input id="eCnpj" value="${ed ? esc(e.cnpj || '') : ''}"></label></div>
      <label class="field"><span>Endereço</span><input id="eEnd" value="${ed ? esc(e.endereco || '') : ''}"></label>
      <label class="field"><span>Coordenadas (lat, long — padrão Google Maps)</span>
        <input id="eCoord" placeholder="-18.16572, -47.94220" value="${esc(coord)}"></label>
      <p class="muted" style="font-size:.76rem;margin-top:-6px">No Google Maps, clique com o botão direito no ponto e clique nas coordenadas para copiar; cole aqui.</p>
      <div class="actions"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" id="eOk">Salvar</button></div>`);
    $('#eOk').onclick = async () => {
      const nome = $('#eNome').value.trim(); if (!nome) return toast('Informe o nome.', true);
      let lat = null, lng = null;
      const raw = $('#eCoord').value.trim();
      if (raw) {
        const p = raw.replace(/[()]/g, '').split(',').map(s => parseFloat(s.trim()));
        if (p.length !== 2 || isNaN(p[0]) || isNaN(p[1]) || Math.abs(p[0]) > 90 || Math.abs(p[1]) > 180)
          return toast('Coordenadas inválidas. Use: -18.16572, -47.94220', true);
        lat = p[0]; lng = p[1];
      }
      const payload = { nome, cnpj: $('#eCnpj').value.trim(), endereco: $('#eEnd').value.trim(), lat, lng };
      if (ed) payload.id = e.id;
      try { await DB.saveEstabelecimento(payload); closeModal(); toast('Estabelecimento salvo.'); cadEstabelecimentos(); }
      catch (err) { toast(err.message, true); }
    };
  }

  async function cadContratos() {
    const body = $('#cadBody'); body.innerHTML = '<p class="muted">Carregando…</p>';
    const ests = await DB.getEstabelecimentos().catch(() => []);
    const podeEditar = (c) => isMaster() || papelNoContrato(c.id) === 'administrador';
    body.innerHTML = `<div style="margin-bottom:14px"><button class="btn primary" id="novoCtr">Novo contrato</button></div>
      ${contratos.length ? contratos.map(c => `<div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
          <div><strong>${esc(c.numero)}</strong> ${(c.regimes || []).map(k => `<span class="chip sim">${(REGIME_LABEL[k] || {}).curto || k}</span>`).join(' ')} ${c.classificacao ? `<span class="chip neutral">${esc(CLASSIFICACAO_LABEL[c.classificacao] || c.classificacao)}</span>` : ''}
            <div class="muted" style="font-size:.82rem">${esc(c.objeto || '')}${c.estabelecimentoNome ? ' · ' + esc(c.estabelecimentoNome) : ''}${c.vigenciaInicio ? ' · vigência ' + fmtDate(c.vigenciaInicio) + '–' + fmtDate(c.vigenciaFim) : ''}</div></div>
          <div style="display:flex;gap:8px;align-items:center;flex:none">
            ${podeEditar(c) ? `<button class="btn sm" data-edit="${c.id}">Editar</button>` : ''}
          </div></div></div>`).join('')
        : `<div class="empty"><strong>Nenhum contrato</strong>Crie o primeiro contrato para começar.</div>`}`;
    $('#novoCtr').onclick = () => abrirContratoModal(null, ests);
    body.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => abrirContratoModal(contratos.find(x => x.id === b.dataset.edit), ests));
  }

  function abrirContratoModal(c, ests) {
    const ed = !!c;
    openModal(`<h2>${ed ? 'Editar' : 'Novo'} contrato</h2>
      <div class="row"><label class="field"><span>Número</span><input id="cNum" value="${ed ? esc(c.numero) : ''}"></label>
        <label class="field"><span>Estabelecimento</span><select id="cEst">
          <option value="">— nenhum —</option>
          ${ests.map(e => `<option value="${e.id}" ${ed && c.estabelecimentoId === e.id ? 'selected' : ''}>${esc(e.nome)}</option>`).join('')}
          <option value="__novo__">+ Novo estabelecimento…</option>
        </select></label></div>
      <div id="cEstNovoWrap" style="display:none">
        <div class="row"><label class="field"><span>Nome do estabelecimento</span><input id="cEstNome"></label>
          <label class="field"><span>CNPJ (opcional)</span><input id="cEstCnpj"></label></div>
      </div>
      <label class="field"><span>Objeto do contrato</span><input id="cObj" value="${ed ? esc(c.objeto || '') : ''}"></label>
      <label class="field"><span>Classificação (tipo de estabelecimento)</span>
        <select id="cClass"><option value="">— selecione —</option>
          ${CLASSIFICACOES.map(cl => `<option value="${cl.key}" ${ed && c.classificacao === cl.key ? 'selected' : ''}>${cl.label}</option>`).join('')}
        </select></label>
      <div class="row"><label class="field"><span>Vigência — início</span><input type="date" id="cIni" value="${ed ? (c.vigenciaInicio || '') : ''}"></label>
        <label class="field"><span>Vigência — fim</span><input type="date" id="cFim" value="${ed ? (c.vigenciaFim || '') : ''}"></label></div>
      <div class="field"><span style="display:block;font-size:.8rem;font-weight:600;margin-bottom:6px">Regimes de inspeção (marque todos que se aplicam)</span>
        <div style="display:flex;flex-direction:column;gap:7px">
          ${REGIMES.map(rg => `<label style="display:flex;gap:8px;align-items:center;font-weight:400;margin:0"><input type="checkbox" class="cReg" value="${rg.key}" style="width:auto" ${ed && (c.regimes || []).includes(rg.key) ? 'checked' : ''}>${rg.label}</label>`).join('')}
        </div>
        <span class="muted" style="font-size:.75rem;display:block;margin-top:6px">O conjunto de planilhas do P.A.C. é definido por esses regimes.</span></div>
      <div class="actions"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" id="cOk">Salvar</button></div>`);
    $('#cEst').onchange = () => { $('#cEstNovoWrap').style.display = $('#cEst').value === '__novo__' ? 'block' : 'none'; };
    $('#cOk').onclick = async () => {
      const numero = $('#cNum').value.trim(); if (!numero) return toast('Informe o número.', true);
      try {
        let estId = $('#cEst').value;
        if (estId === '__novo__') {
          const nome = $('#cEstNome').value.trim();
          if (!nome) return toast('Informe o nome do novo estabelecimento.', true);
          const r = await DB.saveEstabelecimento({ nome, cnpj: $('#cEstCnpj').value.trim() });
          estId = r.saved;
        }
        const payload = { numero, estabelecimentoId: estId || null, objeto: $('#cObj').value.trim(),
          vigenciaInicio: $('#cIni').value || null, vigenciaFim: $('#cFim').value || null,
          classificacao: $('#cClass').value || null,
          regimes: [...document.querySelectorAll('.cReg:checked')].map(x => x.value) };
        if (ed) payload.id = c.id;
        await DB.saveContrato(payload);
        closeModal(); toast('Contrato salvo.'); await refreshMe(); await carregarContratos(); cadContratos();
      } catch (e) { toast(e.message, true); }
    };
  }

  async function cadAcessos() {
    const cid = getContratoAtual(); const body = $('#cadBody');
    if (!cid) return body.innerHTML = `<div class="empty"><strong>Escolha um contrato</strong>Selecione o contrato para gerenciar seus acessos.</div>`;
    if (papelNoContrato(cid) !== 'administrador') return body.innerHTML = `<div class="empty"><strong>Acesso restrito</strong>Só o administrador deste contrato gerencia os acessos.</div>`;
    body.innerHTML = '<p class="muted">Carregando…</p>';
    let acessos = [];
    try { acessos = await DB.getAcessos(cid); } catch (e) { return body.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
    const papeis = Object.keys(PAPEIS);
    body.innerHTML = `<div class="card">
      <div class="eyebrow">Adicionar acesso</div>
      <div class="row" style="margin-top:8px">
        <input id="aEmail" placeholder="e-mail@dominio.com" style="flex:2 1 220px">
        <input id="aNome" placeholder="Nome (opcional)">
        <select id="aPapel">${papeis.map(p => `<option value="${p}">${PAPEIS[p].label}</option>`).join('')}</select>
        <button class="btn primary" id="aAdd" style="flex:0 0 auto">Adicionar</button>
      </div></div>
      <div style="margin-top:14px">${acessos.length ? acessos.map(a => `<div class="card" style="display:flex;justify-content:space-between;align-items:center">
        <div><strong>${esc(a.name || a.email)}</strong>
          <div class="muted" style="font-size:.82rem">${esc(a.email)} · ${esc((PAPEIS[a.papel]||{}).label || a.papel)}</div></div>
        <button class="btn sm danger" data-rm="${a.id}">Remover</button></div>`).join('')
        : `<div class="empty"><strong>Nenhum acesso ainda</strong>Adicione o fiscal, o gestor e os executores deste contrato.</div>`}</div>`;
    $('#aAdd').onclick = async () => {
      const email = $('#aEmail').value.trim(); if (!email.includes('@')) return toast('E-mail inválido.', true);
      if (acessos.some(a => (a.email || '').toLowerCase() === email.toLowerCase()))
        return toast('Este e-mail já está atribuído a este contrato.', true);
      try { await DB.addAcesso(cid, { email, papel: $('#aPapel').value, name: $('#aNome').value.trim() });
        toast('Acesso adicionado.'); membrosCache = {}; cadAcessos(); } catch (e) { toast(e.message, true); }
    };
    body.querySelectorAll('[data-rm]').forEach(b => b.onclick = async () => {
      try { await DB.removeAcesso(b.dataset.rm, cid); toast('Acesso removido.'); membrosCache = {}; cadAcessos(); }
      catch (e) { toast(e.message, true); }
    });
  }

  // ── Equipamentos / recintos (controle de temperatura) ──────────
  async function cadEquipamentos() {
    const cid = getContratoAtual(); const body = $('#cadBody');
    if (!cid) return body.innerHTML = `<div class="empty"><strong>Escolha um contrato</strong>Selecione o contrato para cadastrar seus equipamentos.</div>`;
    if (papelNoContrato(cid) !== 'administrador') return body.innerHTML = `<div class="empty"><strong>Acesso restrito</strong>Só o administrador deste contrato cadastra equipamentos.</div>`;
    body.innerHTML = '<p class="muted">Carregando…</p>';
    let eqs;
    try { eqs = await DB.getEquipamentos(cid); } catch (e) { return body.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
    body.innerHTML = `<p class="muted" style="font-size:.85rem;margin:0 0 12px">Câmaras, balcões e recintos com seus limites de temperatura e frequência. Definem a conformidade automática e recebem o sensor IoT.</p>
      <div style="margin-bottom:14px"><button class="btn primary" id="novoEq">Novo equipamento</button></div>
      ${eqs.length ? eqs.map(e => cardEquip(e)).join('') : `<div class="empty"><strong>Nenhum equipamento</strong>Cadastre a primeira câmara/balcão/sala para o controle de temperatura.</div>`}`;
    $('#novoEq').onclick = () => abrirEquipModal(cid, null);
    body.querySelectorAll('[data-edit-eq]').forEach(b => b.onclick = () => abrirEquipModal(cid, eqs.find(x => x.id === b.dataset.editEq)));
    body.querySelectorAll('[data-del-eq]').forEach(b => b.onclick = async () => {
      if (!confirm('Excluir este equipamento?')) return;
      try { await DB.removeEquipamento(b.dataset.delEq); toast('Equipamento excluído.'); cadEquipamentos(); } catch (e) { toast(e.message, true); }
    });
    body.querySelectorAll('[data-tok]').forEach(b => b.onclick = () => {
      const el = document.getElementById('tok_' + b.dataset.tok); if (el) { el.style.display = el.style.display === 'none' ? 'block' : 'none'; }
    });
    body.querySelectorAll('[data-copia]').forEach(b => b.onclick = () => { navigator.clipboard?.writeText(b.dataset.copia); toast('Copiado.'); });
    body.querySelectorAll('[data-regen]').forEach(b => b.onclick = async () => {
      if (!confirm('Regerar o token? O sensor precisará ser reconfigurado com o novo token.')) return;
      try { await DB.regenerarTokenEquip(b.dataset.regen); toast('Token regerado.'); cadEquipamentos(); } catch (e) { toast(e.message, true); }
    });
  }

  function cardEquip(e) {
    const faixa = (e.limiteMin != null || e.limiteMax != null) ? `${e.limiteMin ?? '-∞'}°C a ${e.limiteMax ?? '+∞'}°C` : 'sem limite definido';
    const modoLbl = { manual: 'Manual', iot: 'IoT', ambos: 'Manual + IoT' }[e.modo] || e.modo;
    const temIot = e.modo === 'iot' || e.modo === 'ambos';
    return `<div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
        <div><strong>${esc(e.nome)}</strong> <span class="chip neutral">${esc((CATEGORIAS_EQUIP[e.categoria] || e.categoria))}</span>
          <div class="muted" style="font-size:.82rem;margin-top:2px">Faixa: ${faixa}${e.freqPorDia ? ' · ' + e.freqPorDia + '×/dia' : ''} · ${modoLbl}</div></div>
        <div style="display:flex;gap:6px;flex:none">
          <button class="btn sm" data-edit-eq="${e.id}">Editar</button>
          <button class="btn sm danger" data-del-eq="${e.id}">Excluir</button>
        </div>
      </div>
      ${temIot && e.token ? `<div style="margin-top:10px">
        <button class="btn ghost sm" data-tok="${e.id}">Mostrar/ocultar dados do sensor (IoT)</button>
        <div id="tok_${e.id}" style="display:none;margin-top:8px;background:var(--surface-2);border-radius:8px;padding:10px;font-size:.8rem">
          <div><b>Endpoint:</b> <span class="mono">${esc(IOT_ENDPOINT)}</span> <button class="btn ghost sm" data-copia="${esc(IOT_ENDPOINT)}">copiar</button></div>
          <div style="margin-top:4px"><b>Token:</b> <span class="mono" style="word-break:break-all">${esc(e.token)}</span> <button class="btn ghost sm" data-copia="${esc(e.token)}">copiar</button></div>
          <div class="muted" style="margin-top:6px">O sensor faz <b>POST</b> em JSON: <span class="mono">{ "token": "…", "valor": 4.2 }</span>. Opcional: <span class="mono">"medidoEm"</span> (epoch ms).</div>
          <button class="btn sm" data-regen="${e.id}" style="margin-top:8px">Regerar token</button>
        </div></div>` : ''}
    </div>`;
  }

  function abrirEquipModal(cid, e) {
    const ed = !!e;
    const cats = Object.entries(CATEGORIAS_EQUIP).map(([k, v]) => `<option value="${k}" ${ed && e.categoria === k ? 'selected' : ''}>${v}</option>`).join('');
    const modos = [['manual', 'Manual'], ['iot', 'IoT (sensor)'], ['ambos', 'Manual + IoT']].map(([k, v]) => `<option value="${k}" ${ed && e.modo === k ? 'selected' : ''}>${v}</option>`).join('');
    openModal(`<h2>${ed ? 'Editar' : 'Novo'} equipamento / recinto</h2>
      <div class="row"><label class="field"><span>Nome</span><input id="eqNome" value="${ed ? esc(e.nome) : ''}" placeholder="Ex.: Câmara fria 1"></label>
        <label class="field"><span>Categoria</span><select id="eqCat">${cats}</select></label></div>
      <div class="row"><label class="field"><span>Limite mínimo (°C)</span><input id="eqMin" type="number" step="any" value="${ed && e.limiteMin != null ? e.limiteMin : ''}"></label>
        <label class="field"><span>Limite máximo (°C)</span><input id="eqMax" type="number" step="any" value="${ed && e.limiteMax != null ? e.limiteMax : ''}"></label></div>
      <div class="row"><label class="field"><span>Frequência (medições por dia)</span><input id="eqFreq" type="number" step="1" value="${ed && e.freqPorDia != null ? e.freqPorDia : ''}" placeholder="Ex.: 3"></label>
        <label class="field"><span>Forma de medição</span><select id="eqModo">${modos}</select></label></div>
      <label class="field"><span>Identificação do sensor (opcional)</span><input id="eqSensor" value="${ed ? esc(e.sensorId || '') : ''}" placeholder="Ex.: ESP32-cam1"></label>
      <p class="muted" style="font-size:.76rem;margin-top:-4px">Em modo IoT, um token é gerado ao salvar (aparece no card do equipamento).</p>
      <div class="actions"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" id="eqOk">Salvar</button></div>`);
    $('#eqOk').onclick = async () => {
      const nome = $('#eqNome').value.trim(); if (!nome) return toast('Informe o nome.', true);
      const payload = { nome, categoria: $('#eqCat').value, limiteMin: $('#eqMin').value, limiteMax: $('#eqMax').value,
        freqPorDia: $('#eqFreq').value, modo: $('#eqModo').value, sensorId: $('#eqSensor').value.trim() };
      if (ed) payload.id = e.id;
      try { await DB.saveEquipamento(cid, payload); closeModal(); toast('Equipamento salvo.'); cadEquipamentos(); }
      catch (err) { toast(err.message, true); }
    };
  }

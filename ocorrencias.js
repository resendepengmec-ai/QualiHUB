// QualiHUB — Ocorrências
  // ══════════════════════════════════════════════════════════════
  // OCORRÊNCIAS
  // ══════════════════════════════════════════════════════════════
  let ocSub = 'atribuidas';
  function renderOcorrencias() {
    view.innerHTML = `<div class="view-head">
      <div><div class="eyebrow">Não conformidades</div><h1>Ocorrências</h1></div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <div class="subtabs" id="ocSubs">
          <button data-s="atribuidas">Atribuídas a mim</button>
          <button data-s="criar">Criar ocorrência</button>
          <button data-s="contrato">Do contrato</button>
        </div>
        <button class="btn sm" id="btnPdf">Gerar PDF</button>
      </div></div>
      <div id="ocBody"></div>`;
    $('#ocSubs').querySelectorAll('button').forEach(b => {
      b.setAttribute('aria-current', String(b.dataset.s === ocSub));
      b.onclick = () => { ocSub = b.dataset.s; renderOcorrencias(); };
    });
    $('#btnPdf').onclick = abrirRelatorioModal;
    ({ atribuidas: ocAtribuidas, criar: ocCriar, contrato: ocDoContrato }[ocSub])();
  }

  function cardOcorrencia(o, opts = {}) {
    const st = statusOcorrencia(o);
    const g  = (o.gravidade || 'baixa').toLowerCase();
    const meu = (getCurrentUser().email || '').toLowerCase();
    const podeResolver = opts.resolver && o.estado !== 'concluida' && (o.atribuidoA || '').toLowerCase() === meu;
    const podeEditar = opts.editar && ['administrador', 'gestor', 'fiscal'].includes(papelNoContrato(o.contratoId));
    return `<div class="card spine s-${st.key}">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
        <div>
          <span class="chip ${st.key}">${st.label}</span>
          <span class="grav ${g}" style="margin-left:8px">${esc(o.gravidade || 'baixa')}</span>
        </div>
        <span class="muted" style="font-size:.78rem">${o.criadoEm ? new Date(o.criadoEm).toLocaleDateString('pt-BR') : ''}</span>
      </div>
      <p style="margin:8px 0 6px;font-weight:600">${esc(o.descricao || '')}</p>
      ${o.acaoCorretiva ? `<div style="font-size:.85rem;margin:0 0 6px"><span class="muted">Ação corretiva:</span> ${esc(o.acaoCorretiva)}</div>` : ''}
      <div class="muted" style="font-size:.8rem">
        Prazo: <strong>${fmtDate(o.prazoCorrecao)}</strong>
        · Criada por ${esc(o.criadoPorNome || o.criadoPor || '?')}
        · Atribuída a ${esc(o.atribuidoA || '—')}${o.editadoEm ? ' · editada por ' + esc(o.editadoPor || '') : ''}
      </div>
      ${Array.isArray(o.fotos) && o.fotos.length ? `<div class="fotos">${o.fotos.map(f => `<img src="${esc(f.dataUrl)}" alt="">`).join('')}</div>` : ''}
      ${o.execucao ? `<div class="card" style="margin-top:10px;box-shadow:none;background:var(--surface-2)">
        <div class="eyebrow">Execução da correção</div>
        <div style="font-size:.86rem;margin-top:4px">${esc(o.execucao.descricaoExecucao)}</div>
        <div class="muted" style="font-size:.78rem;margin-top:4px">Executada em ${fmtDate(o.execucao.dataExecucao)} por ${esc(o.execucao.porNome || o.execucao.por)}</div>
      </div>` : ''}
      ${(podeResolver || podeEditar) ? `<div style="margin-top:12px;display:flex;gap:8px">
        ${podeEditar ? `<button class="btn ghost sm" data-editar="${o.id}">Editar</button>` : ''}
        ${podeResolver ? `<button class="btn primary sm" data-resolver="${o.id}">Registrar correção</button>` : ''}
      </div>` : ''}
    </div>`;
  }
  function ligarAcoes(container, ocs) {
    const byId = Object.fromEntries((ocs || []).map(o => [o.id, o]));
    container.querySelectorAll('[data-resolver]').forEach(b => b.onclick = () => abrirResolver(b.dataset.resolver));
    container.querySelectorAll('[data-editar]').forEach(b => b.onclick = () => abrirEditarOcorrencia(byId[b.dataset.editar]));
  }

  async function ocAtribuidas() {
    const body = $('#ocBody'); body.innerHTML = '<p class="muted">Carregando…</p>';
    try {
      const ocs = await DB.getAtribuidas();
      body.innerHTML = ocs.length
        ? ocs.sort(ordenarPorUrgencia).map(o => cardOcorrencia(o, { resolver: true, editar: true })).join('')
        : `<div class="empty"><strong>Nada atribuído a você</strong>Quando alguém atribuir uma correção a você, ela aparece aqui.</div>`;
      ligarAcoes(body, ocs);
    } catch (e) { body.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  }

  async function ocDoContrato() {
    const cid = getContratoAtual(); const body = $('#ocBody');
    if (!cid) return body.innerHTML = `<div class="empty"><strong>Escolha um contrato</strong>Selecione um contrato acima para ver suas ocorrências.</div>`;
    body.innerHTML = '<p class="muted">Carregando…</p>';
    try {
      const ocs = await DB.getOcorrenciasContrato(cid);
      body.innerHTML = ocs.length
        ? ocs.sort(ordenarPorUrgencia).map(o => cardOcorrencia(o, { resolver: true, editar: true })).join('')
        : `<div class="empty"><strong>Sem ocorrências neste contrato</strong>Registre a primeira na aba “Criar ocorrência”.</div>`;
      ligarAcoes(body, ocs);
    } catch (e) { body.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  }

  function _camposOcorrencia(oc, membros) {
    return `<div class="row">
        <label class="field"><span>Gravidade</span>
          <select id="fGrav">${GRAVIDADES.map(g => `<option value="${g}" ${oc && (oc.gravidade || '').toLowerCase() === g ? 'selected' : ''}>${g[0].toUpperCase() + g.slice(1)}</option>`).join('')}</select></label>
        <label class="field"><span>Prazo para correção</span><input type="date" id="fPrazo" value="${oc ? (oc.prazoCorrecao || '') : ''}"></label>
      </div>
      <label class="field"><span>Descrição da não conformidade</span>
        <textarea id="fDesc" placeholder="O que foi observado, onde, e por quê é uma não conformidade">${oc ? esc(oc.descricao || '') : ''}</textarea></label>
      <label class="field"><span>Ação corretiva (o que deve ser feito)</span>
        <textarea id="fAcao" placeholder="Ex.: substituir a borracha de vedação e revisar a dobradiça">${oc ? esc(oc.acaoCorretiva || '') : ''}</textarea></label>
      <label class="field"><span>Atribuir a (responsável pela correção)</span>
        <select id="fAtrib"><option value="">— escolha um membro do contrato —</option>
          ${membros.map(m => `<option value="${esc(m.email)}" ${oc && (oc.atribuidoA || '').toLowerCase() === m.email.toLowerCase() ? 'selected' : ''}>${esc(m.name || m.email)} · ${esc((PAPEIS[m.papel] || {}).label || m.papel)}</option>`).join('')}</select></label>
      <label class="field"><span>Fotos (até 3)</span><input type="file" id="fFotos" accept="image/*" multiple></label>
      <div class="fotos" id="fPrev"></div>`;
  }
  function _wireFotos(fotos) {
    $('#fFotos').onchange = async (e) => {
      toast('Processando foto…');
      for (const file of [...e.target.files]) { if (fotos.length >= 3) break; fotos.push(await capturarFoto(file)); }
      $('#fPrev').innerHTML = fotos.map(f => `<img src="${f.dataUrl}" alt="">`).join('');
      if (fotos.some(f => f.lat == null)) toast('Foto salva sem localização — verifique a permissão de local.', true);
      e.target.value = '';
    };
  }
  function _coletarOcorrencia(cid, oc, fotos, sempreFotos) {
    const desc = $('#fDesc').value.trim();
    if (!desc) { toast('Descreva a não conformidade.', true); return null; }
    const p = { contratoId: cid, gravidade: $('#fGrav').value, prazoCorrecao: $('#fPrazo').value || null,
      descricao: desc, acaoCorretiva: $('#fAcao').value.trim() || null, atribuidoA: $('#fAtrib').value || null };
    if (oc) { p.id = oc.id; if (sempreFotos || fotos.length) p.fotos = fotos; } else p.fotos = fotos;
    return p;
  }

  async function ocCriar() {
    const cid = getContratoAtual(); const body = $('#ocBody');
    if (!cid) return body.innerHTML = `<div class="empty"><strong>Escolha um contrato</strong>Selecione o contrato onde observou a ocorrência.</div>`;
    const membros = (await getMembros(cid)).filter(m => m.email.toLowerCase() !== getCurrentUser().email.toLowerCase());
    body.innerHTML = `<div class="card">${_camposOcorrencia(null, membros)}
      <div style="margin-top:8px"><button class="btn primary" id="fSalvar">Registrar ocorrência</button></div></div>`;
    pedirLocalizacao();
    let fotos = []; _wireFotos(fotos);
    $('#fSalvar').onclick = async () => {
      const p = _coletarOcorrencia(cid, null, fotos); if (!p) return;
      $('#fSalvar').disabled = true;
      try { await DB.criarOcorrencia(p); toast('Ocorrência registrada.'); ocSub = 'contrato'; renderOcorrencias(); }
      catch (e) { toast(e.message, true); $('#fSalvar').disabled = false; }
    };
  }

  async function abrirEditarOcorrencia(oc) {
    if (!oc) return;
    const membros = await getMembros(oc.contratoId);
    let manter = (oc.fotos || []).slice();
    let novas = [];
    openModal(`<div class="eyebrow">Editar</div><h2>Ocorrência</h2>${_camposOcorrencia(oc, membros)}
      <div class="actions"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" id="fSalvar">Salvar</button></div>`);
    pedirLocalizacao();
    const render = () => {
      const all = manter.concat(novas);
      $('#fPrev').innerHTML = all.map((f, i) => `<div class="fotowrap"><img src="${esc(f.dataUrl)}" alt=""><button type="button" class="fotorm" data-i="${i}" aria-label="Excluir foto">×</button></div>`).join('');
      $('#fPrev').querySelectorAll('.fotorm').forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (i < manter.length) { manter.splice(i, 1); toast('Foto excluída.'); }
        else { novas.splice(i - manter.length, 1); toast('Foto removida.'); }
        render();
      });
    };
    render();
    $('#fFotos').onchange = async (e) => {
      for (const file of [...e.target.files]) {
        if (manter.length + novas.length >= 3) { toast('Máximo de 3 fotos.', true); break; }
        toast('Processando foto…'); novas.push(await capturarFoto(file)); toast('Foto adicionada.');
      }
      render(); e.target.value = '';
    };
    $('#fSalvar').onclick = async () => {
      const p = _coletarOcorrencia(oc.contratoId, oc, manter.concat(novas), true); if (!p) return;
      $('#fSalvar').disabled = true;
      try { await DB.criarOcorrencia(p); closeModal(); toast('Ocorrência atualizada.'); ocSub = 'contrato'; renderOcorrencias(); }
      catch (e) { toast(e.message, true); $('#fSalvar').disabled = false; }
    };
  }

  function abrirResolver(id) {
    openModal(`<div class="eyebrow">Ver atribuídas a mim</div><h2>Registrar correção</h2>
      <p class="muted" style="font-size:.85rem;margin:.3rem 0 1rem">Você é o responsável por esta correção. Registre o que foi feito.</p>
      <label class="field"><span>Data de execução</span><input type="date" id="rData" value="${new Date().toISOString().slice(0,10)}"></label>
      <label class="field"><span>Descrição da execução</span><textarea id="rDesc" placeholder="O que foi feito para corrigir"></textarea></label>
      <label class="field"><span>Fotos (até 3)</span><input type="file" id="rFotos" accept="image/*" multiple></label>
      <div class="fotos" id="rPrev"></div>
      <div class="actions"><button class="btn" id="rCancel">Cancelar</button><button class="btn primary" id="rOk">Concluir correção</button></div>`);
    let fotos = [];
    pedirLocalizacao();
    $('#rFotos').onchange = async (e) => {
      toast('Processando foto…');
      for (const file of [...e.target.files]) { if (fotos.length >= 3) break; fotos.push(await capturarFoto(file)); }
      $('#rPrev').innerHTML = fotos.map(f => `<img src="${f.dataUrl}" alt="">`).join('');
      if (fotos.some(f => f.lat == null)) toast('Foto salva sem localização — verifique a permissão de local do navegador.', true);
      e.target.value = '';
    };
    $('#rCancel').onclick = closeModal;
    $('#rOk').onclick = async () => {
      const d = $('#rDesc').value.trim();
      if (!d) return toast('Descreva o que foi feito.', true);
      $('#rOk').disabled = true;
      try {
        await DB.resolverOcorrencia(id, { dataExecucao: $('#rData').value, descricaoExecucao: d, fotos });
        closeModal(); toast('Correção registrada.'); renderOcorrencias();
      } catch (e) { toast(e.message, true); $('#rOk').disabled = false; }
    };
  }


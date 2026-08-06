// QualiHUB — P.A.C.
  // ══════════════════════════════════════════════════════════════
  // P.A.C. (planilhas de autocontrole)
  // ══════════════════════════════════════════════════════════════
  async function renderPac() {
    const cid = getContratoAtual();
    view.innerHTML = `<div class="view-head"><div><div class="eyebrow">Autocontrole</div><h1>P.A.C.</h1>
      <p class="muted" style="font-size:.86rem;margin:.3rem 0 0">Planilhas aplicáveis a este contrato pelos regimes de inspeção. Lançamentos vão para aprovação do gestor.</p></div></div>
      <div id="pacBody" class="muted">Carregando…</div>`;
    if (!cid) return $('#pacBody').innerHTML = `<div class="empty"><strong>Escolha um contrato</strong>Selecione um contrato acima para ver as planilhas.</div>`;
    let data;
    try { data = await DB.getPlanilhasDoContrato(cid); } catch (e) { return $('#pacBody').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
    if (!data.planilhas.length) {
      return $('#pacBody').innerHTML = `<div class="empty"><strong>Nenhuma planilha aplicável</strong>Defina os regimes de inspeção deste contrato em Cadastro → Contratos (Editar).</div>`;
    }
    const grupos = { produto: [], meio: [], saude: [] };
    data.planilhas.forEach(p => (grupos[p.natureza] || (grupos[p.natureza] = [])).push(p));
    const tipos = {}; data.planilhas.forEach(p => tipos[p.id] = p);
    const secao = (nat, titulo) => (grupos[nat] && grupos[nat].length) ? `
      <div class="eyebrow" style="margin:18px 0 8px">${titulo}</div>
      ${grupos[nat].map(p => `<div class="card" style="display:flex;justify-content:space-between;align-items:center;gap:10px">
        <div><strong>${esc(p.nome)}</strong><div class="muted" style="font-size:.8rem">${esc(p.periodicidade || '')}</div></div>
        <div style="display:flex;gap:8px;flex:none">
          <button class="btn sm" data-hist="${p.id}">Registros</button>
          <button class="btn primary sm" data-novo="${p.id}">Novo registro</button>
        </div></div>`).join('')}` : '';
    $('#pacBody').innerHTML = secao('produto', 'Produto') + secao('meio', 'Meio') + secao('saude', 'Saúde ocupacional');
    $('#pacBody').querySelectorAll('[data-novo]').forEach(b => b.onclick = () => abrirRegistroPac(cid, tipos[b.dataset.novo]));
    $('#pacBody').querySelectorAll('[data-hist]').forEach(b => b.onclick = () => abrirHistoricoPac(cid, tipos[b.dataset.hist]));
  }

  function _campoInput(c) {
    const id = 'f_' + c.key;
    if (c.tipo === 'numero') return `<input id="${id}" type="number" step="any">`;
    if (c.tipo === 'data') return `<input id="${id}" type="date">`;
    if (c.tipo === 'sim_nao') return `<select id="${id}"><option value="">—</option><option>Sim</option><option>Não</option></select>`;
    return `<input id="${id}">`;
  }
  function abrirRegistroPac(cid, tipo) {
    openModal(`<div class="eyebrow">${esc(tipo.periodicidade || '')}</div><h2>${esc(tipo.nome)}</h2>
      ${tipo.campos.map(c => `<label class="field"><span>${esc(c.label)}${c.unidade ? ' (' + esc(c.unidade) + ')' : ''}</span>${_campoInput(c)}</label>`).join('')}
      <label class="field"><span>Fotos (até 3, com data/hora e localização)</span><input type="file" id="pacFotos" accept="image/*" capture="environment" multiple></label>
      <div class="fotos" id="pacPrev"></div>
      <div class="actions"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" id="pacOk">Registrar</button></div>`);
    pedirLocalizacao();
    let fotos = [];
    $('#pacFotos').onchange = async (e) => {
      toast('Processando foto…');
      for (const file of [...e.target.files]) { if (fotos.length >= 3) break; fotos.push(await capturarFoto(file)); }
      $('#pacPrev').innerHTML = fotos.map(f => `<img src="${f.dataUrl}">`).join('');
      if (fotos.some(f => f.lat == null)) toast('Foto sem localização — verifique a permissão de local.', true);
      e.target.value = '';
    };
    $('#pacOk').onclick = async () => {
      const dados = {}; tipo.campos.forEach(c => { const el = document.getElementById('f_' + c.key); if (el) dados[c.key] = el.value; });
      $('#pacOk').disabled = true;
      try { await DB.criarRegistroPac({ contratoId: cid, planilhaTipoId: tipo.id, dados, fotos });
        closeModal(); toast('Registro lançado — aguardando aprovação do gestor.'); }
      catch (e) { toast(e.message, true); $('#pacOk').disabled = false; }
    };
  }
  async function abrirHistoricoPac(cid, tipo) {
    openModal(`<h2>${esc(tipo.nome)}</h2><p class="muted" style="font-size:.82rem;margin:.2rem 0 1rem">${esc(tipo.periodicidade || '')}</p><div id="pacHist" class="muted">Carregando…</div>`);
    const podeDecidir = ['gestor', 'administrador'].includes(papelNoContrato(cid));
    async function load() {
      let regs;
      try { regs = await DB.getRegistrosPac(cid, tipo.id); } catch (e) { return $('#pacHist').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
      $('#pacHist').innerHTML = regs.length ? regs.map(rg => {
        const chip = rg.estado === 'aprovado' ? '<span class="chip ok">Aprovado</span>'
          : rg.estado === 'reprovado' ? '<span class="chip atraso">Reprovado</span>' : '<span class="chip aberta">Pendente</span>';
        const dados = tipo.campos.map(c => (rg.dados && rg.dados[c.key] != null && rg.dados[c.key] !== '') ? `${esc(c.label)}: <b>${esc(rg.dados[c.key])}</b>` : null).filter(Boolean).join(' · ');
        const fotos = (rg.fotos || []).map(f => `<img src="${f.dataUrl}">`).join('');
        return `<div class="card" style="box-shadow:none;border:1px solid var(--line)">
          <div style="display:flex;justify-content:space-between;align-items:center">${chip}<span class="muted" style="font-size:.76rem">${rg.criadoEm ? new Date(rg.criadoEm).toLocaleString('pt-BR') : ''}</span></div>
          <div style="font-size:.85rem;margin-top:6px">${dados || '<span class="muted">sem dados</span>'}</div>
          <div class="muted" style="font-size:.78rem;margin-top:4px">por ${esc(rg.criadoPorNome || rg.criadoPor || '—')}</div>
          ${fotos ? `<div class="fotos">${fotos}</div>` : ''}
          ${rg.decisao ? `<div class="muted" style="font-size:.78rem;margin-top:4px">${rg.estado === 'aprovado' ? 'Aprovado' : 'Reprovado'} por ${esc(rg.decisao.porNome || rg.decisao.por)}${rg.decisao.observacao ? ' — ' + esc(rg.decisao.observacao) : ''}</div>` : ''}
          ${(podeDecidir && rg.estado === 'pendente') ? `<div style="margin-top:8px;display:flex;gap:8px"><button class="btn primary sm" data-ap="${rg.id}">Aprovar</button><button class="btn danger sm" data-rp="${rg.id}">Reprovar</button></div>` : ''}
        </div>`;
      }).join('') : `<div class="empty"><strong>Nenhum registro</strong>Lance o primeiro em “Novo registro”.</div>`;
      $('#pacHist').querySelectorAll('[data-ap]').forEach(b => b.onclick = async () => {
        try { await DB.decidirRegistroPac(b.dataset.ap, true, ''); toast('Aprovado.'); load(); } catch (e) { toast(e.message, true); }
      });
      $('#pacHist').querySelectorAll('[data-rp]').forEach(b => b.onclick = async () => {
        const obs = prompt('Motivo da reprovação (opcional):') || '';
        try { await DB.decidirRegistroPac(b.dataset.rp, false, obs); toast('Reprovado.'); load(); } catch (e) { toast(e.message, true); }
      });
    }
    load();
  }


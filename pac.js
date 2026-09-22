// QualiHUB — P.A.C.
  // ══════════════════════════════════════════════════════════════
  // P.A.C. (planilhas de autocontrole)
  // ══════════════════════════════════════════════════════════════
  let pacSub = 'planilhas';
  async function renderPac() {
    const cid = getContratoAtual();
    view.innerHTML = `<div class="view-head"><div><div class="eyebrow">Autocontrole</div><h1>P.A.C.</h1>
      <p class="muted" style="font-size:.86rem;margin:.3rem 0 0">Planilhas aplicáveis a este contrato pelos regimes de inspeção. Lançamentos vão para aprovação do gestor.</p></div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <div class="subtabs" id="pacSubs"><button data-s="planilhas">Planilhas</button><button data-s="produtos">Produtos</button></div>
        <button class="btn sm" id="pacPdf">Gerar PDF</button>
      </div></div>
      <div id="pacBody" class="muted">Carregando…</div>`;
    $('#pacSubs').querySelectorAll('button').forEach(b => {
      b.setAttribute('aria-current', String(b.dataset.s === pacSub));
      b.onclick = () => { pacSub = b.dataset.s; renderPac(); };
    });
    const _pdfBtn = $('#pacPdf');
    if (_pdfBtn) { _pdfBtn.onclick = () => abrirRelatorioPacModal(); _pdfBtn.style.display = pacSub === 'produtos' ? 'none' : ''; }
    if (pacSub === 'produtos') return pacProdutos(cid);
    if (!cid) return $('#pacBody').innerHTML = `<div class="empty"><strong>Escolha um contrato</strong>Selecione um contrato acima para ver as planilhas.</div>`;
    let data;
    try { data = await DB.getPlanilhasDoContrato(cid); } catch (e) { return $('#pacBody').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
    if (!data.planilhas.length) {
      return $('#pacBody').innerHTML = `<div class="empty"><strong>Nenhuma planilha aplicável</strong>Defina os regimes de inspeção deste contrato em Cadastro → Contratos (Editar).</div>`;
    }
    const grupos = { produto: [], meio: [], saude: [] };
    data.planilhas.forEach(p => (grupos[p.natureza] || (grupos[p.natureza] = [])).push(p));
    const tipos = {}; data.planilhas.forEach(p => tipos[p.id] = p);
    const _chipStatus = (p) => {
      if (!p.status) return ''; // conformidade só quando o backend do item 1 estiver no ar
      const m = {
        em_dia: ['ok', 'em dia'], atrasado: ['atraso', 'atrasado'], pendente: ['aberta', 'pendente'],
        continuo: ['neutral', (p.total || 0) + ' registro' + ((p.total || 0) === 1 ? '' : 's')],
      }[p.status] || ['neutral', ''];
      return `<span class="chip ${m[0]}">${m[1]}</span>`;
    };
    const secao = (nat, titulo) => (grupos[nat] && grupos[nat].length) ? `
      <div class="eyebrow" style="margin:18px 0 8px">${titulo}</div>
      ${grupos[nat].map(p => `<div class="card" style="display:flex;justify-content:space-between;align-items:center;gap:10px">
        <div style="min-width:0"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><strong>${esc(p.nome)}</strong>${_chipStatus(p)}</div>
          <div class="muted" style="font-size:.8rem">${esc(p.periodicidade || '')}</div></div>
        <div style="display:flex;gap:8px;flex:none">
          <button class="btn sm" data-hist="${p.id}">Registros</button>
          <button class="btn primary sm" data-novo="${p.id}">Novo registro</button>
        </div></div>`).join('')}` : '';
    $('#pacBody').innerHTML = secao('produto', 'Produto') + secao('meio', 'Meio') + secao('saude', 'Saúde ocupacional');
    $('#pacBody').querySelectorAll('[data-novo]').forEach(b => b.onclick = () => {
      const t = tipos[b.dataset.novo];
      if (t.id === 'pt-temperatura') abrirTemperatura(cid); else abrirRegistroPac(cid, t);
    });
    $('#pacBody').querySelectorAll('[data-hist]').forEach(b => b.onclick = () => abrirHistoricoPac(cid, tipos[b.dataset.hist]));
  }

  function _campoInput(c) {
    const id = 'f_' + c.key;
    if (c.tipo === 'numero') return `<input id="${id}" type="number" step="any">`;
    if (c.tipo === 'data') return `<input id="${id}" type="date">`;
    if (c.tipo === 'sim_nao') return `<select id="${id}"><option value="">—</option><option>Sim</option><option>Não</option></select>`;
    if (c.tipo === 'cnc') return `<select id="${id}"><option value="">—</option><option value="C">C — Conforme</option><option value="NC">NC — Não conforme</option><option value="NA">NA — Não se aplica</option></select>`;
    if (c.tipo === 'select') return `<select id="${id}"><option value="">—</option>${(c.opcoes || []).map(o => `<option>${o}</option>`).join('')}</select>`;
    return `<input id="${id}">`;
  }
  function abrirRegistroPac(cid, tipo) {
    openModal(`<div class="eyebrow">${esc(tipo.periodicidade || '')}</div><h2>${esc(tipo.nome)}</h2>
      ${tipo.campos.map(c => `<label class="field"><span>${esc(c.label)}${c.unidade ? ' (' + esc(c.unidade) + ')' : ''}</span>${_campoInput(c)}</label>`).join('')}
      <label class="field"><span>Fotos (até 3, com data/hora e localização)</span><input type="file" id="pacFotos" accept="image/*" multiple></label>
      <div class="fotos" id="pacPrev"></div>
      <div class="actions"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" id="pacOk">Registrar</button></div>`);
    pedirLocalizacao();
    let fotos = [];
    $('#pacFotos').onchange = async (e) => {
      toast('Processando foto…');
      for (const file of [...e.target.files]) { if (fotos.length >= 3) break; fotos.push(await capturarFoto(file)); }
      $('#pacPrev').innerHTML = fotos.map(f => `<img src="${esc(f.dataUrl)}">`).join('');
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
        let corpo;
        if (rg.dados && Array.isArray(rg.dados.leituras)) { // temperatura (manual ou IoT)
          const conf = rg.dados.conformeGeral ? '<span class="chip ok">Conforme</span>' : '<span class="chip atraso">Não conforme</span>';
          const orig = `<span class="chip neutral">${rg.origem === 'iot' ? 'IoT' : 'Manual'}</span>`;
          corpo = `<div style="margin-bottom:4px">${conf} ${orig}</div>` + rg.dados.leituras.map(l =>
            `<div style="font-size:.85rem;margin-top:2px">${esc(l.nome)}: <b style="color:${l.conforme ? 'var(--ok)' : 'var(--danger)'}">${esc(l.valor)}°C</b>${(l.limiteMin != null || l.limiteMax != null) ? ` <span class="muted">(faixa ${l.limiteMin ?? '-∞'}–${l.limiteMax ?? '+∞'}°C)</span>` : ''}</div>`).join('');
        } else {
          corpo = tipo.campos.map(c => (rg.dados && rg.dados[c.key] != null && rg.dados[c.key] !== '') ? `${esc(c.label)}: <b>${esc(rg.dados[c.key])}</b>` : null).filter(Boolean).join(' · ') || '<span class="muted">sem dados</span>';
        }
        const fotos = _renderFotosImgs(rg.fotos, 'pac', rg.id, 'fotos');
        return `<div class="card" style="box-shadow:none;border:1px solid var(--line)">
          <div style="display:flex;justify-content:space-between;align-items:center">${chip}<span class="muted" style="font-size:.76rem">${rg.criadoEm ? new Date(rg.criadoEm).toLocaleString('pt-BR') : ''}</span></div>
          <div style="font-size:.85rem;margin-top:6px">${corpo}</div>
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


  // Lançamento de temperatura dirigido pelos equipamentos cadastrados.
  async function abrirTemperatura(cid) {
    let eqs;
    try { eqs = (await DB.getEquipamentos(cid)).filter(e => e.ativo !== false && (e.modo === 'manual' || e.modo === 'ambos')); }
    catch (e) { return toast(e.message, true); }
    if (!eqs.length) return openModal(`<h2>Controle de temperatura</h2>
      <div class="empty"><strong>Nenhum equipamento para medição manual</strong>Cadastre câmaras/balcões/salas em Cadastro → Equipamentos (forma de medição Manual ou Manual + IoT).</div>
      <div class="actions"><button class="btn primary" onclick="closeModal()">Entendi</button></div>`);
    openModal(`<div class="eyebrow">Data e hora automáticas do registro</div><h2>Controle de temperatura</h2>
      <p class="muted" style="font-size:.82rem;margin:.2rem 0 1rem">Informe a temperatura de cada ponto. A conformidade é calculada pelos limites do cadastro.</p>
      ${eqs.map(e => `<label class="field"><span>${esc(e.nome)} <span class="muted">(${e.limiteMin ?? '-∞'}–${e.limiteMax ?? '+∞'}°C)</span></span>
        <input type="number" step="any" class="tmp" data-eq="${e.id}" data-min="${e.limiteMin ?? ''}" data-max="${e.limiteMax ?? ''}" placeholder="°C"></label>`).join('')}
      <div class="actions"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" id="tOk">Registrar</button></div>`);
    const avalia = (inp) => {
      const v = parseFloat(inp.value);
      const min = inp.dataset.min === '' ? null : parseFloat(inp.dataset.min);
      const max = inp.dataset.max === '' ? null : parseFloat(inp.dataset.max);
      if (inp.value === '' || isNaN(v)) { inp.style.borderColor = ''; inp.style.boxShadow = ''; return; }
      const ok = (min == null || v >= min) && (max == null || v <= max);
      inp.style.borderColor = ok ? 'var(--ok)' : 'var(--danger)';
      inp.style.boxShadow = ok ? '0 0 0 3px var(--ok-wash)' : '0 0 0 3px var(--danger-wash)';
    };
    document.querySelectorAll('.tmp').forEach(inp => inp.oninput = () => avalia(inp));
    $('#tOk').onclick = async () => {
      const leituras = [...document.querySelectorAll('.tmp')].filter(inp => inp.value !== '').map(inp => ({ equipamentoId: inp.dataset.eq, valor: inp.value }));
      if (!leituras.length) return toast('Informe ao menos uma temperatura.', true);
      $('#tOk').disabled = true;
      try { await DB.criarTemperatura(cid, leituras); closeModal(); toast('Temperatura registrada — aguardando aprovação do gestor.'); }
      catch (e) { toast(e.message, true); $('#tOk').disabled = false; }
    };
  }

  // ── Tela dedicada de Temperatura (módulo próprio) ──────────────
  async function renderTemperatura() {
    const cid = getContratoAtual();
    view.innerHTML = `<div class="view-head"><div><div class="eyebrow">Monitoramento</div><h1>Temperatura</h1>
      <p class="muted" style="font-size:.86rem;margin:.3rem 0 0">Câmaras, balcões e sensores com conformidade automática (manual e IoT).</p></div>
      <div style="display:flex;gap:8px"><button class="btn sm" id="tPdf">Gerar PDF</button><button class="btn primary" id="tNovo">Novo registro</button></div></div>
      <div id="tempBody" class="muted">Carregando…</div>`;
    $('#tPdf').onclick = () => abrirRelatorioTemperaturaModal();
    if (!cid) return $('#tempBody').innerHTML = `<div class="empty"><strong>Escolha um contrato</strong>Selecione um contrato acima para ver a temperatura.</div>`;
    $('#tNovo').onclick = () => abrirTemperatura(cid);
    let eqs = [], regs = [];
    try { [eqs, regs] = await Promise.all([DB.getEquipamentos(cid), DB.getRegistrosPac(cid, 'pt-temperatura')]); }
    catch (e) { return $('#tempBody').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
    const ult = {};
    regs.forEach(r => (r.dados?.leituras || []).forEach(l => {
      if (!ult[l.equipamentoId] || (r.criadoEm || 0) > ult[l.equipamentoId].em) ult[l.equipamentoId] = { valor: l.valor, conforme: l.conforme, em: r.criadoEm || 0, origem: r.origem };
    }));
    const modoL = { manual: 'Manual', iot: 'IoT', ambos: 'Manual + IoT' };
    const cards = eqs.length ? eqs.map(e => {
      const u = ult[e.id];
      const faixa = (e.limiteMin != null || e.limiteMax != null) ? `${e.limiteMin ?? '-∞'} a ${e.limiteMax ?? '+∞'}°C` : 'sem limite';
      const chip = u ? (u.conforme ? '<span class="chip ok">conforme</span>' : '<span class="chip atraso">não conforme</span>') : '<span class="chip aberta">sem leitura</span>';
      return `<div class="card"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
        <div><strong>${esc(e.nome)}</strong> <span class="chip neutral">${esc(CATEGORIAS_EQUIP[e.categoria] || e.categoria)}</span>
          <div class="muted" style="font-size:.82rem;margin-top:2px">Faixa ${faixa} · ${modoL[e.modo] || e.modo}${e.freqPorDia ? ' · ' + e.freqPorDia + '×/dia' : ''}</div></div>
        <div style="text-align:right;flex:none">${chip}
          <div style="font-size:1.3rem;font-weight:800;color:${u ? (u.conforme ? 'var(--ok)' : 'var(--danger)') : 'var(--muted)'}">${u ? u.valor + '°C' : '—'}</div>
          <div class="muted" style="font-size:.72rem">${u ? ((u.origem === 'iot' ? 'IoT · ' : 'Manual · ') + _tempoRel(u.em)) : 'aguardando'}</div></div>
      </div></div>`;
    }).join('') : `<div class="empty"><strong>Nenhum equipamento</strong>Cadastre câmaras/balcões/salas em Cadastro → Equipamentos.</div>`;
    const lista = regs.length ? regs.slice(0, 12).map(r => {
      const conf = r.dados?.conformeGeral ? '<span class="chip ok">conforme</span>' : '<span class="chip atraso">não conforme</span>';
      const org = `<span class="chip neutral">${r.origem === 'iot' ? 'IoT' : 'Manual'}</span>`;
      const leit = (r.dados?.leituras || []).map(l => `${esc(l.nome)}: <b style="color:${l.conforme ? 'var(--ok)' : 'var(--danger)'}">${esc(l.valor)}°C</b>`).join(' · ');
      return `<div class="card" style="box-shadow:none;border:1px solid var(--line)">
        <div style="display:flex;justify-content:space-between;align-items:center">${conf} ${org}<span class="muted" style="font-size:.76rem">${r.criadoEm ? new Date(r.criadoEm).toLocaleString('pt-BR') : ''}</span></div>
        <div style="font-size:.85rem;margin-top:6px">${leit || '—'}</div></div>`;
    }).join('') : `<div class="empty"><strong>Sem leituras</strong>Lance a primeira em "Novo registro".</div>`;
    $('#tempBody').innerHTML = `<div class="eyebrow" style="margin:6px 0 8px">Equipamentos</div>${cards}
      <div class="eyebrow" style="margin:22px 0 8px">Leituras recentes</div>${lista}`;
  }

  // ══════════════════════════════════════════════════════════════
  // PRODUTOS (ficha técnica) + RÓTULOS — leitura/geração por IA
  // Promovido de "pt-formulacao" (planilha solta do P.A.C.) — formulação
  // nunca foi um lançamento recorrente de verdade, é cadastro.
  // ══════════════════════════════════════════════════════════════
  const ESTADO_ROTULO_CHIP  = { rascunho: 'neutral', em_revisao: 'vencendo', aprovado: 'ok', reprovado: 'vencida' };
  const ESTADO_ROTULO_LABEL = { rascunho: 'Rascunho', em_revisao: 'Em revisão', aprovado: 'Aprovado', reprovado: 'Reprovado' };
  const CHECKLIST_ROTULO_CHIP = { ok: 'ok', ausente: 'vencida', inconsistente: 'vencendo' };

  async function pacProdutos(cid) {
    const body = $('#pacBody');
    if (!cid) return body.innerHTML = `<div class="empty"><strong>Escolha um contrato</strong>Selecione um contrato acima para ver os produtos.</div>`;
    body.innerHTML = '<p class="muted">Carregando…</p>';
    const podeGerir = ['administrador', 'gestor'].includes(papelNoContrato(cid));
    let produtos;
    try { produtos = await DB.getProdutos(cid); } catch (e) { return body.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
    body.innerHTML = `
      ${podeGerir ? `<div style="margin-bottom:14px"><button class="btn primary" id="prodNovo">Novo produto</button></div>` : ''}
      ${produtos.length ? produtos.map(p => {
        const ficha = [
          p.percCarne != null ? 'Carne ' + p.percCarne + '%' : null,
          p.percGordura != null ? 'Gordura ' + p.percGordura + '%' : null,
          p.percSal != null ? 'Sal ' + p.percSal + '%' : null,
        ].filter(Boolean).join(' · ') || 'Ficha técnica incompleta';
        const selo = p.rotulo?.vigente
          ? `<span class="chip ${ESTADO_ROTULO_CHIP[p.rotulo.vigente.estado] || 'neutral'}">Rótulo v${p.rotulo.vigente.versao} — ${ESTADO_ROTULO_LABEL[p.rotulo.vigente.estado] || p.rotulo.vigente.estado}</span>`
          : `<span class="chip neutral">Sem rótulo</span>`;
        return `<div class="card" data-abrir="${p.id}" style="cursor:pointer">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
            <strong>${esc(p.nome)}</strong>${selo}
          </div>
          <div class="muted" style="font-size:.82rem;margin-top:4px">${esc(ficha)}</div>
        </div>`;
      }).join('') : `<div class="empty"><strong>Nenhum produto cadastrado</strong>Cadastre a ficha técnica do primeiro produto deste contrato.</div>`}`;
    if (podeGerir) $('#prodNovo').onclick = () => abrirProdutoFichaModal(cid, null, () => pacProdutos(cid));
    body.querySelectorAll('[data-abrir]').forEach(el => el.onclick = () => abrirProdutoDetalheModal(cid, produtos.find(x => x.id === el.dataset.abrir), podeGerir));
  }

  // Modal simples: só a ficha técnica (criar ou editar). Reaberto de dentro
  // do modal de detalhe também, pra não duplicar o formulário.
  function abrirProdutoFichaModal(cid, produto, aoSalvar) {
    const ed = !!produto;
    openModal(`<h2>${ed ? 'Editar' : 'Novo'} produto</h2>
      <label class="field"><span>Nome do produto</span><input id="pNome" value="${ed ? esc(produto.nome) : ''}"></label>
      <div class="row">
        <label class="field"><span>% carne</span><input id="pCarne" type="number" step="any" value="${ed && produto.percCarne != null ? produto.percCarne : ''}"></label>
        <label class="field"><span>% gordura</span><input id="pGordura" type="number" step="any" value="${ed && produto.percGordura != null ? produto.percGordura : ''}"></label>
        <label class="field"><span>% sal</span><input id="pSal" type="number" step="any" value="${ed && produto.percSal != null ? produto.percSal : ''}"></label>
      </div>
      <label class="field"><span>Conservantes</span><input id="pConserv" value="${ed ? esc(produto.conservantes || '') : ''}"></label>
      <label class="field"><span>Registro Agrodefesa</span><input id="pRegistro" value="${ed ? esc(produto.registroAgrodefesa || '') : ''}"></label>
      <div class="actions"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" id="pOk">Salvar</button></div>`);
    $('#pOk').onclick = async () => {
      const nome = $('#pNome').value.trim(); if (!nome) return toast('Informe o nome do produto.', true);
      const payload = {
        nome, percCarne: $('#pCarne').value, percGordura: $('#pGordura').value, percSal: $('#pSal').value,
        conservantes: $('#pConserv').value.trim(), registroAgrodefesa: $('#pRegistro').value.trim(),
      };
      if (ed) payload.id = produto.id;
      $('#pOk').disabled = true;
      try { const r = await DB.saveProduto(cid, payload); closeModal(); toast('Produto salvo.'); (aoSalvar || (() => {}))(r.produto); }
      catch (e) { toast(e.message, true); $('#pOk').disabled = false; }
    };
  }

  // Modal rico: ficha (resumo + editar) + rótulos (upload, versões,
  // análise/checklist por IA, aprovar/reprovar) + gerar texto por IA.
  function abrirProdutoDetalheModal(cid, produto, podeGerir) {
    openModal(`<div class="eyebrow">Produto</div><h2>${esc(produto.nome)}</h2>
      <div id="pdFicha"></div>
      <p class="muted" style="font-size:.76rem;margin:10px 0 0">⚠ A leitura por IA é um apoio; a aprovação final do rótulo é responsabilidade do Responsável Técnico do contrato.</p>
      <div class="eyebrow" style="margin:16px 0 8px">Rótulos</div>
      <div id="pdRotulos" class="muted">Carregando…</div>
      ${podeGerir ? `<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
        <label class="btn sm" style="cursor:pointer;margin:0">Novo rótulo (upload)<input type="file" id="pdArquivo" accept="image/*,application/pdf" style="display:none"></label>
        <button type="button" class="btn ghost sm" id="pdGerarTexto">✨ Gerar texto com IA</button>
      </div>
      <div id="pdGerado"></div>` : ''}
      <div class="actions"><button class="btn primary" onclick="closeModal()">Fechar</button></div>`);

    const renderFicha = () => {
      const ficha = [
        produto.percCarne != null ? ['Carne', produto.percCarne + '%'] : null,
        produto.percGordura != null ? ['Gordura', produto.percGordura + '%'] : null,
        produto.percSal != null ? ['Sal', produto.percSal + '%'] : null,
        produto.conservantes ? ['Conservantes', produto.conservantes] : null,
        produto.registroAgrodefesa ? ['Registro Agrodefesa', produto.registroAgrodefesa] : null,
      ].filter(Boolean);
      $('#pdFicha').innerHTML = `<div class="card" style="box-shadow:none;border:1px solid var(--line)">
        ${ficha.length ? ficha.map(([l, v]) => `<div style="font-size:.85rem;margin-top:2px"><span class="muted">${esc(l)}:</span> <strong>${esc(v)}</strong></div>`).join('') : '<span class="muted">Ficha técnica incompleta.</span>'}
        ${podeGerir ? `<button type="button" class="btn ghost sm" id="pdEditarFicha" style="margin-top:8px">Editar ficha técnica</button>` : ''}
      </div>`;
      if (podeGerir) $('#pdEditarFicha').onclick = () => abrirProdutoFichaModal(cid, produto, (novo) => { produto = novo; renderFicha(); toast('Ficha atualizada.'); });
    };
    renderFicha();

    const painelChecklist = (checklist) => !checklist || !checklist.length ? '' : `<div style="margin-top:8px">
      ${checklist.map(c => `<div style="font-size:.8rem;margin-top:4px;display:flex;gap:6px;align-items:flex-start">
        <span class="chip ${CHECKLIST_ROTULO_CHIP[c.status] || 'neutral'}" style="flex:none">${esc(c.item)}</span>
        <span class="muted">${esc(c.observacao || '')}</span>
      </div>`).join('')}
    </div>`;
    const painelExtracao = (ex) => !ex ? '' : `<div class="card" style="box-shadow:none;border:1px solid var(--line);margin-top:8px;background:var(--surface-2)">
      <div class="eyebrow" style="margin:0">Leitura da IA</div>
      ${[
        ['Produto', ex.produto], ['Peso líquido', ex.pesoLiquido], ['Registro', ex.registro],
        ['Ingredientes', (ex.ingredientes || []).join(', ') || null],
        ['Alergênicos', (ex.alergenicos || []).join(', ') || null],
        ['Fabricante', [ex.fabricante?.razaoSocial, ex.fabricante?.endereco].filter(Boolean).join(' — ') || null],
      ].filter(([, v]) => v).map(([l, v]) => `<div style="font-size:.82rem;margin-top:4px"><span class="muted">${esc(l)}:</span> ${esc(v)}</div>`).join('')}
      ${painelChecklist(ex.checklist)}
    </div>`;

    async function carregarRotulos() {
      let versoes;
      try { versoes = await DB.getRotulos(produto.id); } catch (e) { return $('#pdRotulos').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
      $('#pdRotulos').innerHTML = versoes.length ? versoes.map(v => `<div class="card" style="box-shadow:none;border:1px solid var(--line)">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
            <div><strong>Versão ${v.versao}</strong> <span class="chip ${ESTADO_ROTULO_CHIP[v.estado] || 'neutral'}">${ESTADO_ROTULO_LABEL[v.estado] || v.estado}</span></div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <button type="button" class="btn ghost sm" data-ver="${v.id}">Ver arquivo</button>
              ${(podeGerir && (v.estado === 'rascunho' || v.estado === 'em_revisao')) ? `<button type="button" class="btn ghost sm" data-analisar="${v.id}">✨ Analisar com IA</button>` : ''}
              ${(podeGerir && v.estado === 'em_revisao') ? `<button type="button" class="btn primary sm" data-aprovar="${v.id}">Aprovar</button><button type="button" class="btn danger sm" data-reprovar="${v.id}">Reprovar</button>` : ''}
            </div>
          </div>
          <div class="muted" style="font-size:.76rem;margin-top:4px">Enviado por ${esc(v.enviadoPorNome || v.enviadoPor)} em ${v.enviadoEm ? new Date(v.enviadoEm).toLocaleString('pt-BR') : ''}</div>
          ${v.decisao ? `<div class="muted" style="font-size:.78rem;margin-top:4px">${v.estado === 'aprovado' ? 'Aprovado' : 'Reprovado'} por ${esc(v.decisao.porNome || v.decisao.por)}${v.decisao.observacao ? ' — ' + esc(v.decisao.observacao) : ''}</div>` : ''}
          ${painelExtracao(v.extracaoIA)}
        </div>`).join('') : `<div class="empty"><strong>Nenhum rótulo enviado ainda</strong>${podeGerir ? 'Use "Novo rótulo" abaixo pra subir a primeira versão.' : ''}</div>`;

      $('#pdRotulos').querySelectorAll('[data-ver]').forEach(b => b.onclick = async () => {
        b.disabled = true;
        try { const blob = await DB.getArquivoRotuloBlob(produto.id, b.dataset.ver); openBlob(blob); }
        catch (e) { toast(e.message, true); }
        finally { b.disabled = false; }
      });
      $('#pdRotulos').querySelectorAll('[data-analisar]').forEach(b => b.onclick = async () => {
        b.disabled = true; b.textContent = 'Analisando…';
        try { await DB.analisarRotuloIA(produto.id, b.dataset.analisar); toast('Análise concluída.'); carregarRotulos(); }
        catch (e) { toast(e.message, true); b.disabled = false; b.textContent = '✨ Analisar com IA'; }
      });
      $('#pdRotulos').querySelectorAll('[data-aprovar]').forEach(b => b.onclick = async () => {
        try { await DB.decidirRotulo(produto.id, b.dataset.aprovar, true, ''); toast('Rótulo aprovado.'); carregarRotulos(); pacProdutos(cid); }
        catch (e) { toast(e.message, true); }
      });
      $('#pdRotulos').querySelectorAll('[data-reprovar]').forEach(b => b.onclick = async () => {
        const obs = prompt('Motivo da reprovação (opcional):') || '';
        try { await DB.decidirRotulo(produto.id, b.dataset.reprovar, false, obs); toast('Rótulo reprovado.'); carregarRotulos(); pacProdutos(cid); }
        catch (e) { toast(e.message, true); }
      });
    }
    carregarRotulos();

    if (podeGerir) {
      $('#pdArquivo').onchange = async (e) => {
        const file = e.target.files[0]; if (!file) return;
        toast('Enviando rótulo…');
        try {
          const dataUrl = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(new Error('Falha ao ler o arquivo.')); r.readAsDataURL(file); });
          await DB.uploadRotulo(produto.id, dataUrl);
          toast('Rótulo enviado.'); carregarRotulos(); pacProdutos(cid);
        } catch (err) { toast(err.message, true); }
        e.target.value = '';
      };
      $('#pdGerarTexto').onclick = async () => {
        $('#pdGerarTexto').disabled = true; $('#pdGerarTexto').textContent = 'Gerando…';
        $('#pdGerado').innerHTML = '';
        try {
          const { rascunho } = await DB.gerarTextoRotuloIA(produto.id);
          $('#pdGerado').innerHTML = `<div class="card" style="box-shadow:none;border:1px solid var(--line);margin-top:10px;background:var(--surface-2)">
            <div class="eyebrow" style="margin:0 0 6px">Rascunho gerado pela IA (copie para a peça gráfica)</div>
            <div style="font-size:.82rem"><strong>Ingredientes:</strong><br>${esc((rascunho.ingredientes || []).join(', '))}</div>
            ${rascunho.avisos?.length ? `<div style="font-size:.82rem;margin-top:8px"><strong>Avisos:</strong><br>${rascunho.avisos.map(a => esc(a)).join('<br>')}</div>` : ''}
            ${rascunho.tabelaNutricionalPendente?.length ? `<div style="font-size:.8rem;margin-top:8px;color:var(--warn)">⚠ Campos que dependem de laudo laboratorial (não preenchidos pela IA): ${rascunho.tabelaNutricionalPendente.map(esc).join(', ')}</div>` : ''}
            ${rascunho.observacao ? `<div class="muted" style="font-size:.76rem;margin-top:8px">${esc(rascunho.observacao)}</div>` : ''}
            <p class="muted" style="font-size:.74rem;margin-top:8px">Isto é sempre um rascunho — a peça gráfica final e a aprovação são responsabilidade humana (RT do contrato). Não vira uma versão de rótulo sozinho.</p>
          </div>`;
        } catch (err) { toast(err.message, true); }
        finally { $('#pdGerarTexto').disabled = false; $('#pdGerarTexto').textContent = '✨ Gerar texto com IA'; }
      };
    }
  }

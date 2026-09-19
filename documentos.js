// QShub — Documentos sanitários (licenças do contrato, com vencimento)
  // ══════════════════════════════════════════════════════════════
  // DOCUMENTOS SANITÁRIOS
  // ══════════════════════════════════════════════════════════════
  async function renderDocumentos() {
    const cid = getContratoAtual();
    view.innerHTML = `<div class="view-head"><div><div class="eyebrow">Contrato</div><h1>Documentos sanitários</h1>
      <p class="muted" style="font-size:.86rem;margin:.3rem 0 0">Licenças e registros do estabelecimento, com aviso de vencimento.</p></div>
      <div style="display:flex;gap:8px"><button class="btn sm" id="docPdf">Gerar PDF</button><button class="btn primary" id="docNovo">Novo documento</button></div></div>
      <div id="docChecklist" class="muted">Carregando checklist…</div>
      <div class="eyebrow" style="margin:18px 0 8px">Todos os documentos</div>
      <div id="docBody" class="muted">Carregando…</div>`;
    $('#docPdf').onclick = () => abrirRelatorioDocumentosModal();
    if (!cid) { $('#docNovo').style.display = 'none'; $('#docChecklist').innerHTML = ''; return $('#docBody').innerHTML = `<div class="empty"><strong>Escolha um contrato</strong>Selecione um contrato acima para ver os documentos.</div>`; }
    const podeGerir = ['administrador', 'gestor'].includes(papelNoContrato(cid));
    $('#docNovo').style.display = podeGerir ? '' : 'none';
    $('#docNovo').onclick = () => abrirDocumentoModal(cid, null, podeGerir);
    carregarChecklist(cid);
    await carregarDocumentos(cid, podeGerir);
  }

  // ── Checklist de conformidade: "merge" entre a lista pré-definida (filtrada
  // pelos regimes do contrato) e os documentos já cadastrados.
  async function carregarChecklist(cid) {
    const box = $('#docChecklist');
    let d;
    try { d = await DB.getDocumentosChecklist(cid); } catch (e) { return box.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
    const RANK = { vencida: 0, vencendo: 1, faltando: 2, sem_validade: 3, ok: 4 };
    const itens = d.itens.slice().sort((a, b) => RANK[a.status] - RANK[b.status]);
    box.innerHTML = `<div class="card" style="padding:14px 16px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
        <div class="eyebrow" style="margin:0">Checklist de conformidade</div>
        ${d.faltando > 0 ? `<span class="chip aberta">${d.faltando} obrigatório${d.faltando === 1 ? '' : 's'} faltando</span>` : `<span class="chip ok">Tudo cadastrado</span>`}
      </div>
      <div style="margin-top:8px">
        ${itens.map(i => `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:7px 0;border-top:1px solid var(--line)">
          <span style="font-size:.88rem">${esc(i.label)}${i.periodicidadeMeses ? ` <span class="muted" style="font-size:.76rem">(renova a cada ${i.periodicidadeMeses}m)</span>` : ''}</span>
          <span class="chip ${STATUS_DOC_CHIP[i.status]}">${STATUS_DOC_LABEL[i.status]}</span>
        </div>`).join('')}
      </div>
    </div>`;
  }

  async function carregarDocumentos(cid, podeGerir) {
    const body = $('#docBody'); body.innerHTML = '<p class="muted">Carregando…</p>';
    let docs;
    try { docs = await DB.getDocumentos(cid); } catch (e) { return body.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
    const rank = { vencida: 0, vencendo: 1, sem_validade: 2, ok: 3 };
    docs = docs.slice().sort((a, b) => rank[a.status] - rank[b.status]);
    body.innerHTML = docs.length ? docs.map(d => `<div class="card${d.status !== 'sem_validade' ? ' spine s-' + d.status : ''}">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
          <div><span class="chip ${STATUS_DOC_CHIP[d.status]}">${STATUS_DOC_LABEL[d.status]}</span>
            <strong style="margin-left:8px">${esc(d.tipoLabel || d.tipo)}</strong></div>
          ${podeGerir ? `<div style="display:flex;gap:6px;flex:none">
            <button class="btn sm" data-edit="${d.id}">Editar</button>
            <button class="btn sm danger" data-del="${d.id}">Excluir</button>
          </div>` : ''}
        </div>
        <div class="muted" style="font-size:.82rem;margin-top:6px">
          ${d.numero ? 'Nº ' + esc(d.numero) + ' · ' : ''}${d.orgaoEmissor ? esc(d.orgaoEmissor) + ' · ' : ''}${d.validade ? 'Validade: ' + fmtDate(d.validade) : (d.validadeEfetiva ? 'Vencimento estimado (periodicidade): ' + fmtDate(d.validadeEfetiva) : 'Sem validade definida')}
        </div>
        ${d.observacoes ? `<div style="font-size:.85rem;margin-top:6px">${esc(d.observacoes)}</div>` : ''}
        ${_anexoPreviewHTML(d.arquivo, d.arquivoMime, 90)}
      </div>`).join('')
      : `<div class="empty"><strong>Nenhum documento cadastrado</strong>Cadastre as licenças sanitárias deste contrato para acompanhar o vencimento.</div>`;
    body.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => abrirDocumentoModal(cid, docs.find(x => x.id === b.dataset.edit), podeGerir));
    body.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      if (!confirm('Excluir este documento?')) return;
      try { await DB.removeDocumento(b.dataset.del); toast('Documento excluído.'); carregarChecklist(cid); carregarDocumentos(cid, podeGerir); }
      catch (e) { toast(e.message, true); }
    });
  }

  // Imagem ou, se for PDF, uma prévia embutida (sem navegar/baixar — só olhar).
  // `arquivo` pode vir do SERVIDOR (documento já salvo, carregado de outro
  // dispositivo) — o backend só limita o TAMANHO, não o conteúdo. Sem esc(),
  // um dataUrl malicioso enviado direto pela API (fora desta UI) quebraria o
  // atributo src="..." e executaria script na tela de quem abrisse este
  // documento depois (achado e corrigido na auditoria — mesmo padrão de
  // ocorrencias.js/pac.js/cadastro.js/empresa.js).
  function _anexoPreviewHTML(arquivo, mime, maxH) {
    if (!arquivo) return '';
    if (mime === 'application/pdf') return `<div style="margin-top:8px"><embed src="${esc(arquivo)}" type="application/pdf" style="width:100%;height:220px;border:1px solid var(--line);border-radius:8px"></div>`;
    return `<div style="margin-top:8px"><img src="${esc(arquivo)}" style="max-height:${maxH}px;border:1px solid var(--line);border-radius:8px;padding:4px;background:#fff"></div>`;
  }

  // Lê um arquivo (PDF cru, ou imagem redimensionada) para anexar/enviar à
  // leitura automática. Devolve { dataUrl, mime }.
  const ANEXO_MAX_BYTES = 3 * 1024 * 1024; // ~3 MB, mesmo teto do backend
  function _lerAnexo(file) {
    return new Promise((resolve, reject) => {
      if (file.size > ANEXO_MAX_BYTES) return reject(new Error('Arquivo muito grande (máx. 3 MB).'));
      if (file.type === 'application/pdf') {
        const r = new FileReader();
        r.onload = () => resolve({ dataUrl: r.result, mime: 'application/pdf' });
        r.onerror = () => reject(new Error('Falha ao ler o arquivo.'));
        r.readAsDataURL(file);
        return;
      }
      if (!file.type.startsWith('image/')) return reject(new Error('Envie uma imagem (foto/scan) ou um PDF.'));
      _lerLogo(file).then(dataUrl => resolve({ dataUrl, mime: 'image/png' })).catch(reject);
    });
  }

  function abrirDocumentoModal(cid, d, podeGerir) {
    if (!podeGerir) return;
    const ed = !!d;
    openModal(`<h2>${ed ? 'Editar' : 'Novo'} documento</h2>
      <label class="field"><span>Tipo</span><select id="dTipo">
        ${TIPOS_DOCUMENTO.map(t => `<option value="${t.key}" ${ed && d.tipo === t.key ? 'selected' : ''}>${t.label}</option>`).join('')}
      </select></label>
      <div id="dTipoOutroWrap" style="display:${ed && d.tipo === 'outro' ? 'block' : 'none'}">
        <label class="field"><span>Descreva o tipo</span><input id="dTipoOutro" value="${ed ? esc(d.tipoLabel || '') : ''}"></label>
      </div>
      <div class="row"><label class="field"><span>Número</span><input id="dNumero" value="${ed ? esc(d.numero || '') : ''}"></label>
        <label class="field"><span>Órgão emissor</span><input id="dOrgao" value="${ed ? esc(d.orgaoEmissor || '') : ''}"></label></div>
      <div class="row"><label class="field"><span>Emissão</span><input type="date" id="dEmissao" value="${ed ? (d.dataEmissao || '') : ''}"></label>
        <label class="field"><span>Validade (em branco se não vence)</span><input type="date" id="dValidade" value="${ed ? (d.validade || '') : ''}"></label></div>
      <label class="field"><span>Observações</span><textarea id="dObs">${ed ? esc(d.observacoes || '') : ''}</textarea></label>
      <label class="field"><span>Anexo (opcional — foto, scan ou PDF do documento)</span><input type="file" id="dArquivo" accept="image/*,application/pdf"></label>
      <div id="dArquivoPrev">${_anexoPreviewHTML(ed ? d.arquivo : null, ed ? d.arquivoMime : null, 80)}</div>
      <div id="dIaWrap" style="display:none;margin:4px 0 14px">
        <button type="button" class="btn ghost sm" id="dIaBtn">✨ Ler documento automaticamente (IA)</button>
        <p class="muted" style="font-size:.74rem;margin:4px 0 0">A leitura é uma sugestão — confira e ajuste os campos antes de salvar. Nada é preenchido sem você confirmar.</p>
        <div id="dIaResultado"></div>
      </div>
      <div class="actions"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" id="dOk">Salvar</button></div>`);
    let arquivo = ed ? (d.arquivo || null) : null;
    let arquivoMime = ed ? (d.arquivoMime || null) : null;
    $('#dTipo').onchange = () => { $('#dTipoOutroWrap').style.display = $('#dTipo').value === 'outro' ? 'block' : 'none'; };
    $('#dArquivo').onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      $('#dIaResultado').innerHTML = '';
      try {
        const lido = await _lerAnexo(file);
        arquivo = lido.dataUrl; arquivoMime = lido.mime;
        $('#dArquivoPrev').innerHTML = _anexoPreviewHTML(arquivo, arquivoMime, 80);
        $('#dIaWrap').style.display = 'block';
      } catch (err) { toast(err.message, true); }
    };
    $('#dIaBtn').onclick = async () => {
      if (!arquivo) return;
      $('#dIaBtn').disabled = true; $('#dIaBtn').textContent = 'Lendo…';
      $('#dIaResultado').innerHTML = '';
      try {
        const { extracao, modelo } = await DB.lerDocumentoIA(cid, arquivo, arquivoMime);
        $('#dIaResultado').innerHTML = _painelSugestaoIA(extracao, modelo);
        const aplicar = document.getElementById('dIaAplicar');
        if (aplicar) aplicar.onclick = () => {
          if (extracao.tipoSugerido) { $('#dTipo').value = extracao.tipoSugerido; $('#dTipo').dispatchEvent(new Event('change')); }
          if (extracao.numero) $('#dNumero').value = extracao.numero;
          if (extracao.orgaoEmissor) $('#dOrgao').value = extracao.orgaoEmissor;
          if (extracao.dataEmissao) $('#dEmissao').value = extracao.dataEmissao;
          if (extracao.validade) $('#dValidade').value = extracao.validade;
          toast('Sugestão aplicada — confira os campos antes de salvar.');
        };
        const descartar = document.getElementById('dIaDescartar');
        if (descartar) descartar.onclick = () => { $('#dIaResultado').innerHTML = ''; };
      } catch (err) { toast(err.message, true); }
      finally { $('#dIaBtn').disabled = false; $('#dIaBtn').textContent = '✨ Ler documento automaticamente (IA)'; }
    };
    $('#dOk').onclick = async () => {
      const tipo = $('#dTipo').value;
      if (tipo === 'outro' && !$('#dTipoOutro').value.trim()) return toast('Descreva o tipo do documento.', true);
      const payload = {
        tipo, tipoLabel: tipo === 'outro' ? $('#dTipoOutro').value.trim() : undefined,
        numero: $('#dNumero').value.trim(), orgaoEmissor: $('#dOrgao').value.trim(),
        dataEmissao: $('#dEmissao').value || null, validade: $('#dValidade').value || null,
        observacoes: $('#dObs').value.trim(), arquivo, arquivoMime,
      };
      if (ed) payload.id = d.id;
      $('#dOk').disabled = true;
      try { await DB.saveDocumento(cid, payload); closeModal(); toast('Documento salvo.'); carregarChecklist(cid); carregarDocumentos(cid, podeGerir); }
      catch (err) { toast(err.message, true); $('#dOk').disabled = false; }
    };
    if (arquivo) $('#dIaWrap').style.display = 'block';
  }

  // Painel de revisão da sugestão da IA — nunca aplica nada sozinho; só
  // mostra o que foi lido (com a evidência e a confiança) e espera o clique.
  function _painelSugestaoIA(ex, modelo) {
    const confChip = { alta: 'ok', media: 'vencendo', baixa: 'vencida' }[ex.confianca] || 'neutral';
    const tipoInfo = TIPOS_DOCUMENTO.find(t => t.key === ex.tipoSugerido);
    const campo = (label, v) => `<div style="font-size:.83rem;margin-top:3px"><span class="muted">${label}:</span> ${v ? `<strong>${esc(v)}</strong>` : '<span class="muted">não identificado</span>'}</div>`;
    return `<div class="card" style="box-shadow:none;border:1px solid var(--line);margin-top:10px;background:var(--surface-2)">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
        <div class="eyebrow" style="margin:0">Sugestão da IA (${esc(modelo)})</div>
        <span class="chip ${confChip}">Confiança: ${ex.confianca}</span>
      </div>
      ${campo('Tipo', tipoInfo ? tipoInfo.label : null)}
      ${campo('Número', ex.numero)}
      ${campo('Órgão emissor', ex.orgaoEmissor)}
      ${campo('Emissão', ex.dataEmissao ? fmtDate(ex.dataEmissao) : null)}
      ${campo('Validade', ex.validade ? fmtDate(ex.validade) : null)}
      ${ex.trechoEvidencia ? `<div style="font-size:.78rem;margin-top:6px;padding:6px 8px;border-left:2px solid var(--line);color:var(--muted)">“${esc(ex.trechoEvidencia)}”</div>` : ''}
      ${ex.observacao ? `<div style="font-size:.78rem;margin-top:6px;color:var(--warn)">⚠ ${esc(ex.observacao)}</div>` : ''}
      <p class="muted" style="font-size:.74rem;margin:8px 0 0">Nada foi preenchido ainda. Revise acima e confirme.</p>
      <div style="margin-top:8px;display:flex;gap:8px">
        <button type="button" class="btn ghost sm" id="dIaDescartar">Descartar</button>
        <button type="button" class="btn primary sm" id="dIaAplicar">Aplicar ao formulário</button>
      </div>
    </div>`;
  }

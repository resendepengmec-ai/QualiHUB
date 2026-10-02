// QualiHUB — Relatório PDF (pdfmake)
  // ── Filtro "por período de visita" — reaproveitado nos modais de relatório.
  // Preenche De/Até com o intervalo entre uma visita e a anterior (ou o início,
  // se for a primeira). Some quando o contrato não tem visitas registradas.
  async function _wireFiltroVisita(cid, selId, fromId, toId) {
    const sel = document.getElementById(selId);
    const wrap = sel ? sel.closest('label') : null;
    if (!sel || !cid) { if (wrap) wrap.style.display = 'none'; return; }
    let visitas = [];
    try { visitas = (await DB.getVisitas(cid)).visitas || []; } catch (e) {}
    if (!visitas.length) { if (wrap) wrap.style.display = 'none'; return; }
    if (wrap) wrap.style.display = '';
    const asc = visitas.slice().reverse(); // mais antiga primeiro
    sel.innerHTML = '<option value="">Personalizado (datas abaixo)</option>' +
      asc.map((v, i) => `<option value="${i}">Visita de ${fmtDate(v.data)}</option>`).join('');
    sel.value = '';
    sel.onchange = () => {
      if (sel.value === '') return;
      const i = Number(sel.value);
      document.getElementById(toId).value = asc[i].data;
      document.getElementById(fromId).value = i > 0 ? asc[i - 1].data : '';
    };
  }

  // ── Relatório PDF (por período / contrato / estabelecimento) ────
  function abrirRelatorioModal() {
    // Etapa 1 — o filtro de estabelecimento segue o CONTRATO escolhido aqui
    // no próprio modal (antes era uma lista fixa de todos os
    // estabelecimentos do usuário, sem relação com o contrato selecionado).
    const estOptsPara = (cid) => {
      let ests = [];
      if (cid) ests = estabelecimentosDoContrato(cid);
      else contratos.forEach(c => { ests = ests.concat(estabelecimentosDoContrato(c.id)); });
      return ests.map(e => `<option value="${esc(e.id)}">${esc(e.nome)}</option>`).join('');
    };
    openModal(`<div class="eyebrow">Ocorrências</div><h2>Gerar PDF</h2>
      <label class="field"><span>Contrato</span><select id="rContrato">
        <option value="">Todos os meus contratos</option>
        ${contratos.map(c => `<option value="${c.id}">${esc(c.numero)}${c.objeto ? ' — ' + esc(c.objeto) : ''}</option>`).join('')}</select></label>
      <label class="field" id="rEstWrap"><span>Estabelecimento</span><select id="rEst"><option value="">Todos</option>${estOptsPara(null)}</select></label>
      <label class="field" style="display:none"><span>Ou pelo período de uma visita</span><select id="rVisita"></select></label>
      <div class="row"><label class="field"><span>De</span><input type="date" id="rFrom"></label>
        <label class="field"><span>Até</span><input type="date" id="rTo"></label></div>
      <p class="muted" style="font-size:.78rem">Se escolher um contrato, o filtro de estabelecimento é ignorado. Sem datas, entram todas as ocorrências.</p>
      <div class="actions"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" id="rGerar">Gerar</button></div>`);
    $('#rContrato').onchange = () => {
      _wireFiltroVisita($('#rContrato').value, 'rVisita', 'rFrom', 'rTo');
      $('#rEst').innerHTML = '<option value="">Todos</option>' + estOptsPara($('#rContrato').value);
      $('#rEstWrap').style.display = $('#rContrato').value ? 'none' : '';
    };
    $('#rGerar').onclick = async () => {
      const p = new URLSearchParams();
      if ($('#rContrato').value) p.set('contrato', $('#rContrato').value);
      else if ($('#rEst').value) p.set('estabelecimento', $('#rEst').value);
      if ($('#rFrom').value) p.set('from', $('#rFrom').value);
      if ($('#rTo').value) p.set('to', $('#rTo').value);
      $('#rGerar').disabled = true;
      try { const dados = await DB.getRelatorioOcorrencias(p.toString()); closeModal(); gerarRelatorioPDF(dados); }
      catch (e) { toast(e.message, true); $('#rGerar').disabled = false; }
    };
  }

  async function abrirRelatorioPacModal() {
    const cid = getContratoAtual(); if (!cid) return toast('Selecione um contrato.', true);
    let planilhas = [];
    try { planilhas = (await DB.getPlanilhasDoContrato(cid)).planilhas || []; } catch (e) {}
    openModal(`<div class="eyebrow">P.A.C.</div><h2>Gerar PDF</h2>
      <label class="field"><span>Planilha</span><select id="rpPlan"><option value="">Todas as planilhas</option>${planilhas.map(p => `<option value="${p.id}">${esc(p.nome)}</option>`).join('')}</select></label>
      <label class="field" style="display:none"><span>Ou pelo período de uma visita</span><select id="rpVisita"></select></label>
      <div class="row"><label class="field"><span>De</span><input type="date" id="rpFrom"></label>
        <label class="field"><span>Até</span><input type="date" id="rpTo"></label></div>
      <p class="muted" style="font-size:.78rem">Sem datas, entram todos os registros do contrato.</p>
      <div class="actions"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" id="rpGerar">Gerar</button></div>`);
    _wireFiltroVisita(cid, 'rpVisita', 'rpFrom', 'rpTo');
    $('#rpGerar').onclick = async () => {
      const p = new URLSearchParams(); p.set('contrato', cid);
      if ($('#rpPlan').value) p.set('planilha', $('#rpPlan').value);
      if ($('#rpFrom').value) p.set('from', $('#rpFrom').value);
      if ($('#rpTo').value) p.set('to', $('#rpTo').value);
      $('#rpGerar').disabled = true;
      try { const dados = await DB.getRelatorioPac(p.toString()); closeModal(); pdfPac(dados); }
      catch (e) { toast(e.message, true); $('#rpGerar').disabled = false; }
    };
  }

  function pdfPac(d) {
    toast('Gerando PDF...');
    ensurePdfMake().then(() => {
      const cab = d.cabecalho || {};
      const temBranding = !!(cab.logoDataUrl || cab.razaoSocial || cab.nomeFantasia);
      const periodo = (d.escopo.from || d.escopo.to)
        ? (d.escopo.from ? fmtDate(d.escopo.from) : 'inicio') + ' a ' + (d.escopo.to ? fmtDate(d.escopo.to) : 'hoje') : 'Todo o periodo';
      const geradoEm = new Date(d.geradoEm).toLocaleString('pt-BR');
      const header = () => {
        const emp = [{ text: cab.razaoSocial || cab.nomeFantasia || 'QShub', bold: true, fontSize: 12, color: '#2E6620' }];
        if (cab.nomeFantasia && cab.razaoSocial) emp.push({ text: cab.nomeFantasia, fontSize: 8, color: '#5e6b65' });
        if (cab.cnpj) emp.push({ text: 'CNPJ: ' + cab.cnpj, fontSize: 8, color: '#5e6b65' });
        if (cab.endereco) emp.push({ text: cab.endereco, fontSize: 8, color: '#5e6b65' });
        if (cab.contato) emp.push({ text: cab.contato, fontSize: 8, color: '#5e6b65' });
        const cols = [];
        if (cab.logoDataUrl) cols.push({ image: cab.logoDataUrl, fit: [110, 46], margin: [0, 0, 12, 0] });
        cols.push({ stack: emp, width: '*' });
        return { margin: [40, 22, 40, 0], stack: [
          { columns: cols, columnGap: 10 },
          { canvas: [{ type: 'line', x1: 0, y1: 6, x2: 515, y2: 6, lineWidth: 0.7, lineColor: '#45912E' }] },
        ] };
      };
      const footer = (cp, pc) => ({ margin: [40, 8, 40, 0], columns: [
        { text: 'Gerado por ' + d.geradoPor + ' em ' + geradoEm, fontSize: 7, color: '#8a938e' },
        { text: 'Pagina ' + cp + ' de ' + pc, alignment: 'right', fontSize: 7, color: '#8a938e' },
      ] });
      const valores = (reg) => {
        const dd = reg.dados || {};
        if (Array.isArray(dd.leituras)) {
          const l = dd.leituras.map(x => `${x.nome}: ${x.valor}°C ${x.conforme ? '(conforme)' : '(não conforme)'}`);
          l.push('Conformidade geral: ' + (dd.conformeGeral ? 'conforme' : 'não conforme') + (reg.origem === 'iot' ? ' · IoT' : ''));
          // Telemetria ambiental (ambiente/umidade/bateria) — só enriquece o
          // registro quando presente (sensor Tuya); nunca entra na
          // conformidade, que continua baseada só na sonda (dd.leituras acima).
          const tel = dd.telemetria;
          if (tel) {
            if (tel.ambiente) l.push(`Temperatura ambiente: ${tel.ambiente.temperaturaC}°C`);
            if (tel.umidade) l.push(`Umidade ambiente: ${tel.umidade.valorPct}%`);
            if (tel.bateria) l.push(`Tensão da bateria: ${tel.bateria.label || tel.bateria.estado}`);
          }
          return l.join('\n');
        }
        const parts = [];
        (reg.campos || []).forEach(c => { const v = dd[c.key]; if (v !== undefined && v !== null && v !== '') parts.push(c.label + ': ' + v + (c.unidade ? ' ' + c.unidade : '')); });
        return parts.length ? parts.join('   ·   ') : '(sem dados)';
      };
      const blocoReg = (reg, n) => {
        const meta = [reg.criadoEm ? new Date(reg.criadoEm).toLocaleString('pt-BR') : '-'];
        if (reg.criadoPorNome) meta.push('por ' + reg.criadoPorNome);
        if (reg.aprovacao && reg.aprovacao.status) meta.push('aprovação: ' + reg.aprovacao.status);
        return { stack: [
          { text: [{ text: n + '. ', bold: true, color: '#2E6620' }, { text: valores(reg) }], fontSize: 9.5 },
          { text: meta.join('  -  '), fontSize: 7.5, color: '#8a938e', margin: [0, 2, 0, 0] },
        ], unbreakable: true, margin: [0, 0, 0, 8] };
      };
      const body = [
        { text: 'Relatorio do P.A.C.', fontSize: 15, bold: true, margin: [0, 4, 0, 2] },
        { text: 'Contrato ' + (d.escopo.contratoNumero || '-') + (d.escopo.estabelecimentoNome ? '  -  ' + d.escopo.estabelecimentoNome : ''), fontSize: 9, color: '#5e6b65' },
        { text: 'Periodo: ' + periodo + (d.escopo.planilha ? '   -   Planilha: ' + d.escopo.planilha : '') + '   -   ' + d.total + ' registro(s)', fontSize: 9, color: '#5e6b65', margin: [0, 0, 0, 12] },
      ];
      const grupos = {};
      d.registros.forEach(r => { (grupos[r.planilhaNome] = grupos[r.planilhaNome] || []).push(r); });
      const chaves = Object.keys(grupos);
      if (!d.registros.length) body.push({ text: 'Nenhum registro no escopo selecionado.', italics: true, color: '#8a938e' });
      chaves.forEach((k, gi) => {
        body.push({ text: k, fontSize: 11, bold: true, color: '#45912E', margin: [0, gi > 0 ? 10 : 4, 0, 6] });
        let n = 1; grupos[k].forEach(r => body.push(blocoReg(r, n++)));
      });
      body.push({ canvas: [{ type: 'line', x1: 0, y1: 6, x2: 515, y2: 6, lineWidth: 0.5, lineColor: '#cccccc' }], margin: [0, 8, 0, 0] });
      if (d.rt && (d.rt.nome || d.rt.conselho)) body.push({ text: [{ text: 'Responsável Técnico: ', bold: true }, { text: (d.rt.nome || '') + (d.rt.conselho ? ' — ' + d.rt.conselho : '') }], fontSize: 8.5, margin: [0, 6, 0, 2] });
      body.push({ text: [{ text: 'Assinatura digital (HMAC): ', bold: true }, { text: d.assinatura.hash }], fontSize: 7.5, margin: [0, 6, 0, 0] });
      body.push({ text: 'keyId: ' + d.assinatura.keyId + '  -  documento gerado em ' + geradoEm, fontSize: 7.5, color: '#5e6b65' });
      return _finalizarPdf({
        pageSize: 'A4', pageMargins: [40, temBranding ? 96 : 70, 40, 42],
        header, footer, content: body, defaultStyle: { fontSize: 10, color: '#12211c' },
      }, 'pac-' + (d.escopo.contratoNumero || '') + '.pdf');
    }).catch(e => toast('Nao foi possivel gerar o PDF: ' + e.message, true));
  }

  // Carrega o pdfmake sob demanda (CDN) para gerar PDF A4 formatado. Duas
  // fontes (cdnjs, depois jsdelivr) — em rede móvel/corporativa é comum UMA
  // CDN estar bloqueada/lenta mas não a outra; sem isto, "Gerar PDF" falhava
  // de forma pouco clara sempre que a única fonte configurada estava fora.
  let _pdfLoad;
  const _PDFMAKE_SRCS = [
    ['https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/pdfmake.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/vfs_fonts.js'],
    ['https://cdn.jsdelivr.net/npm/pdfmake@0.2.10/build/pdfmake.min.js', 'https://cdn.jsdelivr.net/npm/pdfmake@0.2.10/build/vfs_fonts.js'],
  ];
  function ensurePdfMake() {
    if (window.pdfMake && window.pdfMake.vfs) return Promise.resolve();
    if (_pdfLoad) return _pdfLoad;
    const load = (src) => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Falha ao carregar ' + src)); document.head.appendChild(s); });
    const tentar = (i) => load(_PDFMAKE_SRCS[i][0]).then(() => load(_PDFMAKE_SRCS[i][1]))
      .catch(err => { if (i + 1 < _PDFMAKE_SRCS.length) return tentar(i + 1); throw new Error('Não foi possível carregar o gerador de PDF (sem conexão com as CDNs). Verifique sua internet e tente novamente.'); });
    _pdfLoad = tentar(0).catch(err => { _pdfLoad = null; throw err; });
    return _pdfLoad;
  }

  // Finaliza um docDefinition do pdfMake: pega o Blob (em vez de só chamar
  // .download(), que no iOS Safari costuma abrir o PDF sem oferecer "Salvar")
  // e usa openOrShareFile() (file-output.js) — Web Share quando disponível,
  // download por Blob URL como fallback. Dá feedback de sucesso/erro sempre;
  // nunca deixa o usuário sem saber se funcionou.
  function _finalizarPdf(docDefinition, filename) {
    return new Promise((resolve, reject) => {
      try {
        pdfMake.createPdf(docDefinition).getBlob(blob => {
          openOrShareFile(blob, filename, 'application/pdf')
            .then(resultado => { if (resultado !== 'cancelled') toast('PDF pronto.'); resolve(resultado); })
            .catch(reject);
        });
      } catch (e) { reject(e); }
    });
  }

  // GET /relatorios/ocorrencias manda as ocorrências no formato "de
  // listagem" (thumbUrl/arquivoPath, nunca dataUrl — Etapa 2 do
  // PERFORMANCE.md tirou o binário do banco). O PDF precisa da foto em
  // tamanho cheio; busca sob demanda pela mesma rota já usada pra ampliar
  // foto na tela (GET /ocorrencias/:id/fotos), em BLOCOS pequenos
  // (Promise.all limitado, não tudo de uma vez) pra não gerar uma rajada de
  // N requisições simultâneas nem prender a resposta de nenhuma delas em
  // memória por mais tempo que o necessário — mesmo raciocínio de RAM/banda
  // da rodada anterior, só que aplicado ao lado do cliente que monta o PDF.
  const LOTE_FOTOS_PDF = 5;
  async function _carregarFotosParaPdf(ocorrencias, onProgresso) {
    const comFotos = ocorrencias.filter(o =>
      (o.fotos || []).some(f => f && f.arquivoPath) || (o.fotosExecucao || []).some(f => f && f.arquivoPath));
    for (let i = 0; i < comFotos.length; i += LOTE_FOTOS_PDF) {
      const lote = comFotos.slice(i, i + LOTE_FOTOS_PDF);
      if (onProgresso) onProgresso(Math.min(i + LOTE_FOTOS_PDF, comFotos.length), comFotos.length);
      await Promise.all(lote.map(async (o) => {
        try {
          const r = await DB.getFotosOcorrencia(o.id);
          if (r.fotos) o.fotos = r.fotos;
          if (r.fotosExecucao) o.fotosExecucao = r.fotosExecucao;
        } catch (e) { /* essa ocorrência fica sem foto no PDF, o resto do relatório segue normal */ }
      }));
    }
  }

  function gerarRelatorioPDF(d) {
    toast('Gerando PDF...');
    ensurePdfMake().then(async () => {
      await _carregarFotosParaPdf(d.ocorrencias, (feito, total) => toast(`Gerando PDF... carregando fotos (${feito}/${total})`));
      const cab = d.cabecalho || {};
      const temBranding = !!(cab.logoDataUrl || cab.razaoSocial || cab.nomeFantasia);
      const linhaEscopo = [d.escopo.contratoNumero ? 'Contrato ' + d.escopo.contratoNumero : 'Todos os contratos'];
      if (d.escopo.estabelecimentoNome) linhaEscopo.push('Estabelecimento: ' + d.escopo.estabelecimentoNome);
      const periodo = (d.escopo.from || d.escopo.to)
        ? (d.escopo.from ? fmtDate(d.escopo.from) : 'inicio') + ' a ' + (d.escopo.to ? fmtDate(d.escopo.to) : 'hoje') : 'Todo o periodo';
      const geradoEm = new Date(d.geradoEm).toLocaleString('pt-BR');

      const header = () => {
        const emp = [{ text: cab.razaoSocial || cab.nomeFantasia || 'QShub', bold: true, fontSize: 12, color: '#2E6620' }];
        if (cab.nomeFantasia && cab.razaoSocial) emp.push({ text: cab.nomeFantasia, fontSize: 8, color: '#5e6b65' });
        if (cab.cnpj) emp.push({ text: 'CNPJ: ' + cab.cnpj, fontSize: 8, color: '#5e6b65' });
        if (cab.endereco) emp.push({ text: cab.endereco, fontSize: 8, color: '#5e6b65' });
        if (cab.contato) emp.push({ text: cab.contato, fontSize: 8, color: '#5e6b65' });
        const cols = [];
        if (cab.logoDataUrl) cols.push({ image: cab.logoDataUrl, fit: [110, 46], margin: [0, 0, 12, 0] });
        cols.push({ stack: emp, width: '*' });
        return { margin: [40, 22, 40, 0], stack: [
          { columns: cols, columnGap: 10 },
          { canvas: [{ type: 'line', x1: 0, y1: 6, x2: 515, y2: 6, lineWidth: 0.7, lineColor: '#45912E' }] },
        ] };
      };
      const footer = (currentPage, pageCount) => ({ margin: [40, 8, 40, 0], columns: [
        { text: 'Gerado por ' + (d.geradoPor || d.geradoPorEmail) + ' em ' + geradoEm, fontSize: 7, color: '#8a938e' },
        { text: 'Pagina ' + currentPage + ' de ' + pageCount, alignment: 'right', fontSize: 7, color: '#8a938e' },
      ] });

      function bloco(o, n) {
        const st = statusOcorrencia(o);
        const linha = [];
        if (o.contratoNumero) linha.push('Contrato ' + o.contratoNumero);
        if (o.estabelecimentoNome) linha.push(o.estabelecimentoNome);
        linha.push('Gravidade: ' + (o.gravidade || '-'));
        linha.push(st.label);
        linha.push('Prazo: ' + (o.prazoCorrecao ? fmtDate(o.prazoCorrecao) : '-'));
        linha.push('Criada por ' + (o.criadoPorNome || o.criadoPor || '-') + (o.criadoEm ? ' em ' + new Date(o.criadoEm).toLocaleDateString('pt-BR') : ''));
        linha.push('Atribuida a ' + (o.atribuidoA || '-'));
        const c = [
          { text: [{ text: n + '. ', bold: true, color: '#2E6620' }, { text: o.descricao || '', bold: true }], fontSize: 10.5 },
          { text: linha.join('  -  '), fontSize: 8, color: '#5e6b65', margin: [0, 2, 0, 0] },
        ];
        if (o.acaoCorretiva) c.push({ text: [{ text: 'Ação corretiva: ', bold: true }, { text: o.acaoCorretiva }], fontSize: 8.5, margin: [0, 4, 0, 0] });
        const fotos = (o.fotos || []).concat(o.fotosExecucao || []).filter(f => f && f.dataUrl);
        for (let k = 0; k < fotos.length; k += 3) {
          c.push({ columns: fotos.slice(k, k + 3).map(f => ({ image: f.dataUrl, fit: [150, 150] })), columnGap: 8, margin: [0, 6, 0, 0] });
        }
        if (o.execucao) c.push({ text: [{ text: 'Correcao: ', bold: true }, { text: o.execucao.descricaoExecucao + ' - executada em ' + fmtDate(o.execucao.dataExecucao) + ' por ' + (o.execucao.porNome || o.execucao.por) }], fontSize: 8.5, margin: [0, 6, 0, 0] });
        return { stack: c, unbreakable: true, margin: [0, 0, 0, 12] };
      }

      const body = [
        { text: 'Relatorio de Ocorrencias', fontSize: 15, bold: true, margin: [0, 4, 0, 2] },
        { text: linhaEscopo.join('  -  '), fontSize: 9, color: '#5e6b65' },
        { text: 'Periodo: ' + periodo + '   -   ' + d.total + ' ocorrencia(s)', fontSize: 9, color: '#5e6b65', margin: [0, 0, 0, 12] },
      ];
      const grupos = {};
      d.ocorrencias.forEach(o => { const key = o.contratoNumero || '-'; (grupos[key] = grupos[key] || []).push(o); });
      const chaves = Object.keys(grupos);
      if (!d.ocorrencias.length) body.push({ text: 'Nenhuma ocorrencia no escopo selecionado.', italics: true, color: '#8a938e' });
      chaves.forEach((key, gi) => {
        if (chaves.length > 1) body.push({ text: 'Contrato ' + key, fontSize: 11, bold: true, color: '#45912E', pageBreak: gi > 0 ? 'before' : undefined, margin: [0, gi > 0 ? 0 : 4, 0, 8] });
        let n = 1; grupos[key].forEach(o => body.push(bloco(o, n++)));
      });
      body.push({ canvas: [{ type: 'line', x1: 0, y1: 6, x2: 515, y2: 6, lineWidth: 0.5, lineColor: '#cccccc' }], margin: [0, 8, 0, 0] });
      if (d.rt && (d.rt.nome || d.rt.conselho)) body.push({ text: [{ text: 'Responsável Técnico: ', bold: true }, { text: (d.rt.nome || '') + (d.rt.conselho ? ' — ' + d.rt.conselho : '') }], fontSize: 8.5, margin: [0, 6, 0, 2] });
      body.push({ text: [{ text: 'Assinatura digital (HMAC): ', bold: true }, { text: d.assinatura.hash }], fontSize: 7.5, margin: [0, 6, 0, 0] });
      body.push({ text: 'keyId: ' + d.assinatura.keyId + '  -  documento gerado em ' + geradoEm, fontSize: 7.5, color: '#5e6b65' });
      body.push({ text: 'As fotos carregam o rotulo de data/hora e localizacao registrados pelo dispositivo no momento da captura.', fontSize: 7.5, color: '#8a938e', margin: [0, 3, 0, 0] });

      const nomeArq = 'ocorrencias' + (d.escopo.contratoNumero ? '-' + d.escopo.contratoNumero : '') + '.pdf';
      return _finalizarPdf({
        pageSize: 'A4',
        pageMargins: [40, temBranding ? 96 : 70, 40, 42],
        header, footer, content: body,
        defaultStyle: { fontSize: 10, color: '#12211c' },
      }, nomeArq);
    }).catch(e => toast('Nao foi possivel gerar o PDF: ' + e.message, true));
  }

  // ── Relatório dedicado de Temperatura ──────────────────────────────
  // Gerador PRÓPRIO (não reaproveita pdfPac/relatório genérico): período +
  // seleção de equipamentos + modo de gráfico agrupado/individual, capa,
  // KPIs, uma seção por equipamento (identificação, config, limites,
  // gráfico quando individual, tabela de medições brutas COMPLETA — nunca
  // truncada) e frequência configurada vs. observada. Dados vêm já
  // filtrados pelo servidor (GET /contratos/:id/temperatura/relatorio),
  // nunca baixando o histórico inteiro do contrato.
  async function abrirRelatorioTemperaturaModal() {
    const cid = getContratoAtual(); if (!cid) return toast('Selecione um contrato.', true);
    let eqs = [];
    try { eqs = await DB.getEquipamentos(cid); } catch (e) { return toast(e.message, true); }
    openModal(`<div class="eyebrow">Temperatura</div><h2>Gerar PDF</h2>
      <div class="row"><label class="field"><span>De</span><input type="date" id="rtFrom"></label>
        <label class="field"><span>Até</span><input type="date" id="rtTo"></label></div>
      <label class="field"><span>Modo do gráfico</span><select id="rtModoGrafico">
        <option value="agrupado">Agrupado (todos os equipamentos no mesmo gráfico)</option>
        <option value="individual">Individual (um gráfico por equipamento)</option>
      </select></label>
      <div class="field"><span>Equipamentos (vazio = todos)</span>
        <div style="max-height:160px;overflow:auto;border:1px solid var(--line);border-radius:8px;padding:8px">
          ${eqs.length ? eqs.map(e => `<label style="display:flex;gap:6px;align-items:center;font-size:.85rem;margin:2px 0"><input type="checkbox" class="rtEq" value="${esc(e.id)}">${esc(e.nome)}</label>`).join('') : '<span class="muted">Nenhum equipamento cadastrado.</span>'}
        </div>
      </div>
      <p class="muted" style="font-size:.78rem">Sem datas, entram todos os registros de temperatura do contrato. A tabela de medições brutas nunca é truncada, mesmo com muitos registros.</p>
      <div class="actions"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" id="rtGerar">Gerar</button></div>`);
    $('#rtGerar').onclick = async () => {
      const from = $('#rtFrom').value || undefined, to = $('#rtTo').value || undefined;
      const modoGrafico = $('#rtModoGrafico').value;
      const equipamentos = [...document.querySelectorAll('.rtEq:checked')].map(c => c.value);
      $('#rtGerar').disabled = true;
      try {
        const dados = await DB.getRelatorioTemperatura(cid, { from, to, equipamentos });
        closeModal();
        await gerarPdfTemperatura(dados, { modoGrafico, from, to });
      } catch (e) { toast(e.message, true); $('#rtGerar').disabled = false; }
    };
  }

  const ORIGEM_LABEL_TEMP = { manual: 'Manual', iot_tuya: 'IoT (Tuya)', iot_generico: 'IoT (genérico)' };

  // Canvas desacoplado do DOM, com tamanho FIXO em pixels — usado só pra
  // capturar a imagem do gráfico (toBase64Image) e embutir no PDF; nunca
  // é exibido na tela. animation:false (ver temperature-chart.js) garante
  // que a imagem já sai completa, sem esperar nenhuma transição.
  function _canvasOffscreen(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  // Frequência OBSERVADA: medições por dia corrido no período, a partir
  // dos timestamps reais das leituras — nunca inventada, só contada.
  function _frequenciaObservada(leiturasDoEquip) {
    if (!leiturasDoEquip.length) return 0;
    const dias = new Set(leiturasDoEquip.map(l => new Date(l.criadoEm || 0).toISOString().slice(0, 10)));
    return +(leiturasDoEquip.length / dias.size).toFixed(1);
  }

  async function gerarPdfTemperatura(dados, opcoes) {
    toast('Gerando PDF...');
    try {
      await Promise.all([ensurePdfMake(), ensureChartJs()]);
      const equipamentos = dados.equipamentos || [];
      const leituras = dados.leituras || [];
      const geradoEm = new Date(dados.geradoEm || Date.now()).toLocaleString('pt-BR');
      const periodo = (opcoes.from || opcoes.to) ? (opcoes.from ? fmtDate(opcoes.from) : 'início') + ' a ' + (opcoes.to ? fmtDate(opcoes.to) : 'hoje') : 'Todo o período';

      // KPIs do escopo selecionado.
      const totalLeituras = leituras.length;
      const conformes = leituras.filter(l => l.conforme).length;
      const pctConforme = totalLeituras ? Math.round((conformes / totalLeituras) * 100) : null;
      const bateriasBaixas = new Set(leituras.filter(l => l.telemetria?.bateria?.estado === 'low').map(l => l.equipamentoId)).size;
      const kpis = { text: [
        { text: equipamentos.length + ' equipamento(s)  ·  ', bold: false },
        { text: totalLeituras + ' medição(ões) no período  ·  ' },
        { text: (pctConforme != null ? pctConforme + '% conforme' : 'sem medições') + (bateriasBaixas ? '  ·  ' + bateriasBaixas + ' sensor(es) com bateria baixa' : '') },
      ], fontSize: 9, color: '#5e6b65', margin: [0, 0, 0, 14] };

      const body = [
        { text: 'Relatório de Temperatura', fontSize: 15, bold: true, margin: [0, 4, 0, 2] },
        { text: 'Período: ' + periodo + '   ·   Gráfico: ' + (opcoes.modoGrafico === 'individual' ? 'individual por equipamento' : 'agrupado'), fontSize: 9, color: '#5e6b65', margin: [0, 0, 0, 4] },
        kpis,
      ];

      // Gráfico AGRUPADO: um único gráfico com todas as séries, mesma
      // identidade visual (cor+traço+marcador) do dashboard.
      if (opcoes.modoGrafico !== 'individual' && equipamentos.length) {
        const canvas = _canvasOffscreen(960, 420);
        const regsComoNoDashboard = agruparLeiturasEmRegistros(leituras);
        const chart = TemperaturaChart.renderGraficoTemperaturas(canvas, equipamentos, regsComoNoDashboard, 'pdf');
        if (chart) { body.push({ image: chart.toBase64Image(), fit: [515, 225], margin: [0, 4, 0, 14] }); chart.destroy(); }
      }

      if (!equipamentos.length) body.push({ text: 'Nenhum equipamento no escopo selecionado.', italics: true, color: '#8a938e' });

      equipamentos.forEach((e, idx) => {
        const leiturasDoEquip = leituras.filter(l => l.equipamentoId === e.id).sort((a, b) => (a.criadoEm || 0) - (b.criadoEm || 0));
        const faixa = (e.limiteMin != null || e.limiteMax != null) ? `${e.limiteMin ?? '-∞'} a ${e.limiteMax ?? '+∞'}°C` : 'sem limite';
        const sec = [
          { text: (idx + 1) + '. ' + e.nome, fontSize: 12, bold: true, color: '#45912E', pageBreak: idx > 0 ? 'before' : undefined, margin: [0, idx > 0 ? 0 : 6, 0, 2] },
          { text: 'Categoria: ' + (CATEGORIAS_EQUIP[e.categoria] || e.categoria || '—') + (e.excluidoEm ? '  ·  EXCLUÍDO em ' + new Date(e.excluidoEm).toLocaleDateString('pt-BR') : ''), fontSize: 8.5, color: '#5e6b65' },
          { text: 'Configuração atual: faixa ' + faixa + (e.freqPorDia ? ' · frequência configurada ' + e.freqPorDia + '×/dia' : ' · sem frequência configurada') + ' · modo ' + (e.modo === 'iot' ? 'IoT' : 'Manual'), fontSize: 8.5, color: '#5e6b65', margin: [0, 2, 0, 0] },
          { text: 'Frequência observada no período: ' + _frequenciaObservada(leiturasDoEquip) + ' medição(ões)/dia (calculada pelos horários reais das leituras)', fontSize: 8.5, color: '#5e6b65', margin: [0, 2, 0, 6] },
        ];
        if (opcoes.modoGrafico === 'individual' && leiturasDoEquip.length) {
          const canvas = _canvasOffscreen(960, 380);
          const { chart, avisoLimiteMudou } = TemperaturaChart.renderGraficoIndividual(canvas, e, leiturasDoEquip, 'pdf');
          if (chart) { sec.push({ image: chart.toBase64Image(), fit: [515, 205], margin: [0, 0, 0, avisoLimiteMudou ? 2 : 8] }); chart.destroy(); }
          if (avisoLimiteMudou) sec.push({ text: 'Os limites deste equipamento mudaram durante o período — a linha de limite não é exibida para não representar um valor único incorreto; veja o limite vigente em cada linha da tabela abaixo.', fontSize: 7.5, italics: true, color: '#8a938e', margin: [0, 0, 0, 8] });
        }
        // Tabela de medições brutas — SEMPRE completa, nunca paginada-pra-
        // fora nem reduzida, mesmo que o gráfico acima tenha sido limitado.
        if (leiturasDoEquip.length) {
          sec.push({
            table: {
              headerRows: 1, widths: ['auto', 'auto', 'auto', 'auto', 'auto'],
              body: [
                [{ text: 'Data/hora', bold: true, fontSize: 8 }, { text: 'Valor', bold: true, fontSize: 8 }, { text: 'Limites na medição', bold: true, fontSize: 8 }, { text: 'Conforme', bold: true, fontSize: 8 }, { text: 'Origem', bold: true, fontSize: 8 }],
                ...leiturasDoEquip.map(l => [
                  { text: l.criadoEm ? new Date(l.criadoEm).toLocaleString('pt-BR') : '—', fontSize: 7.5 },
                  { text: (l.valor != null ? l.valor + '°C' : '—'), fontSize: 7.5 },
                  { text: `${l.limiteMinNaMedicao ?? '-∞'} a ${l.limiteMaxNaMedicao ?? '+∞'}°C`, fontSize: 7.5 },
                  { text: l.conforme ? 'Sim' : 'Não', fontSize: 7.5, color: l.conforme ? '#2E6620' : '#a4303f' },
                  { text: ORIGEM_LABEL_TEMP[l.origemDetalhada] || l.origem || '—', fontSize: 7.5 },
                ]),
              ],
            }, layout: 'lightHorizontalLines', margin: [0, 0, 0, 10],
          });
        } else {
          sec.push({ text: 'Nenhuma medição no período selecionado.', italics: true, fontSize: 8.5, color: '#8a938e', margin: [0, 0, 0, 10] });
        }
        body.push({ stack: sec });
      });

      body.push({ canvas: [{ type: 'line', x1: 0, y1: 6, x2: 515, y2: 6, lineWidth: 0.5, lineColor: '#cccccc' }], margin: [0, 8, 0, 0] });
      body.push({ text: 'Dados de origem/aprovação preservados conforme registrados — nenhum valor é inventado ou interpolado.', fontSize: 7.5, color: '#8a938e', margin: [0, 6, 0, 0] });
      body.push({ text: 'Documento gerado em ' + geradoEm, fontSize: 7.5, color: '#5e6b65' });

      await _finalizarPdf({
        pageSize: 'A4', pageMargins: [40, 70, 40, 42],
        header: () => ({ margin: [40, 22, 40, 0], stack: [
          { text: 'QShub', bold: true, fontSize: 12, color: '#2E6620' },
          { canvas: [{ type: 'line', x1: 0, y1: 6, x2: 515, y2: 6, lineWidth: 0.7, lineColor: '#45912E' }] },
        ] }),
        footer: (cp, pc) => ({ margin: [40, 8, 40, 0], columns: [
          { text: 'Gerado em ' + geradoEm, fontSize: 7, color: '#8a938e' },
          { text: 'Página ' + cp + ' de ' + pc, alignment: 'right', fontSize: 7, color: '#8a938e' },
        ] }),
        content: body, defaultStyle: { fontSize: 10, color: '#12211c' },
      }, 'temperatura.pdf');
    } catch (e) { toast('Não foi possível gerar o PDF: ' + e.message, true); }
  }

  // O renderizador de gráfico agrupado (temperature-chart.js) espera o
  // mesmo formato de "registros" usado no dashboard (um item por leitura,
  // com dados.leituras[0] e dados.telemetria) — a rota de relatório devolve
  // leituras já achatadas; esta função só reconstrói esse formato, sem
  // alterar nenhum valor.
  function agruparLeiturasEmRegistros(leituras) {
    return leituras.map(l => ({ criadoEm: l.criadoEm, dados: { leituras: [l], telemetria: l.telemetria || null } }));
  }

  // ── Relatório de Documentos sanitários ────────────────────────────
  async function abrirRelatorioDocumentosModal() {
    const cid = getContratoAtual(); if (!cid) return toast('Selecione um contrato.', true);
    openModal(`<div class="eyebrow">Documentos sanitários</div><h2>Gerar PDF</h2>
      <label class="field"><span>Status</span><select id="rdStatus">
        <option value="">Todos</option>
        <option value="vencida">Vencidos</option>
        <option value="vencendo">Vencendo</option>
        <option value="ok">Em dia</option>
        <option value="sem_validade">Sem validade</option>
      </select></label>
      <div class="actions"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" id="rdGerar">Gerar</button></div>`);
    $('#rdGerar').onclick = async () => {
      const p = new URLSearchParams(); p.set('contrato', cid);
      if ($('#rdStatus').value) p.set('status', $('#rdStatus').value);
      $('#rdGerar').disabled = true;
      try { const dados = await DB.getRelatorioDocumentos(p.toString()); closeModal(); pdfDocumentos(dados); }
      catch (e) { toast(e.message, true); $('#rdGerar').disabled = false; }
    };
  }

  function pdfDocumentos(d) {
    toast('Gerando PDF...');
    ensurePdfMake().then(() => {
      const cab = d.cabecalho || {};
      const temBranding = !!(cab.logoDataUrl || cab.razaoSocial || cab.nomeFantasia);
      const geradoEm = new Date(d.geradoEm).toLocaleString('pt-BR');
      const header = () => {
        const emp = [{ text: cab.razaoSocial || cab.nomeFantasia || 'QShub', bold: true, fontSize: 12, color: '#2E6620' }];
        if (cab.nomeFantasia && cab.razaoSocial) emp.push({ text: cab.nomeFantasia, fontSize: 8, color: '#5e6b65' });
        if (cab.cnpj) emp.push({ text: 'CNPJ: ' + cab.cnpj, fontSize: 8, color: '#5e6b65' });
        if (cab.endereco) emp.push({ text: cab.endereco, fontSize: 8, color: '#5e6b65' });
        if (cab.contato) emp.push({ text: cab.contato, fontSize: 8, color: '#5e6b65' });
        const cols = [];
        if (cab.logoDataUrl) cols.push({ image: cab.logoDataUrl, fit: [110, 46], margin: [0, 0, 12, 0] });
        cols.push({ stack: emp, width: '*' });
        return { margin: [40, 22, 40, 0], stack: [
          { columns: cols, columnGap: 10 },
          { canvas: [{ type: 'line', x1: 0, y1: 6, x2: 515, y2: 6, lineWidth: 0.7, lineColor: '#45912E' }] },
        ] };
      };
      const footer = (cp, pc) => ({ margin: [40, 8, 40, 0], columns: [
        { text: 'Gerado por ' + d.geradoPor + ' em ' + geradoEm, fontSize: 7, color: '#8a938e' },
        { text: 'Pagina ' + cp + ' de ' + pc, alignment: 'right', fontSize: 7, color: '#8a938e' },
      ] });
      const blocoDoc = (doc, n) => {
        const meta = [];
        if (doc.numero) meta.push('Nº ' + doc.numero);
        if (doc.orgaoEmissor) meta.push(doc.orgaoEmissor);
        if (doc.dataEmissao) meta.push('Emissão: ' + fmtDate(doc.dataEmissao));
        meta.push(doc.validade ? 'Validade: ' + fmtDate(doc.validade) : 'Sem validade');
        meta.push('Status: ' + (STATUS_DOC_LABEL[doc.status] || doc.status));
        return { stack: [
          { text: [{ text: n + '. ', bold: true, color: '#2E6620' }, { text: doc.tipoLabel || doc.tipo, bold: true }], fontSize: 10.5 },
          { text: meta.join('   ·   '), fontSize: 8, color: '#5e6b65', margin: [0, 2, 0, 0] },
          ...(doc.observacoes ? [{ text: doc.observacoes, fontSize: 8.5, margin: [0, 4, 0, 0] }] : []),
        ], unbreakable: true, margin: [0, 0, 0, 10] };
      };
      const body = [
        { text: 'Relatorio de Documentos Sanitarios', fontSize: 15, bold: true, margin: [0, 4, 0, 2] },
        { text: 'Contrato ' + (d.escopo.contratoNumero || '-') + (d.escopo.estabelecimentoNome ? '  -  ' + d.escopo.estabelecimentoNome : ''), fontSize: 9, color: '#5e6b65' },
        { text: (d.escopo.status ? 'Status: ' + (STATUS_DOC_LABEL[d.escopo.status] || d.escopo.status) + '   -   ' : '') + d.total + ' documento(s)', fontSize: 9, color: '#5e6b65', margin: [0, 0, 0, 12] },
      ];
      if (!d.documentos.length) body.push({ text: 'Nenhum documento no escopo selecionado.', italics: true, color: '#8a938e' });
      let n = 1; d.documentos.forEach(doc => body.push(blocoDoc(doc, n++)));
      body.push({ canvas: [{ type: 'line', x1: 0, y1: 6, x2: 515, y2: 6, lineWidth: 0.5, lineColor: '#cccccc' }], margin: [0, 8, 0, 0] });
      if (d.rt && (d.rt.nome || d.rt.conselho)) body.push({ text: [{ text: 'Responsável Técnico: ', bold: true }, { text: (d.rt.nome || '') + (d.rt.conselho ? ' — ' + d.rt.conselho : '') }], fontSize: 8.5, margin: [0, 6, 0, 2] });
      body.push({ text: [{ text: 'Assinatura digital (HMAC): ', bold: true }, { text: d.assinatura.hash }], fontSize: 7.5, margin: [0, 6, 0, 0] });
      body.push({ text: 'keyId: ' + d.assinatura.keyId + '  -  documento gerado em ' + geradoEm, fontSize: 7.5, color: '#5e6b65' });
      return _finalizarPdf({
        pageSize: 'A4', pageMargins: [40, temBranding ? 96 : 70, 40, 42],
        header, footer, content: body, defaultStyle: { fontSize: 10, color: '#12211c' },
      }, 'documentos-' + (d.escopo.contratoNumero || '') + '.pdf');
    }).catch(e => toast('Nao foi possivel gerar o PDF: ' + e.message, true));
  }


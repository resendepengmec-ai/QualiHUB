// QualiHUB — Relatório PDF (pdfmake)
  // ── Relatório PDF (por período / contrato / estabelecimento) ────
  function abrirRelatorioModal() {
    const estMap = {};
    contratos.forEach(c => { if (c.estabelecimentoId) estMap[c.estabelecimentoId] = c.estabelecimentoNome || c.estabelecimentoId; });
    const estOpts = Object.entries(estMap).map(([id, nome]) => `<option value="${id}">${esc(nome)}</option>`).join('');
    openModal(`<div class="eyebrow">Ocorrências</div><h2>Gerar PDF</h2>
      <label class="field"><span>Contrato</span><select id="rContrato">
        <option value="">Todos os meus contratos</option>
        ${contratos.map(c => `<option value="${c.id}">${esc(c.numero)}${c.objeto ? ' — ' + esc(c.objeto) : ''}</option>`).join('')}</select></label>
      <label class="field"><span>Estabelecimento</span><select id="rEst"><option value="">Todos</option>${estOpts}</select></label>
      <div class="row"><label class="field"><span>De</span><input type="date" id="rFrom"></label>
        <label class="field"><span>Até</span><input type="date" id="rTo"></label></div>
      <p class="muted" style="font-size:.78rem">Se escolher um contrato, o filtro de estabelecimento é ignorado. Sem datas, entram todas as ocorrências.</p>
      <div class="actions"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" id="rGerar">Gerar</button></div>`);
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

  // Carrega o pdfmake sob demanda (CDN) para gerar PDF A4 formatado.
  let _pdfLoad;
  function ensurePdfMake() {
    if (window.pdfMake && window.pdfMake.vfs) return Promise.resolve();
    if (_pdfLoad) return _pdfLoad;
    const load = (src) => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Falha ao carregar ' + src)); document.head.appendChild(s); });
    _pdfLoad = load('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/pdfmake.min.js')
      .then(() => load('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/vfs_fonts.js'));
    return _pdfLoad;
  }

  function gerarRelatorioPDF(d) {
    toast('Gerando PDF...');
    ensurePdfMake().then(() => {
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
      body.push({ text: [{ text: 'Assinatura digital (HMAC): ', bold: true }, { text: d.assinatura.hash }], fontSize: 7.5, margin: [0, 6, 0, 0] });
      body.push({ text: 'keyId: ' + d.assinatura.keyId + '  -  documento gerado em ' + geradoEm, fontSize: 7.5, color: '#5e6b65' });
      body.push({ text: 'As fotos carregam o rotulo de data/hora e localizacao registrados pelo dispositivo no momento da captura.', fontSize: 7.5, color: '#8a938e', margin: [0, 3, 0, 0] });

      const nomeArq = 'ocorrencias' + (d.escopo.contratoNumero ? '-' + d.escopo.contratoNumero : '') + '.pdf';
      pdfMake.createPdf({
        pageSize: 'A4',
        pageMargins: [40, temBranding ? 96 : 70, 40, 42],
        header, footer, content: body,
        defaultStyle: { fontSize: 10, color: '#12211c' },
      }).download(nomeArq);
    }).catch(e => toast('Nao foi possivel gerar o PDF: ' + e.message, true));
  }


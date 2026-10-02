// QualiHUB — identidade visual determinística dos gráficos de Temperatura
// ══════════════════════════════════════════════════════════════
// Cada equipamento precisa de uma identidade visual ESTÁVEL (cor + traço +
// marcador) que nunca dependa da posição em que aparece num array, da
// ordem de carregamento, de quantos outros equipamentos estão visíveis ou
// de qualquer coisa não-determinística (Math.random() nunca é usado aqui).
// getEquipamentoChartStyle(equipamentoId) é a única fonte de verdade —
// usada tanto no dashboard (pac.js) quanto no PDF dedicado (pdf.js), pra
// garantir a MESMA identidade nos dois lugares.
window.TemperaturaChart = (function () {
  // FNV-1a: determinístico, rápido, sem dependência externa.
  function hashFnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  // 12 combinações cor×traço×marcador, todas distintas entre si — cobre o
  // cenário de até 12 equipamentos simultâneos sem repetir identidade.
  // Acima de 12, o hash volta a repetir uma combinação (esperado — não há
  // paleta infinita de combinações visualmente distinguíveis), mas o
  // resultado continua 100% estável para cada equipamentoId.
  const PALETA_EQUIP = [
    { cor: '#45912E', dash: [],         marker: 'circle' },
    { cor: '#C4442E', dash: [6, 3],     marker: 'rect' },
    { cor: '#2E6CA4', dash: [2, 2],     marker: 'triangle' },
    { cor: '#C77A1A', dash: [8, 2, 2, 2], marker: 'rectRot' },
    { cor: '#6B3FA0', dash: [],         marker: 'rectRounded' },
    { cor: '#2E9E6B', dash: [6, 3],     marker: 'star' },
    { cor: '#A4303F', dash: [2, 2],     marker: 'cross' },
    { cor: '#5B7B9A', dash: [8, 2, 2, 2], marker: 'crossRot' },
    { cor: '#8A6D3B', dash: [],         marker: 'triangle' },
    { cor: '#3F6B3F', dash: [6, 3],     marker: 'circle' },
    { cor: '#7A3B69', dash: [2, 2],     marker: 'rect' },
    { cor: '#2E8C8C', dash: [8, 2, 2, 2], marker: 'star' },
  ];

  // contexto ajusta só espessura/tamanho (PDF impresso precisa de traços
  // mais grossos pra não desaparecer) — NUNCA a identidade cor/traço/
  // marcador em si, que é sempre a mesma pro mesmo equipamentoId.
  function getEquipamentoChartStyle(equipamentoId, contexto) {
    const idx = hashFnv1a(String(equipamentoId)) % PALETA_EQUIP.length;
    const base = PALETA_EQUIP[idx];
    const pdf = contexto === 'pdf';
    return { cor: base.cor, dash: base.dash, marker: base.marker, lineWidth: pdf ? 2.5 : 2, markerSize: pdf ? 4 : 2.5 };
  }

  const EIXO_TEMPO = { type: 'linear', ticks: { callback: (v) => new Date(v).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) } };

  // Cada canvas (dashboard OU pdf, podem coexistir) guarda sua própria
  // instância de Chart — destruída antes de redesenhar, nunca acumula.
  const _instancias = {};
  function _resolverCanvas(canvasOuId) { return (typeof canvasOuId === 'string') ? document.getElementById(canvasOuId) : canvasOuId; }
  function _chavePara(canvasOuId) { return (typeof canvasOuId === 'string') ? canvasOuId : canvasOuId; }
  function _destruir(chave) { if (_instancias[chave]) { _instancias[chave].destroy(); delete _instancias[chave]; } }

  // Sonda + Ambiente no MESMO gráfico (mesma unidade, °C) — sonda em linha
  // sólida com a identidade do equipamento, ambiente no traço auxiliar
  // (mais pontilhado) da MESMA cor — nunca misturado com umidade.
  function renderGraficoTemperaturas(canvasOuId, eqs, regs, contexto) {
    contexto = contexto || 'dashboard';
    const chave = _chavePara(canvasOuId);
    const datasets = [];
    eqs.forEach((e) => {
      const estilo = getEquipamentoChartStyle(e.id, contexto);
      const sonda = regs.map(r => { const l = (r.dados?.leituras || []).find(x => x.equipamentoId === e.id); return l ? { x: r.criadoEm || 0, y: l.valor } : null; })
        .filter(Boolean).sort((a, b) => a.x - b.x);
      if (sonda.length) datasets.push({
        label: e.nome + ' · sonda', data: sonda, borderColor: estilo.cor, backgroundColor: estilo.cor,
        borderDash: estilo.dash, pointStyle: estilo.marker, tension: 0.25, pointRadius: estilo.markerSize, borderWidth: estilo.lineWidth, spanGaps: false,
      });
      const ambiente = regs.map(r => { const t = r.dados?.telemetria?.ambiente; return (t && t.temperaturaC != null) ? { x: r.criadoEm || 0, y: t.temperaturaC } : null; })
        .filter(Boolean).sort((a, b) => a.x - b.x);
      if (ambiente.length) datasets.push({
        label: e.nome + ' · ambiente', data: ambiente, borderColor: estilo.cor, backgroundColor: estilo.cor,
        borderDash: estilo.dash.length ? estilo.dash : [5, 4], pointStyle: estilo.marker, tension: 0.25,
        pointRadius: Math.max(1.5, estilo.markerSize - 0.5), borderWidth: Math.max(1, estilo.lineWidth - 0.5), spanGaps: false,
      });
    });
    _destruir(chave);
    const canvas = _resolverCanvas(canvasOuId);
    if (!canvas || !datasets.length) return null;
    // PDF: canvas desacoplado do DOM/CSS — responsive:false usa o
    // width/height explícitos do canvas; animation:false garante que
    // toBase64Image() já captura o desenho final, sem esperar transição.
    const pdf = contexto === 'pdf';
    const chart = new Chart(canvas.getContext('2d'), {
      type: 'line', data: { datasets },
      options: { responsive: !pdf, maintainAspectRatio: false, animation: !pdf, scales: { x: EIXO_TEMPO, y: { title: { display: true, text: '°C' } } }, plugins: { legend: { display: true } } },
    });
    _instancias[chave] = chart;
    return chart;
  }

  // Umidade em gráfico PRÓPRIO — eixo % nunca compartilhado com temperatura.
  function renderGraficoUmidade(canvasOuId, eqs, regs, contexto) {
    contexto = contexto || 'dashboard';
    const chave = _chavePara(canvasOuId);
    const datasets = eqs.map((e) => {
      const estilo = getEquipamentoChartStyle(e.id, contexto);
      const pontos = regs.map(r => { const t = r.dados?.telemetria?.umidade; return (t && t.valorPct != null) ? { x: r.criadoEm || 0, y: t.valorPct } : null; })
        .filter(Boolean).sort((a, b) => a.x - b.x);
      return pontos.length ? {
        label: e.nome, data: pontos, borderColor: estilo.cor, backgroundColor: estilo.cor,
        borderDash: estilo.dash, pointStyle: estilo.marker, tension: 0.25, pointRadius: estilo.markerSize, borderWidth: estilo.lineWidth, spanGaps: false,
      } : null;
    }).filter(Boolean);
    _destruir(chave);
    const canvas = _resolverCanvas(canvasOuId);
    if (!canvas || !datasets.length) return null;
    const pdf = contexto === 'pdf';
    const chart = new Chart(canvas.getContext('2d'), {
      type: 'line', data: { datasets },
      options: { responsive: !pdf, maintainAspectRatio: false, animation: !pdf, scales: { x: EIXO_TEMPO, y: { title: { display: true, text: '%' }, min: 0, max: 100 } }, plugins: { legend: { display: datasets.length > 1 } } },
    });
    _instancias[chave] = chart;
    return chart;
  }

  // Gráfico de UM equipamento (modo individual do relatório de PDF) — com
  // linhas de limite mín/máx, visualmente DISTINTAS da série de dados
  // (cinza neutro, pontilhado fino, nunca entra na paleta de identidade).
  // Só desenha a linha de limite quando o limite é CONSTANTE em todas as
  // leituras do período exibido — se mudou durante o período, não desenha
  // uma única linha reta enganosa (devolve avisoLimiteMudou:true pro
  // chamador mostrar um aviso textual em vez disso).
  function renderGraficoIndividual(canvasOuId, equip, leituras, contexto) {
    contexto = contexto || 'pdf';
    const chave = _chavePara(canvasOuId);
    const estilo = getEquipamentoChartStyle(equip.id, contexto);
    const pontos = leituras.map(l => ({ x: l.criadoEm || 0, y: l.valor })).sort((a, b) => a.x - b.x);
    const datasets = [{
      label: equip.nome, data: pontos, borderColor: estilo.cor, backgroundColor: estilo.cor,
      borderDash: estilo.dash, pointStyle: estilo.marker, tension: 0.25, pointRadius: estilo.markerSize, borderWidth: estilo.lineWidth, spanGaps: false,
    }];
    const mins = new Set(leituras.map(l => l.limiteMinNaMedicao ?? l.limiteMin ?? null));
    const maxs = new Set(leituras.map(l => l.limiteMaxNaMedicao ?? l.limiteMax ?? null));
    const limiteMinEstavel = mins.size === 1 ? [...mins][0] : null;
    const limiteMaxEstavel = maxs.size === 1 ? [...maxs][0] : null;
    const avisoLimiteMudou = mins.size > 1 || maxs.size > 1;
    const LINHA_LIMITE = { borderColor: '#888', backgroundColor: '#888', borderDash: [3, 3], borderWidth: 1, pointRadius: 0, tension: 0, spanGaps: false };
    if (limiteMinEstavel != null && pontos.length) datasets.push({ label: 'Limite mínimo', data: [{ x: pontos[0].x, y: limiteMinEstavel }, { x: pontos[pontos.length - 1].x, y: limiteMinEstavel }], ...LINHA_LIMITE });
    if (limiteMaxEstavel != null && pontos.length) datasets.push({ label: 'Limite máximo', data: [{ x: pontos[0].x, y: limiteMaxEstavel }, { x: pontos[pontos.length - 1].x, y: limiteMaxEstavel }], ...LINHA_LIMITE });
    _destruir(chave);
    const canvas = _resolverCanvas(canvasOuId);
    if (!canvas || !pontos.length) return { chart: null, avisoLimiteMudou };
    const pdf = contexto === 'pdf';
    const chart = new Chart(canvas.getContext('2d'), {
      type: 'line', data: { datasets },
      options: { responsive: !pdf, maintainAspectRatio: false, animation: false, scales: { x: EIXO_TEMPO, y: { title: { display: true, text: '°C' } } }, plugins: { legend: { display: true } } },
    });
    _instancias[chave] = chart;
    return { chart, avisoLimiteMudou };
  }

  return { hashFnv1a, getEquipamentoChartStyle, renderGraficoTemperaturas, renderGraficoUmidade, renderGraficoIndividual };
})();

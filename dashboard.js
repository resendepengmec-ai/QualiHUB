// QualiHUB — Dashboard
  // ══════════════════════════════════════════════════════════════
  // DASHBOARD
  // ══════════════════════════════════════════════════════════════
  async function renderDashboard() {
    const cid = getContratoAtual();
    view.innerHTML = `<div class="view-head"><div>
      <div class="eyebrow">Desempenho</div><h1>Prazo de atendimento das não conformidades</h1></div></div>
      <div id="dashBody" class="muted">Carregando…</div>`;
    try {
      const s = await DB.getStats(cid);
      const body = $('#dashBody');
      body.innerHTML = `
        <div class="grid cols-3">
          <div class="kpi"><div class="n danger">${s.abertasVencidas}</div><div class="lbl">Em aberto e vencidas</div></div>
          <div class="kpi"><div class="n">${s.abertas}</div><div class="lbl">Em aberto</div></div>
          <div class="kpi"><div class="n">${s.total}</div><div class="lbl">Total no escopo</div></div>
          <div class="kpi"><div class="n ok">${s.pctNoPrazo === null ? '—' : s.pctNoPrazo + '%'}</div><div class="lbl">Atendidas no prazo</div></div>
          <div class="kpi"><div class="n warn">${s.atendidasComAtraso}</div><div class="lbl">Concluídas com atraso</div></div>
          <div class="kpi"><div class="n">${s.tempoMedioAtendimentoHoras === null ? '—' : s.tempoMedioAtendimentoHoras + 'h'}</div><div class="lbl">Tempo médio de atendimento</div></div>
        </div>
        <div class="view-head" style="margin-top:26px"><div><div class="eyebrow">${cid ? 'Contrato selecionado' : 'Selecione um contrato'}</div>
          <h2>Não conformidades em aberto</h2></div></div>
        <div id="abertas"></div>`;
      if (cid) {
        const ocs = (await DB.getOcorrenciasContrato(cid)).filter(o => o.estado !== 'concluida');
        $('#abertas').innerHTML = ocs.length
          ? ocs.sort(ordenarPorUrgencia).map(cardOcorrencia).join('')
          : `<div class="empty"><strong>Nenhuma não conformidade em aberto</strong>Bom sinal — este contrato está em dia.</div>`;
      } else {
        $('#abertas').innerHTML = `<div class="empty"><strong>Escolha um contrato acima</strong>Para ver as não conformidades em aberto por contrato.</div>`;
      }
    } catch (e) { $('#dashBody').innerHTML = `<div class="empty"><strong>Não foi possível carregar</strong>${esc(e.message)}</div>`; }
  }
  function ordenarPorUrgencia(a, b) {
    const rank = { vencida: 0, vencendo: 1, aberta: 2, atraso: 3, ok: 4 };
    return rank[statusOcorrencia(a).key] - rank[statusOcorrencia(b).key];
  }


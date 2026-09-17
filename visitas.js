// QShub — Agenda de visitas (periodicidade do contrato + alerta)
  // ══════════════════════════════════════════════════════════════
  // VISITAS
  // ══════════════════════════════════════════════════════════════
  function labelPeriodicidade(p) {
    if (!p) return 'Periodicidade não definida';
    if (p.tipo === 'personalizada') return `${p.vezesPorSemana}x por semana`;
    return PERIODICIDADE_VISITA_LABEL[p.tipo] || p.tipo;
  }

  async function renderVisitas() {
    const cid = getContratoAtual();
    view.innerHTML = `<div class="view-head"><div><div class="eyebrow">Contrato</div><h1>Visitas</h1>
      <p class="muted" style="font-size:.86rem;margin:.3rem 0 0">Agenda de visitas técnicas, conforme a periodicidade definida no contrato.</p></div>
      <button class="btn primary" id="visNovo">Registrar visita</button></div>
      <div id="visBody" class="muted">Carregando…</div>`;
    if (!cid) { $('#visNovo').style.display = 'none'; return $('#visBody').innerHTML = `<div class="empty"><strong>Escolha um contrato</strong>Selecione um contrato acima para ver a agenda de visitas.</div>`; }
    $('#visNovo').onclick = () => abrirVisitaModal(cid);
    await carregarVisitas(cid);
  }

  async function carregarVisitas(cid) {
    const body = $('#visBody'); body.innerHTML = '<p class="muted">Carregando…</p>';
    let d;
    try { d = await DB.getVisitas(cid); } catch (e) { return body.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
    const podeExcluir = ['administrador', 'gestor'].includes(papelNoContrato(cid));
    const spine = d.status !== 'sem_periodicidade' ? ` spine s-${STATUS_VISITA_CHIP[d.status]}` : '';
    const resumo = `<div class="card${spine}">
      <span class="chip ${STATUS_VISITA_CHIP[d.status]}">${STATUS_VISITA_LABEL[d.status]}</span>
      <div style="margin-top:8px"><strong>${esc(labelPeriodicidade(d.periodicidadeVisita))}</strong></div>
      <div class="muted" style="font-size:.84rem;margin-top:4px">
        ${d.ultimaVisita ? 'Última visita: ' + fmtDate(d.ultimaVisita.data) : 'Nenhuma visita registrada ainda'}${d.proximaVisita ? ' · Próxima prevista: ' + fmtDate(d.proximaVisita) : ''}
      </div>
      ${!d.periodicidadeVisita ? `<p class="muted" style="font-size:.8rem;margin-top:10px">Defina a periodicidade em Cadastro → Contratos (Editar) para habilitar o alerta.</p>` : ''}
    </div>`;
    const lista = d.visitas.length ? d.visitas.map(v => `<div class="card" style="box-shadow:none;border:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;gap:10px">
        <div><strong>${fmtDate(v.data)}</strong>${v.observacoes ? ` <span class="muted" style="font-size:.85rem">— ${esc(v.observacoes)}</span>` : ''}
          <div class="muted" style="font-size:.78rem;margin-top:2px">Registrada por ${esc(v.criadoPorNome || v.criadoPor)}</div></div>
        ${podeExcluir ? `<button class="btn sm danger" data-del="${v.id}">Excluir</button>` : ''}
      </div>`).join('') : `<div class="empty"><strong>Nenhuma visita registrada</strong>Registre a primeira visita técnica a este estabelecimento.</div>`;
    body.innerHTML = resumo + `<div class="eyebrow" style="margin:18px 0 8px">Histórico</div>` + lista;
    body.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      if (!confirm('Excluir este registro de visita?')) return;
      try { await DB.removerVisita(b.dataset.del); toast('Visita excluída.'); carregarVisitas(cid); }
      catch (e) { toast(e.message, true); }
    });
  }

  function abrirVisitaModal(cid) {
    openModal(`<h2>Registrar visita</h2>
      <label class="field"><span>Data da visita</span><input type="date" id="vData" value="${new Date().toISOString().slice(0, 10)}"></label>
      <label class="field"><span>Observações (opcional)</span><textarea id="vObs" placeholder="O que foi verificado, pendências, etc."></textarea></label>
      <div class="actions"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" id="vOk">Registrar</button></div>`);
    $('#vOk').onclick = async () => {
      const data = $('#vData').value; if (!data) return toast('Informe a data.', true);
      $('#vOk').disabled = true;
      try { await DB.registrarVisita(cid, { data, observacoes: $('#vObs').value.trim() }); closeModal(); toast('Visita registrada.'); carregarVisitas(cid); }
      catch (e) { toast(e.message, true); $('#vOk').disabled = false; }
    };
  }

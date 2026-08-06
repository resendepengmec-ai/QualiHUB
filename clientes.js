// QualiHUB — Clientes (árvore de famílias)
  // ══════════════════════════════════════════════════════════════
  // CLIENTES (SaaS) — só o ADMIN MASTER libera administradores de cliente
  // ══════════════════════════════════════════════════════════════
  async function renderClientes() {
    view.innerHTML = `<div class="view-head">
      <div><div class="eyebrow">Plataforma</div><h1>Clientes</h1>
        <p class="muted" style="font-size:.86rem;margin:.3rem 0 0">Libere o e-mail do administrador de cada cliente. Ele entra com Google e cria os próprios contratos, estabelecimentos e acessos — vendo só o que é dele. Abaixo, a árvore só-leitura de tudo que cada cliente cadastrou.</p></div></div>
      <div class="card">
        <div class="eyebrow">Novo administrador de cliente</div>
        <div class="row" style="margin-top:8px">
          <input id="adEmail" placeholder="e-mail@empresa.com" style="flex:2 1 220px">
          <input id="adOrg" placeholder="Empresa / cliente">
          <input id="adNome" placeholder="Nome (opcional)">
          <button class="btn primary" id="adAdd" style="flex:0 0 auto">Liberar acesso</button>
        </div></div>
      <div id="adLista" style="margin-top:18px"><p class="muted">Carregando…</p></div>`;

    const papelCurto = { administrador: 'Admin', fiscal: 'Fiscal', gestor: 'Gestor', executor: 'Executor' };
    function contratoRow(c) {
      return `<div class="card" style="box-shadow:none;background:var(--surface-2);margin-top:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
          <div><strong>${esc(c.numero)}</strong> ${c.sim ? '<span class="chip sim">S.I.M.</span>' : ''}
            ${c.objeto ? `<span class="muted" style="font-size:.82rem"> — ${esc(c.objeto)}</span>` : ''}</div>
          <span class="muted" style="font-size:.78rem">${esc(c.estabelecimento || 'sem estabelecimento')}</span>
        </div>
        <div style="margin-top:8px">${c.membros.length
          ? c.membros.map(m => `<span class="chip neutral" style="margin:2px 6px 0 0">${papelCurto[m.papel] || m.papel}: ${esc(m.name || m.email)}</span>`).join('')
          : '<span class="muted" style="font-size:.8rem">sem usuários cadastrados</span>'}</div>
      </div>`;
    }
    function grupoCliente(c) {
      const status = c.jaEntrou ? '<span class="chip ok">Já entrou</span>' : '<span class="chip aberta">Aguardando 1º acesso</span>';
      return `<details class="card" style="padding:0;margin-top:12px">
        <summary style="padding:14px 18px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:10px">
          <span><strong>${esc(c.org || c.name || c.email)}</strong> ${status}
            <span class="muted" style="font-size:.82rem">· ${c.contratos.length} contrato(s)</span><br>
            <span class="muted" style="font-size:.8rem">${esc(c.email)}</span></span>
          <button class="btn sm danger" data-rm="${esc(c.email)}">Revogar</button>
        </summary>
        <div style="padding:2px 18px 16px">${c.contratos.length ? c.contratos.map(contratoRow).join('') : '<p class="muted" style="font-size:.85rem">Nenhum contrato cadastrado ainda.</p>'}</div>
      </details>`;
    }

    async function listar() {
      let tree;
      try { tree = await DB.getPlatformTree(); } catch (e) { return $('#adLista').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
      let html = '';
      html += tree.clientes.length ? tree.clientes.map(grupoCliente).join('')
        : `<div class="empty"><strong>Nenhum cliente liberado ainda</strong>Cadastre o e-mail do primeiro administrador de cliente acima.</div>`;
      if (tree.doMaster && tree.doMaster.length) {
        html += `<div class="eyebrow" style="margin:22px 0 2px">Criados por você (master)</div>` + tree.doMaster.map(contratoRow).join('');
      }
      if (tree.orfaos && tree.orfaos.length) {
        html += `<div class="eyebrow" style="margin:22px 0 2px">Contratos sem cliente ativo</div>` + tree.orfaos.map(contratoRow).join('');
      }
      $('#adLista').innerHTML = html;
      $('#adLista').querySelectorAll('[data-rm]').forEach(b => b.onclick = async (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        if (!confirm(`Revogar o acesso de ${b.dataset.rm}? Os contratos que ele criou continuam existindo (passam a aparecer em "sem cliente ativo").`)) return;
        try { await DB.removePlatformAdmin(b.dataset.rm); toast('Acesso revogado.'); listar(); } catch (e) { toast(e.message, true); }
      });
    }
    $('#adAdd').onclick = async () => {
      const email = $('#adEmail').value.trim();
      if (!email.includes('@')) return toast('E-mail inválido.', true);
      try {
        await DB.addPlatformAdmin({ email, org: $('#adOrg').value.trim(), name: $('#adNome').value.trim() });
        $('#adEmail').value = $('#adOrg').value = $('#adNome').value = '';
        toast('Administrador de cliente liberado.'); listar();
      } catch (e) { toast(e.message, true); }
    };
    listar();
  }


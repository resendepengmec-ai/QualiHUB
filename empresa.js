// QualiHUB — Minha Empresa
  // ══════════════════════════════════════════════════════════════
  // MINHA EMPRESA (branding do cabeçalho dos PDFs)
  // ══════════════════════════════════════════════════════════════
  function _lerLogo(file) { // reduz para caber no cabeçalho e no limite do servidor
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const img = new Image();
        img.onload = () => {
          const maxW = 420, scale = Math.min(1, maxW / img.width);
          const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
          const c = document.createElement('canvas'); c.width = w; c.height = h;
          c.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(c.toDataURL('image/png'));
        };
        img.onerror = () => reject(new Error('Imagem inválida'));
        img.src = r.result;
      };
      r.onerror = () => reject(new Error('Falha ao ler a imagem'));
      r.readAsDataURL(file);
    });
  }

  async function renderEmpresa() {
    view.innerHTML = `<div class="view-head"><div>
      <div class="eyebrow">SaaS</div><h1>Minha Empresa</h1>
      <p class="muted" style="font-size:.86rem;margin:.3rem 0 0">Estes dados e o logo entram no cabeçalho dos PDFs (relatórios e, futuramente, contratos) dos seus contratos.</p></div></div>
      <div id="empBody" class="muted">Carregando…</div>`;
    let perfil = {};
    try { perfil = await DB.getPerfil() || {}; } catch (e) { return $('#empBody').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
    let logo = perfil.logoDataUrl || null;
    $('#empBody').innerHTML = `<div class="card">
      <div class="row">
        <label class="field"><span>Razão social</span><input id="pRazao" value="${esc(perfil.razaoSocial || '')}"></label>
        <label class="field"><span>Nome fantasia</span><input id="pFantasia" value="${esc(perfil.nomeFantasia || '')}"></label>
      </div>
      <div class="row">
        <label class="field"><span>CNPJ</span><input id="pCnpj" value="${esc(perfil.cnpj || '')}"></label>
        <label class="field"><span>Contato (telefone / e-mail)</span><input id="pContato" value="${esc(perfil.contato || '')}"></label>
      </div>
      <label class="field"><span>Endereço</span><input id="pEndereco" value="${esc(perfil.endereco || '')}"></label>
      <label class="field"><span>Logo (aparece no cabeçalho do PDF)</span><input type="file" id="pLogo" accept="image/*"></label>
      <div id="logoPrev" style="margin:6px 0 4px">${logo ? `<img src="${logo}" style="max-height:70px;border:1px solid var(--line);border-radius:6px;padding:4px;background:#fff">` : '<span class="muted" style="font-size:.82rem">Sem logo</span>'}</div>
      ${logo ? '<button class="btn ghost sm" id="pRemoveLogo">Remover logo</button>' : ''}
      <div style="margin-top:14px"><button class="btn primary" id="pSalvar">Salvar</button></div>
    </div>`;
    $('#pLogo').onchange = async (e) => {
      if (!e.target.files[0]) return;
      try { logo = await _lerLogo(e.target.files[0]); $('#logoPrev').innerHTML = `<img src="${logo}" style="max-height:70px;border:1px solid var(--line);border-radius:6px;padding:4px;background:#fff">`; }
      catch (err) { toast(err.message, true); }
    };
    const rmBtn = document.getElementById('pRemoveLogo');
    if (rmBtn) rmBtn.onclick = () => { logo = null; $('#logoPrev').innerHTML = '<span class="muted" style="font-size:.82rem">Sem logo</span>'; rmBtn.style.display = 'none'; };
    $('#pSalvar').onclick = async () => {
      $('#pSalvar').disabled = true;
      try {
        await DB.savePerfil({
          razaoSocial: $('#pRazao').value.trim(), nomeFantasia: $('#pFantasia').value.trim(),
          cnpj: $('#pCnpj').value.trim(), contato: $('#pContato').value.trim(),
          endereco: $('#pEndereco').value.trim(), logoDataUrl: logo || null,
        });
        toast('Dados da empresa salvos.');
      } catch (e) { toast(e.message, true); } finally { $('#pSalvar').disabled = false; }
    };
  }


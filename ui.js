// QualiHUB — infra de UI (helpers + estado compartilhado)
  // ── infra de UI ───────────────────────────────────────────────
  const $ = (s, r = document) => r.querySelector(s);
  const view = $('#view');
  let contratos = [];   // lista completa (do backend, já filtrada por acesso)
  let membrosCache = {};

  function toast(msg, err = false) {
    const t = $('#toast'); t.textContent = msg; t.className = 'toast show' + (err ? ' err' : '');
    setTimeout(() => t.className = 'toast', 2600);
  }
  // Trava o scroll do body enquanto o modal está aberto (sem isto, em mobile
  // dava pra rolar o conteúdo por trás do modal); devolve o foco a quem abriu
  // ao fechar, e foca o próprio modal ao abrir (teclado/leitor de tela).
  let _modalReturnFocus = null;
  function openModal(html) {
    _modalReturnFocus = document.activeElement;
    const modal = $('#modal');
    modal.innerHTML = html;
    $('#modalBg').classList.add('show');
    document.body.classList.add('modal-open');
    modal.setAttribute('tabindex', '-1');
    modal.focus({ preventScroll: true });
  }
  function closeModal() {
    $('#modalBg').classList.remove('show');
    document.body.classList.remove('modal-open');
    if (_modalReturnFocus && typeof _modalReturnFocus.focus === 'function') _modalReturnFocus.focus({ preventScroll: true });
    _modalReturnFocus = null;
  }
  $('#modalBg').addEventListener('click', e => { if (e.target === $('#modalBg')) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#modalBg').classList.contains('show')) closeModal(); });

  // ── Lightbox de fotos ─────────────────────────────────────────────
  // Miniaturas (.fotos img, em ocorrências/P.A.C.) só mostram um thumbnail
  // pequeno; toque/clique amplia numa camada própria (não reaproveita
  // #modal porque as miniaturas costumam estar DENTRO de um modal de
  // edição já aberto — precisa empilhar por cima, não substituir).
  let _lightboxReturnFocus = null;
  function _closeLightbox() {
    const lb = document.getElementById('_lightbox');
    if (lb) lb.remove();
    if (_lightboxReturnFocus && typeof _lightboxReturnFocus.focus === 'function') _lightboxReturnFocus.focus({ preventScroll: true });
    _lightboxReturnFocus = null;
  }
  function _openLightbox(src) {
    _lightboxReturnFocus = document.activeElement;
    const lb = document.createElement('div');
    lb.id = '_lightbox';
    lb.style.cssText = 'position:fixed;inset:0;z-index:60;background:rgba(10,16,13,.88);display:flex;align-items:center;justify-content:center;padding:calc(16px + env(safe-area-inset-top)) calc(16px + env(safe-area-inset-right)) calc(16px + env(safe-area-inset-bottom)) calc(16px + env(safe-area-inset-left));cursor:zoom-out';
    lb.innerHTML = `<img src="${esc(src)}" alt="" style="max-width:100%;max-height:100%;border-radius:8px;object-fit:contain">`;
    lb.tabIndex = -1;
    lb.addEventListener('click', _closeLightbox);
    document.body.appendChild(lb);
    lb.focus({ preventScroll: true });
    return lb;
  }
  // Auditoria de banda (PERFORMANCE.md, Etapa 1): quando a miniatura na
  // lista veio SEM o dataUrl cheio (porque tinha thumbUrl — a listagem só
  // manda a miniatura), a ampliação busca a foto em tamanho cheio sob
  // demanda (só ao clicar, nunca antes). Miniatura aparece na hora,
  // meio-opaca, e é trocada pela foto cheia quando a busca terminar.
  async function _abrirLightboxComBusca(thumbSrc, buscar) {
    const lb = _openLightbox(thumbSrc);
    const img = lb.querySelector('img');
    img.style.opacity = '.5';
    try {
      const full = await buscar();
      if (full && document.getElementById('_lightbox') === lb) { img.src = full; img.style.opacity = '1'; }
      else if (document.getElementById('_lightbox') === lb) img.style.opacity = '1';
    } catch (e) { if (document.getElementById('_lightbox') === lb) img.style.opacity = '1'; }
  }
  document.addEventListener('click', e => {
    const img = e.target.closest('.fotos img');
    if (!img) return;
    const { fotoTipo, fotoOwner, fotoIdx, fotoCampo } = img.dataset;
    if (fotoTipo && fotoOwner != null && fotoIdx != null) {
      _abrirLightboxComBusca(img.src, async () => {
        const r = fotoTipo === 'ocorrencia' ? await DB.getFotosOcorrencia(fotoOwner) : await DB.getFotosPac(fotoOwner);
        return r?.[fotoCampo || 'fotos']?.[Number(fotoIdx)]?.dataUrl || null;
      });
    } else {
      _openLightbox(img.src);
    }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.getElementById('_lightbox')) _closeLightbox(); });
  // Renderiza um array de fotos (ocorrência/P.A.C.): se a foto já tem
  // dataUrl (upload local recém-capturado, ou registro legado sem
  // thumbUrl), mostra ela direto; se só tem thumbUrl (listagem já cortou o
  // dataUrl cheio, ver PERFORMANCE.md), mostra a miniatura marcada pra
  // buscar o tamanho cheio sob demanda ao ampliar (ver _abrirLightboxComBusca).
  function _renderFotosImgs(fotos, tipo, ownerId, campo) {
    return (fotos || []).map((f, i) => {
      if (!f) return '';
      if (f.dataUrl) return `<img src="${esc(f.dataUrl)}" alt="">`;
      if (f.thumbUrl) return `<img src="${esc(f.thumbUrl)}" alt="" data-foto-tipo="${esc(tipo)}" data-foto-owner="${esc(ownerId)}" data-foto-idx="${i}" data-foto-campo="${esc(campo || 'fotos')}">`;
      return '';
    }).join('');
  }
  const fmtDate = d => d ? new Date(d + (d.length <= 10 ? 'T00:00:00' : '')).toLocaleDateString('pt-BR') : '—';

  // Espelha a regra do backend (api.js): só master ou administrador de
  // CLIENTE (plataforma) pode criar contrato/estabelecimento novo. Ser
  // administrador de UM contrato não habilita isso (ver auditoria 0.16) —
  // o backend já recusa; isto só evita mostrar um botão que vai dar 403.
  function isAdministradorAnywhere() {
    if (isMaster()) return true;
    return getCurrentUser().role === 'admin'; // administrador de cliente
  }

  // ── Estabelecimentos do contrato (Etapa 1 — contrato 1:N) ──────────
  // Lê do `contratos` já carregado (cada contrato traz `estabelecimentos:
  // [{id,nome,...}]`, ver GET /contratos) — sem chamada extra à API.
  function estabelecimentosDoContrato(contratoId) {
    const c = (typeof contratos !== 'undefined' ? contratos : []).find(x => x.id === contratoId);
    return (c && c.estabelecimentos) || [];
  }
  function nomeEstabelecimento(contratoId, estId) {
    if (!estId) return null;
    const e = estabelecimentosDoContrato(contratoId).find(x => x.id === estId);
    return e ? e.nome : null;
  }
  // Campo de estabelecimento de um formulário: nada (string vazia) se o
  // contrato não tem nenhum estabelecimento; campo fixo (só leitura) se tem
  // exatamente 1 (não faz sentido perguntar); <select> se tem 2+.
  function campoEstabelecimento(contratoId, selecionadoId, idAttr) {
    const ests = estabelecimentosDoContrato(contratoId);
    if (!ests.length) return '';
    if (ests.length === 1) {
      return `<input type="hidden" id="${idAttr}" value="${esc(ests[0].id)}">
        <label class="field"><span>Estabelecimento</span><input value="${esc(ests[0].nome)}" disabled></label>`;
    }
    return `<label class="field"><span>Estabelecimento</span><select id="${idAttr}">
      <option value="">— selecione —</option>
      ${ests.map(e => `<option value="${esc(e.id)}" ${selecionadoId === e.id ? 'selected' : ''}>${esc(e.nome)}</option>`).join('')}
    </select></label>`;
  }
  function lerEstabelecimento(idAttr, root) {
    const el = (root || document).querySelector('#' + idAttr);
    return el ? (el.value || null) : null;
  }

  // ── Etapa 2 — aviso de troca de contrato + "formulário sujo" ───────
  // Qualquer campo preenchido em #view ou dentro do #modal marca a tela como
  // "com dados não salvos" (exceto o próprio seletor de contrato, na
  // appbar). O reset acontece em dois pontos que cobrem tanto navegação
  // quanto salvar-e-re-renderizar sem precisar tocar em cada módulo:
  // (1) sempre que #view é substituído por inteiro (MutationObserver —
  // pega tanto irPara() quanto um handler de "salvo" que re-renderiza a
  // aba direto); (2) ao fechar o modal (closeModal), coberto abaixo.
  window._formSujo = false;
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (!(el.matches('input,textarea,select'))) return;
    if (el.closest('.appbar')) return; // seletor de contrato não conta
    if (el.disabled) return;
    if (el.closest('#view') || el.closest('#modal')) window._formSujo = true;
  }, true);
  new MutationObserver(() => { window._formSujo = false; }).observe(view, { childList: true });

  const _closeModalOriginal = closeModal;
  closeModal = function () { window._formSujo = false; _closeModalOriginal(); };

  // Banner temporário (fecha sozinho ou no X) avisando a troca de contrato,
  // com destaque visual breve no próprio seletor — sem bloquear navegação.
  function avisarTrocaContrato(c) {
    document.querySelectorAll('.contrato-aviso').forEach(el => el.remove());
    const ests = estabelecimentosDoContrato(c.id);
    const nomeEst = ests.length ? (ests.length <= 2 ? ests.map(e => e.nome).join(', ') : `${ests.length} estabelecimentos`) : 'sem estabelecimento vinculado';
    const box = document.createElement('div');
    box.className = 'contrato-aviso';
    box.innerHTML = `<span>Contrato alterado para <strong>${esc(c.numero)}</strong> — ${esc(nomeEst)}. O que você vê e lança agora pertence a este contrato.</span>
      <button type="button" aria-label="Fechar aviso">×</button>`;
    box.querySelector('button').onclick = () => box.remove();
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 6000);
    const selWrap = document.querySelector('.contrato-select');
    if (selWrap) { selWrap.classList.add('destaque'); setTimeout(() => selWrap.classList.remove('destaque'), 1200); }
  }


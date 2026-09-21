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
  }
  document.addEventListener('click', e => {
    const img = e.target.closest('.fotos img');
    if (img) _openLightbox(img.src);
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.getElementById('_lightbox')) _closeLightbox(); });
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


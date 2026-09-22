// ── file-output.js (QualiHUB) ───────────────────────────────────────
// Helper central pra abrir/baixar/compartilhar arquivos (PDF, principalmente)
// de forma confiável em desktop, Android e iOS Safari.
//
// Por que isto existe: antes, PDFs anexados eram abertos/baixados direto
// via data:application/pdf;base64,... em href="..." (URI de dados cru — cai
// em limites de tamanho de URL e é inconsistente entre navegadores, em
// especial no atributo download do Safari/iOS) e PDFs GERADOS usavam só
// pdfMake(...).download(), que no iOS Safari frequentemente não salva nada
// (o navegador só abre o PDF, sem opção de "Salvar em Arquivos"). Blob URL +
// Web Share API (quando disponível) resolve os dois casos.
//
// Regra: nunca chamar window.open() depois de um await (popup blocker).
// openBlob()/downloadBlob() usam um <a> sintético clicado de forma síncrona
// dentro do próprio handler — não é bloqueado como window.open() seria.

function dataUrlToBlob(dataUrl) {
  const [meta, b64] = dataUrl.split(',');
  const mime = (meta.match(/data:([^;]+)/) || [, 'application/octet-stream'])[1];
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function _clickTempAnchor(href, opts) {
  const a = document.createElement('a');
  a.href = href;
  a.rel = 'noopener';
  if (opts && opts.download) a.download = opts.download;
  if (opts && opts.target) a.target = opts.target;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// "Abrir" — nova aba, sem forçar download. Mantém o Blob URL vivo por um
// tempo (a nova aba/contexto ainda precisa carregá-lo) e revoga depois.
function openBlob(blob) {
  const url = URL.createObjectURL(blob);
  _clickTempAnchor(url, { target: '_blank' });
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// "Salvar" — força download via atributo download (Chrome/Firefox/Edge e
// Safari desktop lidam bem com isso). No iOS Safari isto é o fallback;
// openOrShareFile() abaixo prefere o Web Share quando disponível.
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  _clickTempAnchor(url, { download: filename });
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// Prefere a Web Share API (nível 2, com arquivos) quando o navegador suporta
// compartilhar ESTE arquivo — é o que dá ao iOS a folha de compartilhamento
// nativa com "Salvar em Arquivos"/AirDrop/etc, porque baixar um Blob direto
// no Safari iOS nem sempre oferece uma forma de salvar de fato. Cai para
// downloadBlob() em qualquer outro caso (desktop, Android sem share, erro,
// ou usuário cancelando o share não é tratado como erro).
async function openOrShareFile(blob, filename, mime) {
  if (navigator.canShare && navigator.share) {
    try {
      const file = new File([blob], filename, { type: mime || blob.type });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        return 'shared';
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled'; // usuário fechou a folha de share
      // qualquer outro erro (ex.: share não suportado nesse contexto) cai pro download normal
    }
  }
  downloadBlob(blob, filename);
  return 'downloaded';
}

// ── Delegação de clique pros chips de anexo PDF (documentos.js) ─────
// Um único listener no documento inteiro: funciona tanto na lista de
// documentos quanto dentro do modal de novo/editar, sem precisar religar
// handlers a cada render. O data-arquivo carrega o data:URL (já validado
// e populado via esc() no HTML — ver documentos.js) só até o clique; a
// conversão pra Blob só acontece na hora do uso, não é reprocessado à toa.
// data-doc-id (em vez de data-arquivo): auditoria de banda (PERFORMANCE.md,
// Etapa 1) — a listagem de documentos não manda mais o PDF inteiro, só um
// id; busca o arquivo do servidor sob demanda, só neste clique.
document.addEventListener('click', async (e) => {
  const openBtn = e.target.closest('[data-pdf-open]');
  const saveBtn = e.target.closest('[data-pdf-save]');
  const btn = openBtn || saveBtn;
  if (!btn) return;
  const nome = btn.getAttribute('data-nome') || 'documento.pdf';
  let dataUrl = btn.getAttribute('data-arquivo');
  if (!dataUrl && btn.dataset.docId) {
    btn.disabled = true;
    try { const r = await DB.getArquivoDocumento(btn.dataset.docId); dataUrl = r.arquivo; }
    catch (err) { if (typeof toast === 'function') toast(err.message || 'Não foi possível buscar o anexo.', true); btn.disabled = false; return; }
    btn.disabled = false;
  }
  if (!dataUrl) return;
  let blob;
  try { blob = dataUrlToBlob(dataUrl); }
  catch (err) { if (typeof toast === 'function') toast('Não foi possível abrir o anexo.', true); return; }
  if (openBtn) { openBlob(blob); return; }
  openOrShareFile(blob, nome, 'application/pdf').catch(() => {
    if (typeof toast === 'function') toast('Não foi possível salvar o anexo.', true);
  });
});

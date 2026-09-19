// ── test-xss-guard.js ─────────────────────────────────────────────
// Guarda de regressão pro XSS armazenado achado na auditoria: campos que
// vêm do SERVIDOR (fotos de ocorrência/P.A.C., logo do perfil, foto do
// estabelecimento) sendo jogados em innerHTML como <img src="${valor}">
// SEM esc(). Como esses campos (dataUrl/foto/logo) só são validados por
// TAMANHO no backend (não por conteúdo), um valor malicioso enviado direto
// pela API (fora da UI) quebra o atributo src="..." e injeta HTML/JS na
// tela de quem abrir aquele registro depois — o JWT mora em
// sessionStorage, então isso seria sequestro de sessão de quem visse.
//
// Este teste não substitui um scanner de verdade: é uma rede de segurança
// barata contra a REINTRODUÇÃO exata deste padrão. Roda com Node puro, sem
// DOM/browser.
const fs = require('fs');
const path = require('path');

// [arquivo, regex do padrão perigoso (interpolação SEM esc() ao redor)]
const CHECKS = [
  { file: 'ocorrencias.js', pattern: /src="\$\{(?!esc\()f\.dataUrl\}/ },
  { file: 'pac.js',         pattern: /src="\$\{(?!esc\()f\.dataUrl\}/ },
  { file: 'empresa.js',     pattern: /src="\$\{(?!esc\()logo\}/ },
  { file: 'cadastro.js',    pattern: /src="\$\{(?!esc\()(e\.foto|foto)\}/ },
  { file: 'documentos.js',  pattern: /src="\$\{(?!esc\()arquivo\}/ },
];

let pass = 0, fail = 0;
CHECKS.forEach(({ file, pattern }) => {
  const full = path.join(__dirname, file);
  const src = fs.readFileSync(full, 'utf8');
  const bad = pattern.test(src);
  if (!bad) { pass++; console.log('  ✓', file, '— nenhum src="${...}" sem esc() encontrado'); }
  else { fail++; console.log('  ✗', file, '— ACHOU um src="${...}" SEM esc() (regressão do XSS armazenado corrigido na auditoria)'); }
});

console.log(`\nRESULTADO: ${pass} passaram, ${fail} falharam`);
process.exit(fail ? 1 : 0);

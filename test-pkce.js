// ── test-pkce.js ─────────────────────────────────────────────────
// Verifica o algoritmo de PKCE (RFC 7636) usado em api-client.js:
// code_challenge = BASE64URL(SHA-256(code_verifier)), sem padding, com
// + → - e / → _.
//
// api-client.js usa APIs de navegador (crypto.subtle, btoa, TextEncoder)
// que não existem no Node puro — este teste não executa o arquivo, ele
// reimplementa a MESMA transformação (byte[] → base64url) e confere contra
// o encoder nativo do Node (Buffer...toString('base64url')), que é a
// referência confiável. Isso cobre o ponto onde um bug seria mais fácil de
// passar despercebido: padding/troca de caracteres do base64 pro base64url.
//
// O que este teste NÃO cobre (precisa de teste manual, navegador real, com
// login Google de verdade, antes de habilitar em produção — ver
// SECURITY.md): o redirect completo pro accounts.google.com, a troca do
// código por id_token em https://oauth2.googleapis.com/token, e o
// PKCE_VERIFIER_KEY sobrevivendo ao redirect via sessionStorage.
const crypto = require('crypto');

// Mesma lógica de _base64url() em api-client.js, mas usando Buffer no lugar
// de btoa/Uint8Array (só pra rodar em Node; o algoritmo é idêntico).
function base64urlComoNoApiClient(bytes) {
  let str = '';
  bytes.forEach(b => { str += String.fromCharCode(b); });
  const b64 = Buffer.from(str, 'binary').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, extra !== undefined ? JSON.stringify(extra) : ''); }
}

// Vários tamanhos/valores aleatórios, comparados contra o encoder nativo
// (confiável) do Node.
for (let i = 0; i < 20; i++) {
  const len = 16 + Math.floor(Math.random() * 48);
  const bytes = crypto.randomBytes(len);
  const esperado = bytes.toString('base64url'); // referência nativa do Node
  const obtido = base64urlComoNoApiClient([...bytes]);
  check(`base64url de ${len} bytes bate com o encoder nativo do Node (rodada ${i + 1})`, obtido === esperado, { esperado, obtido });
}

// Round-trip completo do desafio PKCE: verifier aleatório → SHA-256 →
// base64url, comparado com o mesmo cálculo feito só com APIs nativas do Node.
const verifier = base64urlComoNoApiClient([...crypto.randomBytes(32)]);
const challengeViaApiClientLogic = base64urlComoNoApiClient([...crypto.createHash('sha256').update(verifier, 'utf8').digest()]);
const challengeReferencia = crypto.createHash('sha256').update(verifier, 'utf8').digest('base64url');
check('code_challenge = base64url(sha256(verifier)) bate com a referência nativa', challengeViaApiClientLogic === challengeReferencia,
  { challengeViaApiClientLogic, challengeReferencia });
check('code_verifier gerado tem 43 chars (32 bytes em base64url, RFC 7636 pede 43–128)', verifier.length === 43, verifier.length);
check('code_challenge não tem caracteres de padding (=) nem +/ (alfabeto base64url puro)', !/[+/=]/.test(challengeViaApiClientLogic), challengeViaApiClientLogic);

console.log(`\nRESULTADO: ${pass} passaram, ${fail} falharam`);
console.log('\nLembrete: isto testa só o algoritmo (base64url/SHA-256). O fluxo completo');
console.log('(redirect → Google → troca do código → id_token) precisa de um teste manual');
console.log('em navegador real antes de habilitar em produção — ver SECURITY.md.');
process.exit(fail ? 1 : 0);

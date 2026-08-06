// ── config.js ─────────────────────────────────────────────────────
// FONTE ÚNICA da URL do backend do QualiHUB.
// Carregue SEMPRE antes de api-client.js:
//   <script src="config.js"></script>
//   <script src="api-client.js"></script>
(function () {
  'use strict';

  // ►► TROQUE AQUI quando o backend estiver no ar no Render ◄◄
  // (sem barra no final). Enquanto estiver vazio, o frontend tenta o mesmo
  // domínio (útil se você servir o front pelo próprio backend).
  var API_PRODUCAO = 'https://qualihub-backend.onrender.com'; // URL do backend no Render

  var API_LOCAL = API_PRODUCAO;

  var host    = location.hostname;
  var ehLocal = (host === 'localhost' || host === '127.0.0.1' || location.protocol === 'file:');

  // Override manual pra testar contra outro backend sem editar arquivo:
  //   localStorage.setItem('quali_api_url', 'https://outro-backend...')
  var override = null;
  try { override = localStorage.getItem('quali_api_url'); } catch (e) {}

  window.QUALI_API = override || (ehLocal ? API_LOCAL : API_PRODUCAO);
})();

// ── saiba-mais.js (QShub) ───────────────────────────────────────────
// Conteúdo do "Saiba mais", num único lugar (função que devolve o HTML) —
// usado tanto pelo modal da tela de login (index.html) quanto por um ícone
// "?" na appbar de dentro do app (app.html), pra não manter duas cópias do
// texto desatualizando em ritmos diferentes (Etapa 4 da auditoria de
// fluxo). Diagrama em HTML/CSS puro (sem imagem externa nem lib de CDN),
// usando as variáveis de cor do styles.css; empilha em coluna no mobile via
// a classe .saiba-diagrama (regra em styles.css, mesmo breakpoint de 640px
// já usado no resto do app).
function saibaMaisHTML() {
  const passo = (titulo, desc) => `<div class="saiba-passo"><div class="saiba-passo-t">${titulo}</div><div class="saiba-passo-d">${desc}</div></div>`;
  const seta = '<span class="saiba-seta" aria-hidden="true">→</span>';

  return `
    <div class="eyebrow">Sobre o sistema</div>
    <h2>QShub</h2>
    <p style="margin:.5rem 0 0">O QShub (powered by Qualiservice) é um sistema de gestão de qualidade de
      alimentos. Ele organiza, por contrato, o controle de autocontrole (P.A.C.), o controle de temperatura,
      o tratamento de não conformidades (Ocorrências), as licenças e certificados (Documentos sanitários) e a
      agenda de visitas técnicas — com indicadores por contrato e relatórios em PDF assinados digitalmente.</p>

    <h3 style="margin-top:18px">1. Quem é quem</h3>
    <div class="saiba-diagrama">
      ${passo('Admin master', 'Dono do sistema. Cadastra os clientes (administradores de conta) e enxerga tudo, só para fiscalização.')}
      ${seta}
      ${passo('Cliente<br><span class="muted" style="font-weight:400">(administrador contratante)</span>', 'Empresa contratante do serviço. Cria e é dono dos próprios contratos.')}
      ${seta}
      ${passo('Contrato', 'A unidade de trabalho do dia a dia. Escolhido na barra superior — define o que você vê e lança.')}
      ${seta}
      ${passo('Estabelecimento(s)', 'Um contrato tem um ou vários. Cada estabelecimento pertence a exatamente um contrato (não é compartilhado).')}
    </div>
    <p class="muted" style="font-size:.85rem;margin-top:10px">Dentro de cada contrato, quatro papéis definem o que cada pessoa pode fazer:</p>
    <div class="saiba-papeis">
      <div class="saiba-papel"><span class="chip aberta">Administrador</span> gerencia o contrato: acessos, equipamentos, estabelecimentos.</div>
      <div class="saiba-papel"><span class="chip sim">Fiscal</span> acompanha, cria e edita ocorrências; é o 1º da fila de responsável padrão.</div>
      <div class="saiba-papel"><span class="chip ok">Gestor</span> aprova/reprova o P.A.C.; cuida de funcionários e ocorrências.</div>
      <div class="saiba-papel"><span class="chip neutral">Executor</span> lança o dia a dia: registros do P.A.C., temperatura, ocorrências.</div>
    </div>

    <h3 style="margin-top:18px">2. Escolha do contrato</h3>
    <p style="margin:.4rem 0 0;font-size:.9rem">A barra superior define o contexto de tudo — inclusive a lista de
      estabelecimentos disponível em cada formulário. Trocar de contrato avisa na tela (uma faixa temporária com o
      número do novo contrato) e, se houver um formulário com dados não salvos, pede confirmação antes de trocar.</p>

    <h3 style="margin-top:18px">3. A rotina de cada módulo (em paralelo)</h3>
    <div class="saiba-modulos">
      <div class="saiba-mod"><div class="saiba-mod-t">P.A.C.</div><div class="saiba-mod-fluxo">Lançar${seta}Aprovar ou reprovar<span class="muted" style="font-size:.72rem;display:block">(decisão única, não é reescrita)</span></div></div>
      <div class="saiba-mod"><div class="saiba-mod-t">Temperatura</div><div class="saiba-mod-fluxo">Sensor ou manual${seta}Comparação com a faixa do equipamento${seta}Alerta se fora da faixa</div></div>
      <div class="saiba-mod"><div class="saiba-mod-t">Ocorrências</div><div class="saiba-mod-fluxo">Registrar (estabelecimento, prazo, gravidade, foto)${seta}Responsável corrige${seta}Concluída no prazo ou com atraso</div></div>
      <div class="saiba-mod"><div class="saiba-mod-t">Documentos e Visitas</div><div class="saiba-mod-fluxo">Cadastro${seta}Aviso de vencimento / periodicidade</div></div>
    </div>

    <h3 style="margin-top:18px">4. Saídas</h3>
    <p style="margin:.4rem 0 0;font-size:.9rem">O painel do contrato reúne os indicadores em tempo real; cada módulo
      gera relatórios em PDF assinados digitalmente (HMAC), com a marca do cliente e do Responsável Técnico.</p>

    <h3 style="margin-top:18px">Regras que evitam conflito entre módulos</h3>
    <ul style="margin:.4rem 0 0;padding-left:1.1rem;font-size:.85rem;line-height:1.7">
      <li>Um estabelecimento não muda de contrato depois de vinculado.</li>
      <li>Um registro fechado (ocorrência concluída, P.A.C. já decidido) não é reescrito.</li>
      <li>Ninguém fica sem responsável: perder o acesso reatribui as ocorrências abertas automaticamente.</li>
      <li>Um sensor de temperatura não infla os indicadores de lançamento humano — só um alerta aparece na atividade recente.</li>
    </ul>

    <h3 style="margin-top:18px">Acesso</h3>
    <p style="margin:.4rem 0 0;font-size:.9rem">Você entra com sua conta Google. O acesso é restrito: só e-mails
      autorizados pelo administrador do contrato conseguem entrar, e cada pessoa vê apenas os contratos aos quais
      foi vinculada.</p>

    <p class="muted" style="font-size:.78rem;margin-top:16px">Sistema privado, de uso restrito aos clientes e
      equipes autorizadas. Em caso de dúvida sobre seu acesso, fale com o administrador do seu contrato.</p>`;
}

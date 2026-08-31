# FinApp na App Store — plano de execução

> Escrito em 31/08/2026. Substitui o roadmap (secções 17 e 18) de
> [`plano-mobile-capacitor.md`](./plano-mobile-capacitor.md), que continua válido
> como **auditoria técnica** (o que existe no código, quais os riscos, que plugins
> fazem falta). O que muda aqui é a **ordem** e o facto de agora existirem etapas
> já concluídas.
>
> Fontes: auditoria de 22/08, `HISTORICO.md` (452 mudanças até 30/08),
> `PENDENCIAS.md`, `EQUIPES_AUDITORIA.md`, estado real do código em `main` a
> 31/08, e confirmação da sessão Gestor sobre o que está decidido e o que não está.

---

## 1. Onde estamos hoje

### Já feito (não é preciso repetir)

- **App web maduro e estável**: React + Vite + Zustand + Firebase, 186 ficheiros
  de código, 85 ficheiros de teste, CI a passar.
- **`theme-color` já acompanha o tema** (`useAplicarTema.ts`) — era o ponto 7.1 da
  auditoria, foi resolvido depois dela.
- **Ícone já declarado como `maskable`** no manifest (`icon-v4.svg`,
  `purpose: "any maskable"`) — falta só a versão em PNG.
- **Cota de IA fechada também no servidor** (27/08) — era uma das dívidas apontadas
  para quando o Copiloto virasse funcionalidade paga.
- **`env(safe-area-inset-*)` em uso**, `viewport-fit=cover` no HTML, `apple-touch-icon`
  tratado, cache offline com estratégia por tipo de recurso.
- **Trabalho pesado de UX móvel feito em 25–31/08**: nav colada à base, menu único de
  ações em todas as listas, Registro Rápido reorganizado, folhas (bottom sheets)
  ajustadas.

### Ainda não existe (verificado no código a 31/08)

| O que falta                                    | Onde se vê que não existe                      |
| ---------------------------------------------- | ---------------------------------------------- |
| Qualquer dependência `@capacitor/*`            | `package.json`                                 |
| Pastas `domain/`, `entitlement/`, `platform/`  | `src/`                                         |
| Nó `/billing/$uid` com `.write: false`         | `database.rules.json` (só existe `users/$uid`) |
| Campo de plano/assinatura no modelo de dados   | `src/types/` — nenhuma referência a plano      |
| Ícones PNG (192/512/1024) e `screenshots`      | `public/icons/` só tem SVG + apple-touch-icon  |
| Conta Apple Developer, nome de loja, bundle id | em aberto (confirmado pelo Gestor)             |

---

## 2. As 4 decisões que só o Gabriel pode tomar

Nenhuma etapa técnica das secções seguintes fica parada à espera destas decisões,
**exceto a etapa E (TestFlight)**, que não arranca sem a decisão 1.

### Decisão 1 — Conta Apple Developer

99 USD/ano (≈ €92). Em nome pessoal (basta o NIF) ou em nome de empresa (precisa de
número D-U-N-S, demora mais 1–2 semanas). **Recomendação: pessoal**, porque é mais
rápido e pode transferir-se para uma empresa depois. A aprovação da conta costuma
demorar 24–48 h, por vezes mais — por isso vale a pena tratar disto cedo, mesmo
que o código ainda não esteja pronto.

### Decisão 2 — Nome na loja + bundle id

"FinApp" é provável que já exista na App Store portuguesa; o nome da loja tem de
ser único. Sugestão: manter "FinApp" como nome do ícone e usar um nome de loja
com sufixo do público-alvo (ex.: "FinApp — Contas TVDE"). O bundle id é interno e
irreversível depois de publicado (ex.: `pt.finapp.app`).

### Decisão 3 — Ordem: loja primeiro ou pagamento primeiro?

Isto é a mudança principal em relação ao plano de 22/08.

- **Caminho A (recomendado): primeira versão na loja sem pagamento nenhum.** Tudo
  aberto, como está hoje. A assinatura entra numa atualização (v1.1) depois de a
  Apple já ter aprovado o app uma vez. Chega-se à loja ~3 semanas mais cedo, e
  separa-se o risco: se a Apple recusar, é por causa do empacotamento, não do
  paywall.
- **Caminho B: construir a assinatura antes de submeter.** É o que o documento de
  22/08 dizia ("billing é bloqueante"). Continua a ser verdade — mas só a partir do
  momento em que existir alguma funcionalidade paga. Se a v1 não tranca nada, não há
  nada a proteger.

O único custo do caminho A: quem instalar a v1 fica com tudo aberto e perde acesso
a TVDE/Veículo/Importar quando a v1.1 chegar. Com a base de utilizadores actual
(uma pessoa), isso não é um problema real.

### Decisão 4 — Como cobrar dentro do iPhone

**Este é o ponto cego do plano comercial actual.** O plano diz "Stripe + webhook
Vercel → `/billing/$uid`". Isso funciona no site, mas a Apple **exige compra
in-app (IAP) para assinatura digital consumida dentro do app**, e cobra 15 % no
primeiro ano de cada subscritor (Small Business Program, para quem factura menos de
1 M USD/ano). Um app que só aceite Stripe lá dentro é recusado na revisão.

Três saídas, por ordem de recomendação:

1. **RevenueCat + IAP da Apple, mantendo o Stripe na web.** O RevenueCat trata dos
   recibos da Apple e da Google, e manda webhook igual ao do Stripe — os dois
   caminhos acabam a escrever no mesmo `/billing/$uid`, e o app continua a só
   perguntar `canUseFeature()`. Grátis até ~2 500 USD/mês de receita.
2. **Só IAP no iOS**, Stripe só no site, sem RevenueCat. Menos uma dependência,
   mais código de validação de recibo escrito à mão.
3. **Link externo para pagar (permitido na UE desde o DMA)**: Portugal é UE, por isso
   é legal levar o utilizador para fora da app para pagar — mas a Apple aplica taxas
   próprias mesmo assim e a revisão é mais chata. Não compensa como plano principal.

---

## 3. As etapas, por ordem

Estimativas em **sessões de trabalho** (uma sessão ≈ 2–3 h de trabalho de um agente
com revisão do Gabriel pelo meio) e em tempo de calendário.

### Etapa A — Preparar o ecrã para telemóvel a sério

**2 sessões · 1–2 dias · pode começar agora**
Equipa: Acessibilidade + Design & Cor

1. Varrer **todas** as telas com cabeçalho ou rodapé fixo à procura de conteúdo
   colado ao notch / à barra inferior (hoje só 4 ficheiros usam `safe-area-inset`).
2. Testar o teclado virtual a tapar campos nas folhas com formulário (o botão
   "Salvar" do Registro Rápido é o caso mais provável).
3. Confirmar que nenhum botão ou ícone tem área de toque abaixo de 44×44 pt
   (mínimo da Apple).

**Pronto quando**: as três varreduras estão feitas e as correções commitadas.

### Etapa B — Fechar o manifest e os ícones

**1 sessão · meio dia · pode começar agora**
Equipa: Performance & PWA + Design & Cor

1. Gerar PNG do ícone em 192, 512 e 1024 px a partir do `icon-v4.svg`
   (o 1024 é obrigatório para a App Store).
2. Acrescentar `screenshots` ao manifest.
3. Preparar o ecrã de arranque (splash) com o fundo certo em tema claro e escuro.

**Pronto quando**: `PENDENCIAS.md` deixa de ter a linha do ícone maskable.

### Etapa C — Empacotar com Capacitor

**4 sessões · 1 semana · a etapa de maior risco**
Equipa: Migração Nativa (nova, ver secção 4) + Segurança

1. Instalar o Xcode (≈ 15 GB, uma hora de download) e correr `npx cap init` com o
   `webDir` a apontar para a build do Vite.
2. Criar `src/platform/` com três adaptadores, mantendo a assinatura das funções que
   o resto do app já chama:
   - `backup.ts` — exportar ficheiro passa a usar Filesystem + Share em vez de
     `<a download>` (que não funciona de forma fiável dentro da WebView);
   - `statusBar.ts` — liga o `useTemaEfetivo()` que já existe à barra de estado nativa;
   - `update.ts` — decide como o utilizador recebe correções sem esperar pela loja.
3. Validar dentro de uma build real, no iPhone: leitura de extrato em PDF
   (`pdfjs-dist` carrega um worker separado, é a causa clássica de "funciona no
   browser, rebenta no app"), e o Firebase em tempo real (WebSocket).
4. Auditar cada plugin `@capacitor/*` novo antes de instalar (equipa Segurança).

**Regra que não se quebra**: nenhum componente de ecrã importa `@capacitor/*`
directamente. Toda a diferença web/nativo vive em `src/platform/`.

**Pronto quando**: o FinApp abre no simulador do iPhone, faz login, grava um
lançamento e exporta um backup.

### Etapa D — Recursos nativos (requisito de aprovação, não luxo)

**3 sessões · 1 semana**
Equipa: Migração Nativa + Segurança

A Apple recusa apps que sejam "um site dentro de uma janela". São precisos recursos
nativos visíveis. Os três de melhor relação esforço/valor:

1. **Face ID** para abrir o app (é dado financeiro — é expectativa normal), com a
   sessão guardada no Keychain em vez do armazenamento do browser.
2. **Notificações locais** para fatura a vencer, a funcionar com o app fechado
   (reaproveita a lógica de `utils/notificacoes.ts` que já existe).
3. **Câmara** para fotografar recibo — pode ficar na versão simples (guarda a foto
   junto do lançamento) sem leitura automática.

**Pronto quando**: dá para escrever, na submissão, três frases concretas a explicar
por que o app não é só o site.

### Etapa E — TestFlight

**1 sessão · 2–3 dias · exige a Decisão 1 feita**
Equipa: Migração Nativa

1. Bundle id, número de versão e de build, ícones finais no Xcode.
2. Enviar a primeira build e instalá-la no iPhone do Gabriel pelo TestFlight.
3. Testar no aparelho real, sem simulador: gesto de voltar (deslizar da borda) a
   competir com as folhas, teclado, safe areas, e o app sem rede.

**Pronto quando**: o FinApp está instalado no iPhone a partir do TestFlight.

### Etapa F — Submeter à App Store

**2 sessões · 1 semana (1–3 dias só de espera pela revisão)**
Equipa: Migração Nativa + Conversão/Comercial

Checklist completo na secção 20 de `plano-mobile-capacitor.md`. Os pontos que mais
recusam apps:

1. **Declaração de privacidade** (`PrivacyInfo.xcprivacy`) — dizer exactamente o que
   é recolhido: e-mail de login, dados financeiros escritos pelo utilizador, e o que
   vai para o Gemini no Copiloto.
2. **Textos de permissão** no `Info.plist`, em português claro (câmara, Face ID,
   notificações).
3. **Apagar conta visível dentro do app** — obrigatório desde 2022; já existe em
   Definições, falta confirmar que o texto e o fluxo servem para a revisão.
4. **Política de privacidade e termos publicados** num link acessível.
5. **Screenshots por tamanho de ecrã** e metadata (nome, subtítulo, categoria
   Finanças, palavras-chave).

**Pronto quando**: estado "Ready for Sale" na App Store Connect.

### Etapa G — Assinatura (v1.1, depois da loja)

**5 sessões · 2 semanas · exige a Decisão 4 feita**
Equipa: Conversão/Comercial + Segurança + Arquitetura & Código

1. Criar `/billing/$uid` nas regras do Firebase com `.write: false` — só o webhook
   escreve. **Se o estado da assinatura ficar em `users/$uid`, o próprio utilizador
   consegue dar-se premium a partir do browser.**
2. Criar `src/entitlement/` com o tipo `Assinatura`, a store alimentada por `onValue`
   (mesmo padrão do `syncService`) e uma única função pública: `canUseFeature()`.
3. Generalizar o `RotaTvde` do `App.tsx` num guarda de rota por funcionalidade — o
   padrão já existe, só troca a bandeira booleana por um plano. Resolve de uma vez
   TVDE, Veículo, Importar, Planejamento, Calendário, Transações e Copiloto.
4. Ligar os dois caminhos de pagamento (IAP e Stripe) ao mesmo `/billing/$uid`.
5. Ecrã de paywall e trial de 21 dias sem cartão, conforme o plano comercial.

### Etapa H — Android / Play Store

Só depois de a v1 estar na App Store. Ícone adaptativo, splash, botão "voltar" do
sistema (que tem semântica própria, diferente do iOS), assinatura da app e conta na
Play Console (25 USD, pagamento único).

---

## 4. Equipas

A tabela viva está em [`EQUIPES_AUDITORIA.md`](./EQUIPES_AUDITORIA.md). Para este
plano há **uma equipa nova** e mudanças de âmbito em duas existentes:

| Equipa                       | Skills                                                    | Etapas     |
| ---------------------------- | --------------------------------------------------------- | ---------- |
| **Migração Nativa** _(nova)_ | `apple-design`, `pwa-expert` + skill de Capacitor (falta) | C, D, E, F |
| Acessibilidade               | `fixing-accessibility`                                    | A          |
| Design & Cor                 | `apple-design`, `color-expert`                            | A, B       |
| Performance & PWA            | `pwa-expert`, `web-perf`                                  | B, F       |
| Conversão/Comercial          | `webapp-paywall-implementation`, `dark-pattern-audit`     | F, G       |
| Segurança                    | `supply-chain-risk-auditor`                               | C, D, G    |
| Testes/QA                    | `vitest`, agente `finapp-visual-qa`                       | todas      |

**Falta instalar**: uma skill de Capacitor/Ionic. O "FinApp Skill Scout" (rotina
diária) já cruzou um candidato no repositório `majiayu000/claude-skill-registry`,
ainda **por verificar** — mesma checagem de legitimidade que se fez às outras antes
de instalar. Isto é a primeira tarefa da equipa Migração Nativa.

---

## 5. Os 5 riscos que podem atrasar isto

1. **O PDF rebenta dentro da app** (etapa C.3). O leitor de extratos carrega um
   ficheiro auxiliar por um caminho que muda dentro da WebView. Descobre-se cedo se
   for a primeira coisa testada na build real — e não na véspera do TestFlight.
2. **Recusa por "é só um site"** (etapa D). Mitiga-se com Face ID + notificações +
   câmara, e com a justificação escrita na submissão.
3. **Conta Apple demora mais do que se espera** (Decisão 1). Trata-se cedo; não custa
   nada estar aprovada e à espera.
4. **Sem forma de corrigir bugs entre versões da loja** (etapa C.2). Hoje a PWA
   corrige-se em segundos; a app nativa espera pela revisão da Apple. Precisa de
   decisão explícita antes da etapa E.
5. **Assinatura montada só sobre Stripe** (Decisão 4). Se a etapa G for construída sem
   IAP, a v1.1 é recusada e o trabalho de paywall tem de ser refeito.

---

## 6. Custos

| Item                        | Valor                           |
| --------------------------- | ------------------------------- |
| Conta Apple Developer       | 99 USD/ano (≈ €92)              |
| Xcode + Mac                 | 0 — o Mac já existe             |
| RevenueCat                  | 0 até ~2 500 USD/mês de receita |
| Comissão da Apple           | 15 % (Small Business Program)   |
| Play Console (etapa H)      | 25 USD, uma vez                 |
| **Para chegar à App Store** | **≈ €92**                       |

Tempo total realista até "Ready for Sale", sem contar a etapa G: **13 sessões de
trabalho, 4 a 6 semanas de calendário** com o ritmo actual do projecto.

---

## 7. O que este plano não muda

- A stack (React + Vite + Zustand + Firebase). O Capacitor embrulha o que existe,
  não substitui nada.
- As regras financeiras já testadas — mudam de pasta na etapa G (`domain/`), nunca
  de comportamento.
- O padrão serviço → store → ecrã, que é exactamente o que permite reaproveitar tudo.
- O plano comercial TVDE-first: público, lista de funcionalidades trancadas e preço
  de referência (≈ €7,99/mês ou €69/ano, trial de 21 dias) mantêm-se como decidido.
- As cores e a identidade visual. A regra do verde só na Receita vale também dentro
  da app nativa.

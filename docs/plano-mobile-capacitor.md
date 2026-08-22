# FinApp — Plano Técnico: PWA → Capacitor → iOS/Android

> Auditoria feita em 22/08/2026 sobre o estado real do código em `main`. Relatório de diagnóstico e planejamento — nenhum código foi alterado para produzir este documento.

---

## 1. Stack atual

- **Framework**: React 19.2.8 + TypeScript, build via Vite 8.1.5 (`tsc -b && vite build`).
- **Roteamento**: react-router-dom 7.18.1, `BrowserRouter` + rotas lazy (`React.lazy`).
- **Estado**: Zustand 5.0.14 — 16 stores em `src/stores/`, 9 delas com `persist` (localStorage).
- **Backend**: Firebase 12.16.0 — Auth (email/senha) + Realtime Database (`europe-west1`).
- **PWA**: `vite-plugin-pwa` 1.3.0 (Workbox por baixo), `registerType: "autoUpdate"`.
- **Outras libs de produto**: `lucide-react` (ícones), `pdfjs-dist` 6.2.108 (leitura de extrato em PDF).
- **Testes**: Vitest 4.1.10 + Testing Library 16.3.2 + jsdom. **Sem Playwright, sem diretório E2E** — só unitário/componente.
- **Lint/format**: ESLint 10 (flat config) + Prettier 3.9.6.
- **Node**: sem `.nvmrc` visível na raiz; CI usa Node 22.

Stack é moderna e enxuta — sem frameworks concorrentes (nenhum Redux, nenhum Next.js, nenhum UI kit pesado tipo MUI). Isso favorece Capacitor: menos coisa pra descobrir se é compatível com WebView.

## 2. Arquitetura atual

Separação já é razoavelmente limpa, em camadas horizontais por pasta (não por feature):

```
src/
  pages/          — uma tela por rota (Inicio, Despesas, Receitas, Veiculo, Cartoes, ...)
  pages/definicoes/ — "folhas" (BottomSheet) extraídas do antigo Definicoes.tsx monolítico
  layout/         — AppShell, Header, Sidebar, MobileNav, RegistroRapido, BottomSheet host
  components/     — reutilizáveis genéricos (BottomSheet, Seletor, Toast, ConfirmarAcao...)
  components/settings/ — SettingsSection/SettingsRow/SettingsSwitchRow (usados só em Definições)
  stores/         — Zustand, 1 arquivo por domínio
  services/       — acesso a dados (Firebase) + lógica de gravação, 1 arquivo por domínio, quase todos com .test.ts irmão
  hooks/          — hooks compartilhados (useTemaEfetivo, useAbrirRegistroPorUrl, usePwaUpdate...)
  utils/          — funções puras (cálculo financeiro, formatação, notificações)
  types/          — tipos de domínio
  constants/      — valores fixos (configPadrao etc.)
  testes/         — setup do Vitest + fixtures ("dobras")
```

Exemplos concretos do padrão service→store→UI: `lancamentosService.ts` (grava no Firebase) é chamado a partir de `RegistroRapido.tsx`, que depois de gravar não atualiza estado local diretamente — o `syncService` mantém um listener (`onValue`) que atualiza as stores (`lancamentosStore` etc.) automaticamente. Ou seja, a UI nunca lê o Firebase direto: sempre store → hook.

**O que falta hoje** (relevante pros itens 6, 16): não existe uma camada `domain/` separada — regras financeiras (cálculo de fatura, parcelas, rateio) vivem em `utils/` misturadas com formatação pura. Funciona porque `utils/` já é só função pura testável, mas a fronteira entre "regra de negócio crítica" e "utilitário qualquer" não é visível na estrutura de pastas, só no nome do arquivo.

## 3. Estrutura de pastas

```
src
src/assets
src/components
src/components/settings
src/constants
src/hooks
src/layout
src/pages
src/pages/definicoes
src/services
src/stores
src/styles
src/testes
src/types
src/utils
```

Plana e sem aninhamento profundo — 14 diretórios de primeiro/segundo nível. Não há `src/features/` nem `src/domain/` ainda.

## 4. Estado atual da PWA

- **Manifest** (`public/manifest.json`): `display: "standalone"`, `start_url: "/"`, `background_color`/`theme_color` fixos em `#0A1622` (o azul escuro do tema dark). **Só 1 ícone** declarado (`icon-v2.svg`, `sizes: "any"`) — sem ícone `maskable` dedicado, sem tamanhos PNG explícitos (192/512), sem `screenshots` (usado pelos install prompts ricos do Android/desktop).
- **Service worker**: gerado pelo `vite-plugin-pwa` com Workbox. `registerType: "autoUpdate"` — sem prompt de "há atualização, recarregar?", o SW novo assume sozinho.
- **Estratégia de cache**: precache do app shell inteiro (JS/CSS/HTML/SVG/woff2) via `globPatterns`. PDF.js (~430 kB) é **excluído do precache** de propósito (`globIgnores`) e cacheado sob demanda (`CacheFirst`) só na primeira vez que alguém importa um PDF — decisão documentada e sensata. Firebase RTDB usa `NetworkFirst` com timeout de 4s e expiração de 7 dias — offline mostra o último dado sincronizado.
- **Atualização ativa**: `usePwaUpdate.ts` força `registration.update()` sempre que o app volta a ficar visível (`visibilitychange`) — existe especificamente porque o iOS Safari, ao tirar o PWA da suspensão, **não** verifica rede sozinho. É uma correção real de um bug observado em produção (documentado no próprio código).
- **`theme-color`**: fixo em `index.html` (`<meta name="theme-color" content="#0A1622">`) e no manifest — **não muda com o tema claro**, que já existe desde a implementação de `useTemaEfetivo`. Está desatualizado em relação à própria feature de tema que acabamos de construir.
- **`viewport-fit=cover`** já presente — pré-requisito pra usar `env(safe-area-inset-*)`, que o app já usa em 4 lugares (`Sidebar.module.css`, `tokens.css`, `BottomSheet.module.css`).
- **`apple-touch-icon`** já tratado com comentário explicando por que é necessário (iOS não lê o manifest pra isso).

## 5. Pontos fortes

1. **Separação service/store já existe e é consistente** — 24 arquivos em `services/`, a maioria com teste irmão (`.test.ts`). Isso é exatamente o que permite reusar lógica entre Web e Capacitor sem reescrever nada: o service não sabe nem precisa saber em que shell está rodando.
2. **Regras financeiras já são funções puras testáveis** em `utils/` (parcelas, fatura, notificações) — não misturadas em componentes. 1248 testes passando, boa parte cobrindo exatamente esse domínio.
3. **`persist` do Zustand já isola o que é local (tema, config, dados offline-first) do que vem do Firebase** — 9 de 16 stores usam `persist`, as outras (auth, ui, toast, confirmar, mesVisivel, historico) são estado de sessão/efêmero por natureza. Essa fronteira já está certa pra decidir o que precisa de `Preferences`/`Storage` nativo do Capacitor depois.
4. **`safe-area-inset` já em uso** — sinal de que mobile real (notch, home indicator) já foi pensado antes de qualquer WebView nativa existir.
5. **PWA já funcionalmente madura**: cache offline com estratégia diferenciada por tipo de recurso, atualização forçada corrigindo um bug real do iOS, ícone específico pro "Adicionar à Tela de Início". Isso reduz o trabalho da Fase 3 (PWA hardening) a ajustes, não a uma reconstrução.
6. **Firebase Auth + RTDB funcionam via SDK JS puro** (`firebase/app`, `firebase/auth`, `firebase/database`) — sem depender de nenhuma API exclusiva de browser (cookies de terceiros, `document.domain` etc.) que quebraria dentro de uma WebView Capacitor.
7. **Nenhuma dependência de UI pesada ou exótica** — só `lucide-react` (SVG puro) e `pdfjs-dist` (isolado num único arquivo, `extrairExtratoPdf.ts`). Superfície de risco de compatibilidade é pequena.

## 6. Problemas arquiteturais

1. **Ausência de camada de domínio isolada.** Regras financeiras (cálculo de fatura, parcelas, arredondamento monetário) vivem em `utils/` junto com formatação e helpers genéricos, sem separação de pasta. Não é um problema hoje (tudo é função pura testada), mas dificulta comunicar "isto é regra de negócio crítica, mexer com cuidado" vs. "isto é um helper qualquer" só olhando a árvore — relevante quando a Fase 5/Entitlements começar a decidir o que cada plano pode calcular.
2. **Nenhuma noção de plano/assinatura no modelo de dados.** `ConfigConta` (`types/config.ts`) não tem nenhum campo de plano, trial, ou billing — confirmado por leitura direta do tipo. Isso é esperado (nada foi implementado ainda), mas é o gap concreto que a Fase 1 precisa fechar antes de qualquer gate de feature.
3. **Estado de assinatura não pode viver em `users/$uid` como está hoje.** `database.rules.json` só valida `fin_v5/iaUso/$dia` (`newData.isNumber() && >= 0`) — todo o resto da árvore do usuário não tem `.validate`. Isso é aceitável pra dados que só o próprio dono lê/escreve (parcela errada só afeta quem errou), mas **é inaceitável pra estado de billing**: se `plano: "premium"` ficasse em `users/$uid`, o próprio usuário logado poderia escrevê-lo diretamente via qualquer client Firebase, sem pagar nada. Já está mapeado (memória do plano comercial) que isso precisa de um ramo `/billing/$uid` com `.write: false`, escrito só por webhook via função serverless — mas hoje esse ramo não existe.
4. **`usePwaUpdate` depende inteiramente de Service Worker.** Dentro de uma build Capacitor (assets locais, sem origem de rede como no browser), o mecanismo de "verifica update no `visibilitychange` e recarrega sozinho" não tem equivalente direto — atualização de app nativo é via loja (App Store/Play Store review) ou uma solução de OTA update separada (ex. Capacitor Live Updates). Isso não é um bug do código atual, é uma peça que precisa de estratégia própria antes da Fase 4, senão o app native "trava" na versão da loja sem o conforto de correções instantâneas que a PWA tem hoje.
5. **Exportação de backup usa download via `<a download>` + Blob URL** (`FolhaBackup.tsx`). Esse padrão funciona no browser mas não dispara o fluxo nativo de salvar arquivo dentro de uma WebView Capacitor (o comportamento é inconsistente entre plataformas e versões de WKWebView/Android System WebView — em alguns casos abre o conteúdo em vez de salvar). Vai precisar de um adapter (`Capacitor Filesystem` + `Share`) por trás da mesma função `exportarBackup`, sem mudar a assinatura que o resto do app usa.

## 7. Problemas de UX/UI

1. **`theme-color` estático** (`#0A1622`) não acompanha o tema claro/escuro/sistema que o app já suporta desde a última sessão (`useTemaEfetivo`). Resultado: no tema claro, a barra de status do navegador/PWA continua escura — inconsistência visual pequena, mas visível, e que vira mais importante em iOS nativo (a Status Bar precisa ser dita explicitamente se é `light`/`dark` via API do Capacitor, hoje não há esse sinal em lugar nenhum do código).
2. **Manifest com um ícone só, sem `maskable`.** Android usa `maskable` pra recortar o ícone dentro do formato do sistema (círculo, squircle, etc.) sem cortar mal o desenho — sem ele, o Android aplica um recorte genérico que pode cortar partes do ícone atual.
3. **Sem `screenshots` no manifest** — instalação em desktop/Android perde o preview rico que o Chrome mostra no prompt de instalação.

Fora esses três pontos específicos de PWA, não identifiquei problemas de UX/UI relevantes pro objetivo deste plano — o trabalho recente de Definições (índice + folhas) e o `safe-area-inset` já resolvem os riscos mobile mais óbvios de layout.

## 8. Riscos para Capacitor

1. **PDF.js e seu worker.** `extrairExtratoPdf.ts` usa `pdfjs-dist`, que carrega um worker JS separado. Dentro do `capacitor://` (iOS) ou `https://localhost` (Android) scheme, o caminho de resolução do worker precisa ser testado explicitamente — é uma causa comum de "funciona no browser, quebra no app" com essa lib especificamente.
2. **Download/upload de arquivo.** Como no item 6.5: exportar backup (Blob + `<a download>`) e importar (`<input type="file">` + `FileReader`) usam APIs de browser que dentro de Capacitor precisam de plugins nativos (`@capacitor/filesystem`, `@capacitor/share`) para uma experiência equivalente — o `<input type="file">` de importação tende a funcionar via picker nativo sem mudança, mas o de exportação (salvar) não.
3. **Service Worker / estratégia de update.** Como no item 6.4 — o app precisa de uma decisão explícita de "como o usuário recebe correções" fora da loja antes da Fase 6.
4. **Firebase RTDB sobre WebSocket.** O SDK JS do Firebase usa WebSocket com fallback long-polling — funciona normalmente em WebViews modernas (WKWebView no iOS 14+, Android System WebView atual), mas vale validar numa build real cedo (Fase 4), não assumir.
5. **`theme-color`/status bar não têm hoje nenhum código que fale com a Status Bar nativa** — precisa do plugin `@capacitor/status-bar` reagindo ao mesmo `useTemaEfetivo()` que já existe, não é trabalho novo de lógica, só uma integração a mais no hook existente.

## 9. Riscos para iOS

- **Notch / Dynamic Island / home indicator**: já mitigado via `env(safe-area-inset-*)` nos 4 pontos identificados (item 4) — mas vale auditar TODAS as telas com conteúdo fixo no topo/rodapé (headers sticky, FAB) na Fase 2, não só os 4 arquivos que já usam a variável.
- **Teclado virtual cobrindo campos**: não identifiquei tratamento explícito (`visualViewport` API ou equivalente) no código atual — formulários como `RegistroRapido` (BottomSheet com campos) precisam ser testados com teclado aberto num dispositivo real antes da Fase 6; comum o teclado cobrir o botão "Salvar" em sheets altas.
- **Voltar por gesto (swipe-back) vs. `BrowserRouter`**: o `BottomSheet` já implementa `useDragToClose` (drag-to-close próprio) — dentro de Capacitor, o gesto de "voltar" do sistema (swipe da borda esquerda no iOS) pode competir com esse gesto ou com a navegação do `react-router`. Precisa de teste dedicado na Fase 4/6, não dá pra prever só lendo o código.
- **App Store review de PWA-empacotado**: a Apple rejeita apps que são "apenas um site na WebView" sem funcionalidade nativa perceptível — a integração real de recursos nativos (Fase 5: câmera, biometria, notificações) não é só nice-to-have, é requisito de aprovação.

## 10. Riscos de segurança

- **Config do Firebase exposta no client (`src/services/firebase.ts`)**: **isto é esperado e não é uma falha** — o próprio código já documenta isso corretamente ("a segurança real está nas Security Rules"). Confirmado que as regras (`database.rules.json`) exigem `auth != null && auth.uid === $uid` tanto pra leitura quanto escrita — isolamento correto entre contas.
- **Falta de `.validate` na maior parte da árvore de dados.** Só `fin_v5/iaUso/$dia` tem validação de schema. O resto aceita qualquer estrutura que o client mandar, contanto que seja dentro do próprio `$uid`. Não é uma falha de segurança entre usuários (ninguém lê/escreve dado alheio), mas é uma falha de **integridade de dados** — um bug no client (ou uma chamada manual via devtools) pode gravar lixo estruturalmente inválido sem o servidor recusar. Vale mais atenção ainda quando o nó de billing for criado (ver item 6.3 — esse _precisa_ ser `.write: false`).
- **Cota de IA "de cortesia"** (já documentado no próprio `iaUsoService.ts`, confirmado por memória): a proteção real de custo do Gemini está do lado da cota grátis do Google, não de uma verificação server-side do token Firebase. Não é novo, mas é uma dívida técnica que fica mais visível se o Copiloto virar feature paga (Premium) — nesse momento, contornar a cota client-side deixa de ser "alguém gastando cota de graça" pra ser "alguém usando feature paga sem pagar".
- **Nenhum secret hardcoded fora do esperado** — não encontrei chave de API privada, token, ou credencial no código-fonte do `src/`.
- **`erroService.ts`** grava erros (mensagem + stack + URL) na própria conta do Firebase, protegido pelas mesmas regras — não vaza pra fora do próprio usuário. Comportamento correto pra um app de uso pessoal, como o próprio comentário no código já justifica.

## 11. Riscos de performance

- **`pdfjs-dist` (~430 kB) já é tratado corretamente** — fora do precache do app shell, carregado só sob demanda (item 4). Não é um risco, é um exemplo do que já foi feito certo.
- **Lazy loading por página já existe** (`React.lazy` em todas as rotas de `App.tsx`) — bundle inicial não carrega telas que o usuário não abriu.
- Não identifiquei problema de performance relevante além disso a partir da leitura estática do código — uma medição real (Lighthouse / trace em dispositivo) está fora do escopo desta auditoria de arquitetura, mas seria o próximo passo natural antes da Fase 6 (a skill `web-perf` deste ambiente serve exatamente pra isso quando chegar a hora).

## 12. Dependências que precisam ser avaliadas

| Pacote                                  | Motivo de atenção                                                                                                                                                                                                                                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pdfjs-dist`                            | Worker + WebView, ver item 8.1                                                                                                                                                                                                                                                                         |
| `vite-plugin-pwa`                       | Só relevante pro shell Web — build Capacitor tipicamente não passa pelo Service Worker gerado por ele; precisa de config condicional (Web vs. Capacitor) na Fase 4                                                                                                                                     |
| `firebase` (12.16.0)                    | SDK grande — vale checar se faz sentido trocar por `@capacitor-firebase/*` (plugins nativos) mais adiante pra ganhar push notification nativa e melhor performance de Auth persistente, mas **não agora** — o SDK JS puro funciona em WebView e a troca teria custo real sem ganho imediato            |
| `react-router-dom` v7 (`BrowserRouter`) | Capacitor serve os assets de `capacitor://localhost` (iOS) / `https://localhost` (Android) — `BrowserRouter` funciona normalmente nesses schemes, mas vale confirmar que não há nenhuma dependência de `window.location.origin` sendo um domínio real em algum lugar do código (não encontrei nenhuma) |

Todas as dependências diretas são de origem confiável (Firebase/Google, Vite/Vitejs, Meta/React, react-router oficial, Vitest oficial). Não identifiquei sinal de pacote abandonado ou de risco de supply chain nas dependências diretas listadas no `package.json` — uma auditoria completa da árvore de transitivas (via `npm audit` ou a skill `supply-chain-risk-auditor`) fica como recomendação de rotina, não como achado específico desta leitura.

## 13. Recursos nativos prováveis

| Recurso                     | Necessário?                                                                                                                                                                                 | API Web já basta?                                                             | Plugin Capacitor                                                                                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Notificações push           | Sim (Fase 5) — hoje não existe nenhuma, só o sino in-app (`utils/notificacoes.ts`)                                                                                                          | Não                                                                           | `@capacitor/push-notifications` (+ backend de envio, ainda não existe)                                                                                                               |
| Notificações locais         | Talvez — lembrar de fatura a vencer mesmo com app fechado                                                                                                                                   | Não                                                                           | `@capacitor/local-notifications`                                                                                                                                                     |
| Câmera / scanner de recibos | Sim, roadmap já menciona (feature futura, ainda não implementada)                                                                                                                           | Parcial (`<input capture>` funciona mas sem controle fino)                    | `@capacitor/camera`                                                                                                                                                                  |
| Biometria / Face ID         | Desejável (é dado financeiro — trava de app por biometria é expectativa comum)                                                                                                              | Não                                                                           | `@capacitor-community/biometric-auth` ou similar                                                                                                                                     |
| Storage seguro              | Sim, se biometria/PIN entrar — token de sessão merece Keychain, não `localStorage` puro                                                                                                     | Não                                                                           | `@capacitor/preferences` (não-sensível) + `@capacitor/secure-storage` ou Keychain nativo pra sensível                                                                                |
| Compartilhar (share)        | Sim, pra exportar backup/relatório (ver item 8.2)                                                                                                                                           | Parcial (`navigator.share` existe mas comportamento inconsistente em WebView) | `@capacitor/share`                                                                                                                                                                   |
| Arquivos (salvar/ler)       | Sim, backup import/export                                                                                                                                                                   | Não de forma confiável                                                        | `@capacitor/filesystem`                                                                                                                                                              |
| Deep links                  | **Já implementado no nível Web** (`useAbrirRegistroPorUrl.ts`, `?registro=despesa`)                                                                                                         | Sim, hoje via URL comum                                                       | Em Capacitor, o mesmo padrão se estende com `@capacitor/app` (`appUrlOpen`) pra abrir via URL scheme custom em vez de só universal link — reaproveita a lógica existente, não recria |
| Status bar                  | Sim (cor deve seguir `useTemaEfetivo`, ver item 8.5)                                                                                                                                        | Não                                                                           | `@capacitor/status-bar`                                                                                                                                                              |
| Safe areas                  | **Já resolvido via CSS** (`env(safe-area-inset-*)`)                                                                                                                                         | Sim                                                                           | Nenhum — CSS puro já funciona igual dentro de Capacitor                                                                                                                              |
| Teclado                     | Precisa de teste dedicado (item 9)                                                                                                                                                          | Parcial                                                                       | `@capacitor/keyboard` (ajusta resize/scroll)                                                                                                                                         |
| Clipboard                   | Não identifiquei uso hoje que precise de plugin — não é prioridade                                                                                                                          | Sim, se necessário                                                            | `@capacitor/clipboard` só se surgir necessidade real                                                                                                                                 |
| Conectividade / offline     | **Já tratado no nível de cache** (Workbox NetworkFirst) — Capacitor teria `@capacitor/network` só se precisar de lógica _ativa_ baseada em estar online/offline (hoje é passivo, via cache) | Parcial                                                                       | `@capacitor/network`, avaliar se compensa a complexidade extra                                                                                                                       |

## 14. Estratégia Free/Premium existente

(Resumo fiel ao que já está decidido — ver memórias `project_finapp_comercial`, `feedback_finapp_saida_pwa`. Nada disso foi alterado ou reavaliado nesta auditoria.)

- **Mercado-alvo**: motoristas TVDE (Uber/Bolt) em Portugal — não finanças pessoais genérico. Preço de referência ~€7,99/mês ou €69/ano, trial de 21 dias sem cartão.
- **Trancado (assinatura)**: TVDE, Veículo, Importar (leitura automática de extrato), Planejamento (orçamento), Calendário, Transações, Copiloto (versão híbrida com IA).
- **Grátis para sempre**: Despesas, Receitas (lançamento manual), Cartões, Metas.
- **Mecanismo de trava já mapeado (não implementado)**: campo `planoMinimo` em `src/constants/abas.ts`, um guarda de rota genérico no molde do `RotaTvde` já existente em `App.tsx`, e uma store de billing alimentada a partir de `syncService.iniciarSyncConta`.
- **Estado de assinatura não pode ficar em `users/$uid`** — precisa de `/billing/$uid` com `.write: false`, escrito só por webhook (Stripe) via função Vercel. Confirmado nesta auditoria: essa árvore **ainda não existe** em `database.rules.json`.
- **Double Tap (Free) já implementado** nesta mesma sessão de trabalho (`useAbrirRegistroPorUrl.ts`) — deep link via `?registro=` sem precisar de app nativo.
- **Registo automático via Apple Pay (Premium)**: depende de App Intent / gatilho de transação real de Wallet — depende da migração nativa (Fase 4+), documentado como decisão já tomada de sequenciamento, não de viabilidade em aberto.
- **Saída de PWA para app nativo já é destino decidido** — este próprio plano é a execução dessa decisão, não uma avaliação de "se vale a pena".

## 15. Impacto técnico do plano comercial

Pra suportar `canUseFeature("receiptScanner")` sem espalhar regra de assinatura pela UI, faltam hoje 3 peças concretas (nenhuma existe ainda):

1. **Modelo de dados de billing** — um tipo `Assinatura { plano: "free" | "premium"; status: "ativa" | "cancelada" | "expirada" | "trial"; expiraEm?: number; origem: "web" | "app_store" | "play_store" }`, guardado em `/billing/$uid` (fora de `users/$uid/fin_v5`, com `.write: false`).
2. **Uma store de entitlement** (`useEntitlementStore` ou equivalente) que assina esse nó via `onValue` (mesmo padrão do `syncService` de hoje) e expõe só `canUseFeature(feature: Feature): boolean` — nunca detalhes de Stripe/App Store/Play Store pro resto do app.
3. **Um guarda de rota genérico** reaproveitando o padrão do `RotaTvde` (`App.tsx`) — hoje esse componente já resolve exatamente o problema de "rota condicional a uma flag de conta", só que a flag é `cfg.showTvde` (booleana simples) em vez de um plano. Generalizar esse padrão pra aceitar qualquer `Feature` resolve TVDE, Veículo, Importar, Planejamento, Calendário, Transações e Copiloto com o mesmo componente.

Nenhuma dessas 3 peças depende de Capacitor — são trabalho de Fase 1 (correções arquiteturais), preparatório e independente da entrada em lojas.

## 16. Arquitetura recomendada

Não recomendo reescrita nem reorganização de pastas por "feature-folder" — o padrão atual (camadas horizontais) já funciona e trocar agora seria custo sem ganho técnico real na escala atual do app. Recomendação é **aditiva**:

```
src/
  domain/            [NOVO] — regras financeiras que hoje vivem soltas em utils/
                        (fatura.ts, parcelas.ts, notificacoes.ts, rateio...)
                        movidas aqui SEM mudar comportamento — só declara
                        explicitamente "isto é regra de negócio crítica"
  entitlement/        [NOVO] — canUseFeature(), a store de billing, o tipo Assinatura
  platform/           [NOVO, só quando Capacitor entrar — Fase 4] — adapters:
                        platform/backup.ts    → exportarBackup() delega pra
                                                  download Web OU Filesystem+Share
                                                  nativo, conforme Capacitor.isNativePlatform()
                        platform/statusBar.ts → liga useTemaEfetivo() ao
                                                  @capacitor/status-bar
                        platform/update.ts    → liga usePwaUpdate (Web) OU
                                                  estratégia de OTA/loja (nativo)
  (resto igual: components/, pages/, services/, stores/, hooks/, utils/, types/)
```

O princípio chave: **nenhum componente de UI deve importar `@capacitor/*` diretamente** ou checar `Capacitor.getPlatform()` espalhado pelo código — toda a diferença Web/nativo fica isolada em `platform/`, exposta como a mesma função/hook que a UI já chama hoje (`exportarBackup()`, por exemplo, continua tendo a mesma assinatura; só o que acontece dentro dela muda por plataforma). Isso é literalmente o mesmo princípio que `canUseFeature()` aplica pro billing — abstrair a variação atrás de uma interface estável.

## 17. Roadmap de implementação

**Fase 1 — Correções arquiteturais**

- Criar `domain/` (mover regras financeiras de `utils/`, sem alterar lógica — mesmo padrão já usado na refatoração de Definições).
- Criar o modelo de dados de billing (`/billing/$uid`, `.write: false`) e a store de entitlement (`canUseFeature`).
- Generalizar `RotaTvde` para um guarda de rota por `Feature`.

**Fase 2 — Mobile readiness**

- Auditar todas as telas com header/footer fixo além dos 4 arquivos que já usam `env(safe-area-inset-*)`.
- Testar teclado virtual cobrindo campos em `RegistroRapido` e outras BottomSheets com formulário.
- Confirmar tamanho de área de toque em botões/ícones pequenos (não auditado nesta rodada — recomendo passe dedicado com um dispositivo real).

**Fase 3 — PWA hardening**

- Corrigir `theme-color` estático → dinâmico conforme `useTemaEfetivo()`.
- Adicionar ícone `maskable`, tamanhos PNG explícitos (192/512), `screenshots` no manifest.

**Fase 4 — Capacitor**

- `npx cap init`, configurar `webDir` apontando pro build do Vite.
- Decidir e implementar estratégia de update (substituto do `usePwaUpdate` baseado em SW).
- Criar `platform/backup.ts` (Filesystem + Share) substituindo o download via `<a download>`.
- Validar `pdfjs-dist` worker rodando dentro da WebView (iOS e Android).
- Validar Firebase RTDB (WebSocket) dentro da WebView.
- Ligar `@capacitor/status-bar` a `useTemaEfetivo()`.

**Fase 5 — Recursos nativos**

- Notificações push/local (depende de decisão de backend de envio).
- Scanner de recibos (câmera).
- Biometria + storage seguro pra sessão.
- Deep link nativo (`@capacitor/app`) reaproveitando `useAbrirRegistroPorUrl`.

**Fase 6 — TestFlight**

- Build de release iOS, ícones/splash finais, bundle identifier definido.
- Teste real de gesto de voltar (swipe) vs. `BottomSheet`/`react-router`.
- Teste de teclado, safe areas, update flow em dispositivo físico.

**Fase 7 — App Store**

- Metadata, privacy declarations (ver checklist item 20), screenshots, review.

**Fase 8 — Android/Play Store**

- Adaptive icon, splash, back button do sistema (Android tem semântica própria de voltar, distinta do gesto iOS), signing, Play Console.

## 18. Ordem de prioridade

**Bloqueante, antes de qualquer coisa depender disso:**

1. Modelo de billing + `.write: false` (Fase 1) — sem isso, qualquer feature paga fica vulnerável desde o primeiro dia que existir.
2. Estratégia de update fora do Service Worker (Fase 4) — sem isso, o app nativo não tem como corrigir bugs entre releases de loja.
3. `platform/backup.ts` (Fase 4) — backup é a única função de "salvar arquivo" que existe hoje; sem adapter, quebra silenciosamente em nativo.

**Importante mas não bloqueante — pode andar em paralelo:**

- `domain/` (reorganização, zero risco funcional).
- Ajustes de manifest/theme-color (Fase 3).
- Auditoria de touch targets e teclado (Fase 2).

**Pode esperar até depois do primeiro TestFlight:**

- Biometria, scanner de recibos, push notifications (Fase 5) — nenhum bloqueia a build nativa existir e ser testável; todos são feature nova, não infraestrutura.

## 19. O que NÃO deve ser alterado

- **Regras financeiras já testadas** (`utils/fatura.ts`, `parcelas`, cálculo de rateio) — mover de pasta (Fase 1) sim, mudar comportamento não.
- **O plano comercial já definido** (público TVDE-first, lista de features trancadas, preço de referência) — este documento assume tudo isso como decidido, não reabre a discussão.
- **A stack React + Vite + Zustand + Firebase** — nenhuma justificativa técnica encontrada nesta auditoria para trocar qualquer uma delas. Capacitor empacota a stack atual, não substitui.
- **Cores e identidade visual** — fora de escopo deste plano por instrução explícita; nada aqui recomenda mudança visual.
- **O padrão service → store → UI** já estabelecido — é exatamente o que permite Capacitor reusar tudo.
- **`BottomSheet` e o sistema de "folhas"** — já testado, já usado em 18+ lugares, já lida com `safe-area-inset`. Recursos nativos (teclado, gesto de voltar) se adaptam a ele, ele não precisa ser refeito.

## 20. Checklist de preparação para App Store

- [ ] **Bundle identifier** definido e reservado (ex. `com.<dominio>.finapp`) — não existe ainda no projeto.
- [ ] **Ícones**: conjunto completo de tamanhos exigidos pelo Xcode (1024×1024 App Store + todos os tamanhos de dispositivo) — hoje só existe 1 SVG + 1 PNG (apple-touch-icon) pensados pra Web.
- [ ] **Splash screen** nativa (Capacitor gera a partir de um asset único, mas precisa ser criado/validado com o fundo certo por tema).
- [ ] **Privacy manifest / declarações de dados** (`PrivacyInfo.xcprivacy`, exigido pela Apple desde 2024) — mapear exatamente o que é coletado (e-mail de auth, dados financeiros inseridos manualmente, uso de Gemini) e por quê.
- [ ] **Permissões declaradas** (`Info.plist`): câmera (scanner de recibos), biometria (Face ID), notificações — cada uma com texto de justificativa (`NSCameraUsageDescription` etc.) já em português claro.
- [ ] **Screenshots** por tamanho de dispositivo exigido pela App Store Connect.
- [ ] **Metadata**: nome, subtítulo, descrição, categoria (Finanças), palavras-chave, classificação etária.
- [ ] **Build number / versionamento** — hoje `package.json` tem só `"version": "0.1.0"`; precisa de esquema de versão + build number incremental pro Xcode.
- [ ] **Ambiente de produção validado**: confirmar que a build de release aponta pro Firebase de produção (`finapp1-20d00`), não um projeto de teste.
- [ ] **Teste de "app funcional sem rede"** — a Apple testa isso; a estratégia offline (NetworkFirst + cache) já existe no nível PWA, mas precisa ser revalidada dentro da build Capacitor.
- [ ] **Justificativa de "não é só um site empacotado"** — documentar quais recursos nativos reais (câmera, biometria, notificações, deep link nativo) diferenciam o app de abrir o site no Safari, porque a Apple rejeita WebViews genéricas (ver item 9).
- [ ] **Termos de uso / política de privacidade** publicados e linkados — obrigatório pra app com conta de usuário e dado financeiro.
- [ ] **Fluxo de exclusão de conta** visível no app — exigência da Apple desde 2022 para apps com criação de conta (confirmar se `ApagarConta`, já existente em Definições, atende ao requisito ou precisa de ajuste de texto/fluxo pra revisão).

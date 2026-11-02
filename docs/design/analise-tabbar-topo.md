# Análise: tab bar e barra do topo — FinApp e TVDE Pro

Documento de entrada para a sessão que vai criar o padrão comum de design.
As partes 1 a 3 só descrevem o que existe hoje (código de 02/11/2026) e não
propõem mudanças. A parte 4 diz o que já está decidido mexer depois (tab bar e
topo, textos, animações e botões), para o analista poder opinar. A parte 5
fixa o padrão comum já aprovado.

---

## Parte 1 — FinApp

### 1.1 Estrutura geral (onde cada peça vive)

`src/layout/AppShell.tsx` monta tudo, sempre na mesma ordem:

| Peça | Ficheiro | Telemóvel (<768px) | Tablet/desktop (≥768px) |
|---|---|---|---|
| Barra do topo | `layout/Header.tsx` | sim | sim |
| Tab bar em baixo | `layout/MobileNav.tsx` | sim | escondida |
| Barra lateral (rail) | `layout/Sidebar.tsx` | escondida | sim |
| Botão "+" flutuante | `layout/Fab.tsx` | escondido (o "+" está na tab bar) | sim, canto inferior direito |
| Menu do "+" | `layout/MenuRegistroRapido.tsx` | folha inferior | folha inferior |

Fonte da verdade das abas: `src/constants/abas.ts` (ícones Lucide, mais um
ícone próprio para Análise em `components/IconeAnalise`).

### 1.2 Tab bar (telemóvel)

**Itens, por ordem:** Receitas · Despesas · **[+ central]** · Início · Mais

| Item | Ícone (Lucide) | Ação |
|---|---|---|
| Receitas | `TrendingUp` | vai para `/receitas` |
| Despesas | `TrendingDown` | vai para `/despesas` |
| + (central) | `Plus` 26px, traço 2.5 | abre a folha "Novo lançamento" |
| Início | `House` | vai para `/` |
| Mais | `MoreHorizontal` | abre/fecha o menu "Mais" |

- **Só ícones.** O nome existe no código (para leitores de ecrã e `title`),
  mas não se vê. Ícones de 20px.
- **Início não é o primeiro item**: fica à direita do "+", em 4.º lugar.
- **Menu "Mais"**: um popover (não é folha inferior) que aparece 11px acima
  da barra, com grelha de 2 colunas: Cartões, Planejamento, Análise,
  Veículo*, TVDE*. (*só aparecem se ligados em Definições.) Cada item tem
  ícone 18px + nome, 44px de altura, peso 600. Por trás, véu escuro a 35%
  com blur de 4px; tocar no véu fecha. Se a página atual está dentro do
  "Mais", o botão "Mais" fica marcado como ativo.
- **Definições não estão na tab bar nem no "Mais"**: só se chega pelo avatar
  no topo.

**Visual**
- Pílula flutuante, não colada à borda: 14px de margem de cada lado, 6px
  acima da zona do indicador de gestos do iPhone. Altura 64px. Raio total
  (`--r-pill` 99px).
- Fundo: classe `.material` — branco translúcido a 86% **sem blur** no
  telemóvel (o blur só entra a partir de 768px). Borda 1px branca a 75%.
  Sombra `--sh-vidro` (duas camadas suaves).
- **Aba ativa**: círculo de 40px (área de toque 44px) — branco no tema
  claro, creme no escuro — com sombra pequena. Ícone passa da cor
  `--mut` (cinza-castanho) para a cor de texto escura. Sem ponto, sem
  sublinhado, sem texto.
- **Botão "+"**: círculo de 56px cheio em terracota (`--blu`), ícone
  escuro, sombra colorida terracota. Está **dentro** da pílula, ao mesmo
  nível das abas (não sobe acima dela).

**Interação**
- Toque: aba encolhe para 96% enquanto pressionada; "+" encolhe para 92%
  com mola (`--ease-spring`).
- Transição de cor/fundo da aba ativa: 0,18s.
- Mudança de página: a nova página entra com fade + subida de 6px (0,24s)
  — `layout/PaginaTransicao.tsx`. A antiga desaparece logo.
- Sem haptics (nenhum uso de vibração no código).
- Sem badges na tab bar.
- Tocar na aba já ativa: não faz nada (não volta ao topo).
- Não se esconde ao rolar nem com o teclado aberto.

### 1.3 Barra lateral (tablet/desktop) — para referência

- Pílula vertical de vidro de 60px de largura, à esquerda, alinhada ao topo
  do conteúdo. Blur 18px.
- Só ícones (20px); ativa = mesmo círculo branco/creme da tab bar.
- Nome aparece num tooltip escuro à direita, no hover ou foco.
- Lista completa por esta ordem: Início, Receitas, Despesas, Veículo,
  Cartões, Planejamento, Análise, TVDE (sem Definições).
- **A ordem é diferente da tab bar do telemóvel.**

### 1.4 Barra do topo

**Ficheiro:** `layout/Header.tsx`. É uma só, igual em todas as páginas;
fica fora do conteúdo da página.

**Layout:** grelha de 3 colunas (esquerda | centro | direita), com o centro
verdadeiramente centrado.

| Esquerda | Centro | Direita |
|---|---|---|
| Avatar 32px + logotipo "Fin**App**" ("App" em terracota) | Seletor de mês compacto (em quase todas as páginas) | Olho (mostrar/ocultar valores) + Sino (lembretes) |

**O que aparece em cada página**

| Página | Seletor de mês no topo? | Título dentro da página | Extra por baixo do título |
|---|---|---|---|
| Início `/` | sim | "Início" existe mas **escondido** | quadro de resultado é o 1.º elemento |
| Receitas | sim | "Receitas" | painel de KPIs |
| Despesas | sim | "Despesas" | painel de KPIs + abas |
| Veículo | sim | "Veículo" | painel de KPIs |
| Cartões | sim | "Cartões" | botão Importar ao lado (telemóvel) |
| Planejamento | sim | "Planejamento" | abas Planejamento/Metas |
| Análise | sim | "Análise" | seletor de período ao lado/por baixo |
| TVDE | sim | "TVDE" | destaque do lucro da semana |
| Definições | **não** | "Definições" | formulário estreito |

- **A barra do topo nunca mostra o nome da página.** Mostra sempre a marca
  "FinApp". O nome da página é um título grande (28px, peso 600) no início
  do conteúdo, que rola com a página (`components/Pagina.tsx`).
- Não há botão "voltar" no topo em nenhuma página.

**O que cada botão faz**
- **Avatar** → menu pequeno ancorado com "Minha conta" (abre folha) e
  "Definições" (vai para a página). É a única porta para Definições.
- **Seletor de mês** → setas ‹ › mudam o mês; tocar no rótulo abre um
  calendário de meses ancorado (`FolhaAncorada`). Pílula com fundo `--s1`.
- **Olho** → liga/desliga o "modo discreto" (esconde valores). Grava na
  conta; se falhar, mostra toast.
- **Sino** → folha inferior "Lembretes"; tem badge de contagem.

**Visual**
- Fixo no topo ao rolar (`sticky`). Altura ~61px + zona do notch
  (`--safe-topo`).
- Fundo creme do próprio fundo a 90% de opacidade + fio fino de 1px por
  baixo. **Sem blur no telemóvel**; blur 18px a partir de 768px.
- Logotipo: 20px peso 800 (encolhe para 17px <430px, 15,5px <400px,
  desaparece <350px).
- Botões da direita: círculos de 36px (toque 44px), ícone 20px traço 1,75,
  cor `--mut`; fundo cinza ao premir.
- Não muda ao rolar (não há título grande que encolhe).

**Interação extra**
- Puxar para recarregar no conteúdo principal (`usePullToRefresh`), com
  indicador próprio.
- Faixa de erro de sincronização aparece logo por baixo do topo quando a
  sync falha (`FaixaErroSync`).

### 1.5 Tokens usados (FinApp)

Tudo em CSS variables, `src/styles/tokens.css` + `motion.css` + `base.css`.

- Cores-chave: fundo `--bg` (creme #fbf3ea claro / café #15100c escuro),
  superfícies `--s1/--s2`, texto `--txt`, secundário `--mut`, acento
  terracota `--blu` (#e8703a claro / #f0844f escuro).
- Raios: `--r-card` 22px, `--r-sm` 9px, `--r-pill` 99px.
- Sombras: `--sh-vidro`, `--sh-card`, `--aba-ativa-sh`, `--mais-sombra`.
- Tamanhos: `--aba-circulo` 40px, `--fab-tam` 56px, `--sidebar-w` 88px.
- Tipografia: fonte do sistema (`-apple-system`…). Escala `--fs-micro` 11px
  → `--fs-display` 20px; título de página fixo em 28px.
- Movimento: `--dur-fast` 0,15s, `--dur-exit` 0,18s, `--dur-enter` 0,24s;
  curvas `--ease-enter`, `--ease-exit`, `--ease-spring`.
- Nome histórico: o acento chama-se `--blu` mas é terracota.

### 1.6 Inconsistências já visíveis na FinApp

1. **Ordem das abas muda entre telemóvel e desktop** (Início é a 4.ª no
   telemóvel e a 1.ª na barra lateral).
2. **Topo não diz onde estás**: mostra sempre "FinApp"; o nome da página só
   aparece no conteúdo e some ao rolar. Na Início nem aparece.
3. **"Mais" é um popover**, enquanto todos os outros menus da app (+, sino,
   conta) são folhas inferiores.
4. **Vidro diferente entre topo e tab bar** no telemóvel: topo é creme 90%,
   tab bar é branco 86%; nenhum tem blur.
5. **Definições escondidas** só no avatar — não estão nem no "Mais".
6. Durações de transição misturadas: tab bar usa 0,18s fixo; barra lateral
   0,15s fixo; resto usa os tokens de movimento.
7. Sem haptics e sem "tocar na aba ativa volta ao topo" (comportamento
   nativo do iOS).

---

## Parte 2 — TVDE Pro

Fonte: análise da sessão "tvde pro - planner opus" (código no origin/main
de 02/11/2026).

### 2.1 Estrutura geral

`src/layout/AppShell.tsx` monta: Header, FaixaErroSync, Sidebar,
IndicadorPull, `<main>` com PaginaTransicao, MobileNav, RegistroRapido,
Toast, ConfirmarAcao. CSS Modules + variáveis CSS; ícones `lucide-react`.
Itens das abas em `src/constants/abas.ts`. No iOS (Capacitor) é o mesmo
código web, sem tab bar nativa.

| Peça | Telemóvel (<768px) | 768–1023px | ≥1024px |
|---|---|---|---|
| Tab bar `MobileNav` | sim | escondida | escondida |
| `Sidebar` | escondida | rail só de ícones (72px) | expandida com rótulos e marca «TVDE Pro» (240px) |

### 2.2 Tab bar (telemóvel)

**Itens, por ordem:** Início (`House`) · Histórico (`History`) · Carro
(`Car`) · Análise (`ChartLine`)

- 4 itens, todos visíveis. Sem "Mais".
- Sem botão "+" central (removido a 18/10: "a tab bar do iOS só tem
  destinos"). Registar faz-se pelos botões da página Início e pelo "+" de
  cada lista do Carro.
- Definições (`/ajustes`) só pelo avatar no topo (desde 01/11).
- Só ícones; nome escondido para leitores de ecrã; ativa leva
  `aria-current="page"`.

**Visual**
- Cápsula flutuante centrada. Largura `min(100vw − 32px − safe, 440px)`.
  Altura **56px**. Raio 999px.
- Posição: `max(10px, safe-area-bottom − 14px)` do fundo — assenta dentro da
  faixa do indicador de gestos.
- Fundo: vidro **com blur** — branco 86% (claro) / azul-noite 86% (escuro),
  `blur(20px) saturate(160%)`.
- Borda: hairline 0,5px interna (`--separador`) + sombra `--sombra-cartao`.
- Itens: círculos 44×44 numa grelha de colunas iguais; ícone 20px traço
  1,75; inativo cinza-azulado (`--rotulo-2`).
- **Aba ativa:** círculo **azul cheio** 44px (`--nav-ativa` #3f5ef0, igual
  nos dois temas); ícone fica **branco** e cresce para 110%.
- Redução de transparência / contraste alto: fundo sólido, sem blur.

**Interação**
- **O círculo ativo desliza** de aba para aba com mola (0,5s, curva
  `linear()` de mola crítica). CSS puro; o JS só calcula o índice.
- Página sem aba ativa (ex.: Detalhe da semana): o círculo desvanece.
- Toque: escala 0,97 (0,1s). Com redução de movimento: opacidade 0,6 e sem
  deslizar.
- Sem haptics, sem badges, sem "tocar na ativa volta ao topo", não se
  esconde ao rolar nem com teclado.

### 2.3 Sidebar (≥768px) — para referência

- Fundo `--material-grosso` (90%) com blur + hairline à direita.
- Linhas de 44px, raio 14px; ícone na cor de destaque, texto 17px.
- Ativa: fundo azul cheio (`--destaque`), texto e ícone em branco.

### 2.4 Barra do topo

**Ficheiros:** `layout/Header.tsx`, `layout/BotaoPerfil.tsx`; título grande
em `components/Pagina.tsx`.

**Layout:** grelha de 3 colunas, centro verdadeiramente centrado.

| Esquerda | Centro | Direita |
|---|---|---|
| Avatar 32px (≥768px: + nome) | Título pequeno da página (aparece ao rolar) **ou** seletor de mês | Botão de tema Lua/Sol, 22px, cor de destaque |

Regra do projeto escrita no código: "Nada mais".

**Comportamento estilo iOS "large title":**
- Em repouso: barra transparente; título grande (34px bold) dentro da página.
- Ao rolar 0–12px: aparece o vidro e o título pequeno (17px semibold) entra
  no centro da barra. CSS com scroll-driven animations; fallback em JS
  (`useRolagemFallback`) para Safari <26 e Firefox.
- Vidro: cor do fundo a 82% com blur, que desce 24px além da barra e
  desvanece em degradê (`mask-image`). Sem fio por baixo.

**O que aparece em cada página**

| Página | Título grande na página | Centro da barra |
|---|---|---|
| Início `/` | Saudação ("Bom dia/tarde/noite", hora de Lisboa) + data | "Início" ao rolar |
| Histórico | "Histórico" | seletor de mês (sempre) |
| Carro | "Carro" | seletor de mês (sempre) |
| Análise | "Análise" | "Análise" ao rolar |
| Definições `/ajustes` | "Definições" | "Definições" ao rolar |
| Detalhe da semana | `CabecalhoDetalhe` com botão voltar + título, dentro da página | "TVDE Pro" (fallback) |

**Visual**
- Altura 44px + notch (52px + notch a partir de 768px).
- Fonte Inter (fallback -apple-system/SF Pro).
- Alvos de toque 44×44.

**O que cada botão faz**
- **Avatar** → `MenuAcoesItem` (folha no telemóvel, popover em ecrã largo):
  "Minha conta" (folha) e "Definições" (página).
- **Tema** → alterna claro/escuro (fixa o tema mesmo se estava em
  "Sistema").
- **Seletor de mês** → muda o mês partilhado entre Histórico e Carro.
- Puxar para recarregar no `<main>`.
- Voltar só existe no Detalhe da semana, dentro da página.
- Transição entre páginas: `PaginaTransicao` (zoom do cartão Início ↔ Ver
  semana).

### 2.5 Tokens (TVDE Pro)

`src/styles/tokens.css` + `motion.css`; regras de uso em `DESIGN.md`.

- Cores (claro / escuro): fundo #eeeffa / #0e1022; superfície #fff /
  #1a1d36; texto #14172b / #f2f3ff; texto secundário #5b6178 / #a3a8c7;
  destaque #3f5ef0 / #8fa2ff; `--nav-ativa` #3f5ef0 nos dois.
- Raios: cartão 28, célula 24, atalho 20, controle 14, interno 8, folha 28,
  alerta 24, cápsula 999.
- Materiais: `--material-barra` 86%, `--material-grosso` 90%,
  `--material-filtro` blur 20px.
- Tipografia: escala iOS (34, 28, 22, 20, 17, 16, 15, 13, 12, 11).
- Movimento: `--dur-fast` 0,15s, `--dur-exit` 0,2s, `--dur-enter` 0,45s,
  `--dur-mola` 0,5s, `--toque-escala` 0,97.
- Tema escuro por `[data-theme="dark"]` + `prefers-color-scheme`; blocos
  para contraste alto e redução de transparência.

### 2.6 Inconsistências já visíveis na TVDE Pro

1. Cor do ativo muda: tab bar usa #3f5ef0 no escuro; Sidebar usa #8fa2ff.
2. Ícones da Sidebar sempre na cor de destaque; na tab bar os inativos são
   cinzentos.
3. Restos de redesign antigo nos comentários/tokens (rótulo da tab bar, 49pt,
   menu "Mais").
4. Detalhe da semana: voltar e título dentro da página, não na barra; o
   centro da barra mostra "TVDE Pro".
5. Início: título grande é a saudação, mas o título da barra diz "Início".
6. Header ≥768px: comentário diz "sempre com vidro", CSS não faz isso.
7. Histórico e Carro: o seletor de mês ocupa o centro, então a barra nunca
   mostra o nome da página.

---

## Parte 3 — Lado a lado (factos, sem recomendação)

### Tab bar

| Aspeto | FinApp | TVDE Pro |
|---|---|---|
| Nº de itens visíveis | 4 + botão "+" | 4 |
| Overflow "Mais" | sim (popover, 2 colunas) | não |
| Botão "+" central | sim, terracota 56px | não (removido de propósito) |
| Posição do Início | 4.º (depois do "+") | 1.º |
| Rótulos visíveis | não | não |
| Altura | 64px | 56px |
| Margem lateral | 14px | 16px (máx. 440px de largura) |
| Distância ao fundo | indicador de gestos + 6px | dentro da faixa do indicador |
| Blur no telemóvel | não | sim (20px) |
| Indicador ativo | círculo branco/creme 40px, ícone escuro | círculo azul cheio 44px, ícone branco +10% |
| Animação do ativo | troca de cor 0,18s | círculo desliza com mola 0,5s |
| Escala ao toque | 0,96 | 0,97 |
| Haptics / badges / voltar ao topo | não / não / não | não / não / não |

### Barra do topo

| Aspeto | FinApp | TVDE Pro |
|---|---|---|
| Esquerda | avatar + logotipo "FinApp" | avatar (+ nome em ecrã largo) |
| Centro | seletor de mês (todas menos Definições) | título ao rolar, ou seletor de mês (Histórico, Carro) |
| Direita | olho (ocultar valores) + sino | tema claro/escuro |
| Nº de botões à direita | 2 | 1 |
| Nome da página na barra | nunca | sim, ao rolar (exceto páginas com mês) |
| Título grande na página | 28px peso 600 (escondido na Início) | 34px bold (saudação na Início) |
| Altura | ~61px + notch | 44px + notch (52px em ecrã largo) |
| Fundo em repouso | creme 90%, sólido, fio de 1px | transparente |
| Fundo ao rolar | igual (não muda) | vidro com blur + degradê, sem fio |
| Blur no telemóvel | não | sim |
| Botão voltar | não existe | só no Detalhe da semana, dentro da página |
| Menu do avatar | Minha conta + Definições (popover ancorado) | Minha conta + Definições (folha no telemóvel) |
| Fonte | sistema (-apple-system) | Inter |
| Pull-to-refresh | sim | sim |

### Tokens

| Aspeto | FinApp | TVDE Pro |
|---|---|---|
| Acento | terracota #e8703a (`--blu`) | azul #3f5ef0 (`--destaque`) |
| Fundo | creme quente / café | lavanda fria / azul-noite |
| Raio de cartão | 22px | 28px |
| Raio de controle | 9px | 14px |
| Escala de texto | 11–20px + título 28px | escala iOS 11–34px |
| `--dur-enter` | 0,24s | 0,45s |
| `--dur-exit` | 0,18s | 0,2s |
| Nomes dos tokens | mistos PT/EN, herdados (`--blu`, `--s1`, `--mut`) | PT semânticos (`--rotulo`, `--superficie`, `--destaque`) |

---

## Parte 4: O que vai ser mexido depois (para o analista)

O Gabriel já decidiu mexer nestas quatro áreas nas DUAS apps. Ainda não há
desenho fechado. A opinião do analista é bem-vinda em todas, sobretudo no que
deve ser comum às duas apps e no que cada uma deve manter como seu.

### 4.1 Tab bar e barra do topo

- **Objetivo:** a FinApp e a TVDE Pro partilham a mesma base de tab bar e de
  barra do topo, cada uma com o seu toque (cor de acento, ícones, conteúdo).
- **Ponto de partida:** as partes 1 a 3 deste documento, incluindo as
  inconsistências já listadas (1.6, 2.6) e a comparação lado a lado.
- **Perguntas em aberto:**
  - Botão «+» central: a FinApp tem, a TVDE Pro tirou-o de propósito.
  - Menu «Mais»: a FinApp tem, a TVDE Pro não.
  - Rótulos visíveis nas abas: nenhuma das duas os mostra.
  - O que aparece à direita no topo.
  - O nome da página na barra quando há seletor de mês.
  - Onde fica o botão voltar.
  - Uma só fonte (sistema ou Inter).
  - Blur ou fundo sólido.

### 4.2 Textos da interface (microcopy)

**Pedido do Gabriel:** a app tem de ter ar profissional. O que o incomoda:
- aspas angulares em texto visível (ex.: «Pago com»);
- parágrafos cinzentos corridos («textos sem formatação»);
- palavras, frases, títulos e subtítulos soltos na página (poluição visual);
- legendas e rodapés em excesso, às vezes repetidos.

**Estado na TVDE Pro (02/11/2026):**
- Já há uma auditoria com pesquisa e fontes: `docs/textos/auditoria.md`, no
  ramo `textos-profissionais` do TVDE Pro. As fontes são Apple HIG (Writing,
  Lists and tables, Pop-up buttons), Material, NN/g, o guia de estilo pt-PT da
  Microsoft e o Ciberdúvidas sobre aspas.
- **Regras aprovadas (resumo das 12):**
  - um texto só fica se ajudar a decidir ou agir;
  - ajuda só quando o rótulo não chega;
  - no máximo um rodapé por secção, de uma frase (~80 caracteres);
  - não repetir o que o título ou o valor já dizem;
  - nomes de ecrãs e opções sem aspas, com caminhos separados por ›;
  - cabeçalhos e botões com 2 a 4 palavras, com o mesmo verbo para a mesma
    ação («Registar»);
  - sem «o seu» desnecessário e sem «nós»;
  - português de Portugal e um só nome para cada coisa;
  - estado vazio = título + uma ação.
- **Números da auditoria** (133 textos): remover 18, encurtar 45, reescrever
  32, manter 38.
- **Já decidido:**
  - «O operador já inclui» passa a «O operador paga»;
  - na configuração inicial, subtítulo só no primeiro e no último passo;
  - na Análise, trocar frases por listas só depois de ver uma prévia.
- **Em curso:** a aplicação da auditoria na TVDE Pro. As mensagens de erro e
  os toasts ficam para uma segunda passagem.

**FinApp, hoje (02/11/2026):** ainda sem auditoria. As mesmas regras devem
valer para as duas apps. Levantamento automático no código (números
aproximados: contam textos em `.tsx`/`.ts`, sem testes nem comentários):

- **Total:** cerca de 680 textos visíveis (títulos, rótulos, ajudas, toasts,
  erros e confirmações).
- **Aspas:**
  - «»: **0** em texto visível. Só aparecem em 10 linhas de comentários do
    código (5 ficheiros).
  - Aspas retas "…": **30** textos. Quase todos põem o nome de um item entre
    aspas em confirmações e toasts: `Eliminar "Netflix"?`,
    `✓ "Uber" adicionado`, `"Uber" removido`, `✓ Agora chama-se "…"`. Um
    usa o nome de um botão: `toque em "Liquidadas" abaixo` (Parcelas).
  - Aspas curvas “…”: **7**, todas em mensagens de erro: 6 no restauro de
    backup, com nomes técnicos (“cfg”, “veiculo”, “tvde/despesas”); 1 na
    importação (entra como “Outros”).
- **Textos longos:** **26** com mais de 80 caracteres, **9** com mais de 120.
  - Onde: folhas de Definições 7, Parcelas 4, backup 4, TVDE 3, Cartões 2,
    Minha conta 2, Análise 1, Importar 1, Valores da parcela 1.
  - Os maiores: confirmação de Apagar conta (190, com «DEFINITIVAMENTE» em
    maiúsculas), explicação dos formatos na Importação (168), nota de Contas
    e cartões (153), nota da motorização do Veículo (149), nota dos valores
    da parcela (143).
- **Legendas, notas e rodapés:** cerca de **60** sítios com texto de ajuda
  (classes `nota*` 25, `aviso*` 14, `rodape*` 10, `subtitulo` 4, `legenda*`
  4, mais `dicaAuto`, `importarExplica`, `descricao`).
  - Aviso em dobro: Apagar conta tem a nota «Remove a conta e todos os dados…
    sem volta» e logo a seguir a confirmação diz o mesmo por extenso.
- **Repetições:** **61** textos (12+ caracteres) aparecem em 2 ou mais
  sítios, **166** ocorrências no total.
  - Os mais repetidos são erros genéricos: «Não foi possível concluir. Tente
    de novo.» (8×), «Não foi possível guardar.», «…alterar.», «…remover.»
    (7× cada), «Valor inválido.» (7×). Repetir a mesma mensagem para o
    mesmo erro está certo; o que falta é que digam o que fazer.
  - Validações: «Descrição obrigatória.» (4×), «Escreva um nome primeiro.»
    (4×).
  - Nota repetida: «Pagamento de fatura — gerencie no ecrã Cartões.» (2×).
- **Vários verbos para a mesma ação** (contra a regra «o mesmo verbo para a
  mesma ação»):
  - apagar: «Eliminar» (~52), «Remover» (~24), «Apagar» (6);
  - criar: «Adicionar» (~53), «Registar» (7), «Lançar» (5);
  - guardar: sempre «Guardar» (42), já está certo.
- **Português do Brasil e «o seu»:** «gerencie» (3), «Configure suas
  contas» (2), «seus/sua» (8).

Pior primeiro: Definições (folhas), Parcelas e TVDE juntam a maior parte dos
textos longos e das notas.

### 4.3 Animações

**TVDE Pro, hoje** (`src/styles/motion.css`, regras em `DESIGN.md`):
- **Molas à Apple:**
  - `--mola` é o padrão: amortecimento crítico, resposta de 0,35 s, sem
    ressalto.
  - `--mola-salto` é só para quando se solta um arrasto.
  - As folhas arrastam-se com uma mola real em JS (`useDragToClose`); o resto
    é CSS com curvas `linear()`.
- **Durações:** rápida 0,15 s, saída 0,2 s, entrada 0,45 s, mola 0,5 s.
  Regra: sair é mais rápido do que entrar.
- **Toque:** escala 0,97 (com redução de movimento: opacidade 0,6, sem
  escala).
- **Animações existentes:**
  - entrada de página e de aba;
  - círculo da tab bar que desliza;
  - barra do topo que ganha vidro ao rolar;
  - título grande que encolhe;
  - números que rolam;
  - anéis que enchem;
  - zoom do cartão entre o Início e Ver semana;
  - pulsar ao carregar.

  São cerca de 11 `@keyframes` em 8 ficheiros.
- **Problemas já corrigidos:** números a recomeçar do zero durante a
  transição, e uma piscadela depois do zoom. O registo está no HISTORICO.md
  (itens Z1 e Z3).

**FinApp, hoje** (`src/styles/motion.css`, `hooks/useDragToClose.ts`):
- **Curvas:** CSS `cubic-bezier`, não molas.
  - `--ease-enter` (0.32, 0.72, 0, 1): desacelera, para abrir/entrar.
  - `--ease-exit` (0.4, 0, 1, 1): acelera, para fechar/sair.
  - `--ease-spring` (0.34, 1.56, 0.64, 1): **com ressalto**, só no toque do
    «+» (tab bar e botão flutuante).
- **Durações:** rápida 0,15 s, saída 0,18 s, entrada 0,24 s, entrada grande
  0,3 s (barras de progresso). Regra igual à da TVDE Pro: sair é mais rápido
  do que entrar.
- **Mola real em JS (só 2 sítios):**
  - folhas inferiores: abrir, fechar (toque no véu ou Esc) e arrastar são a
    mesma mola, que se pode agarrar a meio. Resposta 0,34 s a entrar e 0,3 s
    a sair, amortecimento crítico; ressalto leve (0,8) só quando se solta um
    arrasto com velocidade;
  - puxar para recarregar: volta ao sítio com mola de 0,3 s.
- **Toque:** todos os botões encolhem para 0,97 (`base.css`); abas da tab bar
  0,96; barra lateral 0,95; «+» e botão flutuante 0,92 com ressalto.
- **Animações existentes:**

  | O quê | Como anima | Tempo |
  |---|---|---|
  | Página nova | fade + sobe 6px; a antiga some logo | 0,24 s |
  | Troca de aba dentro da página (Despesas, Planejamento/Metas) | só fade | 0,15 s |
  | Folha inferior (+, sino, conta, formulários) | sobe de fora do ecrã com mola; fecha a arrastar; véu escuro 45% + blur 4px | mola |
  | Folha por cima de folha | a folha de baixo recua para 94%, como no iOS | 0,24 s |
  | Menu «Mais» | balão sobe 8px + fade; véu 35% + blur 4px | 0,24 s / 0,18 s |
  | Menus pequenos (mês, ordenar, ações do item) | telemóvel: folha inferior; desktop: balão desce 4px + fade | 0,24 s |
  | Diálogo de confirmação | cartão central cresce de 96% para 100% + fade; véu 45% + blur 4px | 0,24 s / 0,18 s |
  | Toast | sobe 8px + fade | 0,24 s / 0,18 s |
  | Aba ativa (tab bar e barra lateral) | só troca de cor, fundo e sombra | 0,18 s / 0,15 s (fixos) |
  | Barras de orçamento e metas | a largura cresce | 0,3 s |
  | Puxar para recarregar | ícone gira | 0,8 s em ciclo |
  | Importar | ícone de carregar gira | 0,9 s em ciclo |
  | Abas do Veículo | as pontas esbatem conforme se rola para o lado | segue o dedo |
  | Pequenos detalhes | donut sobe 2px ao passar o rato; setas de grupo rodam; chevron desliza 2px; modo discreto desfoca 5px | 0,15–0,24 s |

- **Contagem:** 8 `@keyframes` em 6 ficheiros (o «girar» está repetido em 2),
  cerca de 46 transições em 19 ficheiros CSS, 11 ficheiros com regras de
  redução de movimento.
- **Redução de movimento:** cada componente tem a sua regra. O que desliza
  passa a fade curto (página, folha, menu, toast); a folha continua a seguir
  o dedo ao arrastar; a folha de baixo deixa de recuar; o ícone que gira
  passa a piscar.
- **O que não existe:** círculo ativo que desliza, topo que ganha vidro ao
  rolar, título grande que encolhe, números que rolam, transição partilhada
  entre ecrãs (zoom), haptics. Os gráficos (SVG próprios) não animam. O
  interruptor das Definições só muda de cor: a bolinha salta, não desliza.
- **Inconsistências:**
  1. Tempos fixos fora dos tokens: tab bar 0,18 s; barra lateral, registo
     rápido e atalhos de data 0,15 s; tooltip 0,12 s.
  2. O `--ease-spring` tem ressalto; a TVDE Pro só usa ressalto ao soltar um
     arrasto.
  3. Véus com escuros diferentes: 35% no «Mais», 45% nas folhas e no
     diálogo.

**A decidir:** uma linguagem de movimento comum às duas apps (curvas,
durações, o que anima e o que não anima), e como fica com a redução de
movimento.

### 4.4 Botões

**TVDE Pro, hoje** (`src/components/Botao.tsx`):
- **Variantes:** `filled` (primário), `tinted`, `branco`, `cinza`, `plain`
  (só texto), `submeter` (degradê azul → lilás), `perigo` e `perigoForte`.
- **Tamanhos:** pequeno, normal e grande. Alvo mínimo de 44 px.
- **Diálogos de confirmação** (`ConfirmarAcao`):
  - o vermelho fica só para ações que apagam;
  - as outras ações usam o verbo da ação («Saltar», «Alterar») em vez de
    «Confirmar».

**FinApp, hoje** (`src/components/Botao.tsx`):
- **9 variantes**, cerca de 150 usos. Não há tamanhos (pequeno/normal/
  grande): cada variante tem a sua medida fixa.

  | Variante | Aspeto | Medida | Usos | Para quê |
  |---|---|---|---|---|
  | `submeter` | cor cheia (quase preto no tema claro, creme no escuro), largura total | texto 15,2px, ~42px de altura | 29 | «Guardar» no fundo das folhas |
  | `primaria` | a mesma cor cheia | texto 13,6px, ~32px | 1 | ação principal de um ecrã |
  | `adicionar` | quadrado de cor cheia, só «+» | 34×34, ícone 18 | 15 | «+» ao lado do título de cada quadro |
  | `secundario` | pílula bege (`--s2`) | 34px de altura, texto 13,6 peso 600 | 47 | Cancelar, Importar, Esconder, Liquidadas… |
  | `icone` | círculo bege com borda | 34×34, ícone 18 | 14 | filtro, ordenar, menu de ações |
  | `link` | texto terracota, sem fundo | 14px peso 500 | 17 | «Ver todos» |
  | `texto` | texto terracota, fundo ao passar o rato | 13,6px | 3 | ação no cabeçalho de secção |
  | `perigo` | texto vermelho, sem fundo | 13,6px | 19 | eliminar um item, terminar sessão |
  | `perigoForte` | vermelho cheio | 13,6px, ~32px | 4 | Apagar conta e «Confirmar» do diálogo |

  Mais o modificador `soIcone` (botão reduzido ao ícone, 1 uso).
- **Comum a todas:** raio 9px (menos `secundario`, que é pílula, e `icone`,
  que é círculo), peso 700, desativado = opacidade 0,6, toque = escala 0,97.
- **Sem estado de carregar** no componente.
- **Alvo de toque:** os botões de 34px e os de ~32px ficam abaixo dos 44px
  da Apple e não têm área de toque extra.
- **Cor:** o botão principal é escuro/creme, não usa a cor de acento. O
  terracota cheio só aparece no «+» da tab bar e no botão flutuante (56px,
  fora do `Botao`).
- **Botões feitos à mão:** cerca de **100** `<button>` fora do componente,
  em 49 ficheiros: setas do mês (8), linhas de lista (7), tipo no registo
  rápido (4), atalhos de data (3), selo Pago/Pendente, chips, segmentados,
  botões do topo, abas e «+». Parte são controlos com estilo partilhado em
  `styles/segmentado`, `pilulas` e `selos`.

**Diálogo de confirmação da FinApp** (`ConfirmarAcao` + `useConfirmar`):
- Um só modelo: cartão central de 340px, raio 22px, mensagem a 15,2px,
  botões à direita: «Cancelar» (`secundario`) + «Confirmar»
  (`perigoForte`, vermelho). O foco começa no «Confirmar»; Esc e toque no
  véu cancelam.
- **33 chamadas em 13 ficheiros** (Veículo 9, Cartões 4, Parcelas 4, TVDE
  4, Despesas 3, Transações 2, mais 1 em Receitas, Calendário,
  Planejamento, Registo rápido, Categorias, Contas e cartões, Apagar conta).
- **O botão diz sempre «Confirmar» e é sempre vermelho**, mesmo sem apagar
  nada: «Pagar tudo de…» (Parcelas), «Lançar … como receita» (TVDE),
  «Mover … para despesas comuns» (Transações). «Reabrir a fatura» (Cartões)
  desfaz pagamentos.
- As mensagens são perguntas com o nome entre aspas retas; 4 têm uma
  segunda linha de aviso.
- Apagar conta pede a senha e depois a confirmação.
- Nenhum toast oferece «Desfazer» depois de eliminar.
- **Inconsistências:**
  1. Dentro das folhas, «Eliminar» é texto vermelho (`perigo`); no diálogo
     logo a seguir é vermelho cheio.
  2. No diálogo, «Cancelar» é pílula e «Confirmar» tem raio 9px: duas formas
     lado a lado.

**A decidir:**
- um conjunto comum de variantes, com nomes iguais nas duas apps;
- a hierarquia: um só botão principal por ecrã;
- o degradê no botão principal;
- os botões de cabeçalho e os botões dentro de células;
- os estados de carregar e de desativado.

### 4.5 Como o analista pode ajudar

- Dizer o que deve ser igual nas duas apps e o que deve ser próprio de cada
  uma.
- Apontar exemplos de apps de referência (banca, mobilidade, Definições do
  iOS) para a tab bar, o topo, os textos, as animações e os botões.
- Rever as regras de texto da 4.2 antes de serem aplicadas à FinApp.

---

## Parte 5 — Padrão comum aprovado

Regras finais para igualar a base das duas apps. A base visual é a da TVDE
Pro, aplicada às duas. Cada app mantém o seu toque: cor de acento, ícones e
conteúdo.

### 5.1 Tab bar (telemóvel)

- **Altura: 56px**, nas duas apps (a FinApp desce dos 64px atuais).
- **Vidro fosco com blur de 20px também no telemóvel** (hoje a FinApp não tem
  blur abaixo de 768px). Com redução de transparência ou contraste alto:
  fundo sólido, sem blur.
- **A bolinha da aba ativa desliza** de um ícone para o outro, como na TVDE
  Pro hoje (mola sem ressalto, CSS). Com redução de movimento: não desliza,
  troca no lugar.
- **FinApp, nova ordem:** Início · Receitas · **[+]** · Despesas · Mais.
  O Início passa a ser o 1.º, como na TVDE Pro e na barra lateral da
  FinApp.
- **FinApp, menu «Mais»:** abre como **folha que sobe de baixo**, igual ao
  «+», ao sino e à conta. Deixa de ser balão flutuante.

### 5.2 Barra do topo

- **Igual nas duas apps.**
- **Em repouso** (página parada no topo): barra **transparente**.
- **Ao rolar:** a barra ganha **vidro fosco**.
- **Nome da página:** título grande de **34px** no início do ecrã (a FinApp
  sobe dos 28px atuais).
- **Sub-página com «Voltar»:** o botão fica no **canto superior esquerdo**,
  no lugar da foto de perfil.

### 5.3 Tipografia e números

- **Mesma fonte nas duas apps: a do sistema (Apple)**, `-apple-system` / SF
  Pro. A TVDE Pro deixa a Inter.
- **Números sempre alinhados:** `font-variant-numeric: tabular-nums` em
  valores, totais, datas e contagens.

### 5.4 Botões

**5 estilos únicos, com o mesmo nome e o mesmo papel nas duas apps:**

| Estilo | Aspeto | Regra |
|---|---|---|
| **Principal** | cor sólida, **sem degradê** | **só 1 por ecrã** |
| **Secundário** | fundo suave (tom leve da cor) | ações de apoio |
| **Neutro** | cinza / cor da superfície | ações comuns, sem destaque |
| **Simples** | só texto ou só ícone, sem fundo | links, ações de cabeçalho |
| **Perigo** | vermelho | **exclusivo para apagar dados** |

O que isto muda já hoje:
- TVDE Pro: o `submeter` com degradê azul → lilás passa a Principal sólido.
- FinApp: o diálogo de confirmação deixa de usar vermelho em ações que não
  apagam nada (pagar, lançar, mover).
- As duas: as variantes atuais encaixam nestes 5 (a FinApp tem 9 e a TVDE
  Pro tem 8).

### 5.5 Ainda em aberto

Pontos das partes 4.1 a 4.4 que estas regras não fecham:

1. ~~Cor do Principal na FinApp~~ — **decidido:** o Botão Principal mantém-se
   **escuro** (modo claro) e **creme** (modo escuro). O terracota fica
   reservado ao botão «+» central e a destaques pontuais.
   **Verbos oficiais unificados:** «Registar» (substitui Adicionar/Lançar) e
   «Apagar» (substitui Eliminar/Remover).
2. O que fica à direita no topo, e se o logotipo «FinApp» se mantém.
3. Nome da página na barra quando há seletor de mês.
4. Linguagem de movimento comum (curvas, durações) além da bolinha que
   desliza.
5. Tamanhos dos botões, estados de carregar e de desativado, e o texto do
   botão do diálogo (verbo da ação em vez de «Confirmar»).

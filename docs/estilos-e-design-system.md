# Estilos e design system

Escrito a partir da leitura do código. Se divergir do código, vale o código: corrija o documento.

Visual «vidro + terracota»: fundo quente em mesh, superfícies de vidro, texto em castanho-tinta, terracota como acento. Mantém um padrão comum mínimo com a TVDE Pro; só muda por decisão do Gabriel. A análise e as decisões do padrão comum estão em [design/analise-tabbar-topo.md](design/analise-tabbar-topo.md) (Parte 5 = o que foi aprovado; secção 5.6 = o que já está no código). Não repetido aqui.

## CSS global (`src/styles/`, importado por `index.css` nesta ordem)

| Ficheiro         | Conteúdo                                                                                                                                                                                                                                                                           |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tokens.css`     | Todas as variáveis de design. Tema escuro no `:root`; claro em `[data-theme="light"]`. Também tokens de layout: `--sidebar-w`, `--conteudo-max`, `--cabecalho-alt`, `--topo-conteudo`, `--fab-*`, `--aba-circulo`, `--alt-barra-nav`, áreas seguras `--safe-*`, `--altura-teclado` |
| `motion.css`     | Curvas, durações e `--veu` (ver abaixo)                                                                                                                                                                                                                                            |
| `typography.css` | `--track-display`, `--track-heading`, `--track-body`, `--track-label` e a classe `.tabular`                                                                                                                                                                                        |
| `base.css`       | Reset e base: `box-sizing`, `body` (fonte do sistema, `tabular-nums`, fundo `--bg`), mesh em `body::before`, `button`, `:active` a 0,97, `:focus-visible` (anel `--blu`), `.discreto`, `.material`, `.nativo` (sem barras de rolagem)                                              |

Módulos CSS partilhados (`composes: x from "../styles/<ficheiro>.module.css"`):

| Ficheiro                | Para quê                                                                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vidro.module.css`      | `.vidro`: material dos cartões (fundo, contorno, sombra, `--r-card`). Blur só a partir de 768px; sólido sem suporte ou com transparência reduzida                   |
| `secoes.module.css`     | `.secao` (quadro com vidro e cabeçalho) e `.cabecalho`. Uma secção de página é sempre um quadro, nunca linhas soltas sobre o fundo                                  |
| `listas.module.css`     | `.quadroLista`, `.listaLegivel`: quadro das listas (Veículo, Parcelas, TVDE)                                                                                        |
| `grelha.module.css`     | Grelha de 12 colunas: `.grelha`, `.celula`, `.s12`, `.s8`, `.s6`, `.s4`, `.linhas2`, `.alinhaTopo`. 1 coluna abaixo de 768px, 2 colunas até 1023px, 12 a partir daí |
| `segmentado.module.css` | Abas segmentadas em pílula de vidro: `.abas`, `.abaBotao`, `.abaAtiva`                                                                                              |
| `pilulas.module.css`    | Alternador Mês/Semana: `.linha`, `.alternador`, `.opcao`, `.ativa`                                                                                                  |
| `selos.module.css`      | Selo Pago/Pendente: `.badgeToggle`, `.badgePago`, `.badgePendente` (com glifo ✓ ou ◷: o estado não depende só da cor)                                               |
| `titulos.module.css`    | `.tituloSecao`: o mesmo título de secção em todas as páginas                                                                                                        |

CSS por componente: cada componente, página e peça de layout tem um `.module.css` ao lado. Usar sempre `var(--...)`.

## Tokens

### Cores (por tema)

Os nomes são os mesmos nos dois temas; só mudam os valores. Fonte: `tokens.css`.

| Papel                           | Token                                                                          | Escuro                                    | Claro                               |
| ------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------- | ----------------------------------- |
| Fundo da página                 | `--bg` (+ `--fundo-mesh`)                                                      | `#15100c`                                 | `#fbf3ea`                           |
| Superfícies opacas              | `--s1`, `--s2`, `--s3`                                                         | `#2a201a` a `#3e3128`                     | `#fffaf5` a `#e9dccb`               |
| Texto / texto suave             | `--txt` / `--mut`                                                              | `#f6eee7` / `#b9aa9d`                     | `#1c1712` / `#64584e`               |
| Contorno / linha                | `--brd` / `--linha`                                                            | creme a 10 % / 9 %                        | castanho a 12 % / 10 %              |
| Acento (terracota)              | `--blu`                                                                        | `#f0844f`                                 | `#e8703a`                           |
| Acento como texto               | `--blu-txt`                                                                    | igual a `--blu`                           | `--blu` misturado com 35 % de preto |
| Verde, vermelho, amarelo, roxo  | `--grn`, `--red`, `--ylw`, `--pur`                                             | tons claros                               | tons escurecidos para texto         |
| Azul da aba TVDE                | `--tvde`, `--tvde-grad`                                                        | `#8fa2ff`                                 | `#3f5ef0`                           |
| Botão primário                  | `--btn-bg` / `--btn-txt`                                                       | creme / escuro                            | escuro / branco                     |
| Aba ativa                       | `--aba-ativa-bg/-txt/-sh`                                                      | creme                                     | branco                              |
| Vidro                           | `--vidro-bg`, `--vidro-bg-blur`, `--vidro-solido`, `--vidro-brd`, `--sh-vidro` | translúcido castanho                      | branco translúcido                  |
| Material (topo, barra, lateral) | `--material-bg`, `--material-brd`                                              | castanho a 86 %                           | branco a 86 %                       |
| Cartão de destaque              | `--destaque-grad`, `--destaque-sh`, `--sobre-destaque`                         | degradê terracota escuro com texto branco | igual                               |
| Fundos suaves                   | `--soft-grn/-red/-ylw`, `--tint-*`                                             | alfa                                      | tons opacos / alfa                  |
| Selos de estado                 | `--selo-pago-*`, `--selo-pendente-*`, `--selo-alerta-*`                        | opacos, contraste medido                  | opacos, contraste medido            |
| Componentes RGB (para alfa)     | `--blu-rgb`, `--grn-rgb`, ...                                                  | sim                                       | sim                                 |
| Sombras                         | `--sh-card`, `--sh-card-hi`, `--sh`, `--sh-sm`, `--sh-div`, `--sh-round`       | sim                                       | sim                                 |

Notas:

- O tema escuro é o valor por omissão do `:root`; `data-theme` é escrito no `<html>` por `useAplicarTema`. O tema `system` é resolvido por `useTemaEfetivo`.
- O utilizador pode trocar os 5 acentos (`blu`, `grn`, `red`, `ylw`, `pur`) em Definições, por tema (`cfg.coresApp`). Sem escolha, valem os de `tokens.css`.
- A terracota no claro só dá 2,2 a 2,8:1 como texto: serve a preenchimentos, anéis e barras; como texto usa-se `--blu-txt`. Contrastes medidos em `docs/workflow/vidro/checks.md`.
- Vermelho (`--red`) é carmim, afastado da terracota de propósito, para não se ler como a mesma cor.

### Escala tipográfica (`--fs-*`, 6 degraus)

| Token          | Tamanho          | Papel                                                |
| -------------- | ---------------- | ---------------------------------------------------- |
| `--fs-micro`   | 0,6875rem (11px) | O mínimo da app: selo, contador, rótulo de aba       |
| `--fs-label`   | 0,76rem          | Rótulo, legenda, nota de apoio                       |
| `--fs-body`    | 0,85rem          | Corpo de lista, texto de botão pequeno, texto padrão |
| `--fs-title`   | 0,95rem          | Título de secção e de cartão, texto de botão normal  |
| `--fs-heading` | 1,05rem          | Título de folha                                      |
| `--fs-display` | 1,25rem          | Valor grande de KPI, título de página                |

Fonte do sistema (`-apple-system` e afins), `tabular-nums` em todo o `body`. Tracking por papel em `typography.css`.

### Cantos (`--r-*`)

| Token          | Valor | Uso                                               |
| -------------- | ----- | ------------------------------------------------- |
| `--r-card`     | 22px  | Cartão/quadro de vidro                            |
| `--r-destaque` | 24px  | Cartão de destaque em terracota                   |
| `--r-sheet`    | 22px  | Folha inferior e navegação flutuante              |
| `--r-sm`       | 9px   | Contentor de controlo, campo, item de lista       |
| `--r-xs`       | 7px   | Controlo dentro de um contentor (segmento, opção) |
| `--r-pill`     | 99px  | Selo, chip, barra de progresso, botão (cápsula)   |

### Movimento (`motion.css`)

| Token            | Valor                         | Uso                                        |
| ---------------- | ----------------------------- | ------------------------------------------ |
| `--ease-enter`   | `cubic-bezier(0.32,0.72,0,1)` | Abrir/entrar (desacelera)                  |
| `--ease-exit`    | `cubic-bezier(0.4,0,1,1)`     | Fechar/sair (acelera)                      |
| `--ease-mola`    | `cubic-bezier(0.16,1,0.3,1)`  | Mola sem ressalto: círculo da tab bar, «+» |
| `--dur-fast`     | 0,15 s                        | Toques e mudanças pequenas                 |
| `--dur-exit`     | 0,2 s                         | Sair                                       |
| `--dur-enter`    | 0,45 s                        | Entrar                                     |
| `--dur-mola`     | 0,5 s                         | Mola                                       |
| `--dur-enter-lg` | 0,5 s                         | Barras de orçamento e metas a crescer      |
| `--veu`          | `rgba(0,0,0,0.45)`            | Véu único atrás de folhas e diálogos       |

Convenção: o estado base de um overlay usa `--ease-exit`/`--dur-exit`; o estado aberto usa `--ease-enter`/`--dur-enter`. Sem ressalto em nada, exceto a folha ao soltar um arrasto (mola em JS, `utils/spring.ts`). Folha e diálogo levam o véu com `blur(4px)`.

`prefers-reduced-motion`: não há regra global; cada componente animado tem as suas regras no próprio módulo (a folha, o menu e o toast passam a só-opacidade; o indicador do botão passa a pulsar). O arrasto direto de uma folha não é decoração e não pode ser anulado por regra genérica. `prefers-reduced-transparency`: vidro e material ficam sólidos e sem blur.

## O botão (`src/components/Botao.tsx` e `Botao.module.css`)

Único componente de botão. Props: `variante` (obrigatória), `tamanho`, `soIcone`, `carregando`. Sem `type`, assume `type="button"`.

| Variante     | Aspeto                                            | Regra                      |
| ------------ | ------------------------------------------------- | -------------------------- |
| `primario`   | `--btn-bg`/`--btn-txt`, cor cheia sem degradê     | Só um por ecrã             |
| `secundario` | `--blu` a 14 % (mais a 22 % no rato), `--blu-txt` | Ações de apoio             |
| `neutro`     | `--s2`, `--txt`                                   | Ações comuns sem destaque  |
| `fantasma`   | só texto/ícone em `--blu-txt`                     | Links e ações de cabeçalho |
| `perigo`     | `--tint-red-12`, `--red`                          | Só para apagar dados       |

| Tamanho   | Altura | Notas                                                         |
| --------- | ------ | ------------------------------------------------------------- |
| `pequeno` | 34px   | Alvo de toque de 44px por trás (`::before` com `inset: -5px`) |
| `normal`  | 44px   | Por omissão                                                   |
| `grande`  | 52px   | Largura toda, fundo das folhas («Guardar»)                    |

Todos são cápsulas (`--r-pill`); `soIcone` é redondo e exige `aria-label` com a frase inteira. `carregando` desativa o botão e troca o conteúdo por um indicador sem mudar a largura; `:disabled` fica a 50 % de opacidade. O «+» central e o FAB são do layout, não são `Botao`; o terracota cheio fica reservado ao «+» e a destaques pontuais.

## Regras

1. Cores só por tokens: sem cores soltas, sem `color-mix` novo se já houver `--tint-*`.
2. Tamanhos de letra só pela escala `--fs-*`. Cantos só pelos `--r-*`. Movimento só pelos tokens de `motion.css`.
3. Um só botão primário por ecrã. Vermelho (`perigo`) só para apagar dados, com o texto «Apagar».
4. Só 5 estilos de botão e 3 tamanhos, sempre pelo `Botao`. O que não encaixa é controlo com componente próprio (segmento, chip, selo).
5. Alvos de toque de pelo menos 44px.
6. Funciona em claro e em escuro, e com movimento e transparência reduzidos.
7. Textos da interface sem aspas «» e sem legendas a mais; verbos oficiais «Registar» e «Apagar»; o botão do diálogo diz o verbo da ação (Pagar, Registar, Mover), não «Confirmar».
8. O estado nunca depende só da cor (os selos levam glifo).
9. Uma secção de página é sempre um quadro de vidro (`secoes.module.css`); a grelha alinhada vem de `grelha.module.css`.
10. Padrão comum com a TVDE Pro: tab bar de 56px, topo transparente em repouso e com vidro ao rolar, título grande de 34px, fonte do sistema, `tabular-nums`, 5 estilos de botão, véu a 45 % com `blur(4px)`. Cada app mantém o seu acento, ícones e conteúdo. Detalhe em `design/analise-tabbar-topo.md`, Parte 5.
11. Números sensíveis aceitam a classe `.discreto` (modo discreto: blur).

## Para mudar design

1. Confirmar que a decisão é do Gabriel e que é só design: não misturar com lógica nem com mudança de comportamento.
2. Ler este ficheiro e a Parte 5 de `design/analise-tabbar-topo.md`. Se a mudança toca o padrão comum com a TVDE Pro, decidir se a TVDE Pro acompanha.
3. Ver como as outras telas resolvem o mesmo caso (`grep` nos `.module.css`) e seguir esse padrão.
4. Mudar primeiro o token (`tokens.css` ou `motion.css`), nos dois temas; só depois o componente. Se for valor novo, criar o token em vez de o escrever no módulo.
5. Reutilizar `Botao` e os módulos partilhados de `src/styles/` com `composes`; não criar um quinto estilo de botão.
6. Verificar claro e escuro, ecrã estreito (telemóvel) e largo (768px e 1024px), movimento reduzido e transparência reduzida; contraste do texto de pelo menos 4,5:1.
7. Ver em ecrã real: `npm run dev`, ou o `dev-preview.html` (ecrãs com dados de exemplo, só em dev). Não pôr capturas de ecrã no git (podem ter dados reais).
8. `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check`.
9. Registar no topo do `HISTORICO.md`, em linguagem simples, e atualizar este documento se um token ou regra mudou.
10. Atualizar a app no iPhone (passo final de cada entrega).

## Para confirmar

- Valores soltos fora da escala, vistos em módulos partilhados: `13px` em `pilulas.module.css` e `segmentado.module.css`, `17px` em `titulos.module.css`. A regra diz escala de 6; confirmar se são exceções aceites ou dívida.
- `base.css` e `pilulas.module.css` referem «seção 4.6» e «seção 6» do spec antigo (fora do git); confirmar se ainda interessam.
- `docs/design/analise-tabbar-topo.md` §5.5 cita `--ease-spring`, que já não existe em `motion.css`; o código atual usa `--ease-mola`.
- Passos de `Botao` com `--fs-body` (pequeno) e `--fs-title` (normal/grande): confirmar se é a intenção do padrão.

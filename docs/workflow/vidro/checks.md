# Checks da Fase A (vidro claro + terracota)

Medições com WCAG 2.x, pior caso entre os pontos do mesh (#FBF3EA, #FFE2C8, #FFD3B0, #F9D9BF, #FBEBD5), com e sem vidro branco a 74% por cima.

## DESVIOS em relação à prévia (anotados antes do commit)

1. `--mut` claro: #64584E em vez de #6B5F55. Motivo: #6B5F55 dá 4,48:1 sobre #FFD3B0 (abaixo de 4,5). Com #64584E: 4,99 no mesh, 6,36 no vidro, 5,80 sobre --s2.
2. Terracota como texto: #E8703A dá 2,2–2,8:1. Texto/links usam `--blu-txt` = `color-mix(--blu 65%, #000)` = #974926 (4,61 no mesh, 5,88 no vidro). #E8703A só em preenchimentos, anéis, barras e toggles.
3. Texto sobre terracota: `--on-blu` #1C1712 (5,8:1); o branco dá 3,1:1.
4. Teal/vermelho/âmbar para TEXTO escurecidos (a prévia usa #0F9F8C = 3,0:1, #C2410C = 3,75 no mesh, #B7791F = 2,6): `--grn` #096B5E (4,64), `--red` #A8350A (4,78), `--ylw` #7F520F (4,88), `--pur` #6D42C4 (4,71). No escuro valem os da prévia.
5. TVDE: `--lrj*` renomeado `--tvde*` (azul do TVDE Pro) e o tom de KPI `laranja` passou a `tvde` (renome interno, sem texto visível).
6. Botões primários (Botao primaria/submeter, Login, Importar, Planejamento, Copiloto, mover em Transações) passam a `--btn-bg`/`--btn-txt` (preto no claro); os preenchimentos terracota com texto (dia escolhido, mês escolhido, etc.) passam a `--on-blu`.

## A1 — contraste (claro)

| Par                                            | Contraste                 |
| ---------------------------------------------- | ------------------------- |
| --txt #1C1712 sobre mesh / vidro               | ≥ 12,9 / ≥ 16,4           |
| --mut #64584E sobre mesh / vidro / --s1 / --s2 | 4,99 / 6,36 / 6,64 / 5,80 |
| --blu-txt #974926 sobre mesh / vidro / --s2    | 4,61 / 5,88 / 5,36        |
| --grn #096B5E mesh / vidro / --s2              | 4,64 / 5,92 / 5,40        |
| --red #A8350A mesh / vidro / --s2              | 4,78 / 6,10 / 5,56        |
| --ylw #7F520F mesh / vidro / --s2              | 4,88 / 6,22 / 5,67        |
| --on-blu #1C1712 sobre #E8703A                 | 5,77                      |
| --tvde #3F5EF0 sobre #FBF3EA / vidro           | 4,69 / 4,76               |
| Botão primário #FFF sobre #1C1712              | 17,4                      |

grep de hex soltos novos fora dos tokens: ver o fim do ficheiro (preenchido a cada nó).

## A2 — contraste (escuro quente), fundo #15100C / vidro rgba(48,36,29,.62) / sólido #2A201A

| Par                                  | bg   | vidro | sólido |
| ------------------------------------ | ---- | ----- | ------ |
| --txt #F6EEE7                        | 16,5 | 14,5  | 13,9   |
| --mut #B9AA9D                        | 8,4  | 7,4   | 7,1    |
| --blu/--blu-txt #F0844F              | 7,3  | 6,4   | 6,2    |
| --grn #3CCBB5                        | 9,4  | 8,3   | 7,9    |
| --red #FF8F75                        | 8,5  | 7,5   | 7,2    |
| --ylw #F2C14E                        | 11,3 | 9,9   | 9,5    |
| --pur #B08DFC                        | 7,3  | 6,4   | 6,1    |
| --on-blu #1A120D sobre #F0844F       | 7,1  |       |        |
| botão primário #1A120D sobre #F6EEE7 | >15  |       |        |
| --tvde #8FA2FF                       | 7,9  | 7,0   |        |

Chips (texto sobre tint 16% sobre vidro): teal 6,1, vermelho 5,5, âmbar 6,9.

Desvio: `theme-color` do manifest/index passa a #15100C; o `background_color` do manifest e a arte do ícone ficam navy (a chapa do ícone é imagem, fora do plano).

## A3 — materiais

- `styles/vidro.module.css` (`.vidro`) e `.material` (base.css): abaixo de 768px branco translúcido sem blur; ≥ 768px `backdrop-filter` + `-webkit-backdrop-filter` (sempre os dois); `@supports not (...)` e `prefers-reduced-transparency` com `--vidro-solido`.
- grep: todo `backdrop-filter` tem o `-webkit-backdrop-filter` ao lado (os véus de 4px de BottomSheet/ConfirmarAcao/MobileNav já o tinham e são overlays, não vidro).
- Raios: `--r-card` 16 → 22px, novo `--r-destaque` 24px, `--r-pill` 99px (já existia).
- DESVIO: `.material` abaixo de 768px usa 86% de branco (a prévia usa 74% só na barra flutuante). O header é sticky e, sem blur, a 74% o texto da lista aparecia por baixo. A 86% continua translúcido.
- DESVIO: `--r-card` a 22px vale para as 41 utilizações, incluindo telas da Fase B; ali a revisão fica para a Fase B.

## A4 — navegação

- iPhone: pílula flutuante (60px, 14px de margem lateral, 6px acima do indicador), as MESMAS abas (Receitas, Despesas, "+", Início, Mais). Aba ativa em círculo branco (creme no escuro), "+" preto (creme no escuro) de 46px, abas de 44px. `--alt-barra-nav` 57 → 66px + folga, para as coisas que flutuam acima (menu "Mais", toast) ficarem à mesma distância da pílula.
- ≥ 768px: sidebar em pílula vertical (60px, centrada na altura), só ícones, aba ativa em círculo branco, tooltip com o nome no hover e no foco (`data-nome` + `aria-label`). `--sidebar-w` 68/224 → 88px (já não expande com rótulos).
- Sem ícones novos (os mesmos Lucide de hoje).
- DESVIO: a sidebar não leva `title`: o tooltip nativo apareceria por cima do nosso, duplicado. O nome está em `aria-label`. Na barra do iPhone as abas levam `title` (sem tooltip próprio).
- DESVIO: o "+" já não veste a cor da página (Despesa/Receita/Veículo/TVDE): é preto, como na prévia. `utils/corBotaoRegistro.ts` ficou sem uso nos componentes (continua com os seus testes); apagar fica para o Gabriel decidir.
- DESVIO: sem o pulso de brilho do "+" (a prévia não o tem; com o botão preto um brilho terracota ficava estranho). Vale para o FAB de desktop também.
- Não movido: a prévia do iPad mostra o "+" no topo da pílula; aqui o FAB continua no canto inferior direito (mudar a posição seria mudança de função). Marcado unresolved.
- Capturas: a4-* (Chromium e WebKit).

## A5 — componentes base

- QuadroResumo: `.quadro` compõe o vidro (`vidro.module.css`); número grande a 600 com tabular-nums (era 700); título de página 600 (era 700). API intacta.
- Segmentado (Despesas, Planejamento, Veículo, TVDE): pílula de vidro, aba ativa em branco (creme no escuro), com `--aba-ativa-*`.
- Chips de estado: Pago ✓ e Pendente ◷, por CSS (`::before` com `/ ""`), então o texto não muda; usam os `--selo-*` recalculados (A1/A2). Chips de estado só onde já existe um estado: o estado "Atrasado" (!) não existe hoje no código (A pagar mostra "hoje/amanhã/dia"), por isso não foi criado.
- Chips de variação ▲/▼: não existe nenhum chip de variação no código (o KPI "vs setembro" é um texto, não um chip). Não criei componente novo. Unresolved, para decidir com o plano da Início/Análise.
- Toggles (SettingsSwitchRow): já usam `--blu` (terracota) com polegar branco; sem alteração.
- Anéis e barras: as barras (Categorias, trilho) usam `--blu`, agora terracota. O app não tem anéis de progresso hoje (só o donut de categorias, com cores de categoria). Sem alteração.
- Botões primários: `--btn-bg` (A1).
- Tipografia: `--fs-micro` 0.68rem → 0.6875rem (11px) e os 4 tamanhos soltos abaixo de 11px (0.58/0.62/0.65rem) passam a `--fs-micro`. Alterou a medida do selo/badge em ~0,1px.
- DESVIO: o alternador "Mês/Semana" (pilulas.module.css, preenchido a preto) não foi mexido: é outro componente e já está no desenho novo (preto/creme).

## A6 — Início

- "Resultado do mês": cartão de destaque em terracota sólido, texto branco (prop opcional `destaque` no QuadroResumo; sem mudar a API existente). Branco sobre o gradiente #C94E1A→#B34314: 4,58 e 5,4:1 (a prévia #EE7E48→#E06630 dá 2,7–3,4, por isso o gradiente é mais escuro: DESVIO). Todo o texto do cartão é branco sólido (sem opacidade, que faria o contraste cair abaixo de 4,5).
- Barra receitas/despesas e bolinhas sobre o terracota: o que entrou a branco cheio, o que saiu a branco a 38% (comprimento, não só cor). O verde/vermelho desta barra desaparece no cartão de destaque; o sinal "−" do resultado negativo continua.
- A pagar / Categorias / Últimos movimentos e a linha do Copiloto: cartões de vidro. Conteúdo idêntico ao de hoje; sem gráficos.
- Grelha: 1 coluna no telemóvel (mesma ordem do DOM), 2 colunas de 768 a 1023px e 3 colunas a partir de 1024px. DESVIO: a 768–1023px a prévia (feita a 1180) não existe; a ~650px de conteúdo três colunas deixavam ~100px de texto por linha.
- "Resultado do mês" na prévia traz o chip "▲ 8% vs set", "Entrou X · saiu Y", Semana/Mês/Ano e Exportar: NÃO entram (funções/textos novos).
- hex soltos novos fora de tokens.css: nenhum (o único é o `theme-color` do useAplicarTema, que já tinha hex).
- Capturas (Chromium e WebKit): ver lista no relatório.

# Fase B

## B0a — cabeçalho no tom do fundo

- `--cabecalho-bg`: creme #FBF3EA a 90% no claro; #15100C a 90% no escuro, com fio `--linha` por baixo. Sem blur abaixo de 768px; ≥ 768px blur leve (com -webkit-) e fundo sólido com prefers-reduced-transparency. Tirei a classe `.material` do header.
- ≥ 768px a faixa ocupa a largura toda (já não começa depois da sidebar); só o conteúdo se afasta (`padding-left: --sidebar-w + 16px`). A sidebar sobe para z-index 31 (acima do header, 30) para não ficar por baixo dele em ecrãs baixos.

## B0b — Início ≥ 1024px

- Escolha: o "Perguntar ao Copiloto" passa para a coluna 2, por baixo do "A pagar" (grid-template-areas, fila do meio 1fr); Últimos movimentos ficam por baixo das duas primeiras colunas. Sem conteúdo novo. A ordem do DOM e a do telemóvel não mudam.

## B1 — Despesas

Sem alterações de código: a tela já estava no desenho novo depois da Fase 2 e as bases (A1–A5). Verificado em claro e escuro: quadro em vidro, segmentado em pílula com o ativo branco/creme, selos Pago ✓ / Pendente ◷, linhas com fio fino, botões "+" pretos/cremes. `--r-card` 22px (desvio 9): sem problema nesta tela (os únicos cartões são o quadro de resumo e o EstadoVazio). O `.form` de Despesas.module.css e o de Veiculo.module.css não são usados por nenhum componente (CSS morto, não mexi). Borda testada: nome comprido, valor de 5 dígitos, dia com 1 e com 2 movimentos, lista vazia.

- Capturas: FinApp-capturas/vidro-faseB/b1-despesas-* (390 claro/escuro, 320, 1180, borda, vazio, WebKit).

## B2 — Receitas

Sem alterações de código: herda o desenho novo (quadro em vidro, "+ Adicionar" em --blu-txt, pílulas Mês/Semana, verde menta só nos valores positivos). Contraste do verde #096B5E medido em checks (A1). Borda: nome comprido, valor grande, lista vazia.

- Capturas: FinApp-capturas/vidro-faseB/b2-receitas-* (390 claro/escuro, 320, 1180, borda, vazio, WebKit).

## B3 — Transações

Sem alterações de código: herda o desenho novo (quadro em vidro, extrato agrupado por dia em secção sem cartão). Borda: nome comprido, 15 transações, valores de 5 dígitos, lista vazia. Nota: "Saídas" e "Saldo" negativo continuam em vermelho no quadro, como já eram.

- Capturas: FinApp-capturas/vidro-faseB/b3-transacoes-* (390 claro/escuro, 320, 1180, borda, vazio, WebKit).

## B4 — Parcelas

Os cartões das compras parceladas (`.parcela`) e o de "Serviços de parcelamento" (`.gerir`) passam a compor o vidro (translúcido, e fosco ≥ 768px) em vez de `--s1` + sombra própria; o resto herda. As barras de progresso das parcelas continuam em `--mut` (decisão antiga: informação, não ação; comentário no CSS). `--r-card` 22px: bom nestes cartões de ~90px de altura. Borda: nome comprido que passa a 2 linhas, lista vazia.

- Capturas: FinApp-capturas/vidro-faseB/b4-parcelas-* (390 claro/escuro, 320, 1180, borda, vazio, WebKit).

## B5 — Cartões

`.cartao`, `.quadro` (cartão clicável) e `.item` (transferências) compõem o vidro. Mesmo conteúdo e ordem. `--r-card` 22px ficou bem (cartões de 140–180px). Borda: cartão sem transações, lista de transferências vazia, valores de 4 dígitos.

- Capturas: FinApp-capturas/vidro-faseB/b5-cartoes-* (390 claro/escuro, 320, 1180, borda, vazio, WebKit).

## B6 — Calendário

A grelha do mês (`.grid`) e os cartões da lista (`.item`) compõem o vidro. O dia de hoje continua em terracota com texto `--on-blu` (5,8:1). Os pontos de vencimento mantêm as cores de tipo. `--r-card` 22px: bom na grelha (≈ 450px) e nos itens (≈ 60px de altura, ficam quase em cápsula; aceitável). Borda: dia sem eventos, nome comprido, lista vazia.

- Capturas: FinApp-capturas/vidro-faseB/b6-calendario-* (390 claro/escuro, 320, 1180, borda, vazio, WebKit).

## B7 — Planejamento

Cartões `.cardMeta`, `.fundoCard` e o `OrcamentoCard` ("Orçamento por categoria") compõem o vidro. Barras de progresso em terracota: em "Orçamento por categoria" a barra deixa de levar a cor da categoria (a bolinha da categoria mantém a sua) e fica em `--blu`, vermelha só quando estoura (como já era); em Metas, as barras dos fundos (antes vermelho < 40%, âmbar < 80%, verde ≥ 80%) e a da meta mensal (antes vermelha enquanto não atingida) ficam em terracota, verde só quando a meta mensal é atingida. Sem anéis nem card "Nova meta" tracejado (não existem). DESVIO: as cores por estado das barras dos fundos desaparecem (pedido do planejador: terracota); o estado continua legível pelo texto e pelo selo "Na meta". Capturas das Metas: b7-planejamento-metas-390-*.png.

- Capturas: FinApp-capturas/vidro-faseB/b7-planejamento-* (390 claro/escuro, 320, 1180, borda, vazio, WebKit).

## B8 — Veículo

Sem alterações de código: o quadro de resumo (vidro), as abas segmentadas (pílula) e as listas sem cartão já herdam o desenho novo. O `.form` de Veiculo.module.css não é usado por nenhum componente (CSS morto). Borda: sem registos, nome comprido, valores de 4 dígitos.

- Capturas: FinApp-capturas/vidro-faseB/b8-veiculo-* (390 claro/escuro, 320, 1180, borda, vazio, WebKit).

## B9 — TVDE

Cartões `.hero`, `.semana`, `.tabela`, `.blocoExtra` compõem o vidro; os destaques (números, linha do topo do herói, "+", aba ativa) usam o azul do TVDE Pro (#3F5EF0 claro, #8FA2FF escuro; 4,7 e 7,0:1 como texto). O resto igual às outras telas. DESVIO: o texto da aba ativa do segmentado usa o azul a 65% com preto (#5D69A6 no escuro, 4,53:1 sobre a aba creme): o #8FA2FF puro dava ~2:1 sobre o creme.

- Capturas: FinApp-capturas/vidro-faseB/b9-tvde-* (390 claro/escuro, 320, 1180, borda, vazio, WebKit).

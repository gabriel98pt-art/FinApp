# Checks da grelha

Verificação prévia (Análise): a 1024, 1100, 1180, 1280, 1366, 1440 e 1500px não há scroll horizontal nem elementos fora da janela com os dados de teste (document.scrollWidth = clientWidth). O corte da captura do Gabriel não se reproduz com estes dados; volta a ser testado depois do H3 com valores longos.

## H1 — utilitário partilhado e largura máxima

- `styles/grelha.module.css`: `.grelha` (1 coluna no telemóvel; 2 colunas de 768 a 1023px; 12 colunas, gap 16px, a partir de 1024px), `.celula` (estica o cartão à altura da linha, desaparece se vazia), spans `.s12/.s8/.s6/.s4` (≥ 1024px), `.linhas2`, `.alinhaTopo` (para o painel sticky). Só CSS, sem biblioteca. De 768 a 1023px `s12` ocupa as 2 colunas e os outros uma cada.
- Largura: `--conteudo-max` 1320px; o conteúdo encosta à sidebar (`margin-left: var(--sidebar-w)`, a sobra fica à direita) em vez de centrar; o cabeçalho acompanha: o `padding-right` da faixa soma a sobra, de modo que o mês e as ações ficam na mesma largura do conteúdo.
- Capturas "antes" (estado anterior): FinApp-capturas/grelha/antes-{inicio,analise,despesas}-{1180,1440,1920}-{escuro,claro}.png e antes-*-1440-claro-webkit.png.

## H2 — Início (GrelhaInicio)

Faixa do aviso de categorias (span 12, some se não houver aviso: a célula vazia desaparece); Resultado do mês 6 | A pagar 6; Últimos movimentos 8 | Categorias 4; Copiloto como faixa de span 12 no fim. Bordas esquerda/direita alinhadas de cima a baixo (verificado a 1180, 1440 e 1920px, claro e escuro). O cartão Resultado estica à altura da linha: o número fica no topo, a barra e os totais colam em baixo (`.rodape`, `margin-top: auto`); `QuadroResumo` passou a flex column (os outros quadros não mudam de aspeto).

- A ordem do DOM e a do telemóvel são as de sempre (Resultado, aviso, A pagar, Categorias, Últimos movimentos, Copiloto). DESVIO anotado: a partir de 768px o `order` do CSS põe o aviso por cima e os Últimos movimentos antes das Categorias, por isso nas telas largas a ordem VISUAL difere da do DOM (um leitor de ecrã lê Resultado, aviso, A pagar, Categorias, Últimos movimentos, Copiloto). Cada cartão é uma região com o seu título, e a ordem lida continua lógica.
- De 768 a 1023px: 2 colunas (aviso e Copiloto a largura toda, os outros dois a dois).
- Capturas: FinApp-capturas/grelha/{antes,depois}-inicio-{1180,1440,1920}-{escuro,claro}.png e *-1440-claro-webkit.png.

## H3 — Análise (GrelhaAnalise) + verificações pendentes

- ≥ 1024px: Taxa (4) e "vs média" (4) empilhados à esquerda, com o gráfico de linhas (8) a ocupar as 2 linhas (`grid-row: span 2`) e a crescer até essa altura (a legenda e o eixo ficam no cartão, a área do gráfico estica); por baixo, Gasto por semana 4 | Categorias 4 | Maiores gastos 4, bordas alinhadas e mesma altura (as barras das semanas crescem; as listas ficam no topo). O seletor 3/6/12 fica à direita do título. De 768 a 1023px: 2 colunas pela ordem do DOM.
- O DOM passou a ter a ordem do telemóvel (taxa, linhas, vs média, semanas, categorias, maiores): sem os wrappers de coluna e sem `order`; nas telas largas cada cartão tem posição explícita na grelha (a ordem visual difere da lida só aí, anotado). O teste da ordem das secções foi ajustado (a ordem é a da prévia).
- Transbordo horizontal (pedido do planejador): a 1024, 1100, 1180, 1280, 1366, 1440 e 1500px, `scrollWidth = clientWidth` e nenhum elemento passa da janela, também com o cenário de taxa negativa e valores longos. O corte da captura do Gabriel não se reproduziu; a grelha de 12 colunas (`minmax(0, 1fr)`, `min-width: 0` nos cartões) deixa de depender das larguras fixas de antes.
- G1/G2 recapturados: g1-negativo-1440-escuro.png e g1-negativo-390-claro.png (taxa "−67%", anel vazio, "Gastou € 930 a mais do que recebeu", Sobra "−€ 930" com chip "▼ € 2.095", categoria nova com chip em euros). O texto "−67%" do anel passa a corpo menor (7,6) para caber dentro do anel.
- Capturas: FinApp-capturas/grelha/{antes,depois}-analise-{1180,1440,1920}-{escuro,claro}.png e *-1440-claro-webkit.png.

## H4 — Despesas (GrelhaDespesas), o padrão das páginas de lista

- `Pagina` ganhou a prop opcional `painel`: no telemóvel é a sequência de sempre (título, painel, conteúdo); a partir de 1024px é a grelha de 12 colunas: painel de 4 colunas à esquerda (título, quadro de resumo, abas Correntes/Fixas, Mês/Semana, seletor de semana e o botão "+") e lista de 8 à direita (o título "Movimentos", o seletor de ordem e a lista). Sem `painel` o markup é o de antes.
- Sticky: o painel fica colado abaixo do cabeçalho (`top: --topo-conteudo`) enquanto a lista rola, só em janelas com 720px de altura ou mais (o painel mede ~500px); abaixo disso NÃO fica sticky (o painel mais alto do que a janela ficaria com o fundo inacessível). A regra é por media query (altura da janela), não medida em JS.
- A linha Mês/Semana + "+" passa do cartão da lista para o painel só a partir de 1024px (`useMediaQuery`, o elemento é renderizado uma vez, num sítio ou no outro); no telemóvel fica no sítio de antes, por isso a ordem do DOM e do telemóvel não mudam.
- Verificado: 390px sem alteração; 1180/1440/1920 claro e escuro (separador Fixas a 1440 escuro: depois-despesas-fixas-1440-escuro.png); 1440x600 sem sticky: depois-despesas-1440x600-claro.png.
- Nota: com 8 colunas a lista de Despesas fica larga a 1920px (≈ 1000px); o valor fica longe do nome em linhas curtas. É o span que a prévia pede; se for demais, o próximo passo é limitar a largura da lista dentro das 8 colunas.
- Capturas: FinApp-capturas/grelha/{antes,depois}-despesas-{1180,1440,1920}-{escuro,claro}.png e *-1440-claro-webkit.png.

## H15 — o menos de verdade nas variações e nos valores

`rotuloVariacao` passa a escrever "−8%" (U+2212) e `formatMoney` escreve os valores negativos como "−€ 731,00" (antes "€ -731,00"), o padrão do app. Cobre todas as telas que usam estas duas funções (Despesas "vs setembro", Receitas, Transações "Saldo", Planejamento "Restam", Cartões…). O resumo que vai para a IA (copilotoResumo) mantém o hífen de sempre (texto simples). Testes atualizados: calculos, Planejamento, Transações (a linha do extrato também é "−€ 42,50", o teste aceita as duas e confirma que "€ -42,50" já não existe). Não mexi na cor do "Total do mês" de Despesas (à espera do Gabriel).

## H5 — Receitas (padrão de lista)

Painel s4: título, quadro de resumo e a linha Mês/Semana + seletor de semana + Adicionar (esta só passa do cartão da lista para o painel a partir de 1024px; no telemóvel fica onde estava). Lista s8: título Lançamentos, seletor de ordem e lançamentos. Sticky como em Despesas (≥720px de altura). Telemóvel 390px igual.

- Capturas: FinApp-capturas/grelha/{antes,depois}-*-{1180,1440,1920}-{escuro,claro}.png, *-1440-claro-webkit.png; telemóvel (390 claro) antes e depois iguais.

## H6 — Transações (padrão de lista)

Painel s4: título e quadro (Entradas/Saídas/Saldo); lista s8: contagem + filtro + extrato por dia (e o paginador). Sticky como em Despesas. Telemóvel 390px igual.

- Capturas: FinApp-capturas/grelha/{antes,depois}-*-{1180,1440,1920}-{escuro,claro}.png, *-1440-claro-webkit.png; telemóvel (390 claro) antes e depois iguais.

## H7 — Parcelas (padrão de lista)

Painel s4: título e quadro (Total do mês, Falta pagar, Restante, Parcelas ativas); s8: cabeçalho com filtro e +, cartões, Quitadas e Serviços de parcelamento. Telemóvel 390px igual.

- Capturas: FinApp-capturas/grelha/{antes,depois}-*-{1180,1440,1920}-{escuro,claro}.png, *-1440-claro-webkit.png; telemóvel (390 claro) antes e depois iguais.

## H8 — Cartões (painel + cartões 4|4)

Decisão (a tela tem quadro, cartões/contas e transferências): padrão de lista, painel s4 = quadro de resumo; s8 = grade de cartões e contas em 2 colunas (cada um ocupa 4 da grelha de 12, intervalo de 16px, mesma altura por linha) + secção Transferências entre contas por baixo. Assim as bordas dos cartões alinham com as colunas da grelha. Telemóvel 390px igual (1 coluna).

- Capturas: FinApp-capturas/grelha/{antes,depois}-*-{1180,1440,1920}-{escuro,claro}.png, *-1440-claro-webkit.png; telemóvel (390 claro) antes e depois iguais.

## H9 — Veículo (padrão de lista)

Painel s4: título, quadro (Gasto do mês…) e as 5 abas (a pílula rola na horizontal se não couber); s8: aviso de sincronização e o conteúdo da aba. Telemóvel 390px igual.

- Capturas: FinApp-capturas/grelha/{antes,depois}-*-{1180,1440,1920}-{escuro,claro}.png, *-1440-claro-webkit.png; telemóvel (390 claro) antes e depois iguais.

## H10 — TVDE (painel: hero, resumo e abas)

Decisão (hero + quadro + abas): painel s4 empilha os três (o hero e o quadro são cartões da mesma largura, bordas alinhadas); s8 = conteúdo da aba (Semanas, Meses, Períodos, Extras e definições). Azul do TVDE mantido nos destaques. Telemóvel 390px igual.

- Capturas: FinApp-capturas/grelha/{antes,depois}-*-{1180,1440,1920}-{escuro,claro}.png, *-1440-claro-webkit.png; telemóvel (390 claro) antes e depois iguais.

## H11 — Calendário (grelha 12)

Linha 1: quadro de resumo s4 | botão + e calendário do mês s8 (mesma altura; o quadro fica no topo); linha 2: Próximos 7 dias s12 com os cartões em 3 colunas de 4 (2 colunas em 768–1023px). Telemóvel 390px igual.

- Capturas: FinApp-capturas/grelha/{antes,depois}-*-{1180,1440,1920}-{escuro,claro}.png, *-1440-claro-webkit.png; telemóvel (390 claro) antes e depois iguais.

## H12 — Planejamento (grelha 12)

Orçamento: quadro s4 | OrcamentoCard s8. Metas: linha 1 quadro s4 | meta do mês s8; linha 2 fundos s8 (cabeçalho + cartões, 2 por linha) | Últimos 12 meses s4. A ordem do DOM é a do telemóvel (a grelha usa a ordem natural). Nota: o título 'Fundos' fica acima dos cartões dos fundos e a coluna dos Últimos 12 meses começa uns pixels mais alto (o cabeçalho dos fundos não é um cartão); as bordas dos CARTÕES alinham à esquerda e à direita. Telemóvel 390px igual.

- Capturas: FinApp-capturas/grelha/{antes,depois}-*-{1180,1440,1920}-{escuro,claro}.png, *-1440-claro-webkit.png; telemóvel (390 claro) antes e depois iguais.

# Checks da página Análise

## D0 — apagar corBotaoRegistro

Apagados `src/utils/corBotaoRegistro.ts` e `corBotaoRegistro.test.ts` (decisão do Gabriel). `grep -rn "corBotaoRegistro\|estiloBotaoRegistro" src api` sem resultados. `cfg.categoriaCor` e `corDaCategoriaVisual` continuam a ser usados por outras telas, por isso ficam.

## D1 — cálculos (utils/analise.ts + testes)

Tudo reutiliza as contas existentes:

- `resultadoDoMes()` (novo, em resumoMensal.ts) = a conta que a Início fazia à mão (receitas por `totalDoMes(receitasNosTotais)`, despesa por `despesaRegistradaMes`); a Início passou a chamá-la, resultado idêntico. Teste: a Análise e a conta escrita à mão dão o mesmo número para o mesmo mês.
- `taxaPoupanca()` (novo, em metas.ts) = a fórmula do KPI "Taxa de Poupança"; Planejamento passou a usá-la (`?? 0`, comportamento igual). Receita 0 → `null` (a página mostra "—"), nunca NaN/∞.
- Média = `mediaDeMeses` (a do "Média (3 meses)") sobre os N meses ANTES do atual, só meses com história.
- Semanas: `semanasDoMes`/`naSemana`/`indiceDaSemana`. Categorias: `despesaPorCategoriaRegistradaMes` (a da folha "Categorias"). Maiores gastos: `transacoesDoMes` (a fonte dos "Últimos movimentos"), sem transferências, pagamentos de fatura e reembolsos.
- Casos de borda testados: sem dados, mês anterior ao primeiro dado, receita 0, média a 0, período maior que o histórico (12 meses com 4), só 1 mês de dados, fixa sem início.

DESVIOS / notas:

1. A taxa de poupança da Análise usa o fluxo de caixa (como o Resultado do mês da Início); a de Planejamento → Metas usa `despesaRealizadaMes` (cronograma). A FÓRMULA é a mesma, os valores de entrada podem diferir em meses com fixas/parcelas pagas fora do mês. Unresolved para o Gabriel decidir se unifica.
2. O primeiro mês de história (`primeiroMesDeDados`) não usa `primeiroMesComDespesa`: este trata uma fixa sem `inicio` como "desde sempre" (0000-01) e encheria a janela de meses vazios.
3. O "gasto por semana" soma os movimentos de saída do mês (mesma fonte dos Últimos movimentos); pode diferir uns cêntimos/valores do total de despesa do Resultado do mês quando há parcelas/fixas com datas diferentes do cronograma.

## D2 — página Análise

- Rota `/analise` (lazy), entrada em ABAS (sidebar ≥ 768px) e no "Mais" do iPhone, logo a seguir a Planejamento; o seletor de mês do cabeçalho passa a aparecer nela (`ROTAS_COM_MES`) e manda no "mês atual".
- Ícone: `IconeAnalise` (SVG inline, três barras, 24px/traço 2 como os Lucide). `AbaDef.Icone` passou de `LucideIcon` para o tipo mais largo `IconeAba` para o aceitar (os Lucide continuam a encaixar).
- Seletor 3/6/12 meses: `role="radiogroup"` com `useRadiogroupTeclado` sobre o `segmentado.module.css` (a pílula já existente). Padrão 6. Estado local da página: as outras vistas (Mês/Semana, abas) também são locais, não há padrão de preferência de vista guardada em `cfg`.
- Secções pela ordem da prévia: taxa de poupança (anel SVG, cartão terracota), receitas vs despesas, "<Mês> vs a sua média", gasto por semana, categorias mês a mês, maiores gastos. Dados reais, nenhuma biblioteca instalada.
- `ChipVariacao` (novo, reutilizável): ▲/▼ + percentagem, carmim = pior, teal = melhor, cinza = sem veredicto, texto escondido para leitores de ecrã ("12% acima da média, pior"); sem base de comparação não aparece. Para despesa e categoria subir é pior; para receita e sobra é descer.
- dataviz: eixos mínimos (3 linhas de grelha e o nome dos meses; sem eixo Y), rótulos ≥ 11px, `aria-label` com o resumo em texto em cada gráfico (linhas, semanas, anel), legenda com o nome além da cor, marcadores do último ponto em HTML (o SVG estica e o círculo ficaria oval). Cores só de tokens (teal = `--grn`, terracota = `--blu`).
- Modo discreto: os valores em € levam `discreto`; as barras semanais também.
- Estado vazio (sem dados até ao mês): `EstadoVazio`. Com dados mas sem histórico, a página mostra o que dá (taxa, semanas, categorias, maiores gastos) e uma nota; o gráfico e a comparação com a média só aparecem com 2+ meses.
- Grelha: 1 coluna no telemóvel (ordem da prévia: taxa, linhas, vs média, semanas, categorias, maiores); 2 colunas a 768–1023px; ≥ 1024px [taxa + vs média | linhas + semanas] em cima (1fr/1,5fr) e [categorias | maiores gastos] por baixo (1,5fr/1fr), como o AnaliseIpad.
- `Pagina` ganhou a prop opcional `acao` (o seletor, à direita do título nos ecrãs largos e por baixo no telemóvel); sem ela, o markup é o de antes.

DESVIOS / unresolved:

1. A prévia do iPad põe o primeiro cartão num 3.º de largura com um grid aninhado; implementei duas colunas (1fr/1,5fr) em vez de copiar a aninhação, que ficava com ~380px para os dois cartões da esquerda.
2. A escala do gráfico de linhas começa em 0: com meses parecidos as linhas ficam quase planas (honesto, mas pouco expressivo). Sem tooltip/valor ao tocar nos pontos.
3. A taxa de poupança aqui usa o fluxo de caixa; a de Planejamento → Metas usa a despesa por cronograma (nota do D1).
4. Texto novo desta página (inevitável): "Ainda não há dados para analisar", "Sem receitas neste mês", "Com mais um mês de histórico aparecem aqui…", "este mês" no cabeçalho das categorias com 1 só mês.
5. Capturas e WebKit: FinApp-capturas/analise/.

## D3 — capturas e fecho

Capturas em ~/Projetos/Dev/FinApp-capturas/analise/ (Chromium): analise-390-claro, analise-390-escuro, analise-320-claro, analise-820-claro (2 colunas), analise-1180-claro, analise-3meses-390-claro, analise-12meses-390-claro (só 6 meses de histórico: a janela encolhe), analise-borda-1mes-390-claro (um mês de dados, receita 0, nome de categoria comprido), analise-vazio-390-claro, analise-menu-mais-390-{claro,escuro}. WebKit: analise-390-claro-webkit, analise-1180-claro-webkit, analise-12meses-390-claro-webkit, analise-borda-1mes-390-claro-webkit (o anel e os gráficos desenham-se bem). HISTORICO.md atualizado.

## E1 — espaço por baixo do conteúdo (FAB)

Diagnóstico: a 1180px o AppShell já guardava 96px por baixo (= 56 do FAB + 24 de margem + 16), por isso o FAB não cobre o último cartão quando se rola até ao fim (capturas e1-antes-*-1180-fim.png, com a página rolada até ao fim). O "€ 89,00" tapado em analise-1180-claro era um artefacto da captura de página inteira, que desenha o FAB (fixo) na posição do primeiro ecrã, a meio da página. Mesmo assim, os 96px estavam escritos à mão, separados do tamanho do FAB: novos tokens `--fab-tam` (56px) e `--fab-margem` (24px) em tokens.css, usados pelo Fab.module.css e pelo `padding-bottom` do AppShell (`calc(--fab-tam + --fab-margem + 16px)`), para nunca se desencontrarem. Resultado igual (96px). Capturas e1-depois-{analise,inicio,despesas}-1180-fim.png.

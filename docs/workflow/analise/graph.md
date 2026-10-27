# Grafo da página Análise

Prévias: canvas https://claude.ai/artifact/Rd6hdbYJfiid6wyjq7Ed1W, boards AnaliseIphone e AnaliseIpad (y 5400). Os números da prévia são de exemplo: aqui só dados reais. Regras: um commit por nó (format, lint, test, build, push); desvios anotados no checks.md antes do commit; capturas em FinApp-capturas/analise/. Sem bibliotecas novas; gráficos em SVG à mão. Fora de âmbito: o cartão "Ver análise" na Início e outras telas.

- D0 Apagar src/utils/corBotaoRegistro.ts e o teste (grep sem referências)
- D1 Cálculos puros em utils (+ testes): receitas/despesas por mês (as mesmas da Início), taxa de poupança (a mesma do KPI de Planejamento), mês vs média, gasto por semana, categorias mês a mês, maiores gastos
- D2 Página Analise.tsx + rota, entrada no "Mais" e na sidebar depois de Planejamento, seletor 3/6/12 meses, gráficos SVG, chip de variação, estado vazio, modo discreto, grelha ≥ 1024px
- D3 Capturas (390 claro/escuro, 320, 1180, WebKit, borda) + HISTORICO.md

Arestas: D1 → D2 → D3.

# Grelha alinhada nas telas largas (fase H)

Prévias: canvas https://claude.ai/artifact/Rd6hdbYJfiid6wyjq7Ed1W, boards GrelhaInicio, GrelhaAnalise, GrelhaDespesas (y 7000). Só ≥ 1024px; de 768 a 1023px, 2 colunas com as mesmas regras; telemóvel e ordem do DOM não mudam.

Regras: 12 colunas, gap 16px, partilhadas por todas as linhas; cada cartão num span fixo (12, 8/4, 6/6, 4/4/4); cartões da mesma linha com a mesma altura (stretch), conteúdo no topo, rodapés colados em baixo, gráficos a crescer; nada de masonry nem colunas independentes; conteúdo até ~1320px encostado à sidebar, cabeçalho a acompanhar.

- H1 utilitário partilhado (styles/grelha.module.css) + largura máxima do conteúdo
- H2 Início
- H3 Análise (inclui verificar o transbordo horizontal e recapturar G1/G2)
- H4 Despesas (padrão de lista: painel esquerdo sticky 4 | lista 8)
- GATE: parar e reportar. Receitas, Transações, Parcelas, Cartões, Veículo, TVDE (lista) e Calendário, Planejamento, Definições (grelha) só depois de liberadas.

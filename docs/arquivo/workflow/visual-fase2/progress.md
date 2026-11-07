# Progresso

- Feitos: N1, N2, N3, N7, N4, N5, N6
- A rodar: nada (grafo concluído; falta HISTORICO.md e o relatório)
- Bloqueados: —
- Ficheiros alterados: N1 (Pagina, KpiCard, testes); N2: utils/calculos.ts (`nomeDoMes`), Despesas.tsx, Receitas.tsx + testes; N3: ListaLancamentos.tsx + testes; N4: Despesas.tsx/.module.css, styles/secoes.module.css, Pagina.module.css, ErroSincronizacao.module.css; N6: Transacoes.tsx/.module.css/.test.tsx; N5: Receitas.tsx, Receitas.module.css (novo), Receitas.test.tsx; N7: SeletorOrdem.tsx (reescrito, sem .module.css), SeletorOrdemFolha.tsx/.module.css (`gatilho="texto"`), SeletorOrdem.test.tsx, Receitas.test.tsx
- Decisões: ordem N1, N2, N3, N7, N4, N5, N6. KpiCard clicável vira botão. `nomeDoMes` novo. A regra "2+" conta todos os itens do dia. N7 reaproveita a folha de Parcelas em vez de inventar um menu novo.
- Pendências para o Gabriel: (1) ordenar passa a ser 2 toques; (2) Despesas ganhou o título de secção "Movimentos" (como na prévia) para alinhar a ordem; (3) EstadoVazio/ErroSincronizacao sem caixa em TODAS as telas; (4) Receitas: o botão "Adicionar" passou do cabeçalho da lista para a linha Mês/Semana (a ordem ocupou o lugar dele ao lado do título); (5) Transações: saídas com "−" mas sem vermelho; o título da secção é a contagem ("11 transações", e "1 transações" no singular já era assim antes); (6) "Orçamento por categoria" mora em Planejamento, não foi tocado.
- Próximo nó: HISTORICO.md + relatório final

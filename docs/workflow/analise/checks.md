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

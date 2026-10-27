# Grafo da Fase 2 do visual novo

Prévia aprovada: canvas https://claude.ai/artifact/Rd6hdbYJfiid6wyjq7Ed1W, boards "ResumoReceitas" e "ResumoDespesas" (y 3300, coluna "Proposta").

Regras: um commit por nó (format → lint → test → build). Checks determinísticos primeiro, depois visual a 320px e 390px, escuro e claro. Máximo 3 rodadas por nó. Fora do escopo: services/, stores/, Firebase e cálculos. "Mostrar mais" vs Paginador e o "+" redondo junto às abas ficam como estão. Qualquer mudança visual não listada vai para Pendências.

N1 — Quadro de resumo em linhas (Pagina.tsx Kpis + KpiCard + Pagina.module.css/KpiCard.module.css)
input: grelha .colunas de 3 colunas | output: KPIs secundários como linhas dentro do QuadroResumo

- Cada linha: rótulo (14px, --txt) à esquerda com o detalhe (sub, 12px, --mut) por baixo; valor (15px/600, cor do tom, tabular-nums) à direita. min-height 44px, fio fino (--mut 15%) por cima de cada linha, primeira linha com margin-top 16px. Sem reticências no rótulo: o texto quebra se precisar, o valor nunca quebra.
- Remove a lógica de COLUNAS/linhas de 3. O aoClicar continua (a linha inteira vira botão).
- Número grande, rótulo do quadro e NotaDoQuadro ficam iguais.
  check: testes de Kpis/KpiCard atualizados e a passar; a 320px nenhum rótulo cortado ("Abastecimentos", "Líquido (−custos)" visíveis por inteiro); afeta todas as páginas com Kpis — confira cada uma.
  N2 — Textos dos KPIs secundários mais curtos (depende de N1)
- "vs mês passado": sub passa de "set 2026: € X" para "era € X"; o RÓTULO visível passa a "vs <mês por extenso>" (ex. "vs setembro"), mantendo chave="vs mês passado" para não partir a escolha do destaque (ver comentário em constants/kpis.ts).
- "Média (3 meses)": sub só quando há menos de 3 meses ("só 2 meses de dados"); com 3, sem sub.
- Veja as outras páginas e encurte subs do mesmo tipo (com rótulo + ":" + valor) seguindo o mesmo padrão. Liste cada mudança no checks.md.
  check: grep sem `${rotuloMes(...)}: ` em subs de KPI; testes a passar.
  N3 — Total do dia só com 2+ movimentos (ListaLancamentos)
- O cabeçalho do dia mostra o total apenas quando o grupo tem 2 ou mais itens; com 1, só a data.
  check: teste novo no ListaLancamentos.test.tsx (dia com 1 item sem total, com 2 com total).
  N4 — Despesas no visual novo (depende de N1-N3)
- Cartões secundários (ex. "Orçamento por categoria") passam a secção sem cartão: título 17px/600, 12px até à lista, linhas com fio fino, 36px entre secções. O conteúdo e as ações ficam todos.
- EstadoVazio no estilo novo (sem caixa).
  check: nenhum cartão s1 além do quadro de resumo (grep/inspeção), a 320px e 390px.
  N5 — Receitas no visual novo (mesmas regras de N4)
  N6 — Transações no visual novo (mesmas regras de N4; o total do dia aqui é o líquido, e a regra 2+ vale igual)
  N7 — SeletorOrdem restilizado no padrão da prévia DespesasEscuro: texto --mut 14px/500 com chevron, sem caixa, alinhado ao título da secção. Comportamento e acessibilidade iguais.
  check: teclado e leitor de ecrã continuam (testes existentes a passar).

ARESTAS: N1→N2; N1,N2,N3→N4,N5,N6; N7 independente (pode ir antes de N4).

ENTREGA: resumo curto: nó | commit | veredito, o que ficou unresolved e as pendências para o Gabriel decidir. Só testado no Chrome (Safari não testado).

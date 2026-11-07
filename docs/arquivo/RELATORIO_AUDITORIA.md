# Relatório de auditoria — FinApp

Data: 26/07/2026
Base: commit `b355053` (antes da auditoria)

Este arquivo não faz parte do app. É só o registo do que foi procurado, do que
foi encontrado e do que ficou de fora, para leitura posterior.

---

## Parte 1 — Bugs confirmados de filtro de mês (corrigidos)

Commit: `0ce8d61`

### 1.1 Veículo · aba "Despesas" — mostrava todos os tempos

`src/pages/Veiculo.tsx` (aba `despesas`) fazia `dados.despesas` → `.sort()` →
`.map()`, sem nenhum filtro. A aba "Resumo", logo ao lado, filtrava certo com
`.filter((d) => mesDe(d.data) === mes)`. Resultado: a mesma despesa aparecia em
todos os meses, e o KPI "Despesas" no topo (que já era do mês) nunca batia com a
lista embaixo.

**Corrigido**: lista passa por `despesasVisiveis` (filtrada pelo mês do topo).

### 1.2 Veículo · aba "Km" — mostrava todos os tempos

Mesmo padrão, em `dados.quilometragem`.

**Decisão**: filtrar, e não manter como histórico cumulativo. A dúvida era se km
seria um odômetro (leitura acumulada, faz sentido ver o histórico inteiro) ou um
incremento por registo. O código responde: `Veiculo.tsx:64` calcula o KPI
`kmDoMes` **somando** `k.km` das entradas do mês —

```ts
const kmDoMes = dados.quilometragem
  .filter((k) => mesDe(k.data) === mes)
  .reduce((s, k) => s + k.km, 0);
```

Somar leituras de odômetro não significaria nada; somar incrementos sim. Logo km
é uma entrada do mês como qualquer outra, e a lista tem que casar com o KPI que
está logo acima dela. Ver o histórico = trocar de mês no topo.

### 1.3 Veículo · abas "Fixas" e "Resumo" — estado vazio mentia

Efeito colateral do mesmo descuido, achado durante a correção: o estado vazio
testava o total de **todos os tempos** (`dados.despesasFixas.length === 0`,
`dados.cargas.length === 0 && dados.despesas.length === 0`) mas a lista logo
abaixo era filtrada pelo mês. Num mês sem nada, mas com dados em outros meses, a
condição dava `false` e a tela renderizava uma lista vazia — sem itens e sem
mensagem nenhuma.

**Corrigido**: o estado vazio olha a lista já filtrada, e o texto distingue os
dois casos ("Nenhuma despesa do veículo em julho 2026" vs. "…ainda").

### 1.4 Calendário · detalhe do dia ficava preso no mês antigo

`src/pages/Calendario.tsx`: `diaSelecionado` não era limpo quando o mês do topo
mudava. Com a folha de detalhe aberta, trocar de mês no header mantinha na tela
um dia que já não pertence ao mês exibido.

**Corrigido**: trocar de mês fecha a folha, usando o mesmo padrão de reset que
Despesas e Veículo já usavam para o índice da semana.

---

## Parte 2 — Varredura sistemática das telas com seletor de mês

O seletor de mês só existe em 6 rotas (`src/layout/Header.tsx:13-20`):
`/receitas`, `/despesas`, `/cartoes`, `/veiculo`, `/calendario`, `/transacoes`.
Isso delimita a auditoria: nas outras telas (Início, Metas, Planejamento,
Parcelas, TVDE) não há mês escolhido, e usar o mês real de hoje é o
comportamento correto, não um bug.

Varredura: toda lista que sai de um store (`useXStore((s) => s.itens)` ou
`.dados`) e chega a um `.map()` — conferindo se passa por `doMes`, `mesDe`,
`naSemana` ou `fixaAtivaNoMes` no caminho.

| Rota          | Listas                  | Situação                                                                                                    |
| ------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| `/receitas`   | 1                       | OK — `doMes(itens, mes)` (`Receitas.tsx:21`)                                                                |
| `/despesas`   | 3 abas                  | OK — correntes via `doPeriodo` (:113), fixas via `fixaAtivaNoMes` (:379), transferências via `doMes` (:426) |
| `/cartoes`    | faturas + resumos       | OK — `calcularFatura(c, mes, …)` (:195), `resumosDasContas(…, mes)` (:196)                                  |
| `/veiculo`    | 5 abas                  | **4 problemas, corrigidos** (Parte 1)                                                                       |
| `/calendario` | grid + dia + próximos 7 | grid e dia OK; **detalhe do dia corrigido**                                                                 |
| `/transacoes` | 1                       | OK — `transacoesDoMes(dados, mes)` (:55)                                                                    |

### Exceções legítimas encontradas (não são bugs)

- **Calendário · "Próximos 7 dias"** (`Calendario.tsx:152`): ancorado em `hoje`,
  não no mês exibido. É uma secção com título explícito, o mesmo tipo de exceção
  que a visão "Semana" — o utilizador lê o rótulo e sabe o que está a ver.
- **Cartões · "Saldo atual"** (`utils/contas.ts:87-96`): acumulado de caixa
  desde o saldo inicial, deliberadamente de todos os tempos e documentado no
  cabeçalho do ficheiro. O rótulo diz "atual", não "do mês".
- **Início e Planejamento** usam `mesAtual()` (`DonutCategoriaCard.tsx:41`,
  `OrcamentoCard.tsx:17`): correto, essas rotas não têm seletor de mês.
- **Metas · fundos** (`Metas.tsx:188`): um fundo é um saldo acumulado, não uma
  transação com data — não há mês pelo qual filtrar.
- **Parcelas**: cada parcela é um plano que atravessa vários meses, e a rota não
  tem seletor. Listar todas (ativas/quitadas) é o propósito da tela.

---

## Parte 3 — Revisão multi-ângulo (council)

Três ângulos, em paralelo: consistência de cálculo, UX e visual. Todo achado
abaixo foi reconferido no código antes de virar correção — dois deles não
sobreviveram à reconferência e estão na Parte 4.

### Corrigidos — consistência de cálculo

**3.1 · Copiloto não somava as despesas fixas** (`utils/copiloto.ts`)
`totaisDoMes` somava correntes + parcelas + veículo, mas nunca chamava
`contribuicaoFixasMes`. O Copiloto vive no Início, logo abaixo do KPI
"Despesas" — perguntar "quanto gastei este mês" devolvia um número menor que o
card acima, pelo valor inteiro das fixas gerais. O mesmo furo em
`categoriasDoMes` fazia as respostas por categoria divergirem do donut e do
orçamento. `ContextoCopiloto.despesasFixas` era opcional "para não quebrar
chamadores"; agora é obrigatório, porque sem ele o número principal fica errado
em silêncio.

**3.2 · "Poupança" do Início e "Total geral" de Despesas nunca batiam**
(`pages/Inicio.tsx`) A Poupança usava `saldoTotal(receitas, despesas)` com a
lista crua: contava pagamento de fatura (`fat`) como despesa por cima da compra
original, contava ajustes de reconciliação (`recon`), e contava parcela pelo
espelho em vez do plano — enquanto `Despesas.tsx` já fazia
`despesasNosTotais` + `totalParcelasGeral`. Dois números para a mesma ideia.
Agora seguem o mesmo caminho.

**3.3 · Em Despesas, o rodapé da lista contradizia o KPI acima dele**
(`pages/Despesas.tsx`, `components/ListaLancamentos.tsx`) A lista mostra
pagamento de fatura e espelho de parcela de propósito (com a origem indicada) —
mas o rodapé "Total &lt;mês&gt;" somava todas as linhas, incluindo essas. Na
mesma tela, "Total do mês" no topo e "Total julho 2026" no rodapé davam valores
diferentes. `ListaLancamentos` ganhou um `total` opcional para o caso em que o
rodapé não é a simples soma das linhas; Receitas continua somando as linhas.

### Corrigidos — UX

**3.4 · Transações afirmava "Nada movimentado" durante o carregamento**
(`pages/Transacoes.tsx`) O estado vazio não checava `carregado`. Como o extrato
junta seis stores, agora só aparece quando todas responderam.

**3.5 · Despesas/Fixas com estado vazio mentindo** (`pages/Despesas.tsx`)
Mesmo bug da Parte 1.3, na outra tela: o vazio testava
`despesasFixas.length === 0` mas a lista filtrava por `fixaAtivaNoMes`. Com
fixas já terminadas, a aba ficava em branco absoluto.

**3.6 · Categoria padrão do registo rápido dependia da POSIÇÃO na lista**
(`layout/RegistroRapido.tsx`) Sem categoria escolhida, caía em
`opcoes[opcoes.length - 1]`. Isso dá "Outros" só por acidente da ordem padrão —
qualquer categoria criada em Definições entra no fim da lista e passa a receber
os lançamentos sem categoria. Agora procura "Outros" por nome.

**3.7 · Ações mudas** Adicionar/remover categoria (`pages/Definicoes.tsx`) não
davam confirmação nenhuma, num app que confirma tudo o resto; desmarcar um dos
2 KPIs fazia `return` silencioso sem explicar o limite; nome vazio em
Definições e Cartões fazia o botão não responder sem dizer porquê; "Novo
extrato" (`pages/Importar.tsx`) descartava todas as linhas analisadas e as
categorias ajustadas à mão, sem confirmar.

**3.8 · Acessibilidade** Inputs só com `placeholder` ganharam `aria-label`
(`pages/Cartoes.tsx`, `pages/Definicoes.tsx`).

**3.9 · Rótulo do KPI do Calendário** "Eventos este mês" contava o mês do
seletor mas dizia "este mês". Agora diz o mês.

### Corrigidos — visual

**3.10 · Despesas e Receitas ficaram para trás na mudança dos ícones**
(`components/ListaLancamentos.tsx`) Transações, o donut, o seletor de categoria
e Definições já mostram a bolha colorida com ícone; as duas telas do dia a dia
mostravam a categoria como texto cinza. `ItemLista` ganhou um `categoria`
opcional (o nome puro, sem a nota) e a linha ganhou a bolha.

**3.11 · `color: #fff` cravado no seletor de cor**
(`components/SeletorAparencia.module.css`) Era o único hex hardcoded nos 38
módulos CSS, e contradizia a própria util do app: nas cores claras da grade
(`#eab308`, `#fbbf24`, `#84cc16`) o ✓ branco ficava ilegível. Agora usa
`corDoIconeSobre()`, a mesma função das bolhas.

**3.12 · Número grande de Metas sem `tabular-nums`**
(`pages/Metas.module.css`) Os outros números grandes do app têm; este tremia ao
atualizar.

---

## Parte 4 — Anotado, sem corrigir

Coisas reais, mas grandes ou ambíguas demais para mexer sem confirmação.

**4.1 · `onValue` sem callback de erro** — ✅ **RESOLVIDO** (26/07, ver secção
"Resolvido depois" no fim). O resto deste item fica como registo do que era.

**4.1 (registo original) · `onValue` sem callback de erro** — nenhum dos seis serviços
(`lancamentosService.ts:42`, `cfgService.ts:18`, `eventosService.ts:17`,
`fundosService.ts:17`, `tvdeService.ts:73`, `veiculoService.ts`) trata erro de
subscrição. Falha de regra ou de rede deixa "Carregando…" para sempre em
Receitas/Despesas e vazio silencioso no resto, sem nunca avisar. É a causa-raiz
de qualquer tela travada em branco. **Não corrigido** porque a decisão não é
mecânica: o que fazer no erro (marcar `carregado` e mostrar vazio? manter o
spinner e mostrar um toast? tentar de novo?) muda o comportamento de toda a app
e merece ser escolhido, não adivinhado.

**4.2 · Extrato: fixa só conta se paga, parcela conta sempre**
(`utils/transacoes.ts:103` vs `:117`) Em mês fechado, o KPI "Saídas" de
Transações fica abaixo do "Total do mês" de Despesas exatamente pelas fixas não
marcadas. A regra "mês fechado conta cheio" não chegou ao extrato. **Não
corrigido**: há uma decisão de produto por trás — um extrato lista movimento
real (e aí nem a parcela não paga devia entrar) ou compromisso do mês (e aí a
fixa devia entrar)? Hoje faz um de cada. Também foi pedido explicitamente que
`transacoes.ts` não fosse mexido.

**4.3 · Donut: fixas contam cheias no mês corrente, parcelas só se pagas**
(`utils/despesaPorCategoria.ts`) O cabeçalho do ficheiro documenta a escolha
das fixas ("o donut mostra o compromisso do mês"), e a regra
corrente/fechado das parcelas foi pedida explicitamente. A mistura é
coerente com o que foi pedido, mas as duas metades do mesmo gráfico seguem
regras diferentes. Vale decidir qual das duas o donut deve seguir.

**4.4 · Transferência entre contas próprias infla "Saídas"**
(`utils/transacoes.ts:133-146`) Entra como saída sem a entrada
correspondente, então Entradas − Saídas não bate com o saldo de mês nenhum.
Num extrato por conta faria sentido; no agregado, engana.

**4.5 · `window.prompt` em TVDE** (`pages/Tvde.tsx:303`) Único do app, no meio
de uma interface toda em bottom sheets.

**4.6 · Navegação de Transações não abre a aba certa**
(`pages/Transacoes.tsx`) "Abrir em Veículo → Carregamentos" faz só
`navegar("/veiculo")` e cai na aba Resumo. A aba é estado local da página; levar
o destino junto pede um parâmetro de rota.

**4.7 · Cosmético, deixado como está** — nove botões "+ Adicionar" usam o sinal
`+` em texto onde o padrão novo é o ícone `Plus` do lucide; `badgeToggle` está
duplicado byte a byte entre `Despesas.module.css` e `Veiculo.module.css` (vetor
de divergência futura, não divergência hoje); `Calendario.module.css` usa `9px`
onde `var(--r-sm)` é exatamente 9px, e 14px de padding no vazio contra 18px das
outras telas.

**4.8 · Código morto** (`components/ResumoAnual.tsx`) O branch `futuro ? 0`
nunca dispara: `mesesRecentes(meses, real)` não produz mês maior que `real`.

### Levantado pelo council e descartado na reconferência

- **"`ResumoAnual` esconde compromisso futuro"** — não é bug: a função nunca
  recebe mês futuro, então o branch é inofensivo (virou 4.8, código morto).
- **"Arredondamento de centavos pode perder resto"** — conferido e correto:
  `valorBaseDaParcela` devolve o resto às primeiras parcelas e `paradasDonut`
  fecha em 100% a partir dos valores exatos, não dos percentuais arredondados.
- **"Telas usam mês real quando deviam usar o exibido"** — conferido: as seis
  rotas com seletor leem `useMesVisivelStore`; `mesAtual()` só aparece em
  Início, Metas e Planejamento, que não têm seletor.

---

## Resolvido depois da auditoria

### 4.1 · Erro de sincronização deixava a tela presa em "Carregando…"

Decisão tomada: em erro, parar de esperar e mostrar um aviso **distinto** do
vazio, com botão de tentar de novo; dados já carregados continuam visíveis.

O que foi feito:

- os 6 services passam agora o `cancelCallback` do Firebase (3º argumento do
  `onValue`) — `observarVeiculo` passa nas suas 4 sub-coleções, porque
  qualquer uma que caia deixa o `DadosVeiculo` combinado incompleto;
- cada store ganhou `erro: boolean`. Ele fica **fora** da persistência
  (`partialize`): `erro` descreve a subscrição desta sessão, não os dados, e
  como "Tentar novamente" recarrega a página, um `erro: true` gravado faria o
  aviso reaparecer no arranque seguinte antes de a nova subscrição responder;
- no `syncService`, erro marca `erro: true` + `carregado: true` sem tocar nos
  dados; sucesso limpa `erro`, então uma ligação que volta sozinha apaga o
  aviso;
- `ErroSincronizacao` em duas formas: caixa cheia (mesma silhueta do
  `EstadoVazio`, em tom de alerta) quando não há nada para mostrar, e tira
  fina por cima da lista quando ainda há dados;
- `cfg` acende uma faixa global (`FaixaErroSync`, entre o header e a TabBar),
  por ser o único domínio usado em toda a app;
- 9 testes novos (`syncService.test.ts`) com o `firebase/database` trocado por
  um duplo que guarda os dois callbacks de cada `onValue`.

**Desvio do que foi pedido, deliberado:** o pedido dizia `erro` →
`ErroSincronizacao` **antes** de tudo na ordem de renderização. Aplicado à
letra, isso esconderia uma lista que ainda tem dados válidos — contradizendo a
própria decisão do enunciado ("dados já carregados continuam visíveis"). A
caixa cheia entra no lugar do **estado vazio**; havendo dados, entra a tira
fina por cima da lista.

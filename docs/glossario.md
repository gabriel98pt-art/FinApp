# Glossário do domínio

Escrito a partir da leitura do código. Se divergir do código, vale o código: corrija o documento.

Termos como aparecem na app e no código (`src/types/`, `src/utils/`, `src/stores/`, `src/constants/`). Entre parênteses o nome técnico. Onde o código não chega para ter a certeza, está «confirmar».

## Dinheiro e tempo

| Termo                   | Significado (no código)                                                                                                                                                                                                                                                          |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cêntimos (`Cents`)      | Todo o dinheiro é guardado em inteiros de cêntimos (1 € = 100). Nunca somar números com vírgula. Conversão e formato em `utils/money.ts`                                                                                                                                         |
| Moeda (`Currency`)      | EUR, BRL, USD ou GBP. Só muda o símbolo: o formato `1.234,56` é o mesmo para todas. Negativo escreve-se com «−» (U+2212) antes do símbolo                                                                                                                                        |
| `IsoDate` / `YearMonth` | Data `YYYY-MM-DD` e mês `YYYY-MM`, sempre em texto, para fugir a problemas de fuso                                                                                                                                                                                               |
| Mês visível             | O mês que as telas que navegam por mês mostram (`useMesVisivelStore`). É partilhado: mudar o mês em Cartões e abrir Veículo mostra o mesmo mês. Não é guardado; cada sessão começa no mês real. Início, Parcelas, TVDE e Metas têm conceitos de período próprios e ficam de fora |
| Hoje                    | `hojeIso()` em `utils/calculos.ts`: a data de hoje no fuso local do aparelho; `mesAtual()` deriva dela                                                                                                                                                                           |
| Modo discreto           | Opção (`cfg.modoDiscreto`) que desfoca valores sensíveis (classe `.discreto`). Há também o olho no topo para ocultar valores                                                                                                                                                     |
| Início da semana        | `cfg.diaInicioSemana` (0 = domingo a 6 = sábado): dia em que a semana começa nas grelhas de calendário e na visão Semana de Despesas e Veículo                                                                                                                                   |

## Lançamentos

| Termo                                | Significado (no código)                                                                                                                                                                                                                                          |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lançamento                           | Qualquer registo de dinheiro: receita, despesa corrente, despesa fixa, parcela, transferência, abastecimento ou despesa do veículo. O extrato geral do mês (`utils/transacoes.ts`) junta-os num feed só                                                          |
| Receita (`Receita`)                  | Entrada de dinheiro, com `fonte` (Salário, TVDE, Extra, Outros por omissão), pontual ou recorrente                                                                                                                                                               |
| Despesa corrente (`DespesaCorrente`) | Despesa variável do dia a dia, com categoria e, opcionalmente, conta/cartão                                                                                                                                                                                      |
| Despesa fixa (`DespesaFixa`)         | Despesa mensal recorrente (renda, assinaturas, seguro). Ativa entre `inicio` e `fim`; pago ou pendente mês a mês (`pagoPorMes`); pode ter dia de vencimento. Com `autoDebit`, conta como paga sem ninguém marcar. O Veículo tem as suas fixas, com a mesma forma |
| Transferência                        | Passagem entre contas (`de`, `para`). Uma saída contra um cartão de crédito entra no cálculo da fatura                                                                                                                                                           |
| Categoria                            | Rótulo de uma despesa. Uma lista só para fixas e correntes (`cfg.categoriasDespesa`). Ícone e cor escolhem-se por nome, em Definições. Renomear faz cascata pelos lançamentos (`utils/renomear.ts`)                                                              |
| Fonte de receita                     | O equivalente à categoria, do lado das receitas (`cfg.fontesReceita`)                                                                                                                                                                                            |
| Origem (`origem`)                    | Marca num lançamento gerado por outro fluxo: `parc` (parcela), `fat` (pagamento de fatura), `fixa` (fixa marcada como paga), `recon` (ajuste de reconciliação), `reemb` (reembolso). Evita contar duas vezes                                                     |
| Reembolso                            | Dinheiro que volta sobre uma despesa já lançada (o jantar em grupo). Guardado como despesa de valor negativo, na mesma categoria, com `origem: "reemb"`; não é receita. Pode apontar à despesa original (`reembolsoDeId`)                                        |
| Reconciliação (`recon`)              | Ajuste automático da importação bancária para acertar um saldo. Fica na lista mas fora dos totais                                                                                                                                                                |
| Nota                                 | Descrição livre, separada do nome curto em `descricao`                                                                                                                                                                                                           |
| Resultado do mês                     | O quadro de receitas, despesas e saldo do Início (`resultadoDoMes`). As telas de Metas e Análise usam as mesmas contas                                                                                                                                           |

## Cartões, contas e faturas

| Termo                           | Significado (no código)                                                                                                                                                                                                                                                          |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cartão / conta                  | Forma de pagar, de crédito ou de débito (`TipoCartao`: `credit`, `debit`). Só o crédito entra no fluxo de fatura. A aba chama-se Cartões                                                                                                                                         |
| Instituição                     | Banco ou emissor (`Instituicao`), com os seus métodos de pagamento. O nome muda à vontade; o `id` é estável e é o que fica gravado nos lançamentos                                                                                                                               |
| Método de pagamento             | Uma forma de pagar dentro de uma instituição: o crédito do Banco X, o débito da mesma conta. `contasCartoes` guarda os ids dos métodos; para mostrar o nome usa-se `nomeAtualDoMetodo`                                                                                           |
| Fatura (`FaturaCalculada`)      | Valor a pagar de um cartão de crédito num mês. É sempre calculada, nunca gravada: soma automática do ciclo (fixas, veículo, correntes, parcelas, transferências de saída). `devido` = valor manual, se existir, senão o automático; `restante` = `devido − pago`, nunca negativo |
| Ciclo da fatura                 | O período de compras que uma fatura cobre. Sem dia de fecho, é o mês civil anterior; com dia de fecho, o que se compra depois dele entra no ciclo do mês seguinte (`diaFechamentoFatura`)                                                                                        |
| Dia de fecho / vencimento       | `diaFechamentoFatura` (quando o ciclo fecha) e `diaVencimentoFatura` (quando a fatura se paga) por cartão. O vencimento é também o das parcelas em débito automático nesse cartão                                                                                                |
| Valor manual da fatura          | Substitui o cálculo automático (`cfg.faturaManual`, por cartão e mês)                                                                                                                                                                                                            |
| Pagamento de fatura             | Total ou parcial (`PagamentoFatura`). Cria um lançamento com origem `fat`; apagar o pagamento apaga esse lançamento. Estado pago/quitada em `cfg.faturasPagas`                                                                                                                   |
| Saldo inicial                   | Saldo de partida de uma conta (`cfg.saldosIniciais`), base do saldo das contas de débito                                                                                                                                                                                         |
| Débito automático (`autoDebit`) | Numa fixa ou parcela: sai do cartão sozinho. Conta como paga sem marcação e, na parcela, o débito mensal entra na fatura                                                                                                                                                         |

## Parcelas

| Termo               | Significado (no código)                                                                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Parcela (`Parcela`) | Uma compra parcelada: total, número de parcelas e mês da primeira. O valor de cada mês é a divisão exata em cêntimos, com o resto nas primeiras (55,99 em 3× = 18,67 + 18,66 + 18,66)      |
| Ajuste de um mês    | `overridePorMes`: valor manual de uma parcela específica                                                                                                                                   |
| Mês pago            | `pagoPorMes`: `true` = pago por fora da fatura (deixa de contar no débito das faturas seguintes); `"fatura"` = quitado pela própria fatura (continua a contar, para o histórico não mudar) |
| Quitação            | Pagar de uma vez as parcelas em aberto (`valorQuitacao`). `parcelaQuitada` diz se já não há nada em aberto                                                                                 |
| Intermediador       | Quem financia o parcelamento (Klarna, Scalapay…): lista do próprio utilizador (`cfg.intermediadoresParcelamento`)                                                                          |
| Débito mensal       | Quanto as parcelas em aberto pesam por mês (`debitoMensalDaParcela`)                                                                                                                       |

## Planeamento

| Termo            | Significado (no código)                                                                                                                                                                                                |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Planejamento     | Aba única com duas abas internas: Orçamento e Metas (antes eram duas telas)                                                                                                                                            |
| Orçamento        | Teto mensal por categoria (`cfg.orcamentos`) e, opcionalmente, um total mensal (`orcamentoTotalMensal`). Recorrente: vale todo mês. Estado de cada categoria em `utils/orcamento.ts`; «perto do teto» a partir de 80 % |
| Meta mensal      | Quanto se quer poupar por mês (`cfg.metaPoupanca`); progresso em `utils/metas.ts`                                                                                                                                      |
| Fundo (`Fundo`)  | Sub-meta, o «cofrinho»: `nome`, `alvo`, `atual` e `prazo` opcional (que permite a projeção do que é preciso por mês)                                                                                                   |
| Taxa de poupança | Parte da receita que sobra (`taxaPoupanca`, `taxaPoupancaReal`); há também a poupança dos últimos 12 meses                                                                                                             |
| Evento           | Item do calendário (`EventoCalendario`) com título, data e valor opcional. Alimenta os alertas de «próximos 7 dias»                                                                                                    |
| Calendário       | Mostra eventos e vencimentos (fixas, parcelas, faturas) por dia                                                                                                                                                        |
| KPI              | Número de resumo de uma página. Cada página tem um KPI em destaque (número grande), escolhido em Definições (`cfg.kpiDestaque`, chaves em `constants/kpis.ts`)                                                         |
| Análise          | Página com os gráficos e comparações do mês (`utils/analise.ts`), sem gráficos de biblioteca (SVG próprio)                                                                                                             |

## Copiloto e importação

| Termo              | Significado (no código)                                                                                                                                                                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Copiloto           | Assistente de perguntas em linguagem natural sobre as finanças. Camada 1: intents por padrões, determinística (`copiloto.ts`), com números de `copilotoPlano.ts`. Camada 2: IA opcional via função serverless `api/copiloto-ia.ts`, com `copilotoResumo.ts` a limitar o que sai |
| Intent             | Um tipo de pergunta que o Copiloto reconhece; a lista é ordenada e o primeiro que bate vence                                                                                                                                                                                    |
| Plano / cenário    | Respostas de planeamento do Copiloto (`gerarPlano`, `responderCenarios`)                                                                                                                                                                                                        |
| Tom do Copiloto    | `direto` ou `acolhedor` (`cfg.copiloto`); só existe se a pessoa o configurou                                                                                                                                                                                                    |
| Importação         | Trazer um extrato (CSV, texto colado ou PDF de Activo Bank, Wise, Revolut). Cada linha é classificada (receita, despesa, fatura, transferência), com confiança `high`/`medium`/`low`, e verificada contra duplicados                                                            |
| Duplicata          | `exact_duplicate`, `duplicate`, `possible` ou `new` (`StatusDuplicata`)                                                                                                                                                                                                         |
| Destino da linha   | Onde a linha vai parar ao confirmar: `lancamento`, `carga`, `transferencia_cartao`, `pagamento_fatura`                                                                                                                                                                          |
| Notificação / sino | Lembretes do topo: parcela, fixa, fatura ou orçamento já vencidos e por pagar. Nada é gravado: a lista é o retrato de agora. Tipos ativos em `cfg.notificacoesAtivas`                                                                                                           |

## TVDE e veículo

| Termo                                     | Significado (no código)                                                                                                                                                                                |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TVDE                                      | Transporte de passageiros em veículo descaracterizado (motorista de plataforma). Módulo opcional por conta (`cfg.showTvde`, desligado por omissão); tem a cor própria `--tvde`                         |
| Semana TVDE                               | A unidade central do módulo: numerada a partir de `inicioSemana1`; só o número é guardado (chave do mapa), as datas derivam-se. Fórmulas vêm de uma folha de cálculo real e não se mudam sem validação |
| Faturado (`fat`)                          | Faturação da semana: a base das contas                                                                                                                                                                 |
| Portagens (`port`), aluguer (`alu`)       | Custos da semana                                                                                                                                                                                       |
| Recarga frota (`recF`) / própria (`recP`) | Energia paga pela frota (descontada da receita) / paga pelo motorista (sai do lucro)                                                                                                                   |
| Gorjetas (`gorj`)                         | Só anotação: nunca entram no lucro                                                                                                                                                                     |
| Extra (`extra`)                           | Soma ao lucro                                                                                                                                                                                          |
| `pctFrota` / `pct`                        | % da frota; `pct` fica gravado na própria semana, por isso mudar a configuração não recalcula semanas antigas                                                                                          |
| Semana de teste (`teste`)                 | Conta como dinheiro real (mês, período, Segurança Social, receita) mas some de todos os indicadores de performance                                                                                     |
| Mês de pagamento                          | O mês onde cai o início da semana mais 7 dias; é o mês seguinte quando a semana acaba na virada (`mesDePagamento`)                                                                                     |
| Período                                   | Agrupamento de semanas (`periodoDaSemana`); o tamanho exato: confirmar                                                                                                                                 |
| Seg. Social (`segPorMes`)                 | Valor por mês de Segurança Social no módulo TVDE (`DadosTvde.segPorMes`). Confirmar o significado exato                                                                                                |
| Meta semanal / mensal TVDE                | `metaSem` e `metaMes` na config do TVDE                                                                                                                                                                |
| Veículo                                   | Módulo com abastecimentos, despesas, despesas fixas e quilometragem. Ligado por omissão (`cfg.showVeiculo`)                                                                                            |
| Tipo de veículo                           | `eletrico`, `combustao` ou `hibrido` (`cfg.tipoVeiculo`); decide os campos do abastecimento                                                                                                            |
| Abastecimento                             | Carga elétrica (kWh) ou de combustível (litros) com custo e local. Campo `frota` = pago pela frota: fica registado mas não é gasto próprio (`cargasProprias`)                                          |
| Local de carregamento                     | Lista guardada de postos/locais (`cfg.locaisCarregamento`), ordenada pelo uso real                                                                                                                     |

## Interface

| Termo          | Significado (no código)                                                                                                                                           |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Folha          | Janela que sobe de baixo (bottom sheet); a partir de 768px passa a diálogo centrado (confirmar no componente `BottomSheet`)                                       |
| Véu            | Fundo escuro atrás de folhas e diálogos (`--veu`, 45 % com blur)                                                                                                  |
| Registo rápido | O «+» da tab bar (e o FAB no ecrã largo), que abre a folha de registo (`layout/RegistroRapido`, `MenuRegistroRapido`)                                             |
| Tab bar / Mais | Barra de baixo no telemóvel: Início, Receitas, «+», Despesas, Mais. O Mais abre uma folha com as outras abas (`constants/abas.ts`)                                |
| Vidro          | O material translúcido das superfícies (`vidro.module.css`)                                                                                                       |
| Item A, K, 22… | Pedidos numerados do dono citados em comentários do código (por exemplo «item 14» = ordenação de listas, «item 22» = extrato geral). Sem lista central: confirmar |
| Seção N        | Referência ao spec antigo (`SPEC_REESCRITA_COMPLETA.md`, fora do git); por exemplo «seção 4.1» = fatura, «4.3» = parcelas, «4.4» = TVDE                           |
| Conta de teste | Conta usada para testar a app; as credenciais ficam num ficheiro local fora do git. Nunca escrever uid, e-mails ou chaves em `docs/`                              |

## Para confirmar

- Tamanho do «Período» TVDE e significado de `segPorMes`.
- Se a folha vira diálogo a partir de 768px (a TVDE Pro faz; na FinApp não verificado).
- Lista dos «itens» numerados do dono.

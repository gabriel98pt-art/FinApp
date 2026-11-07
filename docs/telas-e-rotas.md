Escrito a partir da leitura do código. Se divergir do código, vale o código: corrija o documento.

# Telas e rotas (`src/App.tsx`, `src/pages/`, `src/layout/`)

## Arranque (`App.tsx`)

`App` chama, **fora do gate de sessão** (valem também no Login): `useAplicarTema`, `useAplicarModoDiscreto`, `useAplicarCoresPersonalizadas`, `useAlturaTeclado`, `usePwaUpdate`, `useRecarregarChunkFalho`, `useIgnorarArquivoSolto`, `useCapturarErros`. Tudo vai dentro de `ErrorBoundary`.

`Conteudo` decide pelo `status` do `useAuthStore`:

| `status`      | Resultado                                                          |
| ------------- | ------------------------------------------------------------------ |
| `carregando`  | `null` (espera o Firebase restaurar a sessão; sem piscar)          |
| `deslogado`   | `<Login />` (sem router)                                           |
| (autenticado) | `BrowserRouter` > `Suspense` > `Routes`, tudo dentro de `AppShell` |

`AppShell` e todas as páginas são `lazy`. `Login` é importado de forma estática.

## Abas (`src/constants/abas.ts`)

`ABAS: AbaDef[]` (`id`, `rota`, `titulo`, `Icone`) é a fonte única da navegação. Ordem da barra desktop: Início, Receitas, Despesas, Veículo, Cartões, Planejamento, Análise, TVDE, Definições (9 abas, tipo `AbaId`).

- `NAV_MOBILE_ESQUERDA`: Início, Receitas. `NAV_MOBILE_DIREITA`: Despesas. O «+» central e o «Mais» não são abas.
- `ABAS_MENU_MAIS` (folha «Mais»): Cartões, Planejamento, Análise, Veículo, TVDE, Definições.

## Rotas

Todas dentro de `<Route element={<AppShell />}>`.

| Rota            | Elemento                         | Notas                                                    |
| --------------- | -------------------------------- | -------------------------------------------------------- |
| `/` (index)     | `Inicio`                         |                                                          |
| `/receitas`     | `Receitas`                       |                                                          |
| `/despesas`     | `Despesas`                       |                                                          |
| `/veiculo`      | `RotaVeiculo` > `Veiculo`        | Guarda: ver abaixo                                       |
| `/cartoes`      | `Cartoes`                        | Aloja Transações, Parcelas e Importar                    |
| `/parcelas`     | `IrParaCartoes aba="parcelas"`   | Redireciona para `/cartoes`                              |
| `/transacoes`   | `IrParaCartoes aba="transacoes"` | Redireciona para `/cartoes`                              |
| `/importar`     | `IrParaCartoes importar`         | Redireciona para `/cartoes` e abre a folha de importação |
| `/calendario`   | `Navigate` para `/planejamento`  | `state: { aba: "calendario" }`                           |
| `/metas`        | `Navigate` para `/planejamento`  | `state: { aba: "metas" }`                                |
| `/planejamento` | `Planejamento`                   | Abas Orçamento, Metas, Calendário                        |
| `/analise`      | `Analise`                        |                                                          |
| `/tvde`         | `RotaTvde` > `Tvde`              | Guarda: ver abaixo                                       |
| `/definicoes`   | `Definicoes`                     |                                                          |
| `*`             | `Navigate to="/" replace`        | Qualquer rota desconhecida volta ao Início               |

### Redirecionamentos para Cartões (`IrParaCartoes`)

`IrParaCartoes({ aba?: "transacoes" | "parcelas"; importar?: boolean })` faz `Navigate` para `/cartoes` com `replace` e `state = { ...stateAnterior, aba, importar }`. Preserva o `state` recebido (por exemplo a categoria vinda do donut). `Cartoes` lê esse `state` (`pedido`) para escolher a aba inicial e abrir a folha de importação.

### Guardas (`RotaVeiculo`, `RotaTvde`)

Ambas leem `useCfgStore` (`cfg.showVeiculo` / `cfg.showTvde` e `carregado`). Só redirecionam para `/` quando `carregado && !show…`; enquanto a config carrega renderizam a página, para não expulsar quem recarrega dentro do módulo.

- **TVDE**: opt-in por conta (nasce desligado).
- **Veículo**: nasce **ligado**; o interruptor em Definições › Veículo serve para esconder.

## Layout (`src/layout/`)

| Ficheiro                 | Assinatura / props                              | O que faz                                                                                                                                                                                                                                                                       |
| ------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AppShell.tsx`           | `AppShell()`                                    | Chama `useSyncConta`, `useAbrirRegistroPorUrl`, `usePullToRefresh`. Monta `Header`, `FaixaErroSync`, `Sidebar`, `IndicadorPull`, `<main>` com `PaginaTransicao` > `Outlet`, `MobileNav`, `Fab`, `MenuRegistroRapido`, `RegistroRapido`, `Toast`, `ConfirmarAcao`.               |
| `Header.tsx`             | `Header()`                                      | Topo fixo. Mostra o seletor de mês só em `ROTAS_COM_MES` (`/`, `/receitas`, `/despesas`, `/cartoes`, `/veiculo`, `/planejamento`, `/analise`, `/tvde`). Em `SUBPAGINAS` (`/definicoes`) troca o perfil por «Voltar». Tem o sino (`NotificacoesSino`) e o olho do modo discreto. |
| `Sidebar.tsx`            | `Sidebar()`                                     | Pílula de vidro à esquerda (tablet e desktop), só ícones; o nome aparece em tooltip. Largura via `--sidebar-w`.                                                                                                                                                                 |
| `MobileNav.tsx`          | `MobileNav()`                                   | Barra inferior: Início, Receitas, «+», Despesas, Mais. Círculo de 44px da aba ativa desliza com mola. «Mais» abre folha com `ABAS_MENU_MAIS`. Veículo e TVDE só aparecem com o módulo ligado.                                                                                   |
| `Fab.tsx`                | `Fab()`                                         | Botão flutuante «+», só no desktop. Abre `MenuRegistroRapido`.                                                                                                                                                                                                                  |
| `MenuRegistroRapido.tsx` | `MenuRegistroRapido()`                          | Menu do «+»: Nova despesa, Nova receita, Veículo (só com o módulo ligado). Cada linha abre o `RegistroRapido` no tipo certo.                                                                                                                                                    |
| `RegistroRapido.tsx`     | `RegistroRapido()` (sem props; lê `useUiStore`) | Folha de criação/edição de despesa, receita, abastecimento e despesa do veículo. Mapa interno abaixo.                                                                                                                                                                           |
| `BotaoPerfil.tsx`        | `BotaoPerfil()`                                 | Foto ou iniciais (`Avatar`) no topo esquerdo; menu com «Minha conta» (abre `pages/conta/FolhaConta`) e, no desktop, «Definições».                                                                                                                                               |
| `FaixaErroSync.tsx`      | `FaixaErroSync()`                               | Faixa global quando a sincronização da `cfg` falha. Não bloqueia nada.                                                                                                                                                                                                          |
| `PaginaTransicao.tsx`    | `{ children }`                                  | Entrada animada da página; a `key` pela rota remonta o nó a cada navegação (a página antiga sai de imediato).                                                                                                                                                                   |

## Páginas (`src/pages/`)

Todas usam `Pagina` (`components/Pagina.tsx`) como esqueleto, exceto `Login`. «Seção» = componente de ficheiro próprio que **não é rota**: vive dentro de outra página.

| Ficheiro                  | Export (default)                                                              | O que faz                                                                                                                                                                                                                    |
| ------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Login.tsx`               | `Login()`                                                                     | Autenticação bloqueante, três modos (`entrar`, `cadastrar`, `recuperar`). Erro anunciado com `role="alert"`.                                                                                                                 |
| `Inicio.tsx`              | `Inicio()`                                                                    | `Pagina titulo="Início" tituloVisivel={false}`. Compõe `AvisoOrcamento`, `ResultadoDoMes`, `APagarEsteMes`, `OndeFoiODinheiro`, `UltimosMovimentos`; o `CopilotoCard` abre numa `BottomSheet`. Sem lista própria: só totais. |
| `Receitas.tsx`            | `Receitas()`                                                                  | Lista de receitas do mês via `ListaLancamentos`, KPIs e ordenação (`SeletorOrdem`).                                                                                                                                          |
| `Despesas.tsx`            | `Despesas()`                                                                  | Abas `correntes` e `fixas` (`useAbasTeclado`). Vista Mês/Semana nas correntes. Edita pelo `RegistroRapido`; fixas têm folha própria.                                                                                         |
| `Veiculo.tsx`             | `Veiculo()`                                                                   | Módulo do veículo, cinco abas. Mapa interno abaixo.                                                                                                                                                                          |
| `Cartoes.tsx`             | `Cartoes()`                                                                   | Faturas por conta/cartão, transferências, parcelas e importação de extrato. Mapa interno abaixo.                                                                                                                             |
| `Parcelas.tsx`            | `SecaoParcelas()`                                                             | Seção de Cartões: compras parceladas (`AnelProgresso`, `LinhaParcela`, `FormParcela`). As quitadas saem da lista principal para uma folha à parte.                                                                           |
| `Transacoes.tsx`          | `SecaoTransacoes()`                                                           | Seção de Cartões: extrato que junta seis domínios, paginado (`ExtratoPaginado`, `LinhaTransacao`). Receita/despesa editam pelo `RegistroRapido`; os outros tipos abrem folha de detalhe com «Abrir em X».                    |
| `Importar.tsx`            | `FluxoImportar({ imp })`                                                      | Seção de Cartões: fluxo de importar extrato dentro de folha. `imp` é o retorno de `useImportacao()` (chamado uma vez por `Cartoes`). Escolher extrato, revisão, confirmação, sucesso com desfazer.                           |
| `FolhaValoresParcela.tsx` | `FolhaValoresParcela({ aberta, aoFechar, p, moeda, mesRef, hoje, despesas })` | Folha (usada por `Parcelas`) para ajustar o valor de cada mês de uma parcela (parcelas desiguais, como Klarna). A soma que não bate com o total é só aviso.                                                                  |
| `Planejamento.tsx`        | `Planejamento()`                                                              | Abas `orcamento`, `metas`, `calendario`. Aba inicial vem de `state.aba`. Orçamento usa `OrcamentoCard` e `FolhaOrcamentoTotal`; Calendário é `SecaoCalendario`.                                                              |
| `Calendario.tsx`          | `SecaoCalendario()`                                                           | Seção de Planejamento (era a página `/calendario`): dias com movimento marcados; a informação toda vai no nome acessível de cada botão de dia.                                                                               |
| `Analise.tsx`             | `Analise()`                                                                   | Seletor de período, `GraficoLinhas`, `BarrasSemana`, `MiniBarras`, `AnelTaxa`, `ChipVariacao`. Números do mês iguais aos de `ResultadoDoMes` (mesma conta).                                                                  |
| `Tvde.tsx`                | `Tvde()`                                                                      | Moeda **fixa em euros** (função local `eur`), não segue a moeda da conta. Abas `semanas`, `meses`, `periodos`, `extras` (conta destino, fonte da receita, Segurança Social, despesas). `FormSemana`, `LinhaSemana`.          |
| `Definicoes.tsx`          | `Definicoes()`                                                                | `Pagina estreita`. Secções Geral, Aparência, Registo, Personalização, Notificações, Dados (`SettingsSection`/`SettingsRow`). Abre as folhas de `definicoes/`.                                                                |

### `pages/conta/`

| Ficheiro          | Assinatura                         | O que faz                                                                                                       |
| ----------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `FolhaConta.tsx`  | `FolhaConta({ aberta, aoFechar })` | «Minha conta»: foto, nome (opcional), e-mail só de leitura. Abre `FolhaSenha` (nível 1) e inclui `ApagarConta`. |
| `ApagarConta.tsx` | `ApagarConta()`                    | Apagar a conta (direito ao apagamento), com confirmação via `useConfirmar`.                                     |

### `pages/definicoes/` (folhas abertas por `Definicoes`)

Quase todas recebem `{ cfg, uid, aberta, aoFechar }`.

| Ficheiro                 | Props específicas / nota                                                                                                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FolhaBackup.tsx`        | `{ uid, aberta, aoFechar }`. Exporta/importa o backup completo da conta (JSON). O ficheiro é lido e validado logo.                                                                 |
| `FolhaCategorias.tsx`    | `{ titulo, itens, lista, cfg, uid, aberta, nivel = 0, aoFechar }`. Usada duas vezes: categorias de despesa e fontes de receita. Usa `SeletorCor`, `SeletorIcone`, `RenomearFolha`. |
| `FolhaContasCartoes.tsx` | Criar, renomear, remover, juntar um 2.º método e dias de fatura de contas e cartões.                                                                                               |
| `FolhaCopiloto.tsx`      | Personalização do Copiloto.                                                                                                                                                        |
| `FolhaCorBotao.tsx`      | Cor do botão flutuante em Despesas, Receitas e Veículo.                                                                                                                            |
| `FolhaDiagnostico.tsx`   | `{ uid }` (sem `aberta`: é conteúdo embutido na página). Últimos erros apanhados (14 dias, máx. 30).                                                                               |
| `FolhaKpiDestaque.tsx`   | Escolha do número em destaque de cada página.                                                                                                                                      |
| `FolhaNotificacoes.tsx`  | Quais tipos de notificação aparecem no sino.                                                                                                                                       |
| `FolhaSenha.tsx`         | `{ aberta, aoFechar, nivel }`. Troca de senha; pede a atual (login recente exigido pelo Firebase).                                                                                 |
| `FolhaVeiculo.tsx`       | Tudo o que se configura no módulo Veículo.                                                                                                                                         |

### `pages/importar/` (peças do fluxo de importação)

| Ficheiro                    | O que faz                                                                                                                                                                                                                                    |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useImportacao.ts`          | `useImportacao()`: toda a lógica e ligação às stores. Devolve estado e ações (`texto`, `linhas`, `filtro`, `analisarTexto`, `aoCarregarArquivo`, `aoSoltar`, `aoColar`, `atualizarLinha`, `confirmar`, `desfazer…`, e mais; ver o ficheiro). |
| `ImportacaoEntrada.tsx`     | Estado vazio: escolher/arrastar/colar extrato.                                                                                                                                                                                               |
| `ImportacaoResumo.tsx`      | Topo da revisão: resumo por estado (também filtra) e «Novo extrato».                                                                                                                                                                         |
| `ImportacaoFiltros.tsx`     | `{ contagem, filtro, setFiltro }`: «N revisar · N duplicatas · N novos · N prontos».                                                                                                                                                         |
| `ImportacaoToolbar.tsx`     | Ações em massa: aceitar auto-classificadas, marcar todas, conta para todas.                                                                                                                                                                  |
| `RevisaoImportacao.tsx`     | Lista agrupada por estado mais o editor da linha escolhida (sempre em linha na folha).                                                                                                                                                       |
| `ListaLinhasImportacao.tsx` | Exporta `GrupoVisivel`; desenha os grupos.                                                                                                                                                                                                   |
| `LinhaImportacao.tsx`       | Linha compacta (~52px), exportada com `memo`.                                                                                                                                                                                                |
| `EditorLinha.tsx`           | Editor de uma linha do extrato.                                                                                                                                                                                                              |
| `ConfirmacaoImportacao.tsx` | Rodapé fixo «N marcados para importar» e botão de importar.                                                                                                                                                                                  |
| `ModalDuplicatas.tsx`       | Antes de confirmar, quando algo parece já existir: marcar existentes para apagar ou importar mesmo assim.                                                                                                                                    |
| `agrupamento.ts`            | `pendenciasDaLinha`, `statusDaLinha` (`atencao`, `duplicata`, `novo`, `pronto`), `grupoDoStatus`, `GRUPOS`, `SEGMENTOS`, `contarStatus`, `plural`.                                                                                           |
| `constantes.ts`             | Constantes da importação (ex.: `ROTULO_DECISAO`).                                                                                                                                                                                            |

## Mapa interno dos ficheiros grandes

Números de linha são indicativos (código de referência: commit `240623a`); confirmar antes de citar.

### `pages/Veiculo.tsx` (~1300 linhas)

- Topo: `type Aba = "resumo" | "cargas" | "despesas" | "fixas" | "km"` e `ABAS` (Resumo, Abastecimentos, Despesas, Fixas, Km), fonte única da ordem das abas e do teclado (`useAbasTeclado`).
- Helpers locais: `agir`, `rotuloQuantidade`, `nomeDespesa`, `detalheDespesa`, `juntarDescricao`; componente `ChipComMenu`.
- `Veiculo()` (a partir da linha ~183): estado, cálculos e handlers; `Pagina titulo="Veículo"` (~682); aviso único de sincronização acima das abas (~723).
- `<AbaTransicao aba={aba}>` (~729) com um bloco por aba: `resumo` (~730), `cargas` (~776), `despesas` (~864), `fixas` (~904), `km` (~978).
- Folhas no fim: «Editar abastecimento» (~1021, só edita; criar é pelo Registo Rápido), «Editar despesa» (~1170, só edita), despesa fixa do veículo (~1210, cria e edita), quilometragem (~1262, cria e edita).
- A linha da vista Mês/Semana das cargas (`linhaVisaoCargas`) aparece no cabeçalho só em ecrã largo (`largo`); confirmar o comportamento no estreito.

### `pages/Cartoes.tsx` (~1060 linhas)

- Helpers locais: `ControlesFatura` (~86), `LinhaTransferencia` (~226), `calcularPagamentos` (~283).
- `ECRA_LARGO = "(min-width: 1024px)"`: acima disso não há abas.
- `Cartoes()` (~292): lê `state` (`pedido.aba`, `pedido.importar`); estado `aba: "transacoes" | "parcelas"` (~301); estados das folhas `contaAberta`, `pagando`, `ajustando`, `ajustandoSaldo`, transferência (`tf…`); chama `useImportacao()` uma vez.
- Render (~712): `Pagina titulo="Cartões"`. Sem contas, mostra `EstadoVazio` (criar em Definições › Contas e cartões). Ecrã largo: duas colunas (cartões, `SecaoParcelas` e quadro de importar à esquerda; `SecaoTransacoes` à direita). Estreito: abas Transações/Parcelas.
- Folhas: conta aberta (~805), pagar fatura (~902), ajustar fatura (~943), saldo (~966), transferência nova/editar (~994), «Importar extrato» com `FluxoImportar` (~1045).
- Criar/renomear/remover contas **não** vive aqui: está em `definicoes/FolhaContasCartoes`.

### `layout/RegistroRapido.tsx` (~1190 linhas)

- Constantes: `TITULOS: Record<TipoRegistro, string>`, `ATALHOS_PARCELAS = [3, 6, 9, 12]`, `OPCOES_PARCELAS` (2x a 36x, menos os quatro atalhos), `MOBILE = "(max-width: 767px)"`; função `rotuloAbastecimento(tipoVeiculo)`.
- `RegistroRapido()` (~84): lê `useUiStore` (tipo: `despesa`, `receita`, `carga`, `despesaVeiculo`; criação ou edição). Estados do formulário (~115-166): `descricao`, `data`, `etiqueta` (fonte ou categoria), `conta`, `frota`, `kwh`, `litros`, `parcelada`, `intermediador`, `reembolso`, `erro`, `salvando`.
- Corpo do formulário, por ordem: título e troca de lado na edição, Descrição, pergunta do híbrido, duas formas de informar abastecimento, Valor, categoria/fonte, conta, reembolso (só despesa), despesa do veículo, «Reembolso de qual despesa».
- Folha do parcelamento (~1051), empilhada sobre a principal: atalhos 3/6/9/12 e seletor para outros números.
- Reembolso: o utilizador escreve valor positivo; grava-se negativo com origem `reemb` (testado em `RegistroRapido.test.tsx`).
- `useAbrirRegistroPorUrl` abre esta folha com `?registro=…`.

## Confirmar

- `Receitas.tsx` e `Despesas.tsx`: detalhe de KPIs e fixas não foi lido a fundo.
- Números de linha dos mapas internos mudam a cada commit.
- `Calendario.tsx`: comportamento interno só lido pelo cabeçalho e testes.
- Se `Importar.tsx` e `Parcelas.tsx` foram renomeados para `Secao…`/`Fluxo…` de propósito: os nomes de ficheiro mantêm-se, os exports não coincidem.

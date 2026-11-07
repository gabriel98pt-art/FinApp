# Stores (`src/stores/`)

Escrito a partir da leitura do código. Se divergir do código, vale o código: corrija o documento.

zustand. Três tipos: espelhos do Realtime Database (alimentados só pelo `syncService`), preferências do aparelho e estado de interface.

## Espelhos do banco (persistidos em localStorage)

Criados por `criarStoreEspelho(nome, estadoInicial)` em `storeEspelho.ts`. Forma: um campo de dados (`itens` ou `dados`/`cfg`) + `carregado` + `erro`. `erro` não é persistido (`partialize`). Ao hidratar, `mesclarComDefaults` junta o localStorage ao estado inicial, validando o tipo de cada campo; mapas com chave dinâmica mantêm as chaves persistidas.

| Store                                   | Chave localStorage      | Campo de dados              | Estado inicial  |
| --------------------------------------- | ----------------------- | --------------------------- | --------------- |
| `useCfgStore` (`cfgStore.ts`)           | `finapp-cfg`            | `cfg: ConfigConta`          | `CONFIG_PADRAO` |
| `useReceitasStore` (`lancamentosStore`) | `finapp-receitas`       | `itens: Receita[]`          | `[]`            |
| `useDespesasStore` (`lancamentosStore`) | `finapp-despesas`       | `itens: DespesaCorrente[]`  | `[]`            |
| `useDespesasFixasStore`                 | `finapp-despesasFixas`  | `itens: DespesaFixa[]`      | `[]`            |
| `useTransferenciasStore`                | `finapp-transferencias` | `itens: Transferencia[]`    | `[]`            |
| `useParcelasStore` (`parcelasStore.ts`) | `finapp-parcelas`       | `itens: Parcela[]`          | `[]`            |
| `useEventosStore` (`eventosStore.ts`)   | `finapp-eventos`        | `itens: EventoCalendario[]` | `[]`            |
| `useFundosStore` (`fundosStore.ts`)     | `finapp-fundos`         | `itens: Fundo[]`            | `[]`            |
| `useTvdeStore` (`tvdeStore.ts`)         | `finapp-tvde`           | `dados: DadosTvde`          | `TVDE_VAZIO`    |
| `useVeiculoStore` (`veiculoStore.ts`)   | `finapp-veiculo`        | `dados: DadosVeiculo`       | `VEICULO_VAZIO` |

Regras:

- Só `syncService` escreve nestas stores (com `setState`). Componentes leem com seletores (`useXStore((s) => s.campo)`).
- Parcelas e despesas fixas chegam com `pagoPorMes` sempre definido (o RTDB omite mapas vazios).
- No logout cada store volta ao estado inicial com `carregado: false`.

`persistenciaAdiada.ts`: `createJSONStorage` com leitura síncrona e escrita em fila, aplicada num idle callback (um `setItem` por chave por janela). A fila esvazia-se de forma síncrona em `visibilitychange` e `pagehide`. Sem `localStorage` (testes em Node), a store simplesmente não persiste.

## Sessão

| Store                           | Estado                                                                                                            | Persistido? |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------- |
| `useAuthStore` (`authStore.ts`) | `status` (`carregando`, `autenticado`, `deslogado`), `sessao`. Liga-se a `observarSessao` à importação do módulo. | não         |

## Preferências do aparelho (persistidas)

| Store                                           | Estado                                       | Chave                        |
| ----------------------------------------------- | -------------------------------------------- | ---------------------------- |
| `useThemeStore` (`themeStore.ts`)               | tema local (`system`, `dark`, `light`)       | `finapp-tema`                |
| `useCartoesVistaStore` (`cartoesVistaStore.ts`) | vista escolhida em Cartões                   | `finapp-cartoes-vista`       |
| `useImportacaoStore` (`importacaoStore.ts`)     | rascunho da importação de extrato (versão 1) | `finapp-importacao-rascunho` |

O tema por conta é outro: `cfg.theme`.

## Histórico (desfazer e refazer)

`useHistoricoStore` (`historicoStore.ts`, não persistido): `pilha`, `uid`, `iniciar(uid)`, `parar()`, `snapshot()`, `desfazer()`, `refazer()`. `iniciar` é chamado no início da sincronização e `parar` no logout, para nunca passar o histórico de uma conta para outra.

- `snapshotHistorico()` deve ser chamado antes de qualquer mutação desfazível; os serviços de escrita já o fazem.
- `comHistoricoSuprimido(fn)`: várias escritas dentro de `fn` contam como um único passo de desfazer (usado na importação). O snapshot é tirado à mão antes.
- A captura (`capturarEstadoAtual`) lê as stores em memória, sem rede. A restauração (`restaurarEstado`) faz um `update()` por domínio e nunca toca em nós sem store, como `iaUso`.

## Estado de interface (não persistido)

| Store                                                                               | Para quê                                                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useUiStore` (`uiStore.ts`)                                                         | Registo rápido: `registroAberto`, `registroTipo` (`receita`, `despesa`, `carga`, `despesaVeiculo`), `editandoId`, `abrirRegistro(tipo?, editandoId?)`, `fecharRegistro()`; e o menu do registo (`menuRegistroAberto`, `abrirMenuRegistro`, `fecharMenuRegistro`). Tipo por omissão: `despesa`. |
| `useMesVisivelStore` (`mesVisivelStore.ts`)                                         | `mes` partilhado pelas telas por mês, `setMes`. Cada sessão nasce no mês real.                                                                                                                                                                                                                 |
| `useConfirmarStore` + `confirmarAcao(mensagem, acao?)` + `responderConfirmacao(ok)` | Diálogo de confirmação. `acao`: `{verbo, perigo?}`; por omissão «Apagar», em perigo. Abrir um novo resolve o anterior com `false`.                                                                                                                                                             |
| `useToastStore` + `mostrarToast(mensagem)` (`toastStore.ts`)                        | Uma mensagem de cada vez, visível 2,4 s.                                                                                                                                                                                                                                                       |
| `usePwaStore` + `checarVersaoNova()` + `recarregarQuandoLivre()` (`pwaStore.ts`)    | Ponte entre `usePwaUpdate` (o único que fala com o service worker) e o puxar-para-recarregar.                                                                                                                                                                                                  |

## Regras

- Para confirmar e avisar, usar `confirmarAcao` (ou o hook `useConfirmar`) e `mostrarToast`; não criar diálogos novos.
- Erros de gravação vão para o toast e para o `erroService` (regra do `CLAUDE.md`).

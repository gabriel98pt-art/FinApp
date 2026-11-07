Escrito a partir da leitura do código. Se divergir do código, vale o código: corrija o documento.

# Hooks (`src/hooks/`)

Todos têm o prefixo `use`. `useUidSessao()` só pode ser usado atrás do gate de sessão (dentro de `Conteudo`, em `App.tsx`). Os hooks marcados «fora do gate» são chamados em `App()` e valem também no Login.

## Arranque e aparência (chamados em `App.tsx`, fora do gate)

| Hook                            | Assinatura | O que faz                                                                                                                                                                       |
| ------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useAplicarTema`                | `()`       | Reflete o tema já resolvido (nunca «system») em `<html data-theme>` e na cor da barra do sistema.                                                                               |
| `useAplicarModoDiscreto`        | `()`       | Reflete `cfg.modoDiscreto` em `<html data-discreto>`; elementos com a classe global `.discreto` ficam borrados por CSS.                                                         |
| `useAplicarCoresPersonalizadas` | `()`       | Escreve as cores escolhidas no `<html>`, por cima de `tokens.css` (variáveis `--x` e `--x-rgb`). Exporta `TOKENS_COR_APP` (`blu`, `grn`, `red`, `ylw`, `pur`) e `ROTULO_TOKEN`. |
| `useAlturaTeclado`              | `()`       | Publica a altura do teclado virtual em `--altura-teclado` no `<html>` (no iOS o teclado não encolhe a página). Ignora alturas abaixo de 120 px (barra do Safari).               |
| `usePwaUpdate`                  | `()`       | Pede à mão a checagem de versão nova sempre que o app volta ao primeiro plano; o worker novo assume sozinho e avisa com toast antes de recarregar.                              |
| `useRecarregarChunkFalho`       | `()`       | Depois de um deploy, um `import()` dinâmico com hash antigo falha; este hook deteta o erro e recarrega.                                                                         |
| `useIgnorarArquivoSolto`        | `()`       | Largar um ficheiro fora de uma zona que o aceite não faz nada (o navegador abriria o ficheiro e o app sairia do ecrã). A zona de Importar corre primeiro.                       |
| `useCapturarErros`              | `()`       | Apanha `error` e `unhandledrejection` e grava com `registrarErro`; sem sessão só vai ao console. Lido depois em Definições › diagnóstico.                                       |

## Sessão e dados

| Hook                     | Assinatura                           | O que faz                                                                                                                                                                                                                |
| ------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `useUidSessao`           | `(): string`                         | O uid da sessão, nunca `null`, para páginas atrás do gate. Evita o `uid!` repetido.                                                                                                                                      |
| `useSyncConta`           | `()`                                 | Chama `iniciarSyncConta(uid)` e devolve a limpeza; só com sessão. Chamado em `AppShell`.                                                                                                                                 |
| `useDadosFatura`         | `(): DadosFatura`                    | Lê 6 stores e devolve o `DadosFatura` pronto. Quem já lê alguns desses stores chama `montarDadosFatura()` direto para não assinar duas vezes.                                                                            |
| `useNotificacoes`        | `(): Notificacao[]`                  | O que está vencido e por pagar agora (sempre o mês de hoje, não o do seletor). Usa `useDadosFatura` e `todasNotificacoes`; vem com `useMemo` por estar no Header (corre em todas as páginas).                            |
| `useAbrirRegistroPorUrl` | `()`                                 | Abre o registo rápido quando a URL traz `?registro=despesa`, `receita`, `carga` ou `despesaVeiculo`, e remove o parâmetro (para o F5 não reabrir). É o gatilho do Atalho do iOS (Toque Traseiro). Chamado em `AppShell`. |
| `useConfirmar`           | `(): (mensagem) => Promise<boolean>` | Abre o diálogo `ConfirmarAcao` e resolve com a escolha: `if (!(await confirmar("..."))) return;`. A função é estável (vive no store). Usado em quase todas as páginas e folhas destrutivas.                              |

## Tema e ecrã

| Hook             | Assinatura                 | O que faz                                                                                                                                                                                                                |
| ---------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `useTemaEfetivo` | `(): "dark" \| "light"`    | Resolve a preferência (que pode ser «system») para o tema real; reage à mudança do SO via `matchMedia`.                                                                                                                  |
| `useMediaQuery`  | `(query: string): boolean` | Bate ou não com a media query, atualizado ao vivo. Ex.: `useMediaQuery("(max-width: 767px)")`. Usado em `FolhaAncorada`, `Cartoes`, `Receitas`, `Despesas`, `Veiculo`, `RegistroRapido`, `BotaoPerfil`, `useImportacao`. |

## Folhas, gestos e teclado

| Hook                   | Assinatura                                                      | O que faz                                                                                                                                                                                                                                                                                                                        |
| ---------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useDragToClose`       | `({ aberta, folhaRef, veuRef, aoFechar })`                      | Animação da folha inferior com mola real: abrir, fechar por toque/Esc e fechar por arrasto correm a mesma mola (interrompível). Escreve `--folha-y` direto no DOM por frame (sem re-render). Devolve `{ visivel, aoPointerDown, aoPointerMove, aoPointerUp, aoPointerCancel }`. Usa `utils/spring.ts`. Só o `BottomSheet` o usa. |
| `useFocoModal`         | `({ aberta, folhaRef, aoFechar })`                              | Foco das folhas modais: Esc fecha, o foco entra no contentor ao abrir e volta ao gatilho ao fechar; pilha de folhas (identidade via `useId`). Usado por `BottomSheet` e `ConfirmarAcao`.                                                                                                                                         |
| `usePullToRefresh`     | `()`                                                            | Puxar do topo para recarregar. Pede a checagem de versão (`checarVersaoNova`) e só recarrega se já estiver na última. Deslocamento escrito direto no DOM. Devolve `{ visivel, armado, recarregando, limite, refConteudo, refIndicador, refIcone, manipuladores }`. Usado em `AppShell` com `IndicadorPull`.                      |
| `useAbasTeclado`       | `<T extends string>({ abas: readonly T[], atual: T, aoMudar })` | Teclado ARIA de abas: setas (com volta nas pontas), Home/End, tabindex rotativo. Devolve `propsLista` e `propsAba(id)` (usados em `Planejamento`, `Despesas`, `Tvde`, `Veiculo`). A ordem de `abas` tem de ser a da lista desenhada.                                                                                             |
| `useRadiogroupTeclado` | `<T extends HTMLElement>(): { ref, onKeyDown }`                 | Teclado ARIA de `radiogroup`: setas movem e escolhem, Home/End, tabindex rotativo. Procura os `[role="radio"]` no DOM; basta pôr `ref` e `onKeyDown` no `<div role="radiogroup">`. Usado por `RegistroRapido`, `Seletor*`, `FiltroTransacoes`, `FolhaCategorias`, `Despesas`, `Analise`, `Veiculo`.                              |

## Confirmar

- Todos os hooks aqui descritos existem em `src/hooks/`; as descrições vêm dos comentários de cabeçalho e das assinaturas, não dos corpos.
- `useAlturaTeclado`: mínimo de 120 px (`MINIMO_TECLADO`), via `visualViewport`; sem ele o valor é sempre 0.
- `usePwaUpdate`: espera 1000 ms antes de recarregar (`MS_ANTES_DE_RECARREGAR`); o uso de `checarVersaoNova` está só em `usePullToRefresh` (confirmar se `usePwaUpdate` o partilha).
- `useAbasTeclado` devolve `propsLista` (`ref`, `onKeyDown`) e `propsAba(aba)` (`tabIndex`): lido no ficheiro.
- Hooks de dados de página (por ex. `useImportacao`) vivem junto da página (`pages/importar/useImportacao.ts`), não nesta pasta; ver `telas-e-rotas.md`.

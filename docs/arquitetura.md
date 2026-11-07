# Arquitetura

Escrito a partir da leitura do código. Se divergir do código, vale o código: corrija o documento.

## Camadas (de baixo para cima)

1. `src/types/`: tipos (`Id`, `Cents`, `IsoDate`, `YearMonth`, `Theme`, `ConfigConta`, `Receita`, `DespesaCorrente`, `Parcela`, `DadosTvde`, `DadosVeiculo`...). `index.ts` reexporta tudo.
2. `src/constants/` e `src/utils/`: lógica pura, sem React nem Firebase. Valores em cêntimos inteiros. Cascatas de renomear em `utils/renomear.ts`.
3. `src/services/`: único sítio que fala com o Firebase (`firebase.ts` inicia o SDK). A interface nunca acede ao Firebase nem ao localStorage direto.
4. `src/stores/`: estado zustand. As stores de dados são espelhos do Realtime Database, alimentadas só por `syncService`.
5. `src/hooks/`, `src/components/`, `src/layout/`, `src/pages/`: interface.
6. `api/`: função serverless da Vercel (`copiloto-ia.ts`), fora do `src/` e sem importar nada dele.

Regra de dependência: uma camada só importa das de baixo. Exceções que vi: os serviços importam stores (`syncService` escreve nelas; `cfgService` lê as stores para montar as cascatas; `historicoService` lê-as para o desfazer; `veiculoService` e outros chamam `snapshotHistorico()` de `historicoStore`). Confirmar se isto é intencional.

## Fluxo de dados

```
Firebase Auth --observarSessao--> authStore (status: carregando | autenticado | deslogado)
AppShell: useSyncConta() --> iniciarSyncConta(uid)
iniciarSyncConta: 10 subscrições (observarX) --> stores espelho
telas leem as stores; escrevem pelos serviços (criarReceita, pagarFatura, atualizarConfig...)
```

- Sucesso de uma subscrição grava os dados e põe `carregado: true`, `erro: false`. Erro marca `erro: true` e `carregado: true` sem apagar o que já estava.
- As stores de dados são persistidas em localStorage (chaves `finapp-*`) com escrita adiada, para o reload offline não ficar preso em «a carregar». `erro` nunca é persistido.
- A função que desliga as subscrições (devolvida por `iniciarSyncConta`) também repõe cada store ao estado vazio e pára o histórico: nunca ficam dados de uma conta visíveis para a seguinte.
- A sincronização só arranca depois de o `AppShell` montar (via `useSyncConta`). Confirmar: não há outro ponto de arranque.

## Arranque

- `src/main.tsx`: dentro do app nativo (Capacitor) fixa o viewport sem zoom e põe a classe `nativo` no `<html>`; monta `App` em `StrictMode`.
- `App` (componente): hooks fora do gate de sessão (`useAplicarTema`, `useAplicarModoDiscreto`, `useAplicarCoresPersonalizadas`, `useAlturaTeclado`, `usePwaUpdate`, `useRecarregarChunkFalho`, `useIgnorarArquivoSolto`, `useCapturarErros`) e `ErrorBoundary` à volta de `Conteudo`.
- `Conteudo` decide por `authStore.status`:
  1. `carregando`: não mostra nada (evita piscar);
  2. `deslogado`: `Login`;
  3. `autenticado`: `BrowserRouter` > `Suspense` > `Routes`, tudo dentro de `AppShell`.
- `AppShell` e as páginas carregam com `lazy`. Montados no `AppShell`: `Header`, `Sidebar`, `MobileNav`, `MenuRegistroRapido`, `RegistroRapido`, `Toast`, `ConfirmarAcao`. Liga `useSyncConta` e `useAbrirRegistroPorUrl`.

## Rotas (`src/App.tsx`)

9 abas definidas em `src/constants/abas.ts`: `/` (Início), `/receitas`, `/despesas`, `/veiculo`, `/cartoes`, `/planejamento`, `/analise`, `/tvde`, `/definicoes`.

- `/veiculo` só abre com `cfg.showVeiculo` ligado (nasce ligado); `/tvde` só com `cfg.showTvde` ligado. Enquanto a config carrega, não redireciona. Desligado, volta ao início.
- Redirecionam com `replace` e levam o `state`: `/parcelas`, `/transacoes` e `/importar` para `/cartoes` (abas `parcelas`, `transacoes` ou importar); `/calendario` e `/metas` para `/planejamento` (abas `calendario`, `metas`).
- Qualquer outro caminho volta a `/`.

## Camada 2 do Copiloto (função serverless)

`src/services/copilotoIA.ts` chama `api/copiloto-ia.ts` com o token de sessão do Firebase. Só é usada quando a camada 1 (local) não sabe responder. Detalhe em `dados-e-api.md`.

## Decisões já tomadas (todas escritas nos comentários do código)

- Dinheiro em cêntimos inteiros (`utils/money.ts`). Nunca `undefined` no RTDB (`semIndefinidos`).
- Datas como texto ISO (`YYYY-MM-DD`; meses `YYYY-MM`).
- Erros registados na própria conta, fora de `fin_v5` (`users/{uid}/erros_app`), sem serviço externo.
- `initializeAuth` em vez de `getAuth`: o `getAuth` abre um iframe que nunca responde dentro do app nativo e deixava o ecrã vazio. Só há login por e-mail e senha.
- A configuração do Firebase é pública por design; a segurança está em `database.rules.json`.
- A chave do Gemini nunca está no browser: só como variável `GEMINI_API_KEY` na Vercel.
- Cabeçalhos de segurança em `vercel.json` (CSP em modo só-relatório, `X-Frame-Options: DENY`, etc.).
- Escritas ligadas (pagar fatura, parcelas, importação, cascatas de renomear) vão num só `update()` multi-caminho.
- Desfazer/refazer não vai à rede: captura as stores em memória e restaura com um `update()` por domínio (ver `stores.md`).
- Backup restaura sobrescrevendo `fin_v5`, mas só depois de guardar uma cópia de segurança fora dele.
- Destino: loja iOS e Android. Código específico de iOS fica isolado (ver `CLAUDE.md`).

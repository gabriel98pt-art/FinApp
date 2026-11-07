Escrito a partir da leitura do código. Se divergir do código, vale o código: corrija o documento.

# Testes, qualidade e CI

## Testes (Vitest 4)

- 107 ficheiros `*.test.ts(x)`, 1985 testes (números medidos; voltam a mudar a cada teste novo). Ficheiros ao lado do código, mais `api/copiloto-ia.test.ts`.
- Ambiente por omissão `node` (`vite.config.ts`): a lógica pura corre sem DOM. Os testes de componente pedem jsdom com `// @vitest-environment jsdom` no topo do próprio ficheiro.
- `src/testes/setup.ts`: jest-dom e `cleanup`, e um `matchMedia` por omissão (desktop). Só faz algo em jsdom (guarda `typeof window`).
- `src/testes/dobras.ts` (formas de estado de store de lista, ex. `lista`) e `src/testes/instituicoes.ts` (fixtures de instituições e métodos de pagamento): partilham a forma, não os dados; cada teste declara os seus `vi.mock`.
- Comandos: `npm test` (uma vez), `npm run test:watch`, `npm run test:coverage` (v8, relatório `text` e `html` em `coverage/`, ignorada pelo git).

## Cobertura

Medida só em `api/**`, `src/services/**` e `src/utils/**` (exclui `src/services/firebase.ts` e os testes), de propósito: componentes e páginas só têm testes de montagem, e medi-los daria uma percentagem que sobe sem proteger mais nada. Total medido: 94,6% das instruções e 96,3% das linhas. Páginas, componentes, hooks, stores e layout ficam fora do relatório.

### Retrato de tudo, medido uma vez (07/11/2026)

A configuração não mudou. Esta medição única incluiu `src/**` e `api/**` para mostrar o que a medição normal não vê. Total: 77,5% das linhas, 76,4% das instruções, 73,4% dos ramos. Linhas cobertas por pasta:

| Pasta                                           | Linhas | Nota                     |
| ----------------------------------------------- | ------ | ------------------------ |
| `src/utils`                                     | 96,8%  | lógica, a medida oficial |
| `src/services`                                  | 95,1%  | idem                     |
| `api`                                           | 95,3%  | idem                     |
| `src/constants`                                 | 100%   |                          |
| `src/stores`                                    | 88,6%  |                          |
| `src/pages/importar`                            | 84,3%  |                          |
| `src/components` (inclui `analise`, `settings`) | 75,6%  |                          |
| `src/layout`                                    | 72,3%  |                          |
| `src/pages` (telas)                             | 58,2%  | só testes de montagem    |
| `src/pages/definicoes`                          | 54,3%  | folhas de Definições     |
| `src/pages/conta`                               | 55,6%  |                          |
| `src/hooks`                                     | 43,9%  | o ponto mais fraco       |
| `src/App.tsx`, `src/main.tsx`                   | 0%     | arranque, sem teste      |

Os hooks são a pasta com menos cobertura. Entre os que não têm teste próprio estão `usePullToRefresh`, `useDragToClose`, `useSyncConta`, `useFocoModal` e `useConfirmar`. Por correr de novo: `npx vitest run --coverage --coverage.include='src/**' --coverage.include='api/**'`.

## Qualidade

- TypeScript `strict`, `verbatimModuleSyntax`, `noUnusedLocals/Parameters`, `erasableSyntaxOnly`, `noEmit`. `tsconfig.json` só referencia `tsconfig.app.json` (`src`) e `tsconfig.node.json`. `npm run typecheck` = `tsc -b`.
- ESLint 10 (`eslint.config.js`): recomendado, `typescript-eslint`, `react-hooks`, `react-refresh`, `eslint-config-prettier`; `no-explicit-any` é erro. Ignora `dist`, `coverage` e `ios`.
- Prettier: `npm run format` antes de cada commit; `npm run format:check` na CI.

### Estado atual (a data deste documento)

- Lint: 1 erro, só em `src/dev-botoes.tsx`, ficheiro local fora do git (ver `scripts-e-ferramentas-dev.md`). Na CI não aparece, porque lá o ficheiro não existe.
- `format:check`: falha em 4 ficheiros: `docs/design/analise-tabbar-topo.md`, `BottomSheet.tsx`, `Popover.tsx`, `usePullToRefresh.ts`. Enquanto não forem formatados, a CI vai a vermelho neste passo (confirmar na última execução da CI).

## CI (`.github/workflows/ci.yml`)

Corre em push para `main` e em pull request para `main` (não em todos os ramos). Ubuntu, Node 22, cache npm. Passos, por ordem: `npm ci`, lint, `format:check`, `npm test`, `npm run build` (`tsc -b && vite build`) e validação de JSON (`public/manifest.json`, `firebase.json`, `database.rules.json`, `.firebaserc`, `vercel.json`). Não há passo de cobertura, de iOS nem de deploy: a Vercel faz o deploy à parte.

## Antes de dar algo por feito

`npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check` (regra 7 do `CLAUDE.md`).

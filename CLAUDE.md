# FinApp

App de finanças pessoais do Gabriel (PWA e app iOS via Capacitor): receitas, despesas, cartões e faturas, parcelas, planeamento, análise, TVDE e veículo. Reescrita da app antiga (`financas.html`, arquivada e fora de uso).

**Destino:** a FinApp é feita para virar app de loja, em iOS e em Android. Por agora só se entrega iOS. Não escrever código só para iOS quando houver forma neutra de fazer a mesma coisa; o que for específico de iOS fica isolado e comentado, para o Android entrar depois sem refazer.

## Stack e comandos

Vite 8 + React 19 + TypeScript estrito, zustand, react-router 7, CSS Modules, vitest, Firebase Auth + Realtime Database (projeto `finapp1-20d00`), Capacitor 8 (iOS), função serverless na Vercel (`api/copiloto-ia.ts`).

- `npm run dev` | `npm run build` (tsc -b + vite) | `npm test` | `npm run test:coverage` | `npm run lint` | `npm run typecheck` | `npm run format`
- CI (`.github/workflows/ci.yml`): lint, format:check, test, build e validação dos JSON. Tem de passar.
- Dados por conta: `users/{uid}/fin_v5/...` (regras em `database.rules.json`).
- iOS: ver `docs/ios-e-deploy.md`. O `npx cap run` não funciona nesta máquina; usar `xcodebuild` e `simctl`/`devicectl`.

## Mapa do projeto

- `src/App.tsx`: rotas (lazy por página). 9 abas em `src/constants/abas.ts`. `/parcelas`, `/transacoes` e `/importar` redirecionam para Cartões.
- `src/pages/`: uma tela por ficheiro; subpastas `conta/`, `definicoes/`, `importar/` guardam as peças.
- `src/layout/`: AppShell, Header, MobileNav, Sidebar, RegistroRapido, Fab.
- `src/components/`: UI reutilizável (`analise/`, `settings/`). `src/hooks/`, `src/stores/` (zustand), `src/services/` (Firebase, sync, auth, backup, fatura, importação, IA).
- `src/utils/`: lógica pura e testada (dinheiro, faturas, parcelas, copiloto, importação, análise).
- `src/constants/`, `src/types/`, `src/styles/` (`tokens.css`, motion, typography), `src/testes/` (setup do vitest).
- `api/`: função `copiloto-ia`. `scripts/gerar-icones.mjs`. `ios/` e `capacitor.config.ts`: app iOS (`com.gabriel98pt.finapp`).
- `docs/README.md`: índice da documentação. Ler o ficheiro do assunto antes de mexer. `docs/dicas-de-organizacao.md`: melhorias propostas.
- Já existiam: `HISTORICO.md` (diário, entrada nova no topo), `PENDENCIAS.md`, `RELATORIO_AUDITORIA.md`, `docs/plano-*.md`, `docs/workflow/`.
- Só em dev e fora do app: `dev-preview.html` + `src/dev-preview.tsx` (ecrãs com dados de exemplo).
- Ficheiros locais, fora do git: `SPEC_REESCRITA_COMPLETA.md`, `.claude/finapp-qa-credentials.local`, `dev-botoes`, `dev-captura`.

## Regras do projeto

- UI nunca acede a Firebase nem a localStorage direto: só via `services/` e stores.
- Dinheiro em cêntimos inteiros (`utils/money.ts`). Cálculo financeiro é função pura com teste.
- Cada mudança entra no topo do `HISTORICO.md`, em linguagem simples.
- Cada entrega termina com a app atualizada no iPhone.
- Correções óbvias: decidir e informar. Perguntar só o que muda comportamento, dados ou âmbito.
- Prettier antes de cada commit.

## Design

Visual «vidro + terracota». Mantém um padrão comum mínimo com a TVDE Pro, que dá o toque autoral do Gabriel; pode mudar mais tarde, mas só por decisão dele. Antes de mexer em design, ler `docs/estilos-e-design-system.md`. Mudança de design é só design: não misturar com lógica.

- Cores e tamanhos só pelos tokens de `src/styles/tokens.css`: sem cores soltas, sem tamanhos de letra fora da escala de 6 (`--fs-*`), cantos pelos `--r-*`.
- Movimento só pelos tokens de `src/styles/motion.css`. Respeitar `prefers-reduced-motion`.
- Botões: só o componente `Botao`, nos 5 estilos (primário, secundário, neutro, fantasma, perigo) e 3 tamanhos. Só um botão primário por ecrã. Vermelho só para apagar.
- Alvos de toque de pelo menos 44px. Tem de funcionar em claro e em escuro.
- Textos da interface sem aspas «» e sem legendas a mais.
- Antes de mudar o aspeto de uma tela: ver como as outras já resolvem o mesmo caso e seguir esse padrão.

## Nunca fazer

Sobre o meu trabalho:

- Remover ou alterar funcionalidades sem a minha permissão.
- Refatorar sem pedir (inclui apagar código sem uso e unificar duplicados).
- Usar ou editar o `financas.html` arquivado, a menos que eu diga «AppFinanceiro antigo».
- Pôr capturas de ecrã no git: podem ter dados reais.

As 8 regras de engenharia:

1. Nunca commitar segredos. A config do Firebase em `src/services/firebase.ts` é pública por design; a segurança está em `database.rules.json`. `GEMINI_API_KEY` só no painel da Vercel. Nunca escrever uid, e-mail, UDID, id da equipa Apple ou ids de conta em `docs/`, `CLAUDE.md` ou comentários (usar `<UDID>` e `{uid}`).
2. Nunca repetir código. Antes de criar, procurar em `docs/utils.md`, `docs/componentes.md` e `docs/hooks.md`.
3. Nunca ignorar exceções. Sem `catch` vazio; erros de gravação vão para o toast e o `erroService`.
4. Nunca quebrar a integridade dos dados. Sem `undefined` no RTDB; alterações ligadas num só `update`; backup e migrações nunca apagam dados da conta.
5. Nunca ignorar segurança. Validar o que vem do banco, sem HTML não confiável, sem `any`, regras do RTDB só para o dono, cabeçalhos do `vercel.json` mantidos.
6. Nunca deixar de documentar o essencial. O porquê num comentário curto; a mudança no `HISTORICO.md`; estrutura nova no `docs/` certo.
7. Nunca pular testes. Antes de dar algo por feito: `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check`.
8. Nunca sacrificar a qualidade pela velocidade. Sem remendos temporários; se não der para fazer bem, dizer e propor o caminho.

## Como trabalhar

- Uma tarefa por vez. Avisar o que vai mexer antes de mexer.
- Commits só locais, um por assunto. Sem push até eu pedir.
- Falar sem jargão: o Gabriel não é programador.
- Depois de mudar código: build, `cap sync ios` e instalar no iPhone. Dizer no relatório se ficou instalado.
- Antes de dizer que algo está feito, conferir o resultado (diff e controlos).

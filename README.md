# FinApp

App financeiro pessoal (PWA e iOS), reescrita do antigo AppFinanceiro (`financas.html`, arquivado). A fonte de verdade do código é o próprio código e a pasta `docs/`; o `SPEC_REESCRITA_COMPLETA.md` é a especificação original (local, fora do git).

O esqueleto vanilla-JS anterior deste repo foi descontinuado em 23/07/2026 e substituído por este scaffold — o histórico continua no git.

## Stack

- **Vite + React 19 + TypeScript estrito** (sem `any`)
- **Firebase** (SDK modular v9+): Auth e-mail/senha + Realtime Database — projeto `finapp1-20d00`, região `europe-west1`, regras isoladas por usuário (`users/$uid/...`)
- **ESLint (flat) + Prettier**, testes com **Vitest**, CI no GitHub Actions (lint + formato + testes + build)
- Estado com **zustand** (dividido por domínio), rotas com **react-router** (lazy por página)

## Documentação

A documentação está dividida por assunto, cada parte num ficheiro `.md`. **O ponto de partida é [`docs/README.md`](docs/README.md)**, o índice: arquitetura, dados e API, stores, telas e rotas, componentes, hooks, utils, estilos e design, testes e CI, iOS e deploy, scripts e glossário. O resumo curto para trabalhar está em [`CLAUDE.md`](CLAUDE.md).

Regras de ouro: UI nunca acessa Firebase/localStorage direto (só via `services/`/stores); cálculo financeiro é função pura testável; dinheiro é **centavos inteiros** (`utils/money.ts`).

## Destino

A FinApp é feita para virar app de loja, em iOS e Android. Por agora só se entrega iOS (Capacitor). O diário de mudanças está no `HISTORICO.md` e o que falta fazer no `PENDENCIAS.md`.

## Rodando

```bash
npm install
npm run dev          # abrir no navegador
npm run dev -- --host  # para abrir no celular na mesma rede
npm test             # testes (Vitest)
npm run build        # tsc + vite build
```

### Ver as telas sem conta Firebase

Com o `npm run dev` a correr, abra **`/dev-preview.html`**: é uma entrada só de
desenvolvimento (`src/dev-preview.tsx`) que semeia as stores com dados de
exemplo e salta o login, sem tocar na rede. Serve pra conferir layout e
interações; qualquer ação que grave vai falhar, porque não há sessão real.
Não entra no build de produção — o Vite só usa o `index.html`.

## Copiloto — camada 2 (IA)

O Copiloto responde em duas camadas. A **camada 1** (`utils/copiloto.ts`) é
local, síncrona e determinística, e trata de tudo o que a app sabe calcular. A
**camada 2** só entra quando nenhum intent soube responder, e nunca produz um
número: recebe um resumo já calculado e formatado e limita-se a escrevê-lo.

A chave nunca vai no bundle — a chamada passa por `api/copiloto-ia.ts`, função
serverless da Vercel. Para funcionar em produção é preciso criar, **no
dashboard da Vercel** (Settings → Environment Variables), nunca em ficheiro
commitado:

| Variável         | Obrigatória | Notas                          |
| ---------------- | ----------- | ------------------------------ |
| `GEMINI_API_KEY` | sim         | Chave do Google AI Studio      |
| `GEMINI_MODEL`   | não         | Omitida usa `gemini-2.0-flash` |

Sem a variável a app **não parte**: a camada 2 responde sempre "não consigo
responder agora, tente depois", e a camada 1 continua a funcionar na íntegra.

A cota de 20 perguntas/dia é aplicada só do lado do servidor:
`api/copiloto-ia.ts` reescreve o nó do RTDB com o próprio ID token de quem
pergunta antes de chamar o Gemini, e recusa (429) quando a cota do dia já
está esgotada, sem gastar a `GEMINI_API_KEY`. Chegou a existir um contador
espelho do lado do cliente (`services/iaUsoService.ts`), mas ele descontava a
MESMA pergunta que o servidor também desconta — toda pergunta em uso normal
gastava a cota em dobro — e foi removido; o cliente só lê a resposta (200,
ou não-200 incluindo o 429, que vira sempre a mesma mensagem única).

As regras do Realtime Database mudaram (nó `iaUso`) e precisam de ser
publicadas: `firebase deploy --only database`.

## Repositório

https://github.com/gabriel98pt-art/FinApp

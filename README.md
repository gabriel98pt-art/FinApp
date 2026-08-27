# FinApp

Reescrita completa do app financeiro pessoal (referência funcional: **AppFinanceiro**, `financas.html`), agora com stack moderna. A fonte de verdade do escopo, regras de negócio, modelo de dados e identidade visual é o `SPEC_REESCRITA_COMPLETA.md` (local, fora do git).

O esqueleto vanilla-JS anterior deste repo foi descontinuado em 23/07/2026 e substituído por este scaffold — o histórico continua no git.

## Stack

- **Vite + React 19 + TypeScript estrito** (sem `any`)
- **Firebase** (SDK modular v9+): Auth e-mail/senha + Realtime Database — projeto `finapp1-20d00`, região `europe-west1`, regras isoladas por usuário (`users/$uid/...`)
- **ESLint (flat) + Prettier**, testes com **Vitest**, CI no GitHub Actions (lint + formato + testes + build)
- Estado com **zustand** (dividido por domínio), rotas com **react-router** (lazy por página)

## Estrutura (seção 8 do spec)

```
src/
  components/  layout/  pages/  hooks/  services/
  stores/  utils/  constants/  types/  assets/  styles/
```

Regras de ouro: UI nunca acessa Firebase/localStorage direto (só via `services/`/stores); cálculo financeiro é função pura testável; dinheiro é **centavos inteiros** (`utils/money.ts`).

## Marcos

1. ✅ **Fundação** (23/07/2026): scaffold, tokens dark/light, tipos do modelo de dados, aritmética monetária com testes, login/cadastro real, casca visual com as 11 abas + FAB
2. ✅ Registro rápido (bottom sheet com física de mola), stores de dados + sync RTDB, telas com dados reais
3. ✅ Fatura/parcelas/TVDE/importação/copiloto
4. ✅ Polimento, PWA offline, undo/redo

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

A cota de 20 perguntas/dia é aplicada nos dois lados: o cliente
(`services/iaUsoService.ts`) já não deixa perguntar depois disso, e
`api/copiloto-ia.ts` reescreve o mesmo nó do RTDB com o próprio ID token de
quem pergunta antes de chamar o Gemini — um pedido feito à mão direto ao
endpoint, com um token válido mas cota do dia esgotada, é recusado (429) sem
gastar a `GEMINI_API_KEY`.

As regras do Realtime Database mudaram (nó `iaUso`) e precisam de ser
publicadas: `firebase deploy --only database`.

## Repositório

https://github.com/gabriel98pt-art/FinApp

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
2. ⏳ Registro rápido (bottom sheet com física de mola), stores de dados + sync RTDB, telas com dados reais
3. ⏳ Fatura/parcelas/TVDE/importação/copiloto
4. ⏳ Polimento, PWA offline, undo/redo

## Rodando

```bash
npm install
npm run dev          # abrir no navegador
npm run dev -- --host  # para abrir no celular na mesma rede
npm test             # testes (Vitest)
npm run build        # tsc + vite build
```

## Repositório

https://github.com/gabriel98pt-art/FinApp

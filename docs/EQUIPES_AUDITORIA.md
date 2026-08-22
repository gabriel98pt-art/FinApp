# Equipes de auditoria do FinApp

> Documento vivo. Registra a estrutura de "equipes" (skill do Claude Code + área do projeto que ela audita) usada em auditorias multi-agente do FinApp. Atualizar quando uma skill nova entrar, sair, ou quando surgir uma área que ainda não tem equipe.

## Por que isso existe

Em 21-22/08/2026 rodamos uma auditoria completa do FinApp com 7 equipes especializadas em paralelo (subagentes, leitura apenas). O resultado ficou registrado num relatório visual (artefato), mas a _estrutura_ das equipes — qual skill cobre qual área — só existia solta dentro do prompt da rotina agendada "FinApp Skill Scout". Este arquivo formaliza isso no próprio repositório, para não precisar reconstruir a estrutura do zero na próxima vez.

## Equipes atuais

| Equipe                   | Skills                                                                | Área do projeto                                                       |
| ------------------------ | --------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **Design & Cor**         | `color-expert`, `dataviz`, `apple-design`, `impeccable`               | `src/styles/tokens.css`, componentes visuais, gráficos, gestos/motion |
| **Acessibilidade**       | `fixing-accessibility`                                                | Componentes interativos, formulários, navegação por teclado           |
| **Conversão/Comercial**  | `dark-pattern-audit`, `webapp-paywall-implementation` _(novo, 22/08)_ | Plano comercial TVDE-first (assinatura), paywall, feature gating      |
| **Arquitetura & Código** | `graphify`, `code-review`, `simplify`, `zustand` _(novo, 22/08)_      | `src/services/`, `src/stores/`, `src/hooks/`                          |
| **Segurança**            | `supply-chain-risk-auditor`                                           | Dependências, `authService.ts`, `firebase.ts`, `database.rules.json`  |
| **Performance & PWA**    | `pwa-expert`, `web-perf`                                              | Manifest, service worker, bundle, Core Web Vitals                     |
| **Testes/QA**            | `vitest`                                                              | Cobertura, qualidade dos testes existentes                            |

## Skills novas — 22/08/2026

Achadas pela rotina agendada "FinApp Skill Scout" (roda todo dia às 6h UTC / 7h Lisboa, pesquisa GitHub por skills relevantes e manda e-mail):

- **`zustand`** (oakoss/agent-skills) — Zustand v5: persist, slices, SSR/hidratação, testes. Entrou na equipe Arquitetura & Código porque o FinApp tem 16 stores e a auditoria de arquitetura já achou duplicação de padrão entre elas.
- **`webapp-paywall-implementation`** (curiositech/windags-skills) — Stripe/Lemon Squeezy/Paddle, feature gating em React, ciclo de vida de assinatura. Entrou em Conversão/Comercial porque o plano TVDE-first ainda não tem código — essa skill é para quando o paywall for implementado de verdade.

Ambas instaladas em `.claude/skills/` do próprio projeto (mesmo padrão do `impeccable`), não globais.

## Equipe futura — Migração Capacitor

Ainda **sem skill instalada**. Quando a migração PWA → Capacitor → iOS/Android (ver [`plano-mobile-capacitor.md`](./plano-mobile-capacitor.md)) sair do planejamento para execução, esta equipe entra na lista. A rotina "FinApp Skill Scout" já cruzou, sem confirmar, um candidato: skill de Capacitor/Ionic no repositório `majiayu000/claude-skill-registry` — não verificado ainda, precisa da mesma checagem de legitimidade (repo real, autor real, estrelas plausíveis) antes de instalar.

## Como manter isto atualizado

A rotina agendada "FinApp Skill Scout" (`https://claude.ai/code/routines/trig_01FiVGa527BRpjPLoVHGS1Cy`) pesquisa diariamente e manda e-mail com candidatas verificadas — mas não edita este arquivo sozinha. Toda vez que uma skill nova for instalada a partir do e-mail dela, atualizar a tabela acima manualmente.

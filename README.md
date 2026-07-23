# FinApp

PWA financeiro pessoal, começado do zero em 23/07/2026 reaproveitando o que deu certo no **AppFinanceiro** (`~/Projetos/Dev/Org Finanças`), decidido depois de consulta ao `council` (3 personas: pragmática, cética/riscos, performance/escala).

## Decisões de arquitetura (por quê)

- **Sem build step / sem bundler** — igual ao AppFinanceiro, mas ao contrário dele o JS é **modular desde o dia 1** (`js/*.js`, `<script type="module">` nativo), em vez de um único arquivo gigante. O AppFinanceiro chegou a 612KB num arquivo só e isso já dificulta navegação/edição — as 3 personas do council concordaram que isso é o ponto real que dói, não o Firebase nem a ausência de build.
- **Firebase Auth (e-mail/senha) + Realtime Database** — mesmo backend leve que funcionou bem no AppFinanceiro. Projeto novo e separado (`finapp1-20d00`), não reaproveita o `org-financeira`.
- **Regras isoladas por usuário desde o início** (`users/$uid/...`) — o AppFinanceiro só ganhou isso meses depois (retrofit). Aqui já nasce assim.
- **Testes automatizados desde o início** (`node --test`, zero dependências) cobrindo as funções de cálculo (`js/calc.js`: saldo, resumo por mês, total por categoria). A persona cética apontou que bugs reais do AppFinanceiro (saldo errado, colisão de nomes entre listas) eram exatamente do tipo que um teste automatizado simples pega — mais barato prevenir agora do que retrofitar depois.
- **CI mínimo** (`.github/workflows/ci.yml`): syntax-check de cada módulo JS + `node --test` + validação dos JSONs de config. Mesmo espírito do CI do AppFinanceiro, adaptado pra múltiplos arquivos.
- **Service worker com cache versionado, network-first** — já nasce com a estratégia que corrigiu o bug de cache do AppFinanceiro (cache-first servia versão velha depois de deploy).

## O que NÃO foi copiado de propósito

Funcionalidades específicas do AppFinanceiro (TVDE, copiloto de perguntas, cartões, calendário, metas etc.) ficaram de fora — este é um esqueleto novo e enxuto, só com o essencial (login, lançamentos, saldo, resumo por categoria/mês). Dá pra crescer a partir daqui, mas o objetivo era não repetir o crescimento orgânico sem estrutura que deixou o `financas.html` difícil de navegar.

## Estado do backend (23/07/2026)

- Projeto Firebase ativo: **`finapp1-20d00`** (criado manualmente pelo usuário direto no Console; o projeto inicial `finapp-gc2026` foi abandonado).
- Realtime Database criado, região `europe-west1`. Regras publicadas e confirmadas (`users/$uid/...` isolado por usuário).
- Auth por e-mail/senha publicado e ativo.
- `js/firebase-config.js` e `.firebaserc` já apontam para `finapp1-20d00`.

Nota técnica: o deploy via `firebase_deploy` (MCP) falhava com `"Failed to get instance details"` por um problema de credenciais (ADC sem quota project configurado, afetando a etapa de pré-checagem da API de gerenciamento do RTDB — não era falta do banco). Contornado publicando as regras direto pela REST API do Realtime Database (`PUT /.settings/rules.json`) usando um token do `gcloud auth application-default print-access-token`. O Auth foi publicado normalmente pelo MCP depois de setar o quota project com `gcloud auth application-default set-quota-project finapp1-20d00`.

## Repositório

https://github.com/gabriel98pt-art/FinApp

## Pendências manuais (não dá pra fazer por API)

1. **Ícones PNG/maskable** — só existe um ícone SVG simples (`icons/icon.svg`) por enquanto. Funciona para a maioria dos navegadores, mas iOS "Adicionar à tela de início" se beneficia de PNGs dedicados (192x192, 512x512) — posso gerar mais tarde se quiser.

## Rodando localmente

Sem build step: abra `index.html` direto num servidor estático (ex. `npx serve .` ou a extensão Live Server), porque `fetch`/módulos ES exigem `http://`, não `file://`.

## Testes

```
npm test
```

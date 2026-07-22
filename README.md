# FinApp

PWA financeiro pessoal, começado do zero em 23/07/2026 reaproveitando o que deu certo no **AppFinanceiro** (`~/Projetos/Dev/Org Finanças`), decidido depois de consulta ao `council` (3 personas: pragmática, cética/riscos, performance/escala).

## Decisões de arquitetura (por quê)

- **Sem build step / sem bundler** — igual ao AppFinanceiro, mas ao contrário dele o JS é **modular desde o dia 1** (`js/*.js`, `<script type="module">` nativo), em vez de um único arquivo gigante. O AppFinanceiro chegou a 612KB num arquivo só e isso já dificulta navegação/edição — as 3 personas do council concordaram que isso é o ponto real que dói, não o Firebase nem a ausência de build.
- **Firebase Auth (e-mail/senha) + Realtime Database** — mesmo backend leve que funcionou bem no AppFinanceiro. Projeto novo e separado (`finapp-gc2026`), não reaproveita o `org-financeira`.
- **Regras isoladas por usuário desde o início** (`users/$uid/...`) — o AppFinanceiro só ganhou isso meses depois (retrofit). Aqui já nasce assim.
- **Testes automatizados desde o início** (`node --test`, zero dependências) cobrindo as funções de cálculo (`js/calc.js`: saldo, resumo por mês, total por categoria). A persona cética apontou que bugs reais do AppFinanceiro (saldo errado, colisão de nomes entre listas) eram exatamente do tipo que um teste automatizado simples pega — mais barato prevenir agora do que retrofitar depois.
- **CI mínimo** (`.github/workflows/ci.yml`): syntax-check de cada módulo JS + `node --test` + validação dos JSONs de config. Mesmo espírito do CI do AppFinanceiro, adaptado pra múltiplos arquivos.
- **Service worker com cache versionado, network-first** — já nasce com a estratégia que corrigiu o bug de cache do AppFinanceiro (cache-first servia versão velha depois de deploy).

## O que NÃO foi copiado de propósito

Funcionalidades específicas do AppFinanceiro (TVDE, copiloto de perguntas, cartões, calendário, metas etc.) ficaram de fora — este é um esqueleto novo e enxuto, só com o essencial (login, lançamentos, saldo, resumo por categoria/mês). Dá pra crescer a partir daqui, mas o objetivo era não repetir o crescimento orgânico sem estrutura que deixou o `financas.html` difícil de navegar.

## Pendências manuais (não dá pra fazer por API)

1. **Criar a instância do Realtime Database no Console** — passo obrigatório, único, feito pelo humano (mesma limitação que o AppFinanceiro teve no início):
   - Abrir https://console.firebase.google.com/project/finapp-gc2026/database
   - Clicar em "Criar banco de dados", escolher a região, modo "bloqueado" (as regras já estão prontas em `database.rules.json` e serão publicadas via `firebase deploy` depois).
   - Depois de criado, conferir a `databaseURL` real em `js/firebase-config.js` (tem um TODO marcado lá — a URL pode mudar conforme a região escolhida).
   - Rodar o deploy das regras: `firebase deploy --only database` (ou pedir pra eu rodar via MCP).
2. **Ícones PNG/maskable** — só existe um ícone SVG simples (`icons/icon.svg`) por enquanto. Funciona para a maioria dos navegadores, mas iOS "Adicionar à tela de início" se beneficia de PNGs dedicados (192x192, 512x512) — posso gerar via chrome-devtools-mcp mais tarde se quiser.
3. **GitHub repo** — ver estado abaixo (seção "Deploy").

## Rodando localmente

Sem build step: abra `index.html` direto num servidor estático (ex. `npx serve .` ou a extensão Live Server), porque `fetch`/módulos ES exigem `http://`, não `file://`.

## Testes

```
npm test
```

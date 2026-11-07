# Dicas de organização

Problemas encontrados ao ler o código e sugestões. **Nada disto foi alterado**: são propostas para decidir uma a uma (regra do projeto: não remover nem refatorar sem permissão). Cada item tem um número (G1, D2...) para o poder aprovar pelo nome. Dentro de cada secção, do mais seguro ao mais trabalhoso. Medido em 07/11/2026, em `main`.

Ponto de partida medido: typecheck e build passam; 107 ficheiros e 1985 testes passam; `lint` falha só em `src/dev-botoes.tsx` (ficheiro local, fora do git, por isso não falha na CI); `format:check` falha em 4 ficheiros (ver I1).

## G. Privacidade e ficheiros soltos (primeiro)

1. **FEITO em 07/11/2026 (G1a; G1b por decidir).** **Capturas de ecrã no git.** `.claude/qa-screenshots/` tem **34 PNG versionados** (um só commit os trouxe). Mostram ecrãs da conta de teste: nomes de cartões e bancos, valores de faturas, receitas e despesas. A regra do projeto diz que capturas nunca entram no git. Sugestão, em dois passos separados:
   - **G1a (seguro):** `.claude/qa-screenshots/` no `.gitignore` e `git rm --cached` nas 34. Os ficheiros ficam no disco.
   - **G1b (destrutivo, decisão à parte):** tirar as imagens também do histórico (reescrever o git). Só vale a pena se o repositório for tornado público ou partilhado; implica `push --force` e muda todos os ids de commit. O `.git` pesa 17 MB, dos quais parte são estas imagens.
2. **`public/screenshots/` (3 PNG).** São as imagens do `manifest.json` (pré-visualização de instalação). Mostram dados de exemplo (não parecem da conta real), mas estão no desenho antigo (azul-marinho, antes do «vidro + terracota»). Sugestão: refazê-las com dados fictícios e o visual atual, ou tirar `screenshots` do manifest.
3. **Ícones antigos em `public/icons/`.** Há `icon-v2/v3`, `apple-touch-icon-v2/v3` sem uso aparente; a app usa os v4. Confirmar com grep e apagar os não usados.
4. **`dev-preview.html` e `src/dev-preview.tsx` estão no git**, enquanto `dev-botoes` e `dev-captura` (que fazem o mesmo papel) estão só em `.git/info/exclude`. Decidir: versionar os três, ou excluir os três. Sem isto, quem clona não vê `dev-botoes`.
5. **Pastas geradas** (`coverage/`, `dist/`, `graphify-out/` com 12 MB): já no `.gitignore`. Nada a fazer, só não as apagar sem saber.
6. **`docs/workflow/*/{checks,graph,progress}.md`** (4 pastas, 12 ficheiros, 92 KB): registos de trabalho de fases antigas (por exemplo `progress.md` da Fase A tem tudo «por fazer»). Ninguém no código os referencia. Sugestão: manter como arquivo, ou mover para `docs/arquivo/` com uma linha a explicar. Não apagar.
7. **Relatórios antigos na raiz:** `RELATORIO_AUDITORIA.md` (26/07/2026) e `docs/EQUIPES_AUDITORIA.md`. Sugestão: mover para `docs/arquivo/`, depois de atualizar as ligações do `docs/README.md`.
8. **`.claude/RESUME.md`** (ponto de retoma de agosto, já em `.git/info/exclude`) e `.claude/launch.json` e `skills-lock.json` (por rastrear): decidir se `launch.json` entra no git (útil para outros) e se `skills-lock.json` se ignora.

## A. Contradições e riscos

1. **Duas ideias de «dia de hoje»?** Na FinApp só existe `hojeIso()` (`utils/calculos.ts`), que usa o fuso do aparelho. Está bem para uma app de uso pessoal, mas se o aparelho estiver fora de Portugal o «hoje» muda. Em contraste, o `api/copiloto-ia.ts` conta a cota diária em UTC (`toISOString().slice(0,10)`). Confirmar se essa diferença é intencional.
2. **Três tamanhos de letra fora da escala `--fs-*`:** `13px` em `pilulas.module.css` e `segmentado.module.css`, `17px` em `titulos.module.css`. A regra é só os 6 degraus. Decidir: aceitar como exceção documentada, ou passar para o degrau mais próximo (muda o aspeto).
3. **`docs/design/analise-tabbar-topo.md` cita `--ease-spring`**, que já não existe em `motion.css` (o código usa `--ease-mola`). Corrigir o texto.
4. **O `Botao` pequeno usa `--fs-body` e o normal/grande `--fs-title`.** Confirmar se é intenção do padrão comum com a TVDE Pro.
5. **CSP em modo só-relatório** (`vercel.json`: `Content-Security-Policy-Report-Only`). Não bloqueia nada. Decidir se passa a bloquear (exige testar todas as chamadas externas).
6. **Camadas:** os serviços importam stores (`syncService`, `cfgService`, `historicoService`), o que foge à regra «só importa das camadas de baixo». Pode ser intencional (sync escreve nas stores). Confirmar e, se for, escrever a exceção em `docs/arquitetura.md`.
7. **Sem migrações por versão.** Só há normalização na leitura (`normalizarConfig`, `normalizarTvde`). Para a app Android e novas versões de dados, convém ter um `docs/migracoes.md` com as regras (como o TVDE Pro). Proposta de documento, não de código.
8. **Campos antigos na conta** (`currency`, `fontesReceita`, `kpisMobile` e outros) ficam ignorados. Fazer a lista completa e decidir se algum dia se limpam (nunca apagar sem backup).

## B. Código que só os testes usam (ou ninguém)

Medido por exportações sem importadores fora dos testes. Nenhuma é apagada sem o teu «sim». Três grupos:

- **Sem nenhum uso e sem teste** (candidatos a remover): `removerParcela` e `removerDespesaFixa` (`lancamentosService.ts`), `diaDe` e `lancamentosDoMesVeiculo` (`utils/calculos.ts`, `utils/veiculo.ts`).
- **Só usadas nos testes** (confirmar se são para uso futuro): `restaurarSnapshotDeSeguranca`, `removerFixaVeiculo`, `resumoMes`, `saldoTotal`, `resumoMesCompleto`, `diasComEventoNoMes`, `podeRefazer`, `fromCents`, `ORDENS_PARCELA`, `ROTULOS_ORDEM_PARCELA`, `DADOS_RENOMEAR_VAZIOS`.
- **Exportadas sem precisarem de ser** (só usadas dentro do próprio ficheiro; tirar `export` não muda nada): cerca de 50, sobretudo em `utils/imagem.ts`, `utils/importacao.ts`, `utils/extrairExtratoPdf.ts`, `utils/notificacoes.ts`, `utils/tvde.ts`, `utils/copiloto.ts`. Muitas existem só para o teste as chamar; neste caso o `export` é razoável. Baixa prioridade.

## C. Duplicados e comentários desatualizados

1. **A constante `MOBILE = "(max-width: 767px)"`** repete-se em `layout/RegistroRapido.tsx` e `components/FolhaAncorada.tsx` (e o valor também está em `hooks/useMediaQuery.ts` como exemplo e no CSS). Sugestão: uma só constante em `constants/`.
2. **98 comentários citam «seção X.Y»** do `SPEC_REESCRITA_COMPLETA.md`, que está fora do git. Quem clona não consegue seguir a citação. Sugestão: manter o texto e tirar só o número da secção, ou copiar para `docs/` o que o spec definia e ainda vale.
3. **Comentários «portado do `financas.html`»** em `types/tvde.ts`, `utils/importacaoParser.ts`, `utils/extrairExtratoPdf.ts`, `utils/coresCategoria.ts` e `utils/spring.ts`. São história da origem do código, não apontam para uso. Sugestão: deixar (útil para saber porquê), ou encurtar para «portado da app antiga». Não tocar no ficheiro arquivado.
4. **`README.md` desatualizado:** fala em 11 abas (são 9), lista «Marcos» já cumpridos e em «seção 8 do spec». **`HISTORICO.md`** diz «Período coberto: 23/07/2026 a 11/10/2026 — 528 mudanças», mas já vai a novembro. Sugestão: atualizar as duas linhas e apontar o `README.md` para o `CLAUDE.md` e `docs/README.md`.

## D. Ficheiros grandes (divisão sugerida; só mover código)

| Ficheiro                                                                   | Linhas | Divisão sugerida                                                                                                                                           |
| -------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `utils/copiloto.ts`                                                        | 1550   | O grosso é a lista `INTENTS_COPILOTO` (da linha ~695 ao fim). Dividir em `copiloto/` por assunto (saldo, fatura, meses, metas...); deixar o motor no topo. |
| `pages/Veiculo.tsx`                                                        | 1307   | `pages/veiculo/`: um painel por separador (cargas, abastecimentos, despesas, fixas, km) e as folhas inline para ficheiros próprios.                        |
| `layout/RegistroRapido.tsx`                                                | 1186   | Um ficheiro por tipo de registo (despesa, receita, parcelada, reembolso, veículo), com o estado partilhado num hook.                                       |
| `pages/Cartoes.tsx`                                                        | 1058   | Já tem sub-blocos (`ControlesFatura`, `LinhaTransferencia`): passá-los a `pages/cartoes/`, mais o separador de parcelas.                                   |
| `pages/Importar.module.css`                                                | 1033   | 149 regras para um fluxo com vários passos. Dividir por componente (`importar/*.module.css`), ao lado de cada peça.                                        |
| Testes grandes (`copiloto.test.ts` 1613, `importacaoService.test.ts` 1216) | —      | Seguir a divisão do ficheiro que testam.                                                                                                                   |

Prova de que dividir não muda nada: mesmos testes a passar, mesmo HTML renderizado.

## H. Testes

1. **A cobertura só mede `api/`, `src/services/` e `src/utils/`** (94,6% das instruções, 96,3% das linhas). Componentes, hooks, layout, páginas e stores não entram no número. Sugestão: acrescentar `src/**` à cobertura para ter o número real (vai baixar), ou documentar que é só lógica.
2. **Sem teste com o mesmo nome:** 18 hooks (`useAplicarTema`, `useConfirmar`, `useDragToClose`, `useFocoModal`, `usePullToRefresh`, `useSyncConta`...), 6 de layout (`AppShell`, `Sidebar`, `Fab`...), 38 componentes e 15 stores. Alguns serão cobertos por testes das telas; confirmar com a cobertura real (H1) antes de escrever testes.
3. **Ponto fraco conhecido:** `utils/imagem.ts` com 49% (a parte de recorte e compressão).
4. **A CI falha agora** no passo de formatação (I1), por isso hoje não dá confiança para entregar.

## E. Pastas

1. `src/dev-*.tsx` e `dev-*.html` na raiz: juntar numa pasta `dev/` (e `src/dev/`), como o TVDE Pro. Depende de G4.
2. `docs/` sem subpastas por assunto: se crescer, `docs/arquivo/` (G6, G7) e `docs/design/` (já existe).
3. `src/components/` tem 50 ficheiros soltos. Agrupar por família (`seletores/`, `folhas/`, `cartoes/`) facilitaria encontrar, mas é a mudança com mais imports a reescrever; só com script e `tsc -b`.

## I. Manutenção

1. **FEITO em 07/11/2026.** **`format:check` falhava em 4 ficheiros** (`docs/design/analise-tabbar-topo.md`, `BottomSheet.tsx`, `Popover.tsx`, `usePullToRefresh.ts`). Correr `prettier --write` nesses 4 resolve e repõe a CI verde. É a primeira coisa a fazer na Fase 4 (muda formatação, não comportamento).
2. **Lint com 1 erro local** em `src/dev-botoes.tsx` (react-refresh). Só afeta quem tem o ficheiro; resolvido se G4 excluir ou corrigir.
3. **Dependências:** correr `npm outdated` e `npm audit` de vez em quando; não feito aqui.
4. **Rotina por entrega:** typecheck, lint, format:check, build e testes antes e depois (os «5 controlos»), mais a instalação no iPhone nas mudanças de código.
5. **Android:** quando chegar a hora, a lista do que é específico de iOS (`ios/`, o caminho do build, comportamentos de teclado e folhas) deve estar em `docs/ios-e-deploy.md` para ser isolada. Hoje não está separada.

## Ordem sugerida para a Fase 4

1. I1 (formatação, repõe a CI).
2. G1a, G3, G4, G6/G7 (limpezas de git e pastas, sem tocar no código da app).
3. C4, A3 (atualizar textos).
4. A2, A4, C1 (decisões de design/pequenas, com o teu «sim»).
5. B (remoções, uma a uma).
6. D, E (as mais trabalhosas, em último).
7. G1b só se decidires que o repositório vai ser partilhado.

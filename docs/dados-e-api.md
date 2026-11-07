# Dados e API (Firebase e Vercel)

Escrito a partir da leitura do código. Se divergir do código, vale o código: corrija o documento.

Projeto Firebase `finapp1-20d00`. Base: `https://finapp1-20d00-default-rtdb.europe-west1.firebasedatabase.app` (europe-west1). A configuração é pública por design (`src/services/firebase.ts`): a segurança está nas regras. Inicialização única nesse ficheiro (`firebaseApp`, `auth`, `db`).

## Caminhos no Realtime Database

Raiz de cada conta: `users/{uid}/fin_v5/...`.

| Caminho                                           | O que guarda                                                                                      | Quem lê/escreve                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `.../fin_v5/cfg`                                  | `ConfigConta` (instituições e métodos, categorias, orçamentos, faturas pagas, preferências...)    | `cfgService`, `faturaService`                            |
| `.../fin_v5/receitas/{id}`                        | `Receita`                                                                                         | `lancamentosService`                                     |
| `.../fin_v5/despesasCorrentes/{id}`               | `DespesaCorrente`                                                                                 | `lancamentosService`, `faturaService`, `parcelasService` |
| `.../fin_v5/despesasFixas/{id}`                   | `DespesaFixa`                                                                                     | `lancamentosService`                                     |
| `.../fin_v5/parcelas/{id}`                        | `Parcela` (com `pagoPorMes`)                                                                      | `lancamentosService`, `parcelasService`                  |
| `.../fin_v5/transferencias/{id}`                  | `Transferencia`                                                                                   | `lancamentosService`                                     |
| `.../fin_v5/eventos/{id}`                         | `EventoCalendario`                                                                                | `eventosService`                                         |
| `.../fin_v5/fundos/{id}`                          | `Fundo`                                                                                           | `fundosService`                                          |
| `.../fin_v5/veiculo/cargas`                       | `Abastecimento`                                                                                   | `veiculoService`                                         |
| `.../fin_v5/veiculo/despesas`                     | `DespesaVeiculo`                                                                                  | `veiculoService`                                         |
| `.../fin_v5/veiculo/despesasFixas`                | `DespesaFixa` do veículo                                                                          | `veiculoService`                                         |
| `.../fin_v5/veiculo/quilometragem`                | `RegistroKm`                                                                                      | `veiculoService`                                         |
| `.../fin_v5/tvde`                                 | `DadosTvde`: `cfg`, `semanas`, `segPorMes`, `lancamentos` (semana para id da receita), `despesas` | `tvdeService`                                            |
| `.../fin_v5/iaUso/{dia}`                          | contador diário de perguntas à IA (número, `>= 0`)                                                | só `api/copiloto-ia.ts`                                  |
| `users/{uid}/erros_app`                           | erros capturados (guarda no máximo 30, com idade máxima de 14 dias)                               | `erroService`                                            |
| `users/{uid}/_seguranca/snapshotAntesRestauracao` | cópia dos dados antes de restaurar um backup (`versao`, `criadoEm`, `dados`)                      | `backupService`                                          |

- `caminhoDominio(uid, dominio, id?)` em `lancamentosService.ts` monta os caminhos de receitas, despesasCorrentes, parcelas, despesasFixas e transferencias.
- `erros_app` e `_seguranca` ficam FORA de `fin_v5` de propósito: essa árvore é sobrescrita por restaurar-backup e por desfazer/refazer. `apagarConta` remove `users/{uid}` inteiro, por isso os dois saem com a conta.
- O RTDB remove objetos e listas vazios: `normalizarConfig` e `normalizarTvde` repõem os valores por omissão, e `pagoPorMes` é reposto no `syncService`.
- O RTDB recusa `undefined`: `semIndefinidos` (em `lancamentosService.ts`) antes de gravar.
- Em escritas feitas à mão, listas guardadas como mapa por id (ex.: `cfg.instituicoes`, `tvde.despesas`) têm de ser gravadas como mapa; gravá-las como lista faz o RTDB reindexar por posição e troca os ids (ver comentários em `historicoService.ts`).
- Campos que já não se usam podem ficar na conta, ignorados (ex.: `cfg.currency`, `cfg.fontesReceita`, `cfg.kpisMobile`). Confirmar a lista completa antes de os apagar. Nada se apaga da conta (regra do `CLAUDE.md`).

## Regras de segurança (`database.rules.json`)

Só o dono lê e escreve: `auth != null && auth.uid === $uid`, em `users/$uid` (cobre `fin_v5`, `erros_app` e `_seguranca`). Única validação extra: `fin_v5/iaUso/$dia` tem de ser número `>= 0`. Auth por e-mail e senha (`firebase.json`). O `firebase.json` só configura as regras da base de dados e o login.

## Serviços (`src/services/`)

### `authService.ts`

`Sessao` · `SENHA_MINIMA = 8` (só em senhas novas; no login não se exige) · `entrar` · `cadastrar` · `sair` · `enviarRecuperacaoSenha` · `alterarSenha(atual, nova)` · `apagarConta(senha)` (remove `users/{uid}` inteiro) · `observarSessao(cb)` · `mensagemDeErroAuth` · `mensagemDeErroSenhaAtual`.

### `cfgService.ts` (`.../fin_v5/cfg`)

`normalizarConfig(bruto)` · `observarConfig(uid, cb, aoErro)` · `atualizarConfig(uid, mudancas)` · instituições e cartões: `adicionarCartao`, `adicionarMetodo`, `renomearCartao`, `removerCartao`, `definirDiaVencimentoFatura`, `definirDiaFechamentoFatura` · listas: `adicionarItemLista`, `removerItemLista` · aparência: `definirIconeCategoria`, `definirCorCategoria`, `definirCorApp` · orçamento e saldos: `definirOrcamento`, `definirOrcamentoTotal`, `definirSaldoInicial`, `definirFaturaManual` · `definirPreferenciasCopiloto`.

Cascatas (um só `update()` na raiz `fin_v5`, mapa de caminhos montado por `utils/renomear.ts`): `renomearCategoria`, `renomearFonte`, `renomearLocal`. Varrem receitas, despesas, fixas, transferências, parcelas e as coleções do veículo, lidas das stores. Cartão e conta não entram: o lançamento guarda o id do método de pagamento, que não muda; renomear é uma escrita só no nome da instituição.

### `lancamentosService.ts`

Para cada domínio (receitas, despesas correntes, parcelas, despesas fixas, transferências): `observarX`, `criarX`, `atualizarX`, `removerX`. Mais `alternarPagoDespesaFixa` e `caminhoDominio`.

### `parcelasService.ts`

Updates multi-caminho: `criarParcela`, `pagarMesParcela`, `espelhosDoMes`, `definirValorDoMes`, `limparValorDoMes`, `estornarMesParcela`, `quitarParcela`, `excluirParcela`. O lançamento mensal e o estado pago da parcela não divergem. Parcela de débito automático gera o lançamento sem cartão.

### `faturaService.ts`

`pagarFatura(uid, ctx)`, `removerPagamentoFatura`, `reabrirFatura`. Cada uma é um `update()` atómico: o lançamento do pagamento, a lista em `cfg/faturasPagas/{cartao}/{mes}` e as parcelas quitadas ficam sempre em sincronia.

### `importacaoService.ts`

`confirmarImportacao` grava as linhas marcadas para importar num só `update()` (receitas, despesas correntes, cargas, transferências, pagamentos de fatura); nada é gravado antes dessa chamada. Também `construirExistentes`, `dadosDaCarga`, `dadosDaTransferencia`, `pagamentoDaLinha`, `apagarExistentes`.

### `eventosService.ts` e `fundosService.ts`

`observarEventos`, `criarEvento`, `removerEvento` · `observarFundos`, `criarFundo`, `removerFundo`, `contribuirFundo`.

### `tvdeService.ts` (`.../fin_v5/tvde`)

`normalizarTvde` · `observarTvde` · `salvarConfigTvde` · `salvarSemana` · `removerSemana` · `definirSegMes` · `criarDespesaTvde` · `removerDespesaTvde` · `lancarReceitaSemana(uid, n, dados)` (cria a receita e liga-a à semana num só `update`) · `desfazerLancamentoSemana`. Re-exporta `TVDE_CFG_PADRAO`, `TVDE_VAZIO`. O módulo é autónomo: só a receita lançada à mão entra nos totais gerais.

### `veiculoService.ts` (`.../fin_v5/veiculo/*`)

`observarVeiculo` (junta as 4 sub-coleções num `DadosVeiculo`) · cargas, despesas, fixas e km: `criarX`, `atualizarX`, `removerX` · `alternarPagoFixaVeiculo(uid, fixa, mes, pago, despesas)`. Re-exporta `VEICULO_VAZIO`.

### `historicoService.ts`

`capturarEstadoAtual()` (JSON das stores em memória, sem rede) e `restaurarEstado(uid, json)` (um `update()` por domínio; `iaUso` e outros nós sem store ficam intactos).

### `backupService.ts`

`validarArquivoBackup(json)` · `exportarBackup(uid)` · `importarBackup(uid, json)` · `restaurarSnapshotDeSeguranca(uid)`. Ordem fixa ao restaurar: validar o ficheiro, guardar a cópia dos dados atuais em `_seguranca`, só então sobrescrever `fin_v5`. Se a cópia falhar, nada é sobrescrito. Versão do formato do ficheiro: 1.

### `syncService.ts`

`iniciarSyncConta(uid)`: liga 10 subscrições (receitas, despesas correntes, parcelas, cfg, tvde, veículo, eventos, fundos, despesas fixas, transferências) às stores e inicia o histórico; devolve a função que desliga tudo e limpa as stores. Chamada pelo hook `useSyncConta` no `AppShell`.

### `erroService.ts` (`users/{uid}/erros_app`)

`ErroRegistado` · `registrarErro(uid, {...})` (poda por quantidade e idade) · `observarErros` · `limparErros`. Alimentado pelo hook `useCapturarErros`.

### `copilotoIA.ts`

`responderComIA(pergunta, ctx, uid)` e `MENSAGEM_IA_INDISPONIVEL`. Nunca lança: qualquer falha dá a mesma mensagem. Pede o ID token ao Firebase Auth e faz POST a `api/copiloto-ia`. Tempo limite do cliente: 12 s. Não desconta cota: quem desconta é o servidor.

## Função serverless (`api/copiloto-ia.ts`)

Função da Vercel, autónoma (não importa de `src/`). `POST` com `Authorization: Bearer <ID token do Firebase>`.

1. Método diferente de POST: 405.
2. Token ausente ou inválido (assinatura verificada com `jose` contra as chaves públicas do Google): 401.
3. `GEMINI_API_KEY` por configurar: 503. A chave só existe como variável de ambiente na Vercel. `GEMINI_MODEL` opcional (por omissão `gemini-2.0-flash`).
4. Corpo inválido: 400.
5. Cota diária: 20 perguntas por conta e por dia (dia em UTC), contada em `users/{uid}/fin_v5/iaUso/{dia}` pela API REST do RTDB com o próprio token do utilizador e escrita condicional por ETag. Esgotada ou sem conseguir contar: 429.
6. Pergunta ao Gemini (máx. 400 tokens, tempo limite 10 s). Falha: 503. Sucesso: 200 com `{ resposta }`.

O cliente trata qualquer resposta que não seja 200 como a mesma mensagem única.

## Cabeçalhos (`vercel.json`)

Em todas as rotas: `Content-Security-Policy-Report-Only` (só relata, não bloqueia; confirmar se vai passar a bloquear), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` sem câmara, microfone nem localização. Não há reescritas nem configuração de `api/` (a Vercel reconhece a pasta).

## Tipos (`src/types/`)

- `common.ts`: `Id`, `Cents` (inteiro), `IsoDate`, `YearMonth`, `Currency`, `Theme` (`system | dark | light`).
- `config.ts`: `ConfigConta`, `Instituicao`, `MetodoPagamento`, `TipoCartao`, `TipoMetodo`, `CoresApp`, `PreferenciasCopiloto`, `TipoNotificacao`, e as versões «Bruta» (como vêm do RTDB).
- `lancamentos.ts`: `Receita`, `DespesaCorrente`, `DespesaFixa`, `Transferencia`, `OrigemLancamento` (`parc | fat | fixa | recon | reemb`).
- `parcela.ts`: `Parcela`. `planeamento.ts`: `EventoCalendario`, `Fundo`. `fatura.ts`: `PagamentoFatura`, `PagamentosFatura`, `FaturaCalculada`.
- `tvde.ts`: `SemanaTvde`, `ConfigTvde`, `DespesaTvde`, `DadosTvde`. `veiculo.ts`: `TipoVeiculo` (`eletrico | combustao | hibrido`), `Abastecimento`, `RegistroKm`, `DespesaVeiculo`, `DadosVeiculo`.
- `importacao.ts`: tipos da importação de extratos (`LinhaExtrato`, `LinhaAnalisada`, `StatusDuplicata`...).
- `estado.ts`: `EstadoConta`, o agregado de tudo (backup e migração).

## Migrações

Não encontrei ficheiros de migração por versão no `src/` (ao contrário de um esquema versionado). A compatibilidade com contas antigas é feita na leitura (`normalizarConfig`, `normalizarTvde`, valores por omissão). Confirmar se existe outro mecanismo de migração.

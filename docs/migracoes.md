# Migrações de dados

Escrito a partir da leitura do código. Se divergir do código, vale o código: corrija o documento.

A FinApp **não tem versão de esquema gravada na conta** e não tem passos de migração numerados (ao contrário da TVDE Pro). Os dados antigos tratam-se de duas formas: **normalização na leitura** e **migração preguiçosa na primeira escrita**. Este documento fixa as regras para quando o formato dos dados mudar, na app iOS e, no futuro, no Android.

## Como é hoje

- **Normalização na leitura** (nada é gravado de volta):
  - `normalizarConfig` (`services/cfgService.ts`): põe os valores por omissão campo a campo (`CONFIG_PADRAO`), limpa o que vem de uma base partilhada (nome, foto, `kpiDestaque`) e reconstrói a lista de contas e cartões (`instituicoes`).
  - `normalizarTvde` (`services/tvdeService.ts`): repõe mapas que o Realtime Database transforma em listas com buracos (`fixMapa`) e dá valores por omissão ao TVDE.
- **Migração preguiçosa de `instituicoes`:** uma conta antiga só tem os campos `contasCartoes`, `tipoCartao` e datas da fatura. Na leitura, a lista de instituições é **sintetizada em memória** (`instituicoesGravadas: false`). Só na primeira escrita real sobre contas ou cartões é que a árvore inteira é gravada (`patchInstituicoes`). Gravar só um ramo antes disso faria as outras contas desaparecerem da lista.
- **Backup** (`services/backupService.ts`): o ficheiro tem `versao: 1`; sem `versao` é aceite como 1; outra versão é recusada com mensagem. Antes de restaurar, os dados atuais vão para `_seguranca`; se essa cópia falhar, nada é sobrescrito.
- Campos antigos que já ninguém usa **ficam na conta**, ignorados (por exemplo `currency`, `fontesReceita`, `kpisMobile`). Não há lista completa deles (confirmar).

## A regra

**Cada passo de leitura tem de aceitar valores de formatos mais novos e ser idempotente.**

Como a versão não é gravada, uma conta antiga volta a passar por toda a normalização em cada leitura, já sobre dados escritos pela build atual. Se um passo antigo «limpa» um valor com a lista do seu tempo, apaga valores novos. Por isso:

- Os valores aceites de cada lista ou enum ficam num só sítio (constante exportada). Os passos usam essa constante em vez de escreverem os valores à mão.
- Um valor novo entra no tipo **e** na constante. Se faltar, o typecheck deve falhar.
- Ler duas vezes dá o mesmo que ler uma.
- **Nunca gravar durante a leitura.** Escrever ao ler muda o comportamento e arrisca a conta real (duas janelas abertas ao mesmo tempo disputariam a escrita). A migração acontece na primeira escrita real.
- **Nunca apagar dados da conta** numa migração. Campos obsoletos deixam de ser lidos; o que está no banco fica.
- Antes de mudar o formato de algo que já existe na conta: **backup** (a app já o faz) e um teste com uma conta no formato antigo.

## Para uma mudança de formato

1. Escrever o tipo novo e a constante dos valores aceites.
2. Normalizar na leitura: o formato antigo continua a funcionar (valor por omissão ou conversão em memória).
3. Escrever só o formato novo, e só quando o utilizador gravar algo.
4. Teste com um estado antigo, um estado novo e a leitura repetida.
5. Registar no `HISTORICO.md` e neste documento.

## Android

Os dados vivem no Firebase, por isso a app Android lê os mesmos dados. Qualquer migração tem de funcionar para quem ainda usa a versão antiga da app no iPhone: nunca gravar um formato que a versão anterior não saiba ler.

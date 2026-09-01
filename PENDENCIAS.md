# Pendências — FinApp

Este arquivo não faz parte do app. É a lista do que ficou de fora quando se
pergunta "o que falta fazer" — coisas que foram identificadas mas não
resolvidas, com o motivo de terem ficado pra depois. Toda vez que alguém
perguntar "o que falta", isto entra na resposta junto com o resto.

Entrada mais recente no topo.

---

## Sweep de padronização (01/09/2026) — parado no meio, falta retomar

**Contexto**: dois agentes rodando em paralelo, cada um varrendo um grupo de
telas atrás de dois padrões (item 4 do lote de UX/nav — "Quanto?" + Descrição
única — e botões "+ Adicionar X" virarem só ícone), bateram no limite de
sessão compartilhado entre Principal/Gestor/Auxiliar no meio do trabalho.

**Já feito e no ar** (commit `b5b4cf1`): Cartões (Nova transferência),
Despesas (Nova despesa fixa) e Veículo (despesa variável, despesa fixa,
abastecimento) — os três com o padrão "Quanto?" + Descrição única.

**Falta** (retomar depois do reset do limite, ~6h20 Lisboa):
- Padronizar formulário: Calendário (novo evento), Parcelas, Planejamento
  (fundo/contribuição, "Definir teto" em `OrcamentoCard.tsx`), TVDE.
- Botões "+ Adicionar X" virarem ícone (nenhuma tela mexida ainda): Calendário,
  Cartões, Despesas (×2), Veículo (×4), Parcelas, Planejamento, TVDE — sempre
  dentro do corpo da página, nunca no cabeçalho (regra fixa, ver
  `feedback_finapp_nada_no_cabecalho`).
- "débito automático" da lista de Despesas Fixas: rewrap pra ícone compacto
  (sugestão do Gabriel: "↻" perto do dia, ou selo no ícone da categoria) —
  nem começado.

## Listas que ficaram SEM paginação (01/09/2026)

**Contexto**: em 01/09 o Gabriel pediu paginação em Transações "e em qualquer
outra lista do app que não tenha". Foram auditadas todas as listas. Ganharam
paginação: **Transações** (o extrato do mês) e **TVDE → Semanas**. As de baixo
ficaram de fora, cada uma pelo seu motivo. Nenhuma é "esqueci" — todas foram
olhadas e decididas.

O critério foi um só: **a lista pode crescer sem limite claro e passar das 15
linhas num uso normal?** Se não pode, paginar só acrescenta um controlo a mais
para não fazer nada.

### Cartões → Transferências entre contas — **não paginada**

Mostra só as transferências do mês exibido. Mover dinheiro entre contas
próprias é coisa de duas ou três vezes por mês; chegar a 15 num mês só seria
excecional. **Segundo motivo, mais imediato**: a tela de Cartões estava a ser
reestruturada em paralelo no mesmo dia (a secção "Cartões e contas"), e mexer
lá agora só criava conflito. **Se um dia mudar**: é o mesmo padrão de
Transações, mais ou menos 15 linhas de código.

### Calendário → Próximos 7 dias e a folha de um dia — **não paginadas**

A primeira é, por definição, uma janela de sete dias; a segunda é o que cai
num único dia. As duas são pequenas por desenho, não por acaso — o limite está
no calendário, não na quantidade de dados. Paginar aqui era pôr setas numa
lista que raramente passa de meia dúzia de linhas.

### Veículo → abastecimentos, despesas, fixas e km — **não paginadas**

Todas presas ao mês exibido. Um mês de abastecimentos são 4 a 10 registos, as
fixas do veículo são 2 ou 3. A de km é a que mais pode crescer (quem anota
todos os dias chega aos 30), e é a primeira candidata **se o Gabriel disser
que incomoda** — mas hoje não justifica.

### Importar → pré-visualização do extrato — **não paginada, de propósito**

Esta pode ter centenas de linhas, e mesmo assim fica sem paginação: é uma tela
de conferência, onde se marca linha a linha o que entra e o que fica de fora
antes de gravar. Espalhar isso por páginas é o cenário perfeito para alguém
importar sem ter visto metade, ou perder marcações ao mudar de página. A tela
já tem filtros por decisão (todas / importar / ignorar), que é a forma certa de
encurtar a lista aqui.

### TVDE → Meses e Períodos — **não paginadas**

São tabelas compactas de uma linha de três números cada, uma por mês (12 por
ano). Cinco anos de uso dão 60 linhas curtas — muito diferente dos cartões
grandes da aba Semanas. Revisitar só se alguém usar o módulo por vários anos.

### Definições → categorias, fontes, locais de abastecimento — **não paginadas**

São listas de configuração que o próprio utilizador escreve. Quem tem 40
categorias tem um problema de organização, não de paginação.

---

## Ordem "data · categoria": onde NÃO foi aplicada (01/09/2026)

Na mesma tarefa, a linha de baixo dos itens de lista passou a começar pela
data. Duas listas ficaram como estavam **porque não têm data nenhuma**:

- **Despesas → Fixas**: a linha é "Saúde · ActivoBank · dia 1 · débito
  automático". O "dia 1" não é uma data, é o dia de vencimento que se repete
  todo mês — não há o que alinhar numa coluna, e pô-lo à frente empurrava para
  segundo plano a categoria, que é o que identifica a linha.
- **Parcelas**: mesma coisa, e ali a linha começa pelo valor total da compra,
  que é o número âncora.

**Se o Gabriel quiser na mesma**: é uma linha em cada ficheiro
(`src/pages/Despesas.tsx` e `src/pages/Parcelas.tsx`), trocar a ordem dos
pedaços do texto. Ficou por decidir, não por esquecimento.

---

## Decisões pendentes (não bloqueiam nada)

### Splash por tema no PWA

**Levantado em 31/08/2026**.

O app nativo (Etapa D) tem splash screens em tema claro e escuro. A PWA também
poderia ter, adaptando-se ao tema do utilizador — mas o Safari exige que o splash
seja definido no manifest por tema, e isso criaria 20+ ficheiros adicionais e uma
regra de build complexa. **Decisão tomada: deixado de fora de propósito** — só
entra se o Gabriel disser que vale a pena o overhead.

---

### Screenshots do manifest usam dados de demonstração

**Levantado em 31/08/2026**, na Etapa B.

O `manifest.json` já tem `screenshots` com URLs apontando a dados de exemplo.
Para a App Store de verdade, a Apple exige screenshots em tamanhos específicos
(540×720, 1170×2532, etc.). Capturar esses screenshots e tratá-los é **fora do
escopo da Etapa B** — ficava pro momento em que se submete à loja (Etapa F).
Hoje fica com dados de demonstração só pra validar que a estrutura está certa.

---

### Ícones antigos (v2/v3) continuam em `public/`

**Levantado em 31/08/2026**.

O diretório `public/icons/` tem o novo ícone (`icon-v4.svg`) e as PNGs geradas
dele. Os ícones das versões anteriores (v2 e v3) continuam lá, não foram apagados
— **de propósito**, pra não quebrar o cache de quem já tem o app instalado como
PWA. Quando a Etapa F (submissão) passar, esses ficheiros antigos podem sair.

---

## PWA

### Botão de instalar o app

**Por que ficou de fora**: seria um atalho pra instalar o FinApp como PWA
(ícone próprio, abre sem a barra do navegador). Decisão: **deixado de lado**,
não é "falta fazer" — é decisão tomada. O plano comercial já prevê o FinApp
sair de PWA e virar app nativo (ver decisão registrada em 20/08/2026), então
não vale investir numa tela pra uma etapa que vai ser substituída.

**Se um dia mudar de ideia**: revisitar só se o plano de sair de PWA mudar.

---

## Resolvido (fica registrado por onde passou)

### Contas e cartões mudaram-se inteiros para Definições

**Resolvido em 01/09/2026**, em dois tempos.

Em **31/08** foi só o formulário de criar: o campo de nome + tipo que vivia
dentro da seção "Cartões e contas", na própria tela de Cartões, virou uma
folha em Definições ("Registo" → "Nova conta ou cartão"). A lista do que já
existe e a gestão de cada um (renomear, remover, dia de fatura, pelo menu "⋯"
de cada pílula) ficaram em Cartões.

Em **01/09** o Gabriel reconsiderou e pediu a gestão toda no mesmo sítio. A
folha passou a chamar-se "Contas e cartões" e faz agora tudo: criar,
renomear, remover, juntar um 2.º método à mesma instituição e acertar os dois
dias da fatura. A seção "Cartões e contas" saiu inteira da tela de Cartões,
que ficou só com o que se lê (KPIs, quadros, faturas, transferências).

Resolve de quebra a dúvida sobre o "+" de Cartões só abrir "Adicionar
transferência": com "criar conta/cartão" fora da tela, esse "+" passa a ter
só mesmo um fluxo — não precisa de virar menu.

**Inconsistência assumida de propósito**: nesta folha as ações de cada item
são botões visíveis na linha (o desenho da lista de categorias, que é o
padrão de Definições), e não o menu "⋯" (`MenuAcoesItem`) que Transações,
Parcelas e Veículo usam para editar item de lista. O Gabriel decidiu assim
com o custo à vista — não é um esquecimento a corrigir depois.

### "Adicionar X" no cabeçalho — tentado e revertido no mesmo dia

**Tentado e revertido em 31/08/2026.** Chegou a existir um "+" por página no
cabeçalho, substituindo os botões "Adicionar X" espalhados pelas telas (ver
commits `04c01c8`, `8f99fb3`, `253a821`, revertidos em `236c3e2`/`260eeba`).
O Gabriel rejeitou assim que viu, com firmeza: o cabeçalho não recebe nada de
novo sem ele pedir primeiro — regra geral daqui pra frente, não só deste
caso. Os botões "Adicionar X" voltam a ficar dentro de cada tela, como
sempre estiveram.

### Cinco ícones no cabeçalho não cabem com 44 pontos de largura

**Resolvido em 31/08/2026**, pela hipótese 1 da lista original: tirar botões
do cabeçalho, e não redesenhar os outros. O Gabriel decidiu que desfazer e
refazer saem de lá — eram as duas únicas ações do cabeçalho que não abriam
nada. Ficaram o tema e o sino dos lembretes.

Com dois botões em vez de cinco, a conta passa a fechar: 2 × 44 = 88 pontos,
onde antes eram precisos 220. O desenho de cada ícone continua nos 30 pontos
(discreto, como sempre foi) — quem tem os 44 é a área de toque invisível à
volta dele. O espaço entre os dois passou de 1 para 14 pontos, que é o que
faz as duas áreas encostarem sem se sobreporem: sem isso um toque na
fronteira ia parar ao botão errado.

Medido ao vivo num telemóvel de 375 pontos, com a pré-visualização local: a
marca "FinApp" fica inteira, "setembro 2026" fica inteiro e os dois botões
têm 44×44 pontos cada um, sem se tocarem nem roubarem toques às setas do mês.
Sobram ainda ~26 pontos de folga.

**320 pontos, resolvido em 31/08/2026**: o Gabriel topou tirar a marca
"FinApp" do cabeçalho como solução — abaixo de 350 pontos ela some
(`@media (max-width: 350px)` em `Header.module.css`), o que sobra é espaço de
sobra pro mês por extenso. Em qualquer telemóvel real de hoje (375 pontos ou
mais, o mínimo que a Apple ainda suporta) a marca continua visível — só some
no caso extremo do iPhone SE de 1ª geração.

Pelo caminho apareceu um bug pior do que o corte original: esconder a logo
com `display: none` faz o item deixar de existir no grid, e o mês — que não
tinha `grid-column` explícito, só a logo e as ações tinham — auto-posicionava
na coluna que sobrou (a 1, não a do meio), competindo por espaço com os
ícones em vez de ter a faixa central só para si. Cortava PIOR do que antes.
Corrigido dando `grid-column: 2` explícito ao `.mes`. Medido ao vivo a 320
pontos, em Início e em Cartões (3 ícones): "Agosto 2026" cabe inteiro nos
dois.

### Dois ícones dentro de uma pílula nunca chegam aos 44 pontos de largura

**Resolvido em 31/08/2026**: os ícones colados dentro das pílulas de gerir
saíram e deram lugar a um único botão "⋯", com os 44 pontos de largura e de
altura, que abre o mesmo menu de ações que todas as listas do app já usam. Nos
locais de abastecimento (Veículo) o menu tem Renomear e Remover; nas contas e
cartões tem Adicionar método, Renomear e Remover — o terceiro ícone entrou
junto porque tinha exatamente o mesmo problema de toque. Os campos de escrever
que vivem na pílula do cartão de crédito (dia de fecho e de vencimento)
ficaram onde estavam: são campos, não ações. Nada mudou no que cada ação faz,
nem nos avisos de confirmação.

### Ícone "maskable" do manifest

**Resolvido em 31/08/2026**: o manifest passou a ter os ícones em imagem
(192, 512 e 1024 px), gerados a partir do mesmo desenho que já existia
(`icon-v4.svg`) por um script novo, `npm run icones`. O de 512 px é declarado
duas vezes, uma como ícone normal e outra como "maskable" — o desenho já tem
folga de sobra para o recorte redondo do Android (a marca ocupa 75% do raio
seguro), por isso não foi preciso um desenho novo. Não fez falta ninguém a
desenhar: o SVG continua a ser a única fonte, e trocar o desenho volta a ser
trocar um ficheiro e correr um comando.

### `usePullToRefresh` recalculava a tela a cada milímetro de arrasto

**Resolvido em 22/08/2026**: reescrito pra escrever direto nos nós do DOM
(`refConteudo`/`refIndicador`/`refIcone`) a cada frame do arrasto, em vez de
passar pelo `setState` do React — mesmo padrão já usado em `useDragToClose`.
React só re-renderiza nas transições de verdade (mostrar/esconder o
indicador, mudar de cor ao passar do limite, começar a recarregar).
Verificado ao vivo com gestos de toque simulados: puxão pequeno volta com
mola, puxão além do limite arma e recarrega.

---

## Verificação visual pendente (quando concluída, sai desta lista)

_(vazio no momento — fontes e cores estavam aqui até 22/08/2026, quando
passei a verificar ao vivo com o navegador em vez de esperar aprovação
manual.)_

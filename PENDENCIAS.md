# Pendências — FinApp

Este arquivo não faz parte do app. É a lista do que ficou de fora quando se
pergunta "o que falta fazer" — coisas que foram identificadas mas não
resolvidas, com o motivo de terem ficado pra depois. Toda vez que alguém
perguntar "o que falta", isto entra na resposta junto com o resto.

Entrada mais recente no topo.

---

## Decisões pendentes (não bloqueiam nada)

### O "+" de Cartões só abre "Adicionar transferência"

**Levantado em 31/08/2026.** É o único fluxo de tela inteira que a página
Cartões tem hoje — "Registrar pagamento" é de uma fatura específica,
"Adicionar método" é de uma instituição específica, e criar conta/cartão
nova é um formulário escrito na própria seção "Cartões e contas" (não abre
nada). Se o Gabriel achar o "+" sozinho pouco óbvio, a proposta é mover
"criar conta/cartão" pra uma folha também, e o "+" passar a abrir um menu com
as duas opções — reaproveitando o mesmo `MenuAcoesItem` das pílulas. Prints
reais + mockup da proposta: https://claude.ai/code/artifact/5f2a1fed-5038-4c82-a38f-37370e8f7fb8

### Rótulo "Definir teto de categoria" foge do padrão "Adicionar X"

**Levantado em 31/08/2026, decidido no mesmo dia.** É o único "+" cujo texto
não começa com "Adicionar" — o Gabriel deixou a critério. Mantido como está:
"Adicionar teto" descreveria mal a ação (a categoria já existe, o que se
define é o limite dela), e mudar só esse rótulo pra combinar com os outros
custaria clareza sem ganhar nada em troca.

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

### Botões "Adicionar X" viraram um "+" no cabeçalho

**Resolvido em 31/08/2026**, com a decisão do Gabriel de avançar. Cada tela
passou a poder pôr o SEU botão de adicionar no cabeçalho da app, e ele
desaparece sozinho quando se muda de tela. Não é o "+" azul redondo do fundo
do ecrã (esse é global, lança transações de qualquer sítio) — é outro botão,
pequeno e discreto, ao lado do tema e do sino.

**Telas convertidas** (o botão de texto saiu, o "+" entrou):

- Calendário — "Adicionar evento"
- Receitas — "Adicionar receita"
- Despesas — segue a aba: "Adicionar despesa" / "Adicionar despesa fixa"
- Parcelas — "Adicionar parcela"
- Cartões — "Adicionar transferência"
- Planejamento — segue a aba: "Definir teto de categoria" / "Adicionar fundo"
- TVDE — só na aba Semanas: "Adicionar semana"
- Veículo — segue a aba (abastecimento, despesa, despesa fixa, quilometragem);
  no "Resumo", onde nenhuma aba aponta para uma delas, o "+" abre um menu com
  as quatro em vez de escolher por conta própria

Cada "+" diz por extenso o que adiciona a quem usa leitor de ecrã ("Adicionar
evento", não só "Adicionar"): o desenho sozinho não diz o quê. Onde uma lista
está vazia, o texto de ajuda passou a mandar tocar no "+" do cabeçalho em vez
de procurar um botão que já não existe.

**O que ficou de fora, de propósito** (e porquê):

- **Transações** não tem botão de adicionar nenhum — é uma vista de leitura do
  que já foi lançado. Continua sem "+".
- **Início**, **Importar** e **Definições** também não criam nada por botão.
- Ações que pertencem a UM ITEM, e não à tela: "Contribuir" num fundo,
  "Adicionar método" numa instituição de Cartões, "Pagar" numa fatura. Um "+"
  no cabeçalho não saberia de qual item se estava a falar.
- O formulário "Cartões e contas", em Cartões, tem um botão "Adicionar" que é
  o submeter do formulário escrito ali mesmo (nome + tipo). Não abre nada, e
  chamá-lo do cabeçalho obrigaria a saltar para um campo lá em baixo.

**Resolvido em 31/08/2026** (era a única pendência real desta seção): a 320
pontos a marca "FinApp" sai do cabeçalho — ver a seção "Cinco ícones..."
abaixo para os detalhes.

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

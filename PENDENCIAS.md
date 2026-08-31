# Pendências — FinApp

Este arquivo não faz parte do app. É a lista do que ficou de fora quando se
pergunta "o que falta fazer" — coisas que foram identificadas mas não
resolvidas, com o motivo de terem ficado pra depois. Toda vez que alguém
perguntar "o que falta", isto entra na resposta junto com o resto.

Entrada mais recente no topo.

---

## Telemóvel

### Botões "Adicionar X" devem virar um "+" pequeno no cabeçalho

**Encontrado em 01/09/2026**, na revisão da Etapa A do plano da App Store.

Todas as abas que têm um botão para adicionar (Transações, Cartões, Veículos, etc.)
usam o padrão "Adicionar X" em texto. No telemóvel, isto toma muito espaço no
cabeçalho — deve virar um ícone pequeno "+" que fica mais discreto e liberta
espaço. O que vai ser adicionado é claro pelo contexto da aba.

Também precisam sair do cabeçalho os botões de "Desfazer" e "Refazer" — hoje não
está claro se são realmente usados, e tiram espaço que é crítico em mobile. Podem
viver num gesto ou dentro do menu "Mais" se forem mesmo necessários.

**Por que fica pendente**: é redesenho de padrão em 10+ telas (cada aba), não um
ajuste isolado. Precisa de decisão conjunta com o Gabriel e depois de coordenação
com a Etapa A (Acessibilidade + Design & Cor).

**Prioridade**: solução para os botões de desfazer/refazer vem em primeiro lugar —
avaliar se são realmente usados antes de redesenhar.

---

### Cinco ícones no cabeçalho não cabem com 44 pontos de largura

**Encontrado em 31/08/2026**, na varredura de áreas de toque da Etapa A do
plano da App Store.

O cabeçalho tem, da esquerda para a direita: a marca "FinApp", o seletor de
mês e cinco botões (desfazer, refazer, tema, lembretes e o sino). O mínimo de
toque da Apple é 44×44 pontos. Em altura já ficou resolvido — os cinco têm
agora 44 pontos, com a área de toque a crescer por fora do desenho.

Em largura não dá: cinco botões a 44 pontos são 220 pontos só de ícones. Num
telemóvel de 375 pontos, tirando a margem, sobram 343 — e ainda é preciso lá
caber "FinApp" (~85) e "setembro 2026". Hoje cada botão tem cerca de 31
pontos de largura de toque, e as setas do mês cerca de 34.

**Por que ficou de fora**: qualquer saída é decisão de desenho, não conta de
CSS. As três hipóteses:

1. Tirar botões do cabeçalho. Desfazer e refazer são os candidatos naturais —
   são as duas únicas ações que não abrem nada e podiam viver noutro sítio
   (um gesto, ou dentro do menu "Mais").
2. Tirar o seletor de mês do cabeçalho e pô-lo no topo de cada página. Liberta
   ~120 pontos de uma vez, mas o mês deixa de ser a referência sempre à vista
   que é hoje.
3. Aceitar os ~31 pontos de largura como estão. A altura de 44 já resolve a
   maior parte dos toques falhados (o dedo erra mais em cima/baixo do que aos
   lados numa fileira horizontal), e a Apple aplica o mínimo com alguma folga
   nas barras dela próprias.

**Quem decide**: o Gabriel. Enquanto não decidir, fica a hipótese 3, que é o
que está no código.

## Decisões pendentes (não bloqueiam nada)

### Splash por tema no PWA

**Levantado em 01/09/2026**.

O app nativo (Etapa D) tem splash screens em tema claro e escuro. A PWA também
poderia ter, adaptando-se ao tema do utilizador — mas o Safari exige que o splash
seja definido no manifest por tema, e isso criaria 20+ ficheiros adicionais e uma
regra de build complexa. **Decisão tomada: deixado de fora de propósito** — só
entra se o Gabriel disser que vale a pena o overhead.

---

### Screenshots do manifest usam dados de demonstração

**Levantado em 01/09/2026**, na Etapa B.

O `manifest.json` já tem `screenshots` com URLs apontando a dados de exemplo.
Para a App Store de verdade, a Apple exige screenshots em tamanhos específicos
(540×720, 1170×2532, etc.). Capturar esses screenshots e tratá-los é **fora do
escopo da Etapa B** — ficava pro momento em que se submete à loja (Etapa F).
Hoje fica com dados de demonstração só pra validar que a estrutura está certa.

---

### Ícones antigos (v2/v3) continuam em `public/`

**Levantado em 01/09/2026**.

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

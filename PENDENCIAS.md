# Pendências — FinApp

Este arquivo não faz parte do app. É a lista do que ficou de fora quando se
pergunta "o que falta fazer" — coisas que foram identificadas mas não
resolvidas, com o motivo de terem ficado pra depois. Toda vez que alguém
perguntar "o que falta", isto entra na resposta junto com o resto.

Entrada mais recente no topo.

---

## Telemóvel

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

### Dois ícones dentro de uma pílula nunca chegam aos 44 pontos de largura

**Encontrado em 31/08/2026**, na mesma varredura.

Nas telas de gerir (locais do veículo, cartões), cada pílula tem o nome e dois
botões colados — renomear e remover. As pílulas passaram a ter 44 pontos de
altura e os botões esticam-se a ela toda, mas em largura ficam nos ~26.

**Por que ficou de fora**: o app já tem o padrão certo para isto — o menu de
ações ("⋯" que abre editar/excluir) que todas as listas usam desde 30/08.
Trocar os dois ícones inline por esse menu resolve o toque e ainda uniformiza
o desenho, mas é redesenho destas telas, não um ajuste de área de toque.

**Se for para fazer**: reutilizar `MenuAcoesItem`, já pronto e já testado.

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

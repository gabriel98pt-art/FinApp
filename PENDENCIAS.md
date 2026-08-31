# Pendências — FinApp

Este arquivo não faz parte do app. É a lista do que ficou de fora quando se
pergunta "o que falta fazer" — coisas que foram identificadas mas não
resolvidas, com o motivo de terem ficado pra depois. Toda vez que alguém
perguntar "o que falta", isto entra na resposta junto com o resto.

Entrada mais recente no topo.

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

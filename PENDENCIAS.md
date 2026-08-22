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

### Ícone "maskable" do manifest

**Por que ficou de fora**: hoje o manifest só tem um ícone (SVG, `purpose:
"any"`). Em Android, o sistema recorta esse ícone num círculo/quadrado
arredondado ao instalar — sem uma versão pensada pra esse recorte
("maskable", com margem de segurança), partes do desenho podem ficar
cortadas.

**O que falta pra resolver**: um arquivo de imagem novo (variante do ícone
atual, com a margem certa) — isso não se resolve só escrevendo código, precisa
de alguém desenhando ou de uma ferramenta de imagem.

---

## Arquitetura

### `usePullToRefresh` recalcula a tela a cada milímetro de arrasto

**Por que ficou de fora**: `src/hooks/usePullToRefresh.ts` chama
`setEstado(...)` (React) a cada evento de `touchmove` durante o gesto de puxar
pra atualizar — o app recalcula a tela inteira dezenas de vezes por segundo
enquanto a pessoa arrasta o dedo. Funciona, mas é desperdício de
processamento; o jeito certo é escrever direto no visual (sem passar pelo
React) durante o arrasto, e só avisar o React quando soltar o dedo.

**Por que é separado dos outros itens**: é reescrever o hook inteiro, não um
ajuste pontual — mistura mudança de arquitetura com o resto do código do
arrasto, então precisa da sua própria etapa, validada sozinha.

---

## Verificação visual pendente (quando concluída, sai desta lista)

_(vazio no momento — fontes e cores estavam aqui até 22/08/2026, quando
passei a verificar ao vivo com o navegador em vez de esperar aprovação
manual.)_

# Histórico — FinApp

Este arquivo não faz parte do app. É o diário de tudo que foi mudado no
FinApp desde o primeiro dia — o que foi implementado, o que funcionou de
primeira e o que precisou ser corrigido depois. Entrada mais recente no
topo, uma data por vez, linguagem simples (sem termos técnicos de código).

Período coberto: 23/07/2026 a 03/09/2026 — 506 mudanças registadas.

---

## 03/09/2026

- Corrigido um bug sério: ajustar o saldo de uma conta e depois clicar em
  "Desfazer" (ou "Refazer") podia bagunçar a lista de contas/cartões —
  duas contas apareciam com o mesmo nome e saldo zerado, como se uma
  tivesse desaparecido. A causa: o "Desfazer" grava a lista de contas de
  volta num formato que a base de dados não entende direito, e ela troca os
  nomes das contas por números — duas contas com um cartão cada colidiam no
  mesmo número. Os lançamentos, saldos e parcelas nunca foram afetados, só a
  lista de nomes das contas. Corrigido na origem: "Desfazer"/"Refazer" agora
  gravam a lista de contas no formato certo, sem essa confusão.

## 02/09/2026

- Uma despesa fixa em débito automático (ex. um seguro que sai sozinho do
  cartão) nunca aparecia no total nem no gráfico de categorias do Início,
  mesmo já paga. A causa: ela nunca grava "paga" em lugar nenhum — o selo
  "Pago" dela é calculado pelo dia de vencimento, ninguém clica em nada.
  Corrigido: agora conta pelo mesmo dia de vencimento, com a mesma precisão
  de dia que o resto do app já usa pra débito automático.
- Na lista de Despesas Fixas, tocar numa despesa ia direto para a edição —
  era a única lista do app que fazia isso. Em Transações, Parcelas e Veículo,
  tocar abre um menu com "Editar" e "Excluir", e é o que Despesas Fixas passa
  a fazer também. O selo "Pago"/"Pendente" continua a alternar com um toque
  só, sem passar pelo menu.

## 01/09/2026

- O gráfico "Despesas por categoria" do Início passou a contar pela mesma
  regra que os KPIs "Despesas"/"Receitas" ao lado (fluxo de caixa, pela data
  real). Antes os dois números da mesma tela discordavam: o KPI já mostrava a
  parcela paga com atraso, o gráfico não — a categoria dela ficava vazia até o
  mês seguinte, como se o dinheiro tivesse ido para lugar nenhum.

- No Início, "Despesas" e "Receitas" passam a somar o que foi de fato pago no
  mês — pela data real de cada lançamento, não pelo mês a que a dívida se
  referia. Uma parcela ou despesa fixa paga com atraso, já no mês seguinte,
  agora entra no total do mês em que o dinheiro saiu — antes ficava presa ao
  mês antigo e o pagamento parecia "não contar em lugar nenhum". As outras
  telas (Despesas, Metas, Resumo Anual, Copiloto) continuam a contar pelo
  cronograma de sempre, de propósito — são números diferentes com propósitos
  diferentes.
- Marcar uma despesa fixa (geral ou do veículo) como paga passa a guardar a
  data real do pagamento, do mesmo jeito que uma parcela já fazia — antes só
  se sabia QUE mês foi pago, nunca QUANDO de verdade. Fixas marcadas pagas
  antes de hoje continuam a contar certinho, pelo mês de vencimento — nada no
  que já existe muda de lugar.

- Parcelas, Planejamento, Orçamento e TVDE passaram a ter a mesma cara das
  outras telas: em cada folha, o dinheiro deixou de ser uma caixa pequena
  igual às vizinhas e virou o número grande e centrado do topo. São seis
  formulários — a nova parcela ("Quanto no total?"), o fundo de poupança
  ("Quanto quer juntar?"), a contribuição para um fundo, o teto de uma
  categoria ("Quanto por mês?"), a semana do TVDE (o faturamento) e as duas
  entradas de valor da aba "Extras e definições" do TVDE.
- Na nova parcela, os campos "Nome" e "Descrição (opcional)" viraram um só,
  chamado "Descrição". Eram dois campos de texto seguidos a perguntar a mesma
  coisa. Uma parcela antiga que tenha as duas partes escritas abre com as duas
  juntas, separadas por "·", à vista e editáveis — nada se perde calado.
- No formulário da semana do TVDE só o faturamento subiu para o campo grande.
  Os outros seis (portagens, aluguel, recargas, extra, gorjetas) continuam em
  linhas compactas de propósito: são descontos sobre o faturamento, e seis
  campos gigantes seguidos davam um formulário sem centro nenhum.
- Os botões de criar do Veículo, Parcelas, Planejamento, Orçamento e TVDE
  ficaram só com o "+". São oito: os quatro do Veículo (abastecimento,
  despesa, despesa fixa e quilometragem), "Nova parcela", "Novo fundo",
  "Definir teto" e "Nova semana". O texto não se perdeu — passou para o nome
  que o leitor de ecrã anuncia, por isso quem não vê o ícone continua a ouvir
  "Adicionar abastecimento" e não "mais". Continuam todos exatamente onde
  estavam, dentro de cada tela; nada foi para o cabeçalho.
- O "Contribuir" de cada fundo ficou como estava, com texto: é ação de um
  fundo que já existe, não um "criar" da tela.
- Dois campos do TVDE que não tinham nome nenhum para leitor de ecrã (a
  descrição da despesa, que só tinha texto de exemplo, e o mês da Segurança
  Social) passaram a ter.
- A folha "Novo evento" do Calendário passou a ter a mesma cara das outras: o
  valor deixou de ser mais um campo igual aos outros e virou o número grande do
  topo ("Quanto? (opcional)"), como já acontece no botão "+" do rodapé, em
  Cartões, em Despesas e no Veículo. Continua opcional — um evento pode ser só
  um lembrete.
- Na mesma folha, os campos "Título" e "Nota" viraram um só, chamado
  "Descrição". Eram dois campos de texto seguidos a perguntar a mesma coisa, e
  ninguém sabia em qual escrever. Eventos antigos que tenham nota continuam a
  mostrá-la; só deixou de haver forma de escrever uma nova.
- Os botões de criar de Calendário, Cartões e Despesas ficaram só com o "+".
  São quatro: o evento do Calendário, a transferência de Cartões e os dois de
  Despesas (aba Correntes e aba Fixas). O texto que estava no botão não se
  perdeu — passou para o nome que o leitor de ecrã anuncia, por isso quem não
  vê o ícone continua a ouvir "Adicionar transferência" e não "mais".
  Continuam todos exatamente onde estavam, dentro de cada tela; nada foi para
  o cabeçalho.
- Nas despesas fixas, a marca "débito automático" deixou de ser escrita por
  extenso a roxo e a negrito no fim da linha. Virou um ↻ pequeno encostado ao
  "dia N", na cor apagada do resto da linha. Era o pedaço com mais destaque da
  linha sendo o menos importante dela, e em telemóvel era ele que partia a
  linha em duas. A explicação inteira continua lá para quem passa o rato por
  cima ou usa leitor de ecrã.
- Ontem a criação de uma conta ou cartão tinha mudado da tela de Cartões para
  Definições, e a gestão do que já existia (renomear, remover, dia da fatura)
  tinha ficado para trás. O Gabriel reconsiderou: hoje foi tudo junto. A linha
  em Definições passou a chamar-se "Contas e cartões", com a contagem ao lado,
  e é lá que se cria, se muda o nome, se apaga e se acertam os dois dias da
  fatura do cartão de crédito.
- Cada conta aparece numa linha só, com o tipo (crédito ou débito) ao lado do
  nome e três botões à direita: juntar um segundo cartão ao mesmo banco,
  renomear e remover. É o mesmo desenho da lista de categorias de despesa, que
  já vivia ali — quem já mexeu numa vai reconhecer a outra.
- Nos cartões de crédito, os campos "fecha dia" e "vence dia" ficam numa linha
  própria por baixo do nome. Antes estavam espremidos dentro da pílula, ao lado
  dos botões, e apertavam o nome da conta em telemóvel.
- A tela de Cartões perdeu a seção "Cartões e contas" do fundo por completo.
  Ficou só com o que se lê: os quatro valores do topo, os quadros de cada
  conta, as faturas (pagar, ajustar, reabrir) e as transferências entre contas.
  Nada disso mudou.
- O convite que aparecia quando não há conta nenhuma dizia "Adicione abaixo" —
  já não havia nada abaixo. Agora diz onde é: Definições → Contas e cartões.
- Nota de desenho, assumida de propósito: aqui as ações de cada item são botões
  visíveis, e não o menu "⋯" que Transações, Parcelas e Veículo usam. Foi
  escolha do Gabriel — vale mais estar igual ao resto de Definições do que
  igual ao resto do app.
- A tela de Receitas ganhou o mesmo sistema de organizar a lista que Despesas
  já tinha há algum tempo: os botões "Mais recentes / Mais antigas / Maior
  valor / Menor valor" logo acima dos lançamentos. Antes a lista vinha sempre
  da mais recente para a mais antiga, sem escolha nenhuma.
- Também ganhou o alternador "Mês / Semana". Com "Semana" escolhida, a lista
  passa a mostrar só as receitas dos sete dias escolhidos, e as setas ao lado
  andam de semana em semana. Abre sempre na semana de hoje, e trocar de mês
  no cabeçalho volta a posicioná-la sozinha.
- Nessa visão o primeiro cartão do topo acompanha: deixa de dizer "Total do
  mês" e passa a dizer "Total da semana", com as datas por baixo. Os outros
  três cartões continuam mensais de propósito — uma semana é pouca coisa para
  responder a "vs mês passado" ou "média de 3 meses".
- Por baixo, o par de botões "Mês / Semana" virou uma peça só, reaproveitável,
  em vez de mais uma cópia do mesmo desenho. Despesas e Veículo continuam com
  a versão antiga deles até serem passados para a nova numa mudança à parte.
- Nas listas de lançamentos (Despesas, Receitas, Parcelas), a linha de baixo
  de cada item passou a começar pela data: era "Alimentação · 05/08", agora é
  "05/08 · Alimentação". A razão é simples: numa lista já ordenada por data, é
  a data que se procura ao correr o olho pela coluna — e ela ficava no fim de
  um texto de comprimento variável, num sítio diferente em cada linha. À
  esquerda, todas as datas caem alinhadas.
- A mesma troca foi feita nas listas do Veículo (abastecimentos, registos de
  km e o resumo do mês), que tinham o mesmo formato com a data no fim.
- As telas de Transações e Calendário já mostravam a data primeiro — agora o
  app inteiro segue a mesma ordem.
- Transações passou a mostrar o extrato em páginas de 15, com as setas ‹ › no
  fim, iguais às de Despesas e Receitas. Era a lista maior do app a desenhar
  tudo de uma vez: junta seis tipos de movimento do mês (receitas, despesas,
  fixas, parcelas, transferências e o veículo), então num mês normal passava
  fácil das cem linhas para rolar.
- Mudar de mês ou de filtro volta à página 1 — sem isso, filtrar estando na
  página 5 deixava à vista um pedaço do meio de uma lista que nunca se viu
  começar.
- Os KPIs de cima e o "N transações" do cabeçalho continuam a contar o mês
  inteiro, não só a página aberta.
- A lista de semanas do TVDE também passou a ter páginas de 15. É a única
  lista do app que não está presa a um mês: guarda todas as semanas já
  registadas, uma por semana do ano — ao fim do primeiro ano são 52 cartões
  seguidos, com a semana passada (a que mais se abre) cada vez mais longe.
- As restantes listas foram auditadas uma a uma e ficaram sem paginação de
  propósito, porque estão presas a um mês ou a uma semana e não crescem: as
  transferências de Cartões, as duas do Calendário, as quatro do Veículo, as
  tabelas de Meses e Períodos do TVDE e as listas de configuração de
  Definições. A pré-visualização do Importar fica de fora por outro motivo: é
  uma tela de conferência, onde esconder linhas atrás de páginas é justamente
  como se importa sem ter visto tudo. O porquê de cada uma ficou escrito no
  PENDENCIAS.md.
- Corrigido no Copiloto: quando uma despesa fixa (ex. renda) vinha sendo
  descontada desde antes de qualquer outro lançamento na conta, os meses só
  dela ficavam de fora da soma que dá "quanto tenho disponível" — o Copiloto
  respondia com um saldo maior do que o real. Agora esses meses entram na
  conta também.

---

## 31/08/2026

- Criar uma conta ou cartão novo mudou-se da tela de Cartões para Definições
  ("Registo" → "Nova conta ou cartão"). Cartões continua com a lista do que
  já existe e a gestão de cada um — renomear, remover, dia da fatura — pelo
  menu "⋯" de cada pílula; só o formulário de criar é que mudou de casa.
- De brinde, o "+" de Cartões (que abre "Adicionar transferência") deixa de
  ter uma segunda pergunta em aberto: com "criar conta/cartão" fora da tela,
  sobra só esse fluxo mesmo — não precisava virar um menu com duas opções.
- A marca "FinApp" some do cabeçalho só no iPhone SE de 1ª geração (ecrãs de
  320 pontos ou menos) — era o único jeito de o mês por extenso caber ao lado
  dos ícones sem cortar. Em qualquer telemóvel mais novo continua igual.
- Ao corrigir isso apareceu um bug pior: esconder a marca fazia o mês pular
  pra outra coluna do cabeçalho e passar a competir por espaço com os ícones
  em vez de ter a faixa dele só pra si — o corte piorava em vez de sumir.
  Corrigido dando ao mês um lugar fixo no cabeçalho, que não dependa de mais
  nada estar visível ao lado.
- Uma tentativa de pôr um "+" por página no cabeçalho (substituindo os
  botões "Adicionar X" espalhados pelas telas) foi revertida no mesmo dia: o
  Gabriel não quer nada de novo no cabeçalho sem pedir primeiro, mesmo que
  pareça resolver um problema real de espaço. Os botões "Adicionar X"
  voltam a ficar onde estavam, dentro de cada tela.
- Os botões de "Desfazer" e "Refazer" saíram do cabeçalho. Eram as duas únicas
  coisas lá em cima que não abriam nada, e ocupavam espaço que no telemóvel
  faz falta.
- No telemóvel foram para o menu "Mais" (o botão de baixo à direita), numa
  secção própria chamada "Ações", separada das abas por um risco: as de cima
  levam a uma tela, estas fazem alguma coisa na hora — e o menu fecha-se logo
  a seguir, para se ver o resultado. Ficam apagadas quando não há nada para
  desfazer ou refazer, como ficavam no cabeçalho.
- No tablet e no computador, onde não existe menu "Mais", foram para o fim da
  barra lateral, também separadas das abas por um risco. Sem isto ficavam sem
  sítio nenhum nesses ecrãs.
- Com isso, o cabeçalho do telemóvel deixou de estar apertado: sobraram dois
  ícones (tema e lembretes) e cada um passou a ter finalmente os 44 pontos de
  toque em largura, o mínimo da Apple — antes tinham 31. O desenho do ícone
  não mudou de tamanho: quem cresceu foi a zona clicável à volta dele, e o
  espaço entre os dois aumentou para que uma zona não invada a outra.
- Medido ao vivo num telemóvel de 375 pontos: "FinApp" e "setembro 2026"
  cabem inteiros, com folga. Era o problema anotado nas pendências desde
  ontem, e resolveu-se tirando botões em vez de redesenhar os que ficaram.
- O aviso da tela Importar ("se foi engano, clica em Desfazer") passou a
  apontar para o menu "Mais" em vez de "no topo".
- Nas pílulas de gerir (locais de abastecimento no Veículo, contas e cartões
  em Cartões), os iconezinhos colados lá dentro deram lugar a um só botão
  "⋯" — o mesmo menu de ações que as listas do app já usavam. Antes eram dois
  ou três alvos de cerca de 26 pontos de largura, lado a lado, onde o dedo
  acertava no botão errado; agora é um alvo de 44 por 44 que abre as ações
  escritas por extenso.
- No Veículo o menu tem Renomear e Remover. Em Cartões tem Adicionar método,
  Renomear e Remover — este último ícone tinha o mesmo problema de tamanho,
  por isso foi junto.
- Os campos de escrever que vivem na pílula do cartão de crédito (dia de fecho
  e dia de vencimento da fatura) ficaram onde estavam: são campos, não ações.
  As perguntas de confirmação ao remover também continuam iguais.
- O cabeçalho do app deixa de ficar por baixo do relógio e da bateria do
  iPhone. O app já se abria em ecrã inteiro, entalhe incluído, mas só três
  ficheiros reservavam a faixa do sistema — e nenhum deles era o cabeçalho.
- A mesma folga chegou também à barra lateral (tablet e computador), à barra
  de baixo, ao conteúdo das páginas e à tela de entrada — nestas três últimas
  conta sobretudo com o telemóvel deitado, em que o entalhe passa a estar de
  um dos lados.
- O indicador de "puxar para recarregar" desce junto com o cabeçalho, senão
  aparecia por trás dele em vez de por baixo.
- O teclado do telemóvel deixa de tapar o botão "Salvar" do Registro Rápido.
  No iPhone o teclado não encolhe a página: desenhava-se por cima do fundo da
  folha, que é exatamente onde está o botão. Agora a folha sobe e encurta-se a
  altura do teclado, e o botão fica sempre logo acima dele. Vale para todas as
  folhas do app, não só o Registro Rápido.
- Ignora de propósito os encolhimentos pequenos: a barra de endereço do Safari
  também mexe na janela ao rolar, e sem esse cuidado a folha dava um salto a
  cada scroll.
- Botões e ícones pequenos ganharam área de toque de 44 pontos, o mínimo da
  Apple — sem ficarem maiores no ecrã. A zona clicável cresce por fora do
  desenho, e nunca para o lado do botão vizinho, para não haver troca de
  toques.
- Onde isso aconteceu: os ícones do cabeçalho, o paginador das listas, os
  botões de ordenar e de filtrar, as setas do calendário, a seta de voltar das
  folhas, os interruptores das Definições, a lista de categorias, o painel de
  cores, o menu de ações de cada lançamento e as abas do menu "Mais".
- As pílulas de gerir (locais do veículo, cartões, intermediadores de
  parcelamento) passaram a ter 44 pontos de altura: os "x" e lápis lá dentro
  eram alvos de 18 pontos e agora ocupam a pílula toda.
- Na tela de Importar, a caixinha que decide se cada linha do extrato entra —
  o controlo mais importante dessa tela — tinha 18 pontos de largura de
  toque; passou a 42. A caixa de "apagar" da revisão de duplicatas ganhou 44
  pontos de altura.
- Ficou anotado em pendências um caso que precisa de decisão: os cinco ícones
  do cabeçalho não cabem todos com 44 pontos de largura num telemóvel de 375
  pontos sem tirar espaço ao seletor de mês.
- O ícone do app passa a existir também em imagem, em três tamanhos (192, 512
  e 1024 pontos), gerados a partir do mesmo desenho de sempre. Antes só havia
  o desenho vetorial, que o Android e a loja da Apple não aceitam sozinho.
- O de 1024 é o exigido para enviar o app à App Store: sai quadrado, sem
  cantos arredondados e sem fundo transparente, como a Apple obriga.
- O ícone também passa a estar declarado como "recortável": quando o Android
  corta o ícone num círculo ao instalar, já não corta nada do desenho.
- Novo comando `npm run icones`: refaz todas essas imagens a partir do
  desenho. Trocar o ícone volta a ser trocar um ficheiro e correr um comando,
  em vez de exportar cinco imagens à mão.
- O app passa a ter fotografias de apresentação no manifesto — duas de
  telemóvel (Início e Despesas) e uma de computador. São elas que o Android e
  o Chrome mostram na janela de "instalar app", que antes aparecia vazia.
- Preparado o ecrã de arranque para tema claro e escuro: duas imagens novas
  em `public/splash/`, com o fundo de cada tema e a marca ao centro, prontas
  para quando o app for empacotado como app nativo.
- Corrigido: a lista de ficheiros que o app guarda para funcionar sem
  internet ainda apontava para a versão 2 do ícone, que já não existe desde a
  versão 3 — ou seja, o ícone não estava a ser guardado há duas versões.

---

## 30/08/2026

- Menu único de ações (editar/excluir) chega em todas as listas: Transações,
  TVDE, Cartões, Veículo, Parcelas, Despesas e Receitas — um só padrão de
  menu em vez de botões espalhados por tela.
- Os campos "Nome" e "Nota" viram um só campo, "Descrição", e o campo Valor
  ganha destaque maior no Registro Rápido.
- A barra de navegação do celular passa a ficar colada na base da tela, sem
  parecer um "dock" flutuante solto.
- A cor verde passa a valer pra qualquer fonte de receita, não só pra uma
  fonte fixa.
- O botão "+" agora abre um menu de escolha (Despesa/Receita/Veículo) antes
  de ir pro Registro Rápido.
- Carga elétrica do veículo passa a usar a cor certa e o ícone certo
  automaticamente, sem precisar escolher na tela.
- A grade de ícones de categoria ganha 27 opções novas.
- O seletor de data (Hoje/Ontem/Escolher data) fica com espaçamento parelho.
- O rótulo muda pra "Carga Elétrica" quando o veículo é 100% elétrico.
- Corrigido: uma cópia local dos dados (usada quando o app está offline)
  estava apagando informações por engano ao juntar com os dados do servidor.
- Corrigido: a resposta do Copiloto sobre orçamento não batia com o que a
  tela de Orçamento mostrava.
- O seletor de tipo (Despesa/Receita/Veículo) saiu de dentro do Registro
  Rápido — já não faz falta, porque o botão "+" já pergunta isso antes; no
  lugar entrou um botão de voltar pro menu.
- Descrição e o destaque do campo Valor, que já tinham chegado pra Despesa e
  Receita, chegaram também pro registro de Veículo (Carga Elétrica e
  Despesa).
- "Veículo" saiu da lista geral de categorias de despesa (só a cor dava pra
  editar ali, e já existia um controlo próprio dedicado a ele).
- Despesa do veículo (variável e fixa) deixou de ter categoria pra escolher:
  agora é só nome livre, e todo gasto do veículo — velho ou novo — usa um
  ícone e uma cor únicos, escolhidos uma vez em Definições › Veículo.
- O botão de voltar das folhas (bottom sheets) ficou maior e ganhou mais
  respiro até o título — antes ainda encostavam um no outro.
- No Registro Rápido, o campo Valor passa a vir antes da Descrição.
- O ícone de calendário ao lado de "Escolher data" ficou maior, mais fácil
  de ver.
- As linhas de opção do Veículo no Registro Rápido (Carga Elétrica/Despesa,
  Elétrico/Combustível, Custo total/€ por unidade) passam a ficar
  centralizadas, não mais coladas à esquerda.

## 29/08/2026

- Corrigido: uma parcela, cartão ou fundo guardado com o nome "Carro" era
  confundido com o veículo de verdade e caía numa resposta errada do
  Copiloto.

## 27/08/2026

- O Copiloto passa a controlar o limite diário de perguntas também no
  servidor, não só no aparelho — mais seguro contra alguém tentando burlar
  o limite.
- Corrigido: registrar carga ou despesa do veículo sem escolher a conta que
  pagou fazia esse valor sumir do extrato.

## 26/08/2026

- Corrigido de novo: a cor verde tinha voltado a aparecer fora da Receita
  (regra que é pra ser fixa e já tinha sido corrigida um dia antes).
- O seletor de cor de categoria agora avisa quando você escolhe uma cor
  repetida, e a paleta ficou maior e mais organizada.
- Corrigido: o seletor de cor não mostrava qual cor a categoria já tinha, e
  Veículo não entrava na lista de opções.
- Corrigido: ao juntar os dados salvos no aparelho com os do servidor, o
  app agora confere se cada campo é do tipo certo, não só se existe — evita
  dado corrompido.
- Corrigido: uma cópia antiga salva no aparelho podia travar o app inteiro
  ao abrir.
- A tela de erro (quando o app quebra) passa a dizer qual parte da tela deu
  problema, e a mostrar a mensagem real, não um texto genérico.
- Corrigido: uma instituição financeira salva sem métodos de pagamento
  derrubava o app inteiro.
- Chegou a possibilidade de ter um 2º método de pagamento numa instituição,
  e o app já sugere o débito certo ao pagar uma fatura.
- Corrigido: aspas dentro de um texto importado de um extrato (CSV) faziam
  a descrição se perder.

## 25/08/2026

Dia grande, focado em Veículo e em ajustes soltos por todo o app.

- O título de uma transferência antiga passa a seguir o nome novo da conta.
- Renomear uma conta muda o nome em todo o histórico na hora, numa operação
  só (mais rápido e mais seguro).
- As Definições passam a conhecer instituições e métodos de pagamento
  diretamente.
- O módulo Veículo pode ser desligado por quem não tem carro.
- A fileira de locais de abastecimento deixou de ser uma parede de opções.
- Corrigido: os rótulos do Registro Rápido mostravam "€" mesmo pra quem usa
  outra moeda.
- O campo "Sessão" saiu do formulário de abastecimento (não fazia sentido
  ali).
- A cor do Veículo passou a viver junto do resto das configurações do
  módulo.
- As categorias do veículo passam a usar o mesmo editor das categorias de
  despesa comuns.
- O tipo de veículo (combustão, elétrico, híbrido) foi movido pra
  Definições — não fica mais escondido no meio dos abastecimentos.
- Despesa do veículo ganhou um campo de Nome próprio, como qualquer outra
  despesa.
- Corrigido: o texto "débito automático" quebrava ao meio na lista de
  despesas fixas.
- Corrigido: os atalhos de parcelas e o seletor "Outro número" pareciam
  duas coisas diferentes fazendo a mesma função — unificado.
- Corrigido: a barrinha de arrastar das folhas (bottom sheets) sumia no
  computador.
- Corrigido: categoria sem ícone aparecia como uma bolinha colorida vazia,
  sem explicação.
- Corrigido: textos cortados com "..." não tinham como ver o resto.
- Corrigido: a aba "Km" do Veículo ficava escondida sem indicar que dava
  pra arrastar pra ver mais.
- Corrigido: o botão de Registro Rápido tapava o botão "Apagar conta" no
  computador.
- Corrigido: "Próximos 7 dias" do Calendário dizia "nada agendado" mesmo
  com 6 compromissos marcados.
- Corrigido: o Copiloto dizia "você gastou -X" quando um reembolso deixava
  a categoria negativa (errado).
- Chegou suporte a veículo a combustão e híbrido — antes só tinha elétrico.
- Corrigido: os números de Entradas/Saídas em Transações ignoravam
  reembolsos negativos.
- Corrigido (de novo): verde só pra categoria Receita — as duas paletas de
  cor do app foram unificadas pra isso parar de quebrar sozinho.
- Corrigido: os cantos do Registro Rápido não combinavam com o resto do
  app.
- Unificado: criar carga elétrica ou despesa do veículo virou o mesmo fluxo
  dentro do Registro Rápido.
- Ajuste interno: cálculos pesados passam a ser refeitos só quando
  necessário — o app fica mais rápido.
- Corrigido: uma importação confirmada sumia na hora, o que quebrava o
  "Desfazer" logo em seguida; e uma importação inteira (várias linhas)
  passa a contar como um único passo pro "Desfazer".
- Chegou reconhecimento de extratos consolidados do Revolut na importação.

## 24/08/2026

- Corrigido: renomear um cartão não movia o dia de vencimento e fechamento
  da fatura junto.

## 23/08/2026

- Ícone do app: 2 versões novas do desenho ("Fin" + "APP"), dentro da área
  segura pra não cortar ao instalar.
- Corrigido: o Copiloto só reconhecia "meta" no singular, não "metas" no
  plural.
- Corrigido: remover ou reabrir o pagamento de uma fatura não desfazia a
  quitação das parcelas ligadas a ela.
- Uniformizada a altura das linhas em Definições.
- "Cor do Veículo" mudou de lugar — foi pra seção Aparência.
- Ajuste na cor do Veículo no Registro Rápido e na tipografia de Definições.

## 22/08/2026

**Dia de auditoria geral do app** — performance, acessibilidade, arquitetura
do código, testes e segurança, tudo revisado de uma vez (35 mudanças):

- _Performance_: a tela parou de recalcular sozinha a cada movimento de
  rolagem/arrasto; gravar dados no aparelho parou de travar a tela; o app
  ficou 606 KB mais leve antes do login; Início e Resumo Anual pararam de
  recalcular tudo a cada atualização.
- _Acessibilidade_: teclado passa a navegar pela barra inferior, pelos
  menus e por 14 grupos de opções; erros de formulário passam a ser lidos
  certo por leitor de tela; ícones decorativos do cabeçalho deixam de
  atrapalhar leitores de tela; corrigidas as piores combinações de cor
  difíceis de ver por quem tem daltonismo.
- _Segurança_: corrigidas 6 falhas conhecidas em bibliotecas usadas pelo
  app; adicionada uma camada extra de proteção do navegador; o Copiloto
  passa a exigir login confirmado antes de gastar cota da IA.
- _Qualidade interna_: mais de 260 nomes de cor e tamanho de letra soltos
  pelo código foram trocados por um padrão único; reorganização de como as
  partes do app conversam entre si; um trecho repetido 5 vezes virou um só.
- _Testes_: corrigidos testes que na prática não testavam nada (afirmavam o
  oposto do esperado); passou a medir quanto do app está coberto por teste.
- _Visual_: cor do Veículo mais fácil de encontrar e com paleta maior
  (12 → 16 cores); separador fino entre fatias do gráfico de categorias, e
  ele cresce em telas largas; setas de mês do cabeçalho ficam mais fáceis
  de tocar sem crescer visualmente; personalização de cor passa a recusar
  opções com contraste ruim.
- _Documentação_: registrado o plano técnico de transformar o FinApp num
  app de verdade pra iOS/Android (hoje é PWA, roda no navegador) — retoma
  com mais calma a tentativa rápida de Capacitor de uma semana antes (ver
  15/08/2026 abaixo). **Ainda aguardando aprovação, nada executado.**

## 21/08/2026

- O Copiloto: quando sugere um passo com ação, esse passo virou um botão
  de verdade, clicável.
- Chegou o "toque duplo nas costas do celular" pra abrir o Registro Rápido
  direto.
- As notificações (sino) passam a respeitar de verdade a preferência de
  quem quer recebê-las — antes era só decorativo.
- O Tema ganhou a opção "Sistema" (segue o tema do celular), fechando o
  redesenho de Definições.
- Definições ganhou o índice final, organizado em seções.
- Categorias de despesa e Fontes de receita ganharam tela própria.
- Copiloto, Erros recentes, Backup e Trocar senha ganharam cada um sua
  própria tela dentro de Definições (antes ficavam amontoados).
- O Copiloto passa a responder sobre os cenários de poupança do mês.
- Módulo TVDE e Modo discreto viraram um interruptor de verdade, não só um
  texto clicável.
- Corrigido: o saldo de uma conta com débito automático dependia do mês
  que você estava olhando, e não do dia de hoje — podia mostrar errado.

## 20/08/2026

- Corrigido: o painel de cores fechava, mas a grade de cor continuava
  marcada como "aberta" por dentro.
- Corrigido: no Registro Rápido, o valor do intermediário de uma compra
  ficava gravado errado na compra seguinte.
- Corrigido: as folhas de "Novo evento" e "Novo fundo" reabriam com o que
  você tinha escrito e desistido antes.
- Corrigido: apertar Esc num diálogo de confirmação fechava a tela de trás,
  não o diálogo.
- Corrigido: um teste dizia o contrário do que a tela realmente fazia.
- O filtro de Transações ganhou duas listas lado a lado, cada uma rolando
  de forma independente.
- Corrigido: o teto de largura das listas em telas grandes tinha sumido
  sem querer num commit anterior — restaurado, e aplicado a Despesas,
  Receitas, Transações, Parcelas e Veículo.
- O botão virou um componente único reaproveitado, em vez de 19 versões
  copiadas à mão.
- O Copiloto passa a responder "o que eu devo fazer?" puxando o passo do
  plano.
- Corrigido: o arquivo de estilo da tela Metas tinha sido apagado sem
  querer no dia anterior e quebrado o app — restaurado.
- _Nota_: nesse dia o app foi mexido por mais de uma sessão do Claude ao
  mesmo tempo, o que gerou um commit de merge duplicado e dois commits
  idênticos — sem impacto real, só um detalhe de como foi feito.

## 19/08/2026

- Cartões trocou "Devido no mês" por "A pagar este mês" (mais claro).
- A aba do TVDE passa a mostrar tudo que guarda, não só metade.
- Parcelas ganhou o aviso "Pagar tudo — não dá pra desfazer" antes de
  confirmar.
- Tamanho de letra do app inteiro passou a vir de uma escala única, em vez
  de 32 valores soltos.
- Transações passa a mostrar o saldo do período no lugar de "quantas
  linhas existem"; Receitas troca "quantos lançamentos" pela maior fonte
  do mês; Calendário mostra quanto há pra pagar, não quantos eventos
  existem.
- Corrigido: o valor do card de KPI tinha ficado difícil de ler — voltou a
  ser o texto mais visível do card.
- O Copiloto e o card de Metas passam a falar do mês que está na tela, não
  do mês real de hoje.
- Corrigido: reembolso mostrava o sinal de "menos" duas vezes no extrato.
- Cartões passa a dizer de que fatura é cada valor, com o saldo em
  destaque.
- O KPI de Parcelas passa a dizer quanto do total já foi pago.
- Corrigido: a tela de Despesas tinha dois "Total" diferentes e confusos —
  agora cada um tem nome próprio.
- Corrigido: o saldo da conta só desconta uma despesa fixa em débito
  automático depois do dia de vencimento (ajustado depois de um primeiro
  acerto que descontava cedo demais).

## 18/08/2026

- Resumo Anual e o gráfico de categorias passam a contar só a despesa já
  realizada no mês — e o gráfico leva direto pro extrato filtrado ao tocar,
  e cresce em telas largas.
- No TVDE, passa a dar pra escolher a fonte da receita lançada; corrigido
  a data e a conta de destino, que vinham erradas.
- TVDE ficou mais simples: um botão só de semana, sem checkbox de teste
  sobrando.
- O Copiloto passa a entender o ano mesmo sem a palavra "ano" na pergunta,
  a contar fixas/parcelas/veículo no total por cartão, e o plano dele passa
  a olhar os 3 meses que uma janela de 30 dias pode tocar.
- Meta Mensal passa a respeitar o dia de vencimento de fixas/parcelas em
  débito automático.
- Corrigido: importar extrato do ActivoBank trocava crédito por débito.

## 17/08/2026

- O Copiloto passa a respeitar o ano perguntado em "melhor/pior mês", e a
  levar a sério "ano passado" junto de um mês.
- Corrigido: o extrato de Transações não contava fixas/parcelas não
  marcadas em meses já fechados.
- O resumo que o Copiloto usa pra responder já vem com as últimas compras
  e números prontos.

## 15/08/2026

- Chegou uma segunda camada do Copiloto usando IA de verdade (Gemini), pra
  responder o que a primeira camada (baseada em regras) não sabe. Também
  passa a comparar meses, variar o jeito de responder, e ganhou um "motor"
  pra planejar sobre os fundos guardados.
- Chegou a opção de apagar a própria conta direto pelo app, de trocar a
  senha sem passar pela recuperação por e-mail, e de recuperar senha
  automaticamente. Contas novas passam a exigir senha de 8+ caracteres.
- **Tentativa de virar app iOS de verdade via Capacitor — não deu certo, revertida 7 minutos depois.**
  A ideia era empacotar o FinApp num app nativo que carrega direto o site
  ao vivo (finapp-brown.vercel.app), então toda atualização do site já
  aparece no app sem precisar recompilar — instalável no iPhone via Xcode
  com Apple ID grátis. Foi revertida na mesma madrugada, rápido demais pra
  ter sido um problema técnico grave — leia como "tentativa apressada,
  desfeita antes de aprofundar", não como "Capacitor não funciona".
  **Retomado uma semana depois, com mais cuidado**: em 22/08 foi feita uma
  auditoria completa do código pensando nisso (stack, arquitetura, PWA,
  segurança, riscos pro Capacitor/iOS) e documentado um plano técnico em
  8 fases — mas **ainda não foi aprovado nem executado**. Ou seja: virar
  app iOS nativo continua uma decisão em aberto, não uma tentativa que
  falhou por motivo técnico.

## 14/08/2026

- Corrigido: a atualização automática do app recarregava a tela bem na
  hora em que você estava usando o Registro Rápido.
- Corrigido: a fatura no Calendário não caía no dia real de vencimento, e
  o Calendário marcava como "vencido" algo que já tinha sido pago.
- Corrigido: a ordem de Transações no mesmo dia agrupava por tipo sem
  necessidade.
- Crédito no cartão passa a abater direto na fatura.
- Novo ícone do app: uma rosca de categorias com um recibo, e um desenho
  próprio pro iPhone.

## 13/08/2026

- Planejamento ganhou o plano do mês inteiro.
- Orçamento e o gráfico de categorias pararam de contar dinheiro que ainda
  nem tinha saído da conta.
- Os KPIs de Despesas e Receitas trocaram por comparações mais úteis entre
  períodos.
- Corrigido: a folha (bottom sheet) roubava o foco da tela e ficava
  piscando.
- Chegou o rastreio de reembolso de uma despesa.

## 12/08/2026

**Grande leva de testes automáticos e acessibilidade** (28 mudanças), sem
alterar o que aparece no dia a dia:

- Testes cobrindo o leitor de PDF, o Copiloto, fundos, eventos, backup, e
  as 10 páginas que ainda faltavam — e um apagamento de conta que só
  aparecia sob teste foi corrigido.
- Navegação por teclado nas abas (setas, Home/End); teclado e contraste
  corrigidos nas folhas, seletores e selos de status.
- Filtros de Importar e as abas em geral ganharam o padrão de acessibilidade
  que faltava; dias do calendário passam a dizer o que têm marcado.
- Ícones decorativos saem do caminho de leitores de tela (cabeçalho, barra
  de progresso de parcela); selos das despesas fixas ganham nome próprio
  pra leitor de tela.
- A lista de lançamentos avisa quando está carregando ou trocando de
  página; Início avisa quando os dados não sincronizaram; corrigido:
  Transações dizia "nada movimentado" mesmo quando o problema era falha de
  internet.
- Quitadas (parcelas já pagas) saem da lista principal e ganham sua própria
  folha, com opção de esconder; selo Pago/Pendente passa a seguir o débito
  automático de verdade.
- Passou a medir quanto do app está coberto por teste; corrigido um erro
  que quebrava a publicação do app.

## 11/08/2026

- Corrigido: o dia de vencimento no Registro Rápido e a ordenação "Próximo
  vencimento" ignoravam o dia certo.
- Chegou filtro por categoria e por conta/cartão em Transações.
- Corrigido: "Maior categoria" ignorava "Aluguel" escrito com grafia
  diferente.
- O orçamento por categoria passa a se conectar com o resto do app de
  verdade.
- Corrigido: as opções de KPI no celular não batiam com os cards reais das
  telas — e ganharam opções novas.

## 10/08/2026

- O painel de erros só aparece quando existe erro de verdade, escondido
  atrás de um botão.
- Chegou opção de configurar o dia de início da semana em Definições.

## 09/08/2026

- Corrigido: o kWh não vinha automático no Registro Rápido; e a visão
  "Semana" não abria na semana certa.
- Categorias de despesa fixa e despesa comum, que eram duas listas,
  viraram uma só.

## 08/08/2026

- A paleta de cor de categoria foi reorganizada, com mais contraste entre
  as cores.
- Corrigido: marcar "conta de todas" apagava a origem que o app tinha
  aprendido sozinho numa transferência recebida.
- Transferência recorrente entre contas próprias passa a ser reconhecida
  sozinha pelo app.
- Corrigido: o app não recarregava sozinho quando ficava desatualizado
  depois de uma nova versão publicada.
- Corrigido: o 3º KPI de Parcelas devia mostrar "Restante" (a dívida
  toda), mas mostrava outra coisa.
- Chegou o dia de fechamento da fatura, configurável por cartão.
- Corrigido: transações em débito automático apareciam antes mesmo do dia
  de vencimento.

## 07/08/2026

- Corrigido: o total geral do Veículo, e depois também das Parcelas, não
  considerava direito uma despesa fixa em débito automático.
- Corrigido: quitar uma parcela em débito automático cobrava de novo o que
  o cartão já tinha pago.
- Cada parcela passa a mostrar quanto ainda falta pagar.
- Chegou um sino de lembretes com o que está vencido e por pagar.
- Chegou "arrastar pra fechar" em todas as folhas do app.
- Corrigido: a cor de uma categoria vinha de mais de um lugar no app —
  unificado numa fonte só.
- O kWh do carregamento elétrico passa a ser calculado a partir do custo e
  do preço do último carregamento naquele local.
- Com "Semana" escolhida, os KPIs acompanham a semana em vez do mês; o
  card da conta passa a mostrar também onde ela está guardada.
- Corrigido: a poupança acumulada não contava a despesa fixa que sai
  sozinha do cartão, e despesa fixa em débito automático não contava como
  paga sem marcar na mão.

## 06/08/2026

- Chegou opção de ajustar manualmente o saldo de uma conta de débito;
  corrigidos os KPIs de Parcelas, que passam a ser dois cards.
- Corrigido: o seletor de categoria mostrava duas opções chamadas
  "Outros".
- Chegou opção de mover uma recarga classificada errado pra despesas
  comuns direto pelas Transações.
- Corrigido: o pagamento de fatura importado gravava a data errada.
- Todos os campos de dinheiro do app passam a usar o mesmo componente,
  com máscara ao digitar.
- Chegou opção de trocar receita por despesa (ou o contrário) ao editar um
  lançamento; as notas de cada lançamento passam a aparecer nas listas.
- Na importação, dá pra editar o nome e escrever uma nota por linha, e
  escolher a data ao pagar uma fatura.
- Corrigido: o TVDE lançava o lucro da semana em vez da receita bruta.
- "Carregamento" virou "Carga Elétrica" no extrato (nome mais claro).
- Corrigido: uma parcela só devia entrar no extrato depois de paga, na
  data em que foi paga — antes entrava antes da hora.

## 05/08/2026

- Transferências saíram da aba Despesas e foram pra aba Cartões, onde
  fazem mais sentido.
- No computador, os seletores rápidos passam a abrir colados no botão, não
  no fundo da janela.
- Chegou o filtro "só quitadas" com ícone de olho, e opção de ordenar
  pelo valor da parcela.
- Chegou a opção de escolher a conta de todas as linhas de um extrato
  importado de uma vez.
- Chegou uma tela de "algo deu errado" no lugar de tela branca quando o
  app quebra — e os erros passam a ficar guardados na conta e visíveis em
  Definições.
- Corrigido: uma duplicata na importação não mostrava direito o registro
  que já existia; e sobrava lixo de um rascunho de backup antigo.
- Chegou mais uma leva de testes cobrindo os serviços que gravam despesa,
  veículo, parcelas e TVDE.

## 03/08/2026

- Chegou opção de escolher o intermediador do parcelamento (Klarna,
  Scalapay, etc), e o seletor de mês chegou também em Parcelas, TVDE e
  Metas.
- Corrigido: não dava pra ver qual opção estava ativa entre "sei o valor
  total" e "sei o valor da parcela".
- Parcela no cartão passa a vencer junto da fatura, e conta como paga no
  mês certo.
- O app passa a avisar quando a outra ponta de uma transferência já existe
  no app, e a marcar também a saída como transferência entre contas
  próprias.
- Chegou a opção de pagar a fatura do cartão direto pela importação, em
  vez de lançar como despesa comum; e a leitura da fatura de cartão do
  ActivoBank (antes confundida com extrato de conta).
- Chegou uma tela de revisão antes de gravar, quando uma linha parece já
  existir; e a classificação automática de gastos passa a aprender com o
  que você já categorizou antes.
- O kWh estimado passa a vir do histórico do posto de recarga, e não trava
  mais quando falta essa informação.
- Corrigido: despesa fixa já paga e transferência já registrada não
  entravam na busca por duplicata.
- Chegou botão flutuante laranja próprio na aba TVDE, e a opção de virar
  uma linha da importação pra receita ou despesa manualmente.
- Corrigido: um valor entrando numa regra de despesa passava despercebido.

## 02/08/2026

- Corrigido: escolher a fonte da receita não funcionava certo, e "veio de
  outra conta" não aceitava qualquer conta.
- Corrigido: soltar um arquivo fora da área certa derrubava o app inteiro.
- Chegou a opção de arrastar ou colar o arquivo do extrato, além de usar o
  botão; e de marcar uma linha do extrato como dinheiro vindo do cartão de
  crédito.
- Corrigido: ler um PDF grande derrubava a aba no iPhone por falta de
  memória.

## 01/08/2026

- Chegou a opção de classificar uma linha do extrato como recarga
  elétrica, e a leitura de extrato do Revolut em PDF.
- Corrigido: carga elétrica, despesa do veículo, parcela paga e fatura não
  entravam na busca por duplicata.
- Corrigido: importar PDF quebrava no Safari (e no iPhone inteiro). O app
  passa a dizer o que deu errado ao ler um PDF, e guarda um rastro do
  erro.

## 31/07/2026

- Chegou a barra de navegação encostada na base da tela.
- Corrigido: a barra de navegação tinha uma folga que ninguém tinha
  pedido, e "puxar pra atualizar" não procurava versão nova de verdade.

## 30/07/2026

- Corrigido: a barra de navegação ficava longe demais da borda no iPhone.
- Marcos 2, 3 e 4 do plano de reescrita foram marcados como concluídos.
- Corrigido: importar um backup com TVDE não ligava o módulo sozinho; um
  ajuste de reconciliação estava sendo contado como receita; importar
  extrato do ActivoBank perdia linhas por um erro de posição no PDF.
- Chegou leitura de extrato da Wise em PDF, e a opção de importar extrato
  bancário em PDF.
- Corrigido: categoria configurada e palavra-chave da importação batiam em
  pedaço de palavra, não só na palavra inteira.
- Despesa fixa ganhou a opção "débito automático" (só uma anotação, sem
  automatizar o pagamento em si).
- Corrigido: o selo Pago/Pendente só acendia ao passar o mouse.

## 29/07/2026

- Corrigido: o Registro Rápido virava um diálogo centralizado só no
  computador — agora funciona igual em todo lugar.
- Chegou um painel pra editar as cinco cores centrais do app, e TVDE
  ganhou identidade visual laranja própria.
- Os cards passam a mostrar a maior categoria/fonte de receita do mês.
- Corrigido: importar o backup antigo não trazia o dia de vencimento.
- Conteúdo fica mais largo em monitores grandes, com navegação lateral no
  lugar da barra de abas.
- Chegou "puxar do topo pra recarregar" a tela.

## 28/07/2026

Dia de polimento geral (21 mudanças):

- Corrigido: procurar versão nova só acontecia às vezes — agora acontece
  sempre que o app volta pra frente.
- Ajustes visuais: barra de navegação mais perto do fundo, ações do
  cabeçalho menores, mês centralizado de verdade.
- Resumo Anual do Início passa a acompanhar o mês escolhido; Início e
  Planejamento passam a navegar por mês, com opção de saltar direto pra um
  mês, e mostram de qual mês estão falando.
- Chegou animação ao trocar de aba e ao trocar de página, e o botão
  flutuante veste a cor da página em que está.
- O diálogo de confirmação do app substitui o alerta padrão do navegador.
- Corrigido: o quadro do cartão não contava carga e despesa do veículo, e
  o cabeçalho de Parcelas espremia o título.
- O parcelamento ganhou uma folha própria dentro do Registro Rápido, que
  também ganhou cartão obrigatório.
- Chegou a opção de esconder parcelas já quitadas, e de renomear cartão,
  categoria, fonte e local com o nome atualizando em cascata por todo o
  app.
- Carga e despesa do veículo passam a entrar na fatura do cartão.
- Um seletor próprio do app substitui todos os menus suspensos nativos do
  navegador.

## 27/07/2026

- Corrigido: os campos esticavam em altura dentro da folha (bottom sheet).
- Local de recarga elétrica passa a ser escolhido por chips, gerido na aba
  Veículo.
- Chegou o campo Nota no Registro Rápido, e o seletor de tipo com 3 opções
  (Despesa/Receita/Veículo).
- Ajustes visuais: cantos mais arredondados nos campos, folha com altura
  fixa, sombra própria pro botão flutuante e pro botão central.

## 26/07/2026

- Telas antigas e novas do app foram alinhadas ao mesmo padrão visual e de
  acessibilidade.
- Chegou aviso quando a sincronização com o servidor cai, em vez de ficar
  esperando pra sempre sem dizer nada.
- Parcelas ganhou botão redondo de ordenação, com "próximo vencimento" e
  "restante".
- Cartões passa a mostrar uma conta por linha, em qualquer largura de
  tela.
- Corrigido: KPIs, listas e o Copiloto não batiam entre si; as abas do
  Veículo e o detalhe do Calendário não respeitavam o mês exibido.
- Chegaram ícones minimalistas nas categorias, com contraste garantido.
- Corrigido: parcelas contavam errado quando o mês já estava fechado
  (deviam somar o valor cheio do plano).

## 25/07/2026

- Corrigido: totais de despesa e extrato contavam ajustes de reconciliação
  como se fossem gasto de verdade.
- Chegou a aba Transações (extrato geral do mês), a visão por semana,
  compromissos no Calendário, quadros por conta, ordenação nas listas, a
  aba Planejamento e o gráfico de categorias detalhado.
- O mês foi pro cabeçalho, os KPIs passam a ser escolhidos por página e
  ficam clicáveis; chegou o mês global, que afeta todas as telas de uma
  vez.
- Registro Rápido: cartão em botões, folha maior, despesa parcelada; e
  Veículo chegou nele também, com recarga elétrica automática.
- Parcelas e TVDE passam a usar a mesma caixa de edição — o botão
  "Estornar" (que confundia) saiu; Despesas e Veículo passam a usar uma
  caixa única de adicionar/editar.
- Corrigido: os KPIs no celular viraram paginação de verdade (2 por vez),
  em vez de um grid apertado de 2 colunas.
- Chegou a aba "Backup da app antigo" dentro de Importar, pra trazer os
  dados do app anterior (financas.html).
- Fundação do modelo de dados, aparência de categoria e seletor de data —
  base pra tudo isso.

## 24/07/2026

Dia grande de recursos novos (30 mudanças):

- Chegaram as telas de Despesas Fixas gerais e Transferências, que passam
  a entrar no total de despesa do mês; corrigido: a fatura de cartão
  ignorava as duas.
- Corrigido: o botão Desfazer só ficava disponível a partir da 2ª edição,
  devia ser já na 1ª.
- O app ganhou modo offline (funciona sem internet, guardando localmente),
  e Desfazer/Refazer no cabeçalho, cobrindo as principais ações, com
  "arrastar pra fechar" no Registro Rápido.
- Chegou a tela de Metas completa (meta mensal, fundos, resumo anual), a
  tela de Calendário com grade mensal e "próximos 7 dias", e a tela
  completa de Veículo (cargas, despesas, fixas, km) — que passa a entrar
  nos totais gerais do app.
- Corrigido: o tipo de dado do Veículo estava mapeado errado desde o
  início da reescrita.
- Definições ganhou moeda, categorias editáveis, modo discreto e backup.
- O Copiloto ganhou um card próprio no Início e o motor de respostas
  (baseado em regras, ainda sem IA), usando dados reais de veículo e
  calendário.
- Chegou a tela Importar completa: analisar, editar, filtrar e confirmar
  um extrato.
- TVDE ganhou botão pra criar/editar qualquer semana pelo número, opt-in
  por conta (quem não usa nem vê a aba), e a tela completa com semanas,
  resumo, Segurança Social e despesas.

## 23/07/2026

**Início do projeto** (26 mudanças) — o FinApp nasce como reescrita do app
antigo (financas.html):

- Esqueleto inicial: um PWA (app que roda no navegador mas se comporta
  como app instalado) com Firebase pra login e banco de dados.
- Projeto Firebase próprio criado e publicado (finapp1-20d00).
- Trocado o esqueleto inicial por uma base de verdade em Vite + React +
  TypeScript, com estrutura de pastas e cores/estilos claro e escuro
  definidos desde o início.
- O modelo de dados completo foi desenhado, e cálculos de dinheiro
  passaram a usar centavos inteiros (evita erro de arredondamento), com
  testes.
- Chegou o login de verdade com Firebase, e toda a casca visual: cabeçalho,
  abas, barra de navegação com efeito de "bolha", botão flutuante e as 11
  páginas do app — com o botão central de registro e destaque no estilo
  iOS na aba ativa.
- Chegaram as primeiras telas com dados reais (Início, Receitas,
  Despesas), o Registro Rápido funcional com aviso de confirmação, e
  ajustes finos de visual (sombra, curvas, vidro fosco nos menus, pulso no
  botão flutuante, animação nos KPIs).

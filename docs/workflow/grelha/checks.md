# Checks da grelha

Verificação prévia (Análise): a 1024, 1100, 1180, 1280, 1366, 1440 e 1500px não há scroll horizontal nem elementos fora da janela com os dados de teste (document.scrollWidth = clientWidth). O corte da captura do Gabriel não se reproduz com estes dados; volta a ser testado depois do H3 com valores longos.

## H1 — utilitário partilhado e largura máxima

- `styles/grelha.module.css`: `.grelha` (1 coluna no telemóvel; 2 colunas de 768 a 1023px; 12 colunas, gap 16px, a partir de 1024px), `.celula` (estica o cartão à altura da linha, desaparece se vazia), spans `.s12/.s8/.s6/.s4` (≥ 1024px), `.linhas2`, `.alinhaTopo` (para o painel sticky). Só CSS, sem biblioteca. De 768 a 1023px `s12` ocupa as 2 colunas e os outros uma cada.
- Largura: `--conteudo-max` 1320px; o conteúdo encosta à sidebar (`margin-left: var(--sidebar-w)`, a sobra fica à direita) em vez de centrar; o cabeçalho acompanha: o `padding-right` da faixa soma a sobra, de modo que o mês e as ações ficam na mesma largura do conteúdo.
- Capturas "antes" (estado anterior): FinApp-capturas/grelha/antes-{inicio,analise,despesas}-{1180,1440,1920}-{escuro,claro}.png e antes-*-1440-claro-webkit.png.

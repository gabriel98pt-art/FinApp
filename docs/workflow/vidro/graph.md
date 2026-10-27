# Grafo da Fase A do visual "vidro claro + terracota"

Prévias aprovadas: canvas https://claude.ai/artifact/Rd6hdbYJfiid6wyjq7Ed1W (linha y 3300): VidroInicio (iPhone claro, sem fosco), VidroIpad (iPad/Mac, com fosco, 3 colunas, sidebar em pílula), VidroEscuro (escuro quente, pode ser vetado: fica isolado nos tokens do tema escuro).

Regras: um commit por nó (format → lint → test → build) com push. ZERO mudanças de comportamento, lógica ou texto: só aparência. O que não está na prévia nem no plano NÃO entra; se for inevitável, vai como DESVIO no checks.md ANTES do commit. Capturas de cada tela com dados realistas e casos de borda, a 320 e 390px (claro e escuro) e a 1180px (claro), em ~/Projetos/Dev/FinApp-capturas/vidro-faseA/. WebKit do Playwright para a Início e a navegação. Fora do plano: gráficos, página Análise, seletor Semana/Mês/Ano, Exportar.

- A1 Tokens claro (fundo mesh, vidro, texto, rótulos, terracota, vermelho/âmbar/teal, botão primário preto)
- A2 Tokens escuro quente (botão primário creme, aba ativa creme) — isolado no bloco do tema escuro
- A3 Materiais (vidro partilhado, fosco só ≥768px, fallbacks, raios 22/24/99)
- A4 Navegação (iPhone: pílula flutuante; ≥768px: sidebar em pílula com tooltip)
- A5 Componentes base (QuadroResumo, chips ▲▼, chips de estado, toggles, segmentado, anéis/barras, botões, tipografia)
- A6 Início (Resultado do mês em destaque terracota, secções em vidro, grelha de 3 colunas ≥768px)

Arestas: A1 → A2, A3 → A4, A5 → A6. TVDE passa ao azul do TVDE Pro (#3F5EF0 claro, #8FA2FF escuro), tokens `--tvde*`.

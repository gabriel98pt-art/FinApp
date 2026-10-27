# Checks da Fase A (vidro claro + terracota)

Medições com WCAG 2.x, pior caso entre os pontos do mesh (#FBF3EA, #FFE2C8, #FFD3B0, #F9D9BF, #FBEBD5), com e sem vidro branco a 74% por cima.

## DESVIOS em relação à prévia (anotados antes do commit)

1. `--mut` claro: #64584E em vez de #6B5F55. Motivo: #6B5F55 dá 4,48:1 sobre #FFD3B0 (abaixo de 4,5). Com #64584E: 4,99 no mesh, 6,36 no vidro, 5,80 sobre --s2.
2. Terracota como texto: #E8703A dá 2,2–2,8:1. Texto/links usam `--blu-txt` = `color-mix(--blu 65%, #000)` = #974926 (4,61 no mesh, 5,88 no vidro). #E8703A só em preenchimentos, anéis, barras e toggles.
3. Texto sobre terracota: `--on-blu` #1C1712 (5,8:1); o branco dá 3,1:1.
4. Teal/vermelho/âmbar para TEXTO escurecidos (a prévia usa #0F9F8C = 3,0:1, #C2410C = 3,75 no mesh, #B7791F = 2,6): `--grn` #096B5E (4,64), `--red` #A8350A (4,78), `--ylw` #7F520F (4,88), `--pur` #6D42C4 (4,71). No escuro valem os da prévia.
5. TVDE: `--lrj*` renomeado `--tvde*` (azul do TVDE Pro) e o tom de KPI `laranja` passou a `tvde` (renome interno, sem texto visível).
6. Botões primários (Botao primaria/submeter, Login, Importar, Planejamento, Copiloto, mover em Transações) passam a `--btn-bg`/`--btn-txt` (preto no claro); os preenchimentos terracota com texto (dia escolhido, mês escolhido, etc.) passam a `--on-blu`.

## A1 — contraste (claro)

| Par                                            | Contraste                 |
| ---------------------------------------------- | ------------------------- |
| --txt #1C1712 sobre mesh / vidro               | ≥ 12,9 / ≥ 16,4           |
| --mut #64584E sobre mesh / vidro / --s1 / --s2 | 4,99 / 6,36 / 6,64 / 5,80 |
| --blu-txt #974926 sobre mesh / vidro / --s2    | 4,61 / 5,88 / 5,36        |
| --grn #096B5E mesh / vidro / --s2              | 4,64 / 5,92 / 5,40        |
| --red #A8350A mesh / vidro / --s2              | 4,78 / 6,10 / 5,56        |
| --ylw #7F520F mesh / vidro / --s2              | 4,88 / 6,22 / 5,67        |
| --on-blu #1C1712 sobre #E8703A                 | 5,77                      |
| --tvde #3F5EF0 sobre #FBF3EA / vidro           | 4,69 / 4,76               |
| Botão primário #FFF sobre #1C1712              | 17,4                      |

grep de hex soltos novos fora dos tokens: ver o fim do ficheiro (preenchido a cada nó).

## A2 — contraste (escuro quente), fundo #15100C / vidro rgba(48,36,29,.62) / sólido #2A201A

| Par                                  | bg   | vidro | sólido |
| ------------------------------------ | ---- | ----- | ------ |
| --txt #F6EEE7                        | 16,5 | 14,5  | 13,9   |
| --mut #B9AA9D                        | 8,4  | 7,4   | 7,1    |
| --blu/--blu-txt #F0844F              | 7,3  | 6,4   | 6,2    |
| --grn #3CCBB5                        | 9,4  | 8,3   | 7,9    |
| --red #FF8F75                        | 8,5  | 7,5   | 7,2    |
| --ylw #F2C14E                        | 11,3 | 9,9   | 9,5    |
| --pur #B08DFC                        | 7,3  | 6,4   | 6,1    |
| --on-blu #1A120D sobre #F0844F       | 7,1  |       |        |
| botão primário #1A120D sobre #F6EEE7 | >15  |       |        |
| --tvde #8FA2FF                       | 7,9  | 7,0   |        |

Chips (texto sobre tint 16% sobre vidro): teal 6,1, vermelho 5,5, âmbar 6,9.

Desvio: `theme-color` do manifest/index passa a #15100C; o `background_color` do manifest e a arte do ícone ficam navy (a chapa do ícone é imagem, fora do plano).

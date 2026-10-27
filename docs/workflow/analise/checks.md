# Checks da página Análise

## D0 — apagar corBotaoRegistro

Apagados `src/utils/corBotaoRegistro.ts` e `corBotaoRegistro.test.ts` (decisão do Gabriel). `grep -rn "corBotaoRegistro\|estiloBotaoRegistro" src api` sem resultados. `cfg.categoriaCor` e `corDaCategoriaVisual` continuam a ser usados por outras telas, por isso ficam.

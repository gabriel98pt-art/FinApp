# Documentação da FinApp

Índice. Cada ficheiro cobre um assunto. O resumo curto para trabalhar está em `../CLAUDE.md`.
Escrito a partir da leitura do código. Se algo divergir do código, vale o código: corrija o documento.

## Como o código está organizado

| Ficheiro                                                 | Assunto                                                          |
| -------------------------------------------------------- | ---------------------------------------------------------------- |
| [arquitetura.md](arquitetura.md)                         | Camadas, fluxo de dados, arranque, decisões já tomadas           |
| [dados-e-api.md](dados-e-api.md)                         | Firebase: caminhos, serviços, sync, auth, regras, tipos, IA      |
| [stores.md](stores.md)                                   | Stores zustand: o que cada uma guarda e quem a alimenta          |
| [telas-e-rotas.md](telas-e-rotas.md)                     | Rotas, telas, folhas, layout, mapa interno dos ficheiros grandes |
| [componentes.md](componentes.md)                         | Componentes de UI com as props                                   |
| [hooks.md](hooks.md)                                     | Hooks                                                            |
| [utils.md](utils.md)                                     | Lógica pura, ficheiro a ficheiro, e constantes                   |
| [estilos-e-design-system.md](estilos-e-design-system.md) | CSS, tokens, movimento, regras de design                         |
| [glossario.md](glossario.md)                             | Termos do domínio (fatura, parcela, fundo, mês visível...)       |

## Como trabalhar, testar e publicar

| Ficheiro                                                     | Assunto                                                                |
| ------------------------------------------------------------ | ---------------------------------------------------------------------- |
| [testes-e-ci.md](testes-e-ci.md)                             | Testes, cobertura, lint, CI                                            |
| [ios-e-deploy.md](ios-e-deploy.md)                           | PWA, Capacitor/iOS, Vercel, Firebase                                   |
| [scripts-e-ferramentas-dev.md](scripts-e-ferramentas-dev.md) | `scripts/`, ecrãs de desenvolvimento                                   |
| [dicas-de-organizacao.md](dicas-de-organizacao.md)           | Problemas e sugestões de melhoria (nada aplicado, a decidir uma a uma) |

## Já existiam (não mexidos)

- [../HISTORICO.md](../HISTORICO.md): diário de mudanças, entrada nova sempre no topo.
- [../PENDENCIAS.md](../PENDENCIAS.md): o que ficou por fazer e porquê.
- [../RELATORIO_AUDITORIA.md](../RELATORIO_AUDITORIA.md): auditoria antiga.
- [plano-app-apple.md](plano-app-apple.md) e [plano-mobile-capacitor.md](plano-mobile-capacitor.md): planos da app nativa.
- [EQUIPES_AUDITORIA.md](EQUIPES_AUDITORIA.md): equipas da auditoria.
- `design/`: análise da barra de abas e do topo.
- `workflow/`: registos de trabalho (`checks`, `graph`, `progress`) de análise, grelha, vidro e visual-fase2.

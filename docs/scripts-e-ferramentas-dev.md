Escrito a partir da leitura do código. Se divergir do código, vale o código: corrija o documento.

# Scripts e ferramentas de desenvolvimento

## `npm run` (ver `package.json`)

`dev` (`vite`) · `build` (`tsc -b && vite build`) · `preview` · `test`, `test:watch`, `test:coverage` · `typecheck` · `lint` · `format`, `format:check` · `icones` (`node scripts/gerar-icones.mjs`). Não há `bench` nem `capturas`.

## `scripts/gerar-icones.mjs`

Gera os PNG do ícone e as imagens do ecrã de arranque (claro e escuro) a partir de um único SVG, `public/icons/icon-v4.svg`, com o `sharp` (já traz o rasterizador). Saídas em `public/icons/` e `public/splash/`. As cores vêm de `src/styles/tokens.css`. Trocar o desenho é trocar o SVG e correr `npm run icones`. A versão (`VERSAO = "v4"`) está no próprio script e deve coincidir com `public/manifest.json` e com `includeAssets` em `vite.config.ts`. `public/icons` ainda guarda ficheiros v2 e v3, sem uso aparente (confirmar antes de apagar).

## Pré-visualização local

- `dev-preview.html` + `src/dev-preview.tsx`: renderiza a app inteira com as stores semeadas e sem login (`sessao: null` com `status: "autenticado"`, por isso nada toca na rede). Serve para conferir ecrãs sem conta Firebase. Abre-se com `npm run dev` em `/dev-preview.html`. Não entra no build de produção (o Vite só empacota `index.html`).
- `.claude/launch.json` (ainda não versionado): arranca `vite --port 5173 --strictPort` com o nome `finapp-dev`.

## Só locais, fora do git

`dev-botoes.html` + `src/dev-botoes.tsx` (vitrine dos 5 estilos × 3 tamanhos do `Botao`) e `dev-captura.html` + `src/dev-captura.tsx` existem só nesta máquina: estão em `.git/info/exclude`, não no `.gitignore`. Quem clonar o repositório não os tem. O erro de lint atual vem de `src/dev-botoes.tsx` (ver `testes-e-ci.md`). Também locais: `SPEC_REESCRITA_COMPLETA.md`, `.claude/finapp-qa-credentials.local`, `graphify-out/`, `coverage/`, `ios/DerivedData/`.

## Outros

- `api/copiloto-ia.ts` e o seu teste: função da Vercel (ver `ios-e-deploy.md`). Não importa nada de `src/`.
- Instalar no iPhone ou simulador: ver `ios-e-deploy.md`.

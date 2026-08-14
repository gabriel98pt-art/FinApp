/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  test: {
    // O ambiente por omissão continua a ser `node`: 781 dos testes são lógica
    // pura e correm em ~400 ms assim. Os testes de componente pedem jsdom com
    // `// @vitest-environment jsdom` no topo do próprio ficheiro — é o
    // mecanismo do Vitest para isto, e assim quem escreve um teste vê no
    // ficheiro em que ambiente ele corre, em vez de o deduzir de uma glob
    // escondida na configuração.
    setupFiles: ["./src/testes/setup.ts"],
    coverage: {
      provider: "v8",
      // Sem `include` explícito, o relatório só lista ficheiros que ALGUM
      // teste importou — e um ficheiro que nenhum teste toca simplesmente não
      // aparecia, em vez de aparecer a 0%. O relatório escondia exactamente
      // os buracos para que serve (era o caso de renomear.ts, a cascata de
      // renomeação). Com `include` preenchido, o provider v8 já lista todos
      // os ficheiros que baterem nele — a opção `all` que fazia isto
      // explicitamente saiu do Vitest 4, este `include` sozinho basta agora.
      // Continua a medir só a lógica, mesmo agora que há testes de página. Os
      // smoke tests provam que a tela monta e que os estados aparecem — não
      // percorrem ramos —, e pôr os componentes aqui daria uma percentagem que
      // sobe sem que nada tenha ficado mais protegido. O relatório serve para
      // decidir onde escrever o próximo teste, e para isso tem de continuar a
      // falar da lógica.
      include: ["src/utils/**", "src/services/**"],
      // `firebase.ts` é só a inicialização do SDK (não há lógica para cobrir) e
      // os próprios testes não se medem a si mesmos.
      exclude: ["src/services/firebase.ts", "**/*.test.ts"],
      reporter: ["text", "html"],
    },
  },
  plugins: [
    react(),
    VitePWA({
      // autoUpdate: nova versão publicada entra sozinha na próxima navegação,
      // sem diálogo pedindo confirmação ao usuário (seção 6.1).
      registerType: "autoUpdate",
      includeAssets: ["icons/icon.svg", "icons/apple-touch-icon.png"],
      manifest: false, // manifest.json próprio já existe em public/
      workbox: {
        // Precache do app shell: todo HTML/JS/CSS gerado no build — abre
        // offline mostrando a interface mesmo sem nunca ter sincronizado.
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
        // O PDF.js são ~430 kB e só servem para importar extrato em PDF: ficam
        // fora do precache, senão toda instalação carregava meio megabyte que a
        // maioria nunca usa (era 811 kB de shell, passaria a 1,2 MB). Entram
        // pela regra de runtime abaixo, na primeira vez que alguém importa um
        // PDF, e a partir daí ficam em cache — inclusive offline.
        globIgnores: ["**/pdf-*.js", "**/pdf.worker*"],
        runtimeCaching: [
          {
            // Os chunks do PDF.js: imutáveis (nome com hash), logo cache-first.
            urlPattern: /\/assets\/(pdf-|pdf\.worker)[^/]*$/,
            handler: "CacheFirst",
            options: {
              cacheName: "pdfjs",
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 8 },
            },
          },
          {
            // Leituras do Firebase RTDB: network-first — tenta a rede, mas
            // cai no cache se offline, então o último sync continua visível
            // (ainda que desatualizado). Nunca cachear escritas (só GET).
            urlPattern: ({ url }) => url.hostname.includes("firebaseio.com"),
            handler: "NetworkFirst",
            method: "GET",
            options: {
              cacheName: "firebase-rtdb",
              networkTimeoutSeconds: 4,
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
      },
    }),
  ],
});

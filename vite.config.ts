/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      // Só a lógica. Os componentes ainda não têm ambiente de teste (não há
      // jsdom configurado), e incluí-los aqui afogaria o número que interessa
      // num mar de 0% — o relatório deixaria de servir para decidir onde
      // escrever o próximo teste, que é para o que ele existe.
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
      includeAssets: ["icons/icon.svg"],
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

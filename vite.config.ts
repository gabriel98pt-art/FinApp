import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
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
        runtimeCaching: [
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

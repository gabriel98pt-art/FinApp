// Cache versionado + estratégia network-first: o AppFinanceiro teve um bug
// real de cache não atualizar após deploy até trocar pra essa estratégia
// (cache-first servia versão velha indefinidamente). Bump o número da
// versão a cada deploy que muda arquivos estáticos.
const CACHE = "finapp-v1";
const ARQUIVOS_ESTATICOS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/main.css",
  "./js/main.js",
  "./js/auth.js",
  "./js/db.js",
  "./js/calc.js",
  "./js/state.js",
  "./js/util.js",
  "./js/firebase-init.js",
  "./js/firebase-config.js",
  "./js/ui/dashboard.js",
  "./js/ui/lancamentos.js",
  "./icons/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ARQUIVOS_ESTATICOS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((chaves) =>
      Promise.all(chaves.filter((c) => c !== CACHE).map((c) => caches.delete(c)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  // Nunca cachear chamadas ao Firebase (auth/dados têm que ser sempre live).
  if (event.request.url.includes("firebaseio.com") || event.request.url.includes("googleapis.com")) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((resposta) => {
        const clone = resposta.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        return resposta;
      })
      .catch(() => caches.match(event.request))
  );
});

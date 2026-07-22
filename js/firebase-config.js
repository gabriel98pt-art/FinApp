// Config pública do SDK Firebase (client-side por design — a segurança real
// está nas Realtime Database Security Rules, não em esconder isto).
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCfV2UgHv7r9paXnkCsHKgBqFAPd-t3V8M",
  authDomain: "finapp-gc2026.firebaseapp.com",
  // TODO: confirmar esta URL depois de criar a instância do Realtime Database
  // no Console (passo manual, ver README) — o domínio muda conforme a região
  // escolhida (ex. "-default-rtdb.europe-west1.firebasedatabase.app").
  databaseURL: "https://finapp-gc2026-default-rtdb.firebaseio.com",
  projectId: "finapp-gc2026",
  storageBucket: "finapp-gc2026.firebasestorage.app",
  messagingSenderId: "344135644515",
  appId: "1:344135644515:web:6df0ad8be7984500478f56",
};

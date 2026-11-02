// Inicialização única do SDK Firebase (modular v9+).
// Config pública por design — a segurança real está nas Security Rules do
// Realtime Database, não em esconder estas chaves.

import { initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  indexedDBLocalPersistence,
  initializeAuth,
} from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyC1bT8peqqED1g9BlNs02nJsW501JRWDqU",
  authDomain: "finapp1-20d00.firebaseapp.com",
  databaseURL: "https://finapp1-20d00-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "finapp1-20d00",
  storageBucket: "finapp1-20d00.firebasestorage.app",
  messagingSenderId: "239032194040",
  appId: "1:239032194040:web:fdc8303c2d700e169f7c0d",
};

export const firebaseApp = initializeApp(firebaseConfig);
// `initializeAuth` em vez de `getAuth`, como no TVDE-Pro: o `getAuth` liga o
// login por popup/redirect, que no arranque abre um iframe escondido do
// `firebaseapp.com` e só depois diz se há sessão. Dentro do app nativo
// (Capacitor, capacitor://localhost) esse iframe nunca responde e a tela fica
// vazia. Este app só entra por e-mail e senha, e a persistência é a mesma do
// `getAuth` (IndexedDB, depois localStorage, depois sessionStorage).
export const auth = initializeAuth(firebaseApp, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence],
});
export const db = getDatabase(firebaseApp);

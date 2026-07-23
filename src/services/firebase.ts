// Inicialização única do SDK Firebase (modular v9+).
// Config pública por design — a segurança real está nas Security Rules do
// Realtime Database, não em esconder estas chaves.

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
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
export const auth = getAuth(firebaseApp);
export const db = getDatabase(firebaseApp);

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { FIREBASE_CONFIG } from "./firebase-config.js";

const app = initializeApp(FIREBASE_CONFIG);
export const auth = getAuth(app);
export const rtdb = getDatabase(app);

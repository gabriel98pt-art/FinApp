import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { auth } from "./firebase-init.js";

export function watchAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function login(email, password) {
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  return user;
}

export async function signup(email, password) {
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  return user;
}

export function logout() {
  return signOut(auth);
}

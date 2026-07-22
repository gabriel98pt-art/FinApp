import { watchAuthState, login, signup, logout } from "./auth.js";
import { watchLancamentos, addLancamento, removeLancamento } from "./db.js";
import { setState, subscribe } from "./state.js";
import { renderDashboard } from "./ui/dashboard.js";
import { renderLancamentos } from "./ui/lancamentos.js";

const telaLogin = document.getElementById("tela-login");
const telaApp = document.getElementById("tela-app");
const dashboardEl = document.getElementById("dashboard");
const lancamentosEl = document.getElementById("lancamentos");
const btnLogout = document.getElementById("btn-logout");
const formLogin = document.getElementById("form-login");
const loginErro = document.getElementById("login-erro");

let unsubscribeLancamentos = null;

watchAuthState((user) => {
  setState({ user });
  telaLogin.hidden = Boolean(user);
  telaApp.hidden = !user;

  if (unsubscribeLancamentos) {
    unsubscribeLancamentos();
    unsubscribeLancamentos = null;
  }

  if (user) {
    unsubscribeLancamentos = watchLancamentos(user.uid, (lancamentos) => {
      setState({ lancamentos });
    });
  } else {
    setState({ lancamentos: [] });
  }
});

subscribe(({ lancamentos, user }) => {
  if (!user) return;
  renderDashboard(dashboardEl, lancamentos);
  renderLancamentos(lancamentosEl, lancamentos, {
    onAdd: (novo) => addLancamento(user.uid, novo),
    onRemove: (id) => removeLancamento(user.uid, id),
  });
});

formLogin.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginErro.textContent = "";
  const dados = Object.fromEntries(new FormData(formLogin).entries());
  const acao = e.submitter?.name === "signup" ? signup : login;
  try {
    await acao(dados.email, dados.password);
  } catch (err) {
    loginErro.textContent = traduzirErro(err.code);
  }
});

btnLogout.addEventListener("click", () => logout());

function traduzirErro(code) {
  const mapa = {
    "auth/invalid-email": "E-mail inválido.",
    "auth/user-not-found": "Usuário não encontrado.",
    "auth/wrong-password": "Senha incorreta.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/email-already-in-use": "Esse e-mail já está cadastrado.",
    "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
  };
  return mapa[code] || "Não foi possível concluir. Tente novamente.";
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js");
  });
}

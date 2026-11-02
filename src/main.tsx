import { Capacitor } from "@capacitor/core";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/index.css";

// Dentro do app nativo (Capacitor) a página não pode ter zoom: ao tocar num
// campo com fonte abaixo de 16px o iOS ampliava a página, que ficava mais larga
// que o ecrã, com barras de rolagem nas duas direções e o topo deslocado depois
// de fechar o teclado. Na web o zoom continua livre (acessibilidade).
if (Capacitor.isNativePlatform()) {
  document
    .querySelector('meta[name="viewport"]')
    ?.setAttribute(
      "content",
      "width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1, user-scalable=no",
    );
  document.documentElement.classList.add("nativo");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

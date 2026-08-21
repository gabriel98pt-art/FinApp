import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import Header from "./Header";
import FaixaErroSync from "./FaixaErroSync";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";
import Fab from "./Fab";
import PaginaTransicao from "./PaginaTransicao";
import RegistroRapido from "./RegistroRapido";
import Toast from "../components/Toast";
import ConfirmarAcao from "../components/ConfirmarAcao";
import IndicadorPull from "../components/IndicadorPull";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import { useSyncConta } from "../hooks/useSyncConta";
import { useAbrirRegistroPorUrl } from "../hooks/useAbrirRegistroPorUrl";
import styles from "./AppShell.module.css";

export default function AppShell() {
  useSyncConta();
  useAbrirRegistroPorUrl();
  const { estado, limite, manipuladores } = usePullToRefresh();

  return (
    <>
      <Header />
      <FaixaErroSync />
      <Sidebar />
      <IndicadorPull estado={estado} limite={limite} />
      {/* O gesto vive só na tela principal: folhas e modais estão fora deste
          <main>, então puxar dentro delas não dispara nada. */}
      <main
        className={styles.conteudo}
        style={estado.y > 0 ? { transform: `translateY(${estado.y}px)` } : undefined}
        {...manipuladores}
      >
        <Suspense fallback={null}>
          <PaginaTransicao>
            <Outlet />
          </PaginaTransicao>
        </Suspense>
      </main>
      <MobileNav />
      <Fab />
      <RegistroRapido />
      <Toast />
      <ConfirmarAcao />
    </>
  );
}

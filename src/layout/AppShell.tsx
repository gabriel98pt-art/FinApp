import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import Header from "./Header";
import FaixaErroSync from "./FaixaErroSync";
import TabBar from "./TabBar";
import MobileNav from "./MobileNav";
import Fab from "./Fab";
import PaginaTransicao from "./PaginaTransicao";
import RegistroRapido from "./RegistroRapido";
import Toast from "../components/Toast";
import ConfirmarAcao from "../components/ConfirmarAcao";
import { useSyncConta } from "../hooks/useSyncConta";
import styles from "./AppShell.module.css";

export default function AppShell() {
  useSyncConta();
  return (
    <>
      <Header />
      <FaixaErroSync />
      <TabBar />
      <main className={styles.conteudo}>
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

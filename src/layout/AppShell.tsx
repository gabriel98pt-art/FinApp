import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import Header from "./Header";
import TabBar from "./TabBar";
import MobileNav from "./MobileNav";
import Fab from "./Fab";
import styles from "./AppShell.module.css";

export default function AppShell() {
  return (
    <>
      <Header />
      <TabBar />
      <main className={styles.conteudo}>
        <Suspense fallback={null}>
          <Outlet />
        </Suspense>
      </main>
      <MobileNav />
      <Fab />
    </>
  );
}

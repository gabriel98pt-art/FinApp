import { lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./layout/AppShell";
import Login from "./pages/Login";
import { useAuthStore } from "./stores/authStore";
import { useCfgStore } from "./stores/cfgStore";
import { useAplicarTema } from "./hooks/useAplicarTema";
import { useAplicarModoDiscreto } from "./hooks/useAplicarModoDiscreto";
import { usePwaUpdate } from "./hooks/usePwaUpdate";

// Lazy loading por página (seção 8 — performance)
const Inicio = lazy(() => import("./pages/Inicio"));
const Receitas = lazy(() => import("./pages/Receitas"));
const Despesas = lazy(() => import("./pages/Despesas"));
const Veiculo = lazy(() => import("./pages/Veiculo"));
const Cartoes = lazy(() => import("./pages/Cartoes"));
const Parcelas = lazy(() => import("./pages/Parcelas"));
const Calendario = lazy(() => import("./pages/Calendario"));
const Planejamento = lazy(() => import("./pages/Planejamento"));
const Transacoes = lazy(() => import("./pages/Transacoes"));
const Metas = lazy(() => import("./pages/Metas"));
const Importar = lazy(() => import("./pages/Importar"));
const Tvde = lazy(() => import("./pages/Tvde"));
const Definicoes = lazy(() => import("./pages/Definicoes"));

/** /tvde só existe com o módulo ligado (opt-in por conta, seção 4.4).
 *  Enquanto a cfg carrega, não redireciona — evita expulsar quem recarrega
 *  a página já dentro do TVDE. */
function RotaTvde() {
  const showTvde = useCfgStore((s) => s.cfg.showTvde);
  const carregado = useCfgStore((s) => s.carregado);
  if (carregado && !showTvde) return <Navigate to="/" replace />;
  return <Tvde />;
}

export default function App() {
  useAplicarTema();
  useAplicarModoDiscreto();
  // Fora do gate de sessão de propósito: procurar versão nova não depende de
  // estar logado, e a tela de login também precisa de se atualizar.
  usePwaUpdate();
  const status = useAuthStore((s) => s.status);

  // Nada de piscar tela: espera o Firebase restaurar a sessão persistida
  if (status === "carregando") return null;
  if (status === "deslogado") return <Login />;

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Inicio />} />
          <Route path="/receitas" element={<Receitas />} />
          <Route path="/despesas" element={<Despesas />} />
          <Route path="/veiculo" element={<Veiculo />} />
          <Route path="/cartoes" element={<Cartoes />} />
          <Route path="/parcelas" element={<Parcelas />} />
          <Route path="/calendario" element={<Calendario />} />
          <Route path="/planejamento" element={<Planejamento />} />
          <Route path="/transacoes" element={<Transacoes />} />
          <Route path="/metas" element={<Metas />} />
          <Route path="/importar" element={<Importar />} />
          <Route path="/tvde" element={<RotaTvde />} />
          <Route path="/definicoes" element={<Definicoes />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

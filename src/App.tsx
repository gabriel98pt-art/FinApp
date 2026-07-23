import { lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./layout/AppShell";
import Login from "./pages/Login";
import { useAuthStore } from "./stores/authStore";
import { useAplicarTema } from "./hooks/useAplicarTema";

// Lazy loading por página (seção 8 — performance)
const Inicio = lazy(() => import("./pages/Inicio"));
const Receitas = lazy(() => import("./pages/Receitas"));
const Despesas = lazy(() => import("./pages/Despesas"));
const Veiculo = lazy(() => import("./pages/Veiculo"));
const Cartoes = lazy(() => import("./pages/Cartoes"));
const Parcelas = lazy(() => import("./pages/Parcelas"));
const Calendario = lazy(() => import("./pages/Calendario"));
const Metas = lazy(() => import("./pages/Metas"));
const Importar = lazy(() => import("./pages/Importar"));
const Tvde = lazy(() => import("./pages/Tvde"));
const Definicoes = lazy(() => import("./pages/Definicoes"));

export default function App() {
  useAplicarTema();
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
          <Route path="/metas" element={<Metas />} />
          <Route path="/importar" element={<Importar />} />
          <Route path="/tvde" element={<Tvde />} />
          <Route path="/definicoes" element={<Definicoes />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

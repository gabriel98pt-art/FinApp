import Login from "./pages/Login";
import { useAuthStore } from "./stores/authStore";
import { useAplicarTema } from "./hooks/useAplicarTema";

export default function App() {
  useAplicarTema();
  const status = useAuthStore((s) => s.status);

  if (status === "carregando") return null;
  if (status === "deslogado") return <Login />;

  return <p style={{ padding: 24 }}>Logado — casca do app chega no próximo commit.</p>;
}

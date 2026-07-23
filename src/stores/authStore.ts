import { create } from "zustand";
import { observarSessao, type Sessao } from "../services/authService";

interface AuthState {
  /** 'carregando' até o Firebase restaurar (ou não) a sessão persistida. */
  status: "carregando" | "autenticado" | "deslogado";
  sessao: Sessao | null;
}

export const useAuthStore = create<AuthState>(() => ({
  status: "carregando",
  sessao: null,
}));

// Uma única subscrição global, viva durante toda a vida do app.
observarSessao((sessao) => {
  useAuthStore.setState({
    status: sessao ? "autenticado" : "deslogado",
    sessao,
  });
});

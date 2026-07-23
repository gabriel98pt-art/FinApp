import { create } from "zustand";

interface ToastState {
  mensagem: string;
  visivel: boolean;
  mostrarToast: (mensagem: string) => void;
}

let timer: ReturnType<typeof setTimeout> | undefined;

/** Toast de feedback (seção 7) — uma mensagem de cada vez, some sozinho. */
export const useToastStore = create<ToastState>((set) => ({
  mensagem: "",
  visivel: false,
  mostrarToast: (mensagem) => {
    clearTimeout(timer);
    set({ mensagem, visivel: true });
    timer = setTimeout(() => set({ visivel: false }), 2400);
  },
}));

export const mostrarToast = (mensagem: string) => useToastStore.getState().mostrarToast(mensagem);

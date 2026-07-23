import { useEffect } from "react";
import { iniciarSyncConta } from "../services/syncService";
import { useAuthStore } from "../stores/authStore";

/** Mantém as stores de dados sincronizadas com a conta logada. */
export function useSyncConta() {
  const uid = useAuthStore((s) => s.sessao?.uid);

  useEffect(() => {
    if (!uid) return;
    return iniciarSyncConta(uid);
  }, [uid]);
}

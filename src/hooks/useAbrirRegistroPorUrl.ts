import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useUiStore, type TipoRegistro } from "../stores/uiStore";

const TIPOS_VALIDOS: TipoRegistro[] = ["despesa", "receita", "carga", "despesaVeiculo"];

/** Abre o registro rápido sozinho quando a URL chega com `?registro=despesa`
 *  (ou receita/carga/despesaVeiculo) — é o gatilho do Toque Traseiro do
 *  iOS: um Atalho com a ação "Abrir URLs" apontando pra
 *  `https://<domínio>/?registro=despesa`, sem precisar de app nativo nem de
 *  App Intent. Remove o parâmetro da URL logo depois de ler, pra um F5 não
 *  reabrir o registro sozinho. */
export function useAbrirRegistroPorUrl() {
  const [searchParams, setSearchParams] = useSearchParams();
  const abrirRegistro = useUiStore((s) => s.abrirRegistro);

  useEffect(() => {
    const tipo = searchParams.get("registro");
    if (!tipo) return;
    if (TIPOS_VALIDOS.includes(tipo as TipoRegistro)) {
      abrirRegistro(tipo as TipoRegistro);
    }
    setSearchParams(
      (atuais) => {
        const novos = new URLSearchParams(atuais);
        novos.delete("registro");
        return novos;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams, abrirRegistro]);
}

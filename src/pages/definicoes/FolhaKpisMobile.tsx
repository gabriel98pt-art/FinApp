import BottomSheet from "../../components/BottomSheet";
import { KPIS_POR_PAGINA } from "../../constants/kpis";
import { atualizarConfig } from "../../services/cfgService";
import { mostrarToast } from "../../stores/toastStore";
import type { ConfigConta } from "../../types";
import styles from "../Definicoes.module.css";

/** Escolha dos 2 KPIs que a página mostra no mobile (item 8). No desktop
 *  continuam todos visíveis; TVDE fica de fora, sempre com os 4.
 *
 *  Extraído de Definicoes.tsx sem mudar comportamento — mesma regra dos 2
 *  KPIs (o mais antigo sai quando um terceiro entra), só o wrapper passa de
 *  `<div className={grupo}>` pra esta BottomSheet. */
export default function FolhaKpisMobile({
  cfg,
  uid,
  aberta,
  aoFechar,
}: {
  cfg: ConfigConta;
  uid: string;
  aberta: boolean;
  aoFechar: () => void;
}) {
  async function alternar(paginaId: string, rotulo: string, atuais: string[]) {
    let novos: string[];
    if (atuais.includes(rotulo)) {
      // Não deixa ficar com menos de 2 — desmarcar o 3º é o que troca.
      if (atuais.length <= 2) return mostrarToast("São sempre 2 KPIs — escolha outro para trocar.");
      novos = atuais.filter((r) => r !== rotulo);
    } else {
      // Já tem 2: o mais antigo sai e o novo entra.
      novos = [...atuais, rotulo].slice(-2);
    }
    try {
      await atualizarConfig(uid, {
        kpisMobile: { ...cfg.kpisMobile, [paginaId]: [novos[0], novos[1]] },
      });
    } catch {
      mostrarToast("Não foi possível salvar.");
    }
  }

  return (
    <BottomSheet aberta={aberta} aoFechar={aoFechar} titulo="KPIs no telemóvel">
      <p className={styles.nota}>
        Cada página mostra 2 cartões no telemóvel — escolha quais. No computador continuam
        aparecendo todos.
      </p>
      {KPIS_POR_PAGINA.map((pag) => {
        const atuais = cfg.kpisMobile?.[pag.id] ?? pag.rotulos.slice(0, 2);
        return (
          <div key={pag.id} className={styles.grupoKpis}>
            <p className={styles.nomePagina}>{pag.titulo}</p>
            <div className={styles.chipsKpis}>
              {pag.rotulos.map((r) => {
                const ativo = atuais.includes(r);
                return (
                  <button
                    key={r}
                    className={`${styles.chipKpi} ${ativo ? styles.chipKpiAtivo : ""}`}
                    aria-pressed={ativo}
                    onClick={() => void alternar(pag.id, r, [...atuais])}
                  >
                    {/* O chip mostra o mesmo texto do cartão na página; `r` é
                        a chave guardada, que às vezes já não é esse texto. */}
                    {pag.textos?.[r] ?? r}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </BottomSheet>
  );
}

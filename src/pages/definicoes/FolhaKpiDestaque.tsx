import BottomSheet from "../../components/BottomSheet";
import { KPIS_POR_PAGINA } from "../../constants/kpis";
import { atualizarConfig } from "../../services/cfgService";
import { mostrarToast } from "../../stores/toastStore";
import type { ConfigConta } from "../../types";
import { chaveEmDestaque } from "../../utils/kpis";
import styles from "../Definicoes.module.css";

/** Escolha do número em destaque de cada página: o KPI que o quadro de resumo
 *  mostra grande, com os outros em colunas pequenas por baixo. Uma escolha por
 *  página; a de quem nunca escolheu é o primeiro da escolha antiga de "2 KPIs
 *  no telemóvel" (`kpisMobile`, que continua guardada) ou o primeiro da página.
 *
 *  Substitui a antiga folha "KPIs no telemóvel": agora todos os KPIs aparecem
 *  em qualquer largura, e o que se escolhe é qual deles manda. */
export default function FolhaKpiDestaque({
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
  async function escolher(paginaId: string, chave: string) {
    try {
      await atualizarConfig(uid, { kpiDestaque: { ...cfg.kpiDestaque, [paginaId]: chave } });
    } catch {
      mostrarToast("Não foi possível salvar.");
    }
  }

  return (
    <BottomSheet aberta={aberta} aoFechar={aoFechar} titulo="Número em destaque">
      <p className={styles.nota}>
        Cada página mostra todos os seus números num quadro só — escolha qual deles aparece grande.
      </p>
      {KPIS_POR_PAGINA.map((pag) => {
        const atual = chaveEmDestaque(pag.id, pag.rotulos, cfg);
        return (
          <div key={pag.id} className={styles.grupoKpis}>
            <p className={styles.nomePagina}>{pag.titulo}</p>
            <div className={styles.chipsKpis} role="radiogroup" aria-label={pag.titulo}>
              {pag.rotulos.map((r) => {
                const ativo = atual === r;
                return (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={ativo}
                    className={`${styles.chipKpi} ${ativo ? styles.chipKpiAtivo : ""}`}
                    onClick={() => void escolher(pag.id, r)}
                  >
                    {/* O chip mostra o mesmo texto do KPI na página; `r` é a
                        chave guardada, que às vezes já não é esse texto. */}
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

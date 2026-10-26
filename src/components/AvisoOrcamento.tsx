import { ChevronRight, TriangleAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { useCfgStore } from "../stores/cfgStore";
import { useDespesasStore } from "../stores/lancamentosStore";
import { useMesVisivelStore } from "../stores/mesVisivelStore";
import { useParcelasStore } from "../stores/parcelasStore";
import { hojeIso, mesAtual } from "../utils/calculos";
import { LIMIAR_PERTO_ORCAMENTO, statusOrcamentoMes } from "../utils/orcamento";
import styles from "./AvisoOrcamento.module.css";

/** Linha discreta, sem cartão, que resume o orçamento por categoria direto no
 *  Início — some quando nada está perto do teto, pra não ocupar espaço à toa.
 *  O detalhe completo, categoria a categoria, é a aba Planejamento; aqui é só
 *  "olha, vale a pena ir ver". Sempre amarela, perto ou acima do teto: o
 *  vermelho já tem dono no quadro de cima (despesas) e o laranja é do TVDE. */
export default function AvisoOrcamento() {
  const cfg = useCfgStore((s) => s.cfg);
  const despesas = useDespesasStore((s) => s.itens);
  const parcelas = useParcelasStore((s) => s.itens);
  const mes = useMesVisivelStore((s) => s.mes);

  const status = statusOrcamentoMes(despesas, parcelas, cfg.orcamentos, mes, mesAtual(), hojeIso());
  const estouradas = status.filter((s) => s.estourado);
  const pertos = status.filter((s) => !s.estourado && s.pct >= LIMIAR_PERTO_ORCAMENTO);
  const total = estouradas.length + pertos.length;
  if (total === 0) return null;

  const plural = total > 1;
  let texto: string;
  if (estouradas.length > 0 && pertos.length === 0) {
    texto = `${total} ${plural ? "categorias acima" : "categoria acima"} do limite`;
  } else if (estouradas.length === 0) {
    texto = `${total} ${plural ? "categorias perto" : "categoria perto"} do limite`;
  } else {
    texto = `${total} ${plural ? "categorias perto ou acima" : "categoria perto ou acima"} do limite`;
  }
  const nomes = [...estouradas, ...pertos].map((s) => s.categoria).join(", ");

  return (
    <Link to="/planejamento" className={styles.linha}>
      <TriangleAlert size={16} strokeWidth={2} aria-hidden />
      <span className={styles.texto}>
        <strong>{texto}</strong> · {nomes}
      </span>
      <ChevronRight className={styles.chevron} size={15} strokeWidth={2} aria-hidden />
    </Link>
  );
}

import { ChevronRight, PiggyBank } from "lucide-react";
import { Link } from "react-router-dom";
import { useCfgStore } from "../stores/cfgStore";
import { useDespesasStore } from "../stores/lancamentosStore";
import { useMesVisivelStore } from "../stores/mesVisivelStore";
import { useParcelasStore } from "../stores/parcelasStore";
import { hojeIso, mesAtual } from "../utils/calculos";
import { LIMIAR_PERTO_ORCAMENTO, statusOrcamentoMes } from "../utils/orcamento";
import styles from "./AvisoOrcamento.module.css";

/** Tira compacta (mesma linguagem da faixa de sincronização) que resume o
 *  orçamento por categoria direto no Início — some quando nada está perto do
 *  teto, pra não ocupar espaço à toa. O detalhe completo, categoria a
 *  categoria, é a aba Planejamento; aqui é só "olha, vale a pena ir ver". */
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
    texto = `${estouradas.length} ${
      plural ? "categorias estouraram" : "categoria estourou"
    } o orçamento este mês`;
  } else if (estouradas.length === 0) {
    texto = `${pertos.length} ${plural ? "categorias estão" : "categoria está"} perto do teto este mês`;
  } else {
    texto = `${total} ${plural ? "categorias estão" : "categoria está"} perto ou acima do teto este mês`;
  }

  return (
    <Link
      to="/planejamento"
      className={`${styles.tira} ${estouradas.length > 0 ? styles.estourado : styles.perto}`}
    >
      <PiggyBank size={15} aria-hidden />
      <span className={styles.texto}>{texto}</span>
      <ChevronRight size={16} aria-hidden />
    </Link>
  );
}

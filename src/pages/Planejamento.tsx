import Pagina from "../components/Pagina";
import OrcamentoCard from "../components/OrcamentoCard";
import { mesAtual } from "../utils/calculos";

/** Aba Planejamento (item 20). Por agora é só a nova casa do "Orçamento por
 *  categoria", que saiu do Início — o resto do planejamento será detalhado
 *  depois. */
export default function Planejamento() {
  return (
    <Pagina titulo="Planejamento" mesFixo={mesAtual()}>
      <OrcamentoCard />
    </Pagina>
  );
}

import Pagina from "../components/Pagina";
import OrcamentoCard from "../components/OrcamentoCard";

/** Aba Planejamento (item 20). O teto por categoria define-se e edita-se
 *  direto no OrcamentoCard agora — não vive mais em Definições. O resto do
 *  planejamento será detalhado depois. */
export default function Planejamento() {
  return (
    <Pagina titulo="Planejamento">
      <OrcamentoCard />
    </Pagina>
  );
}

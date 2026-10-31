import SeletorOrdemFolha from "./SeletorOrdemFolha";
import { ORDENS, ROTULOS_ORDEM, type LinhaOrdem, type Ordem } from "../utils/ordem";

const LINHAS: LinhaOrdem<Ordem>[] = ORDENS.map((o) => ({
  tipo: "simples",
  valor: o,
  rotulo: ROTULOS_ORDEM[o],
}));

/** Ordenação das listas de lançamentos (item 14): a ordem atual escrita à
 *  direita, com um chevron; tocar abre as quatro opções (a mesma folha da tela
 *  Parcelas). Não persiste: sair da tela volta ao padrão ("Mais recentes"). */
export default function SeletorOrdem({
  valor,
  aoMudar,
}: {
  valor: Ordem;
  aoMudar: (o: Ordem) => void;
}) {
  return <SeletorOrdemFolha valor={valor} linhas={LINHAS} aoMudar={aoMudar} />;
}

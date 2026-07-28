import CategoriaBolha from "./CategoriaBolha";
import Seletor from "./Seletor";

/** Seletor de categoria: o `Seletor` genérico com o círculo colorido + ícone
 *  na frente de cada nome.
 *
 *  Serve pra qualquer lista de nomes (categorias de despesa fixa/corrente/
 *  veículo e fontes de receita) — a aparência vem de `cfg` pelo nome. */
export default function SeletorCategoria({
  rotulo = "Categoria",
  valor,
  opcoes,
  aoMudar,
  rotuloVazio,
  nivel = 1,
}: {
  rotulo?: string;
  valor: string;
  opcoes: string[];
  aoMudar: (valor: string) => void;
  /** Quando definido, a lista ganha uma opção que limpa a escolha (valor ""). */
  rotuloVazio?: string;
  /** A folha do seletor quase sempre abre de dentro de outra folha. */
  nivel?: number;
}) {
  return (
    <Seletor
      rotulo={rotulo}
      valor={valor}
      opcoes={opcoes}
      aoMudar={aoMudar}
      rotuloVazio={rotuloVazio}
      nivel={nivel}
      renderIcone={(c, tamanho) => <CategoriaBolha categoria={c} tamanho={tamanho} />}
      aviso="Nenhuma categoria ainda — crie em Definições."
    />
  );
}

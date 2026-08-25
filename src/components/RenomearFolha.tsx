import { useState, type FormEvent } from "react";
import BottomSheet from "./BottomSheet";
import styles from "./RenomearFolha.module.css";
import Botao from "./Botao";

/** Folha de renomear, partilhada por cartões, categorias, fontes e locais.
 *  Só recolhe o nome novo — quem sabe o que renomear (e a cascata que isso
 *  implica) é quem a abre. O campo arranca com o nome atual já escrito. */
export default function RenomearFolha({
  aberta,
  nomeAtual,
  titulo = "Renomear",
  aviso,
  nivel = 1,
  aoFechar,
  aoConfirmar,
}: {
  aberta: boolean;
  /** `null` quando fechada — também serve de chave pra recomeçar o campo. */
  nomeAtual: string | null;
  titulo?: string;
  /** Linha explicando o alcance da mudança nesta tela. */
  aviso?: string;
  /** Quase sempre 1: abre-se de dentro de uma lista, que está numa folha ou
   *  numa página. Só sobe quando essa própria lista já é uma folha aninhada
   *  (Definições › Veículo › Categorias), senão as duas ficam no mesmo nível
   *  e a de baixo não recua. */
  nivel?: number;
  aoFechar: () => void;
  aoConfirmar: (nome: string) => void;
}) {
  const [nome, setNome] = useState(nomeAtual ?? "");
  // Reinicia o campo sempre que a folha passa a apontar pra outro item.
  const [alvo, setAlvo] = useState(nomeAtual);
  if (alvo !== nomeAtual) {
    setAlvo(nomeAtual);
    setNome(nomeAtual ?? "");
  }

  function submeter(e: FormEvent) {
    e.preventDefault();
    aoConfirmar(nome);
  }

  return (
    <BottomSheet
      aberta={aberta}
      aoFechar={aoFechar}
      titulo={nomeAtual ? `${titulo} "${nomeAtual}"` : titulo}
      nivel={nivel}
    >
      <form className={styles.form} onSubmit={submeter}>
        <label className={styles.campo}>
          Nome novo
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            aria-label="Nome novo"
            maxLength={60}
            required
          />
        </label>
        <p className={styles.aviso}>
          {aviso ?? "Os lançamentos que já usam este nome passam a usar o novo."}
        </p>
        <Botao type="submit" variante="submeter">
          Renomear
        </Botao>
      </form>
    </BottomSheet>
  );
}

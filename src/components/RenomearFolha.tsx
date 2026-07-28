import { useState, type FormEvent } from "react";
import BottomSheet from "./BottomSheet";
import styles from "./RenomearFolha.module.css";

/** Folha de renomear, partilhada por cartões, categorias, fontes e locais.
 *  Só recolhe o nome novo — quem sabe o que renomear (e a cascata que isso
 *  implica) é quem a abre. O campo arranca com o nome atual já escrito. */
export default function RenomearFolha({
  aberta,
  nomeAtual,
  titulo = "Renomear",
  aviso,
  aoFechar,
  aoConfirmar,
}: {
  aberta: boolean;
  /** `null` quando fechada — também serve de chave pra recomeçar o campo. */
  nomeAtual: string | null;
  titulo?: string;
  /** Linha explicando o alcance da mudança nesta tela. */
  aviso?: string;
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
      nivel={1}
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
        <button type="submit" className={styles.salvar}>
          Renomear
        </button>
      </form>
    </BottomSheet>
  );
}

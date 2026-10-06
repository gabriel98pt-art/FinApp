import { Check } from "lucide-react";
import Seletor from "../../components/Seletor";
import { nomeAtualDoMetodo } from "../../utils/instituicoes";
import type { ConfigConta } from "../../types";
import styles from "../Importar.module.css";

/** Ações em massa sobre todas as linhas: aceitar auto-classificadas, marcar
 *  tudo para importar/pular e escolher a mesma conta para o extrato inteiro.
 *
 *  Hierarquia: "Aceitar auto-classificadas" é a ação que se usa quase sempre,
 *  por isso leva o tom de acento; marcar/pular tudo são o par de recurso, num
 *  grupo só; a conta em massa fica no fim, como os seletores das linhas. */
export default function ImportacaoToolbar({
  cfg,
  contaEmMassa,
  onAceitarAutoClassificadas,
  onMarcarTodas,
  onMarcarContaParaTodas,
}: {
  cfg: ConfigConta;
  contaEmMassa: string;
  onAceitarAutoClassificadas: () => void;
  onMarcarTodas: (acao: "import" | "skip") => void;
  onMarcarContaParaTodas: (conta: string) => void;
}) {
  return (
    <div className={styles.acoesLote} role="group" aria-label="Ações em todas as linhas">
      <button
        className={`${styles.botao} ${styles.botaoAcento}`}
        onClick={onAceitarAutoClassificadas}
      >
        <Check size={15} strokeWidth={2.5} aria-hidden /> Aceitar auto-classificadas
      </button>
      <div className={styles.acoesPar}>
        <button className={styles.botao} onClick={() => onMarcarTodas("import")}>
          Marcar tudo p/ importar
        </button>
        <button className={styles.botao} onClick={() => onMarcarTodas("skip")}>
          Marcar tudo p/ pular
        </button>
      </div>
      <Seletor
        variante="inline"
        rotulo="Conta de todas as linhas"
        nivel={0}
        valor={contaEmMassa}
        opcoes={cfg.contasCartoes}
        rotuloOpcao={(c) => nomeAtualDoMetodo(cfg, c)}
        rotuloVazio="Conta de todas…"
        aviso="Nenhuma conta guardada — as contas vêm de Definições."
        aoMudar={onMarcarContaParaTodas}
      />
    </div>
  );
}

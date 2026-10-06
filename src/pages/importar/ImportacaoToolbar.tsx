import Seletor from "../../components/Seletor";
import { nomeAtualDoMetodo } from "../../utils/instituicoes";
import type { ConfigConta } from "../../types";
import styles from "../Importar.module.css";

/** Ações em massa sobre todas as linhas: aceitar auto-classificadas, marcar
 *  tudo para importar/pular e escolher a mesma conta para o extrato inteiro. */
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
    <div className={styles.acoesLote}>
      <button className={styles.botao} onClick={onAceitarAutoClassificadas}>
        ✓ Aceitar auto-classificadas
      </button>
      <button className={styles.botao} onClick={() => onMarcarTodas("import")}>
        Marcar tudo p/ importar
      </button>
      <button className={styles.botao} onClick={() => onMarcarTodas("skip")}>
        Marcar tudo p/ pular
      </button>
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

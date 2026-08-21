import { useState } from "react";
import { Palette } from "lucide-react";
import BottomSheet from "../../components/BottomSheet";
import SeletorCor from "../../components/SeletorCor";
import { definirCorCategoria } from "../../services/cfgService";
import { mostrarToast } from "../../stores/toastStore";
import type { ConfigConta } from "../../types";
import { corDaCategoriaVisual } from "../../utils/categoriaVisual";
import styles from "../Definicoes.module.css";

/** Cor do botão flutuante em Despesas, Receitas e Veículo. Não é um campo
 *  novo em cfg: estes 3 nomes entram no mesmo `categoriaCor` das categorias,
 *  então o picker e o serviço são exatamente os que já existiam.
 *
 *  Extraído de Definicoes.tsx sem mudar comportamento — só o wrapper, que
 *  passa de `<div className={grupo}>` pra esta BottomSheet. SeletorCor ganha
 *  nivel={1} pelo mesmo motivo das outras folhas extraídas. */
const PAGINAS_COLORIDAS = ["Despesa", "Receita", "Veículo"] as const;

export default function FolhaCorBotao({
  cfg,
  uid,
  aberta,
  aoFechar,
}: {
  cfg: ConfigConta;
  uid: string;
  aberta: boolean;
  aoFechar: () => void;
}) {
  const [corDe, setCorDe] = useState<string | null>(null);

  async function escolher(cor: string | null) {
    if (!corDe) return;
    const alvo = corDe;
    setCorDe(null);
    try {
      await definirCorCategoria(uid, alvo, cor);
    } catch {
      mostrarToast("Não foi possível salvar a cor.");
    }
  }

  return (
    <BottomSheet aberta={aberta} aoFechar={aoFechar} titulo="Cor do botão flutuante">
      <p className={styles.nota}>
        O botão de registro rápido veste esta cor quando você está na página. Nas outras fica no
        azul do app.
      </p>
      <ul className={styles.listaCategorias}>
        {PAGINAS_COLORIDAS.map((nome) => (
          <li key={nome} className={styles.linhaCategoria}>
            <span
              className={styles.amostraCor}
              style={{ background: corDaCategoriaVisual(cfg, nome) }}
              aria-hidden
            />
            <span className={styles.nomeCategoria}>{nome}</span>
            <button
              className={styles.acaoCategoria}
              onClick={() => setCorDe(nome)}
              aria-label={`Cor do botão em ${nome}`}
              title="Cor"
            >
              <Palette size={16} aria-hidden />
            </button>
          </li>
        ))}
      </ul>

      <SeletorCor
        aberta={corDe !== null}
        aoFechar={() => setCorDe(null)}
        titulo={corDe ? `Cor do botão em ${corDe}` : "Cor"}
        valor={corDe ? (cfg.categoriaCor?.[corDe] ?? "") : ""}
        aoEscolher={(c) => void escolher(c)}
        nivel={1}
      />
    </BottomSheet>
  );
}

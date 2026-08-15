import { useState, type FormEvent } from "react";
import { Sparkles } from "lucide-react";
import {
  useDespesasFixasStore,
  useDespesasStore,
  useReceitasStore,
  useTransferenciasStore,
} from "../stores/lancamentosStore";
import { useEventosStore } from "../stores/eventosStore";
import { useFundosStore } from "../stores/fundosStore";
import { useParcelasStore } from "../stores/parcelasStore";
import { useVeiculoStore } from "../stores/veiculoStore";
import { useCfgStore } from "../stores/cfgStore";
import { despesasNosTotais, hojeIso, mesAtual, receitasNosTotais } from "../utils/calculos";
import { responderPergunta } from "../utils/copiloto";
import styles from "./CopilotoCard.module.css";

const SUGESTOES = ["resumo do mês", "estou dentro do orçamento?", "qual meu saldo?"];

/** Copiloto (seção 3.9): pergunta em linguagem natural, resposta 100% local
 *  e determinística — zero chamada a IA externa. */
export default function CopilotoCard() {
  const receitas = receitasNosTotais(useReceitasStore((s) => s.itens));
  const despesas = despesasNosTotais(useDespesasStore((s) => s.itens));
  const parcelas = useParcelasStore((s) => s.itens);
  const veiculo = useVeiculoStore((s) => s.dados);
  const despesasFixas = useDespesasFixasStore((s) => s.itens);
  const transferencias = useTransferenciasStore((s) => s.itens);
  const eventos = useEventosStore((s) => s.itens);
  const fundos = useFundosStore((s) => s.itens);
  const cfg = useCfgStore((s) => s.cfg);

  const [pergunta, setPergunta] = useState("");
  const [resposta, setResposta] = useState<string | null>(null);

  function perguntar(q: string) {
    if (!q.trim()) return;
    const diaDeHoje = parseInt(hojeIso().slice(8, 10), 10);
    const r = responderPergunta(q, {
      receitas,
      despesas,
      parcelas,
      veiculo,
      despesasFixas,
      transferencias,
      eventos,
      fundos,
      cfg,
      mesReal: mesAtual(),
      diaDeHoje,
    });
    setResposta(r);
  }

  function aoSubmeter(e: FormEvent) {
    e.preventDefault();
    perguntar(pergunta);
  }

  return (
    <div className={styles.card}>
      <div className={styles.cabecalho}>
        <Sparkles size={16} aria-hidden />
        <h3 className={styles.titulo}>Copiloto</h3>
      </div>
      <p className={styles.sub}>Pergunte sobre seus dados — sem IA externa, tudo calculado aqui.</p>

      <form className={styles.form} onSubmit={aoSubmeter}>
        <input
          className={styles.input}
          value={pergunta}
          onChange={(e) => setPergunta(e.target.value)}
          placeholder="Ex.: quanto gastei em mercado?"
        />
        <button type="submit" className={styles.botao}>
          Perguntar
        </button>
      </form>

      {resposta !== null && (
        // Ver escaparHtml em utils/copiloto.ts: único tag permitido é <b>,
        // todo texto interpolado é escapado antes — não há HTML de usuário
        // sendo injetado aqui.
        <p className={styles.resposta} dangerouslySetInnerHTML={{ __html: resposta }} />
      )}

      <div className={styles.sugestoes}>
        {SUGESTOES.map((s) => (
          <button
            key={s}
            className={styles.sugestao}
            onClick={() => {
              setPergunta(s);
              perguntar(s);
            }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

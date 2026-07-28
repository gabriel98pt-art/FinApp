import { useState } from "react";
import { ChevronRight, PieChart } from "lucide-react";
import { EstadoVazio } from "./Pagina";
import BottomSheet from "./BottomSheet";
import CategoriaBolha from "./CategoriaBolha";
import { useCfgStore } from "../stores/cfgStore";
import { useDespesasFixasStore, useDespesasStore } from "../stores/lancamentosStore";
import { useMesVisivelStore } from "../stores/mesVisivelStore";
import { useParcelasStore } from "../stores/parcelasStore";
import { useVeiculoStore } from "../stores/veiculoStore";
import { mesAtual, rotuloMes } from "../utils/calculos";
import { coresDasCategorias } from "../utils/coresCategoria";
import { despesaPorCategoriaMes, paradasDonut } from "../utils/despesaPorCategoria";
import { formatMoney } from "../utils/money";
import styles from "./DonutCategoriaCard.module.css";

type OrdemFatias = "maiorValor" | "menorValor" | "nome";

const ROTULOS_ORDEM: Record<OrdemFatias, string> = {
  maiorValor: "Maior valor",
  menorValor: "Menor valor",
  nome: "Nome",
};

/** Donut de despesas por categoria do mês (seção 7 / dashboard do app de
 *  referência). Sem lib de gráfico: `conic-gradient` num círculo + um círculo
 *  da cor do card por cima faz o buraco do meio (equivale ao cutout 65%).
 *
 *  O card abre uma folha com o gráfico maior, a lista completa e ordenação
 *  (item 21). */
export default function DonutCategoriaCard() {
  const cfg = useCfgStore((s) => s.cfg);
  const despesas = useDespesasStore((s) => s.itens);
  const despesasFixas = useDespesasFixasStore((s) => s.itens);
  const parcelas = useParcelasStore((s) => s.itens);
  const veiculo = useVeiculoStore((s) => s.dados);
  const [aberta, setAberta] = useState(false);
  const [ordem, setOrdem] = useState<OrdemFatias>("maiorValor");

  // Segue o seletor do header, como os KPIs ao lado — senão o donut ficaria
  // preso no mês de hoje enquanto o resto do Início mostra outro mês.
  // `mesReal` continua no mês de hoje: é ele que decide se uma fixa/parcela
  // do mês corrente só conta depois de marcada como paga.
  const mes = useMesVisivelStore((s) => s.mes);
  const fatias = despesaPorCategoriaMes(
    despesas,
    despesasFixas,
    parcelas,
    veiculo,
    mes,
    mesAtual(),
  );
  const cores = coresDasCategorias(fatias.map((f) => f.categoria));
  // Breakdown por categoria é sensível (seção 4.6) — borra em modo discreto
  const classeDiscreta = cfg.modoDiscreto ? "discreto" : "";

  if (fatias.length === 0) {
    return (
      <div className={styles.card}>
        <p className={styles.titulo}>Despesas por categoria</p>
        <EstadoVazio
          Icone={PieChart}
          mensagem={`Nenhuma despesa em ${rotuloMes(mes)}`}
          sub="As categorias aparecem aqui assim que houver gastos no mês."
        />
      </div>
    );
  }

  const paradas = paradasDonut(fatias, cores);
  const descricaoDonut = `Despesas de ${rotuloMes(mes)} por categoria: ${fatias
    .map((f) => `${f.categoria} ${f.pct}%`)
    .join(", ")}`;

  // A cor vem da posição na lista original — ordenar a lista não pode
  // trocar a cor de ninguém, senão a legenda deixa de bater com o donut.
  const comCor = fatias.map((f, i) => ({ ...f, cor: cores[i] }));
  const ordenadas = [...comCor].sort((a, b) => {
    if (ordem === "nome") return a.categoria.localeCompare(b.categoria, "pt");
    if (ordem === "menorValor") return a.valor - b.valor;
    return b.valor - a.valor;
  });

  return (
    <>
      <button className={`${styles.card} ${styles.cardBotao}`} onClick={() => setAberta(true)}>
        <span className={styles.linhaTitulo}>
          <span className={styles.titulo}>Despesas por categoria</span>
          <ChevronRight className={styles.chevron} size={18} aria-hidden />
        </span>

        <span className={styles.corpo}>
          <span
            className={styles.donut}
            style={{ background: `conic-gradient(${paradas.join(", ")})` }}
            role="img"
            aria-label={descricaoDonut}
          >
            <span className={styles.buraco} />
          </span>

          <span className={styles.legenda}>
            {comCor.map((f) => (
              <span key={f.categoria} className={styles.item}>
                <span className={styles.bolinha} style={{ background: f.cor }} />
                <span className={styles.categoria}>{f.categoria}</span>
                <span className={styles.pct}>{f.pct}%</span>
                <span className={`${styles.valor} ${classeDiscreta}`}>
                  {formatMoney(f.valor, cfg.currency)}
                </span>
              </span>
            ))}
          </span>
        </span>
      </button>

      <BottomSheet
        aberta={aberta}
        aoFechar={() => setAberta(false)}
        titulo="Despesas por categoria"
      >
        <div
          className={styles.donutGrande}
          style={{ background: `conic-gradient(${paradas.join(", ")})` }}
          role="img"
          aria-label={descricaoDonut}
        >
          <span className={styles.buracoGrande} />
        </div>

        <div className={styles.fileiraOrdem} role="radiogroup" aria-label="Ordenar por">
          {(["maiorValor", "menorValor", "nome"] as OrdemFatias[]).map((o) => (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={ordem === o}
              className={`${styles.opcaoOrdem} ${ordem === o ? styles.opcaoOrdemAtiva : ""}`}
              onClick={() => setOrdem(o)}
            >
              {ROTULOS_ORDEM[o]}
            </button>
          ))}
        </div>

        <ul className={styles.listaCompleta}>
          {ordenadas.map((f) => (
            <li key={f.categoria} className={styles.linhaCompleta}>
              <CategoriaBolha categoria={f.categoria} tamanho={28} />
              <span className={styles.categoriaCompleta}>{f.categoria}</span>
              <span className={styles.pct}>{f.pct}%</span>
              <span className={`${styles.valor} ${classeDiscreta}`}>
                {formatMoney(f.valor, cfg.currency)}
              </span>
            </li>
          ))}
        </ul>
      </BottomSheet>
    </>
  );
}

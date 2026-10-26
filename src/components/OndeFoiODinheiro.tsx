import { useState } from "react";
import { ChevronRight } from "lucide-react";
import FolhaCategorias from "./FolhaCategorias";
import { useCfgStore } from "../stores/cfgStore";
import { useDespesasFixasStore, useDespesasStore } from "../stores/lancamentosStore";
import { useMesVisivelStore } from "../stores/mesVisivelStore";
import { useVeiculoStore } from "../stores/veiculoStore";
import { hojeIso, mesAtual } from "../utils/calculos";
import { despesaPorCategoriaRegistradaMes } from "../utils/despesaPorCategoria";
import { formatMoney } from "../utils/money";
import styles from "./InicioSecoes.module.css";

const QUANTAS = 4;

/** As maiores categorias de despesa do mês — no lugar da pizza. A fonte é a
 *  mesma do DonutCategoriaCard (fluxo de caixa, pela data real de cada
 *  lançamento); "Ver todas" abre a folha com a lista completa que a pizza
 *  abria. A barra de cada linha é proporcional à MAIOR categoria, não ao
 *  total: é isso que as faz comparáveis entre si. */
export default function OndeFoiODinheiro() {
  const moeda = useCfgStore((s) => s.cfg.currency);
  // Breakdown por categoria é sensível (seção 4.6) — borra em modo discreto.
  const discreto = useCfgStore((s) => s.cfg.modoDiscreto);
  const despesas = useDespesasStore((s) => s.itens);
  const despesasFixas = useDespesasFixasStore((s) => s.itens);
  const veiculo = useVeiculoStore((s) => s.dados);
  const mes = useMesVisivelStore((s) => s.mes);
  const [aberta, setAberta] = useState(false);

  const fatias = despesaPorCategoriaRegistradaMes(
    despesas,
    despesasFixas,
    veiculo,
    mes,
    mesAtual(),
    hojeIso(),
  );
  if (fatias.length === 0) return null;

  const maiores = [...fatias].sort((a, b) => b.valor - a.valor).slice(0, QUANTAS);
  const maior = maiores[0].valor;

  return (
    <section className={styles.secao} aria-labelledby="onde-foi">
      <div className={styles.cabecalho}>
        <h3 id="onde-foi" className={styles.titulo}>
          Onde foi o dinheiro
        </h3>
        <button type="button" className={styles.link} onClick={() => setAberta(true)}>
          Ver todas
          <ChevronRight size={15} strokeWidth={2} aria-hidden />
        </button>
      </div>
      {maiores.map((f) => (
        <div key={f.categoria} className={styles.categoria}>
          <div className={styles.categoriaLinha}>
            <span className={styles.categoriaNome}>{f.categoria}</span>
            <span className={styles.pct}>{f.pct}%</span>
            <span className={`${styles.categoriaValor} ${discreto ? "discreto" : ""}`}>
              {formatMoney(f.valor, moeda)}
            </span>
          </div>
          <div className={styles.trilho} aria-hidden>
            <i style={{ width: `${maior > 0 ? (f.valor / maior) * 100 : 0}%` }} />
          </div>
        </div>
      ))}
      <FolhaCategorias
        aberta={aberta}
        aoFechar={() => setAberta(false)}
        fatias={fatias}
        mes={mes}
      />
    </section>
  );
}

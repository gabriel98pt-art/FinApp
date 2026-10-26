import { useState } from "react";
import { useNavigate } from "react-router-dom";
import BottomSheet from "./BottomSheet";
import CategoriaBolha from "./CategoriaBolha";
import { useRadiogroupTeclado } from "../hooks/useRadiogroupTeclado";
import { useCfgStore } from "../stores/cfgStore";
import type { YearMonth } from "../types";
import { rotuloMes } from "../utils/calculos";
import { corDaCategoriaVisual } from "../utils/categoriaVisual";
import { paradasDonut, type FatiaCategoria } from "../utils/despesaPorCategoria";
import { formatMoney } from "../utils/money";
import styles from "./DonutCategoriaCard.module.css";

type OrdemFatias = "maiorValor" | "menorValor" | "nome";

const ROTULOS_ORDEM: Record<OrdemFatias, string> = {
  maiorValor: "Maior valor",
  menorValor: "Menor valor",
  nome: "Nome",
};

/** Folha com o gráfico maior, a lista completa das despesas do mês por
 *  categoria e a ordenação (item 21). Saiu do DonutCategoriaCard para a
 *  página Início poder abrir a mesma folha a partir de "Onde foi o dinheiro".
 *  Cada linha leva ao extrato já filtrado pela categoria. */
export default function FolhaCategorias({
  aberta,
  aoFechar,
  fatias,
  mes,
}: {
  aberta: boolean;
  aoFechar: () => void;
  fatias: FatiaCategoria[];
  mes: YearMonth;
}) {
  const cfg = useCfgStore((s) => s.cfg);
  const navegar = useNavigate();
  const { ref: radiogroupRef, onKeyDown: aoTeclarRadio } = useRadiogroupTeclado<HTMLDivElement>();
  const [ordem, setOrdem] = useState<OrdemFatias>("maiorValor");
  // Breakdown por categoria é sensível (seção 4.6) — borra em modo discreto
  const classeDiscreta = cfg.modoDiscreto ? "discreto" : "";

  /** Clicar numa fatia leva ao extrato já filtrado por ela — a categoria viaja
   *  no `state` da navegação, o mesmo padrão que Transações usa para abrir
   *  Despesas na aba certa.
   *
   *  "Veículo" é a exceção: aquela fatia é SINTÉTICA (soma cargas, despesas e
   *  fixas do veículo inteiro, ver `despesaPorCategoriaMes`) e não existe como
   *  categoria de nenhuma transação — as do veículo guardam a categoria delas
   *  ("Seguro", "Portagens"…). Filtrar o extrato por ela daria lista vazia,
   *  então o destino natural é a própria tela do Veículo. */
  function irParaCategoria(categoria: string) {
    aoFechar();
    if (categoria === "Veículo") {
      navegar("/veiculo");
      return;
    }
    navegar("/transacoes", { state: { categoria } });
  }

  // A cor sai do NOME da categoria, portanto ordenar a lista não mexe nela e
  // a legenda bate sempre com o donut.
  const comCor = fatias.map((f) => ({ ...f, cor: corDaCategoriaVisual(cfg, f.categoria) }));
  // Respiro fino entre fatias (achado da auditoria de Design & Cor): sem ele,
  // duas categorias de cor parecida se fundiam numa fatia só, ilegível.
  const paradas = paradasDonut(
    fatias,
    comCor.map((f) => f.cor),
    0.6,
  );
  const descricaoDonut = `Despesas de ${rotuloMes(mes)} por categoria: ${fatias
    .map((f) => `${f.categoria} ${f.pct}%`)
    .join(", ")}`;
  const ordenadas = [...comCor].sort((a, b) => {
    if (ordem === "nome") return a.categoria.localeCompare(b.categoria, "pt");
    if (ordem === "menorValor") return a.valor - b.valor;
    return b.valor - a.valor;
  });

  return (
    <BottomSheet aberta={aberta} aoFechar={aoFechar} titulo="Despesas por categoria">
      <div
        className={styles.donutGrande}
        style={{ background: `conic-gradient(${paradas.join(", ")})` }}
        role="img"
        aria-label={descricaoDonut}
      >
        <span className={styles.buracoGrande} />
      </div>

      <div
        className={styles.fileiraOrdem}
        role="radiogroup"
        aria-label="Ordenar por"
        ref={radiogroupRef}
        onKeyDown={aoTeclarRadio}
      >
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
          <li key={f.categoria}>
            <button
              type="button"
              className={styles.linhaCompleta}
              onClick={() => irParaCategoria(f.categoria)}
            >
              <CategoriaBolha categoria={f.categoria} tamanho={28} />
              <span className={styles.categoriaCompleta}>{f.categoria}</span>
              <span className={styles.pct}>{f.pct}%</span>
              <span className={`${styles.valor} ${classeDiscreta}`}>
                {formatMoney(f.valor, cfg.currency)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}

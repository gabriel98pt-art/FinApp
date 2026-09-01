import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, PieChart } from "lucide-react";
import { EstadoVazio } from "./Pagina";
import BottomSheet from "./BottomSheet";
import CategoriaBolha from "./CategoriaBolha";
import { useCfgStore } from "../stores/cfgStore";
import { useDespesasFixasStore, useDespesasStore } from "../stores/lancamentosStore";
import { useMesVisivelStore } from "../stores/mesVisivelStore";
import { useRadiogroupTeclado } from "../hooks/useRadiogroupTeclado";
import { useVeiculoStore } from "../stores/veiculoStore";
import { hojeIso, mesAtual, rotuloMes } from "../utils/calculos";
import { corDaCategoriaVisual } from "../utils/categoriaVisual";
import { despesaPorCategoriaRegistradaMes, paradasDonut } from "../utils/despesaPorCategoria";
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
 *  O título e o donut abrem uma folha com o gráfico maior, a lista completa e
 *  ordenação (item 21); cada linha da legenda é um atalho próprio para as
 *  transações daquela categoria. */
export default function DonutCategoriaCard() {
  const cfg = useCfgStore((s) => s.cfg);
  const navegar = useNavigate();
  const despesas = useDespesasStore((s) => s.itens);
  const despesasFixas = useDespesasFixasStore((s) => s.itens);
  const veiculo = useVeiculoStore((s) => s.dados);
  const [aberta, setAberta] = useState(false);
  const { ref: radiogroupRef, onKeyDown: aoTeclarRadio } = useRadiogroupTeclado<HTMLDivElement>();
  const [ordem, setOrdem] = useState<OrdemFatias>("maiorValor");

  // Segue o seletor do header, como os KPIs ao lado — senão o donut ficaria
  // preso no mês de hoje enquanto o resto do Início mostra outro mês.
  //
  // Fluxo de caixa (01/09/2026), mesma regra dos KPIs "Despesas"/"Receitas"
  // ao lado — pela data real de cada lançamento, não pelo mês de vencimento
  // do cronograma. `mesReal`/`hoje` sobrevivem só pro caso de fixa em débito
  // automático (nunca tem lançamento-espelho — o selo dela é só leitura,
  // ninguém clica em nada — então cai no dia de vencimento, com a mesma
  // precisão de dia do resto do app; achado do Gabriel, 02/09/2026, um
  // seguro pago sozinho no cartão sumia do donut).
  const mes = useMesVisivelStore((s) => s.mes);
  const fatias = despesaPorCategoriaRegistradaMes(
    despesas,
    despesasFixas,
    veiculo,
    mes,
    mesAtual(),
    hojeIso(),
  );
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
    setAberta(false);
    if (categoria === "Veículo") {
      navegar("/veiculo");
      return;
    }
    navegar("/transacoes", { state: { categoria } });
  }

  if (fatias.length === 0) {
    return (
      <div className={styles.card}>
        {/* Ver nota em ResumoAnual. Na variante cheia (abaixo) o mesmo título
            fica em <span>, e tem de ficar: ali envolve-o um <button>, que só
            aceita conteúdo de frase — um heading lá dentro é HTML inválido. */}
        <h3 className={styles.titulo}>Despesas por categoria</h3>
        <EstadoVazio
          Icone={PieChart}
          mensagem={`Nenhuma despesa em ${rotuloMes(mes)}`}
          sub="As categorias aparecem aqui assim que houver gastos no mês."
        />
      </div>
    );
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
    <>
      {/* O card já não é um botão só: cada linha da legenda leva ao extrato
          daquela categoria, e botão dentro de botão é HTML inválido. Quem abre
          a folha detalhada passou a ser o título e o donut, cada um o seu. */}
      <div className={styles.card}>
        <button
          type="button"
          className={`${styles.linhaTitulo} ${styles.abreFolha}`}
          onClick={() => setAberta(true)}
        >
          <span className={styles.titulo}>Despesas por categoria</span>
          <ChevronRight className={styles.chevron} size={18} aria-hidden />
        </button>

        <div className={styles.corpo}>
          <button
            type="button"
            className={styles.donutBotao}
            onClick={() => setAberta(true)}
            aria-label="Abrir detalhe das despesas por categoria"
          >
            <span
              className={styles.donut}
              style={{ background: `conic-gradient(${paradas.join(", ")})` }}
              role="img"
              aria-label={descricaoDonut}
            >
              <span className={styles.buraco} />
            </span>
          </button>

          <div className={styles.legenda}>
            {comCor.map((f) => (
              <button
                key={f.categoria}
                type="button"
                className={styles.item}
                onClick={() => irParaCategoria(f.categoria)}
              >
                <span className={styles.bolinha} style={{ background: f.cor }} />
                <span className={styles.categoria}>{f.categoria}</span>
                <span className={styles.pct}>{f.pct}%</span>
                <span className={`${styles.valor} ${classeDiscreta}`}>
                  {formatMoney(f.valor, cfg.currency)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

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
    </>
  );
}

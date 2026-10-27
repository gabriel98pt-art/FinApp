import { useMemo, useState } from "react";
import { ChartColumn } from "lucide-react";
import Pagina, { EstadoVazio } from "../components/Pagina";
import ChipVariacao from "../components/ChipVariacao";
import ErroSincronizacao from "../components/ErroSincronizacao";
import IconeLinha from "../components/IconeLinha";
import { AnelTaxa, BarrasSemana, GraficoLinhas, MiniBarras } from "../components/analise/Graficos";
import { useRadiogroupTeclado } from "../hooks/useRadiogroupTeclado";
import { useCfgStore } from "../stores/cfgStore";
import { useMesVisivelStore } from "../stores/mesVisivelStore";
import {
  useDespesasFixasStore,
  useDespesasStore,
  useReceitasStore,
  useTransferenciasStore,
} from "../stores/lancamentosStore";
import { useParcelasStore } from "../stores/parcelasStore";
import { useVeiculoStore } from "../stores/veiculoStore";
import {
  analisarMes,
  PERIODOS_ANALISE,
  type Comparacao,
  type PeriodoAnalise,
  type Variacao,
} from "../utils/analise";
import { hojeIso, mesAtual, MESES_CURTOS_PT, nomeDoMes } from "../utils/calculos";
import { nomeAtualDoMetodo } from "../utils/instituicoes";
import { formatMoneyInteiro, formatMoneySinal } from "../utils/money";
import segmentado from "../styles/segmentado.module.css";
import styles from "./Analise.module.css";

/** "−53%", com o menos de verdade (U+2212) como no resto do app. */
const rotuloPct = (n: number) => `${n < 0 ? "−" : ""}${Math.abs(n)}%`;

const diaCurto = (iso: string) =>
  `${Number(iso.slice(8, 10))} ${MESES_CURTOS_PT[Number(iso.slice(5, 7)) - 1]}`;

export default function Analise() {
  const cfg = useCfgStore((s) => s.cfg);
  const moeda = cfg.currency;
  const classeDiscreta = cfg.modoDiscreto ? "discreto" : "";
  const mes = useMesVisivelStore((s) => s.mes);
  const receitas = useReceitasStore((s) => s.itens);
  const despesasCorrentes = useDespesasStore((s) => s.itens);
  const despesasFixas = useDespesasFixasStore((s) => s.itens);
  const transferencias = useTransferenciasStore((s) => s.itens);
  const parcelas = useParcelasStore((s) => s.itens);
  const veiculo = useVeiculoStore((s) => s.dados);
  // Como em Despesas/Receitas, a vista (aqui o período) é estado local da página.
  const [periodo, setPeriodo] = useState<PeriodoAnalise>(6);
  const { ref: refRadio, onKeyDown: aoTeclarRadio } = useRadiogroupTeclado<HTMLDivElement>();

  // Um total incompleto lê-se como um total certo: a Início avisa quando um
  // domínio não sincronizou, e esta página soma os mesmos cinco.
  const erroDados = [
    useReceitasStore((s) => s.erro),
    useDespesasStore((s) => s.erro),
    useDespesasFixasStore((s) => s.erro),
    useParcelasStore((s) => s.erro),
    useVeiculoStore((s) => s.erro),
  ].some(Boolean);

  const a = useMemo(
    () =>
      analisarMes(
        { receitas, despesasCorrentes, despesasFixas, parcelas, transferencias, veiculo },
        { diaInicioSemana: cfg.diaInicioSemana },
        mes,
        mesAtual(),
        hojeIso(),
        periodo,
        (id) => nomeAtualDoMetodo(cfg, id),
      ),
    [
      receitas,
      despesasCorrentes,
      despesasFixas,
      parcelas,
      transferencias,
      veiculo,
      cfg,
      mes,
      periodo,
    ],
  );

  const nomeMes = nomeDoMes(mes).charAt(0).toUpperCase() + nomeDoMes(mes).slice(1);
  const dinheiro = (cents: number) => (
    <span className={classeDiscreta}>{formatMoneySinal(cents, moeda)}</span>
  );
  const dinheiroInteiro = (cents: number) => (
    <span className={classeDiscreta}>{formatMoneyInteiro(cents, moeda)}</span>
  );

  const seletor = (
    <div
      className={segmentado.abas}
      role="radiogroup"
      aria-label="Período da análise"
      ref={refRadio}
      onKeyDown={aoTeclarRadio}
    >
      {PERIODOS_ANALISE.map((p) => (
        <button
          key={p}
          type="button"
          role="radio"
          aria-checked={periodo === p}
          className={`${segmentado.abaBotao} ${periodo === p ? segmentado.abaAtiva : ""}`}
          onClick={() => setPeriodo(p)}
        >
          {p} meses
        </button>
      ))}
    </div>
  );

  // A variação em ▲/▼: percentagem, ou a diferença em euros quando a base é
  // pequena ou o sinal mudou (ver `Variacao`).
  const chip = (v: Variacao) => (
    <ChipVariacao
      sentido={v.sentido}
      texto={
        v.pct !== null
          ? `${Math.abs(v.pct)}%`
          : v.euros !== null
            ? formatMoneyInteiro(v.euros, moeda)
            : ""
      }
      pior={v.pior}
    />
  );

  function linhaComparacao(nome: string, c: Comparacao) {
    return (
      <div className={styles.linha} key={nome}>
        <span className={styles.texto}>
          <span className={styles.nome}>{nome}</span>
          <span className={styles.sub}>
            {c.media === null ? "sem média" : <>média {dinheiroInteiro(c.media)}</>}
          </span>
        </span>
        <span className={styles.direita}>
          <span className={styles.valor}>{dinheiroInteiro(c.atual)}</span>
          {chip(c)}
        </span>
      </div>
    );
  }

  if (a.vazio) {
    return (
      <Pagina titulo="Análise" acao={seletor}>
        {erroDados && <ErroSincronizacao compacto mensagem="Alguns dados não sincronizaram" />}
        <EstadoVazio
          Icone={ChartColumn}
          mensagem="Ainda não há dados para analisar"
          sub="Registe receitas e despesas e a Análise compara cada mês com os anteriores."
        />
      </Pagina>
    );
  }

  const nMeses = a.meses.length;
  const t = a.taxa;

  return (
    <Pagina titulo="Análise" acao={seletor}>
      {erroDados && <ErroSincronizacao compacto mensagem="Alguns dados não sincronizaram" />}
      <div className={styles.grade}>
        <div className={styles.coluna}>
          <section className={styles.destaque} aria-labelledby="analise-taxa">
            <AnelTaxa pct={t.atual} />
            <div className={styles.destaqueTexto}>
              <h3 id="analise-taxa" className={styles.destaqueTitulo}>
                Taxa de poupança
              </h3>
              <p className={styles.destaqueLinha}>
                {t.atual === null ? (
                  "Sem receitas neste mês"
                ) : t.gastouAMais > 0 ? (
                  <>Gastou {dinheiroInteiro(t.gastouAMais)} a mais do que recebeu</>
                ) : (
                  <>
                    Guardou {dinheiroInteiro(t.guardou)} de {dinheiroInteiro(t.receitas)}
                  </>
                )}
              </p>
              {t.media !== null && (
                <p className={styles.destaqueNota}>
                  Média dos {nMeses} {nMeses === 1 ? "mês" : "meses"}: {rotuloPct(t.media)}
                </p>
              )}
            </div>
          </section>

          {a.mesesNaMedia > 0 && (
            <section className={styles.cartao} aria-labelledby="analise-vs">
              <h3 id="analise-vs" className={styles.titulo}>
                {nomeMes} vs a sua média
              </h3>
              <div className={styles.lista}>
                {linhaComparacao("Despesas", a.vsMedia.despesas)}
                {linhaComparacao("Receitas", a.vsMedia.receitas)}
                {linhaComparacao("Sobra", a.vsMedia.sobra)}
              </div>
            </section>
          )}
        </div>

        <div className={styles.coluna}>
          {nMeses >= 2 && (
            <section className={styles.cartao} aria-labelledby="analise-linhas">
              <div className={styles.cabecalho}>
                <h3 id="analise-linhas" className={styles.titulo}>
                  Receitas vs despesas
                </h3>
                <span className={styles.apoio}>{nMeses} meses</span>
              </div>
              <GraficoLinhas meses={a.meses} moeda={moeda} />
            </section>
          )}

          <section className={styles.cartao} aria-labelledby="analise-semanas">
            <div className={styles.cabecalho}>
              <h3 id="analise-semanas" className={styles.titulo}>
                Gasto por semana
              </h3>
              {a.semanas.media !== null && (
                <span className={styles.apoio}>média {dinheiroInteiro(a.semanas.media)}</span>
              )}
            </div>
            <div className={classeDiscreta}>
              <BarrasSemana barras={a.semanas.barras} moeda={moeda} />
            </div>
          </section>
        </div>

        {a.categorias.length > 0 && (
          <section
            className={`${styles.cartao} ${styles.categorias}`}
            aria-labelledby="analise-cat"
          >
            <div className={styles.cabecalho}>
              <h3 id="analise-cat" className={styles.titulo}>
                Categorias mês a mês
              </h3>
              <span className={styles.apoio}>
                {nMeses === 1 ? "este mês" : `últimos ${nMeses}`}
              </span>
            </div>
            <div className={styles.lista}>
              {a.categorias.map((c) => (
                <div className={styles.linha} key={c.categoria}>
                  <span className={styles.texto}>
                    <span className={styles.nome} title={c.categoria}>
                      {c.categoria}
                    </span>
                    <span className={styles.sub}>{dinheiro(c.atual)}</span>
                  </span>
                  <MiniBarras serie={c.serie} />
                  <span className={styles.chipFixo}>{chip(c)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {a.maioresGastos.length > 0 && (
          <section
            className={`${styles.cartao} ${styles.maiores}`}
            aria-labelledby="analise-maiores"
          >
            <h3 id="analise-maiores" className={styles.titulo}>
              Maiores gastos do mês
            </h3>
            <div className={styles.lista}>
              {a.maioresGastos.map((g) => (
                <div className={styles.linha} key={g.chave}>
                  <IconeLinha categoria={g.categoria} entrada={false} />
                  <span className={styles.texto}>
                    <span className={styles.nome}>{g.titulo}</span>
                    <span className={styles.sub}>
                      {diaCurto(g.data)}
                      {g.categoria ? ` · ${g.categoria}` : ""}
                    </span>
                  </span>
                  <span className={styles.valor}>{dinheiro(g.valor)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {nMeses < 2 && (
          <p className={styles.nota}>
            Com mais um mês de histórico aparecem aqui o gráfico e as comparações com a sua média.
          </p>
        )}
      </div>
    </Pagina>
  );
}

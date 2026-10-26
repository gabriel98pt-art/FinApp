import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import IconeLinha from "./IconeLinha";
import { useCfgStore } from "../stores/cfgStore";
import {
  useDespesasFixasStore,
  useDespesasStore,
  useReceitasStore,
  useTransferenciasStore,
} from "../stores/lancamentosStore";
import { useMesVisivelStore } from "../stores/mesVisivelStore";
import { useParcelasStore } from "../stores/parcelasStore";
import { useUiStore } from "../stores/uiStore";
import { useVeiculoStore } from "../stores/veiculoStore";
import { hojeIso, MESES_CURTOS_PT, mesAtual } from "../utils/calculos";
import { nomeAtualDoMetodo } from "../utils/instituicoes";
import { CURRENCY_SYMBOLS, formatCents } from "../utils/money";
import { entraDinheiro, TELA_DO_TIPO, transacoesDoMes, type Transacao } from "../utils/transacoes";
import styles from "./InicioSecoes.module.css";

const QUANTOS = 4;

/** Os últimos movimentos do mês do seletor — a mesma lista que Transações
 *  monta (`transacoesDoMes`), cortada nos quatro mais recentes. Tocar abre o
 *  movimento: receita e despesa abrem o editor (o mesmo "Editar" do extrato);
 *  os outros tipos não têm editor próprio e levam à tela onde se gerem. */
export default function UltimosMovimentos() {
  const cfg = useCfgStore((s) => s.cfg);
  const navegar = useNavigate();
  const abrirRegistro = useUiStore((s) => s.abrirRegistro);
  const mes = useMesVisivelStore((s) => s.mes);
  const receitas = useReceitasStore((s) => s.itens);
  const despesasCorrentes = useDespesasStore((s) => s.itens);
  const despesasFixas = useDespesasFixasStore((s) => s.itens);
  const parcelas = useParcelasStore((s) => s.itens);
  const transferencias = useTransferenciasStore((s) => s.itens);
  const veiculo = useVeiculoStore((s) => s.dados);

  const classeDiscreta = cfg.modoDiscreto ? "discreto" : "";

  const ultimos = useMemo(
    () =>
      transacoesDoMes(
        { receitas, despesasCorrentes, despesasFixas, parcelas, transferencias, veiculo },
        mes,
        mesAtual(),
        hojeIso(),
        (id) => nomeAtualDoMetodo(cfg, id),
      ).slice(0, QUANTOS),
    [receitas, despesasCorrentes, despesasFixas, parcelas, transferencias, veiculo, mes, cfg],
  );

  if (ultimos.length === 0) return null;

  function abrir(t: Transacao) {
    if (t.origem === "receita" || t.origem === "despesa") {
      abrirRegistro(t.origem, t.refId);
      return;
    }
    const destino = TELA_DO_TIPO[t.origem];
    navegar(destino.rota, destino.aba ? { state: { aba: destino.aba } } : undefined);
  }

  return (
    <section className={styles.secao} aria-labelledby="ultimos-mov">
      <div className={styles.cabecalho}>
        <h3 id="ultimos-mov" className={styles.titulo}>
          Últimos movimentos
        </h3>
        <button type="button" className={styles.link} onClick={() => navegar("/transacoes")}>
          Ver todos
          <ChevronRight size={15} strokeWidth={2} aria-hidden />
        </button>
      </div>
      <div className={styles.lista}>
        {ultimos.map((t) => {
          const entrada = entraDinheiro(t);
          return (
            <button key={t.chave} type="button" className={styles.linha} onClick={() => abrir(t)}>
              <IconeLinha categoria={t.categoria} entrada={entrada} />
              <span className={styles.texto}>
                <span className={styles.nome}>{t.titulo}</span>
                <span className={styles.sub}>
                  {t.categoria ? `${t.categoria} · ` : ""}
                  {Number(t.data.slice(8, 10))} {MESES_CURTOS_PT[Number(t.data.slice(5, 7)) - 1]}
                </span>
              </span>
              <span
                className={`${styles.valor} ${entrada ? styles.valorEntrada : ""} ${classeDiscreta}`}
              >
                {entrada ? "+" : "−"}
                {CURRENCY_SYMBOLS[cfg.currency]} {formatCents(Math.abs(t.valor))}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

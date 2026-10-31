import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, CreditCard, Receipt, Repeat, type LucideIcon } from "lucide-react";
import { useCfgStore } from "../stores/cfgStore";
import {
  useDespesasFixasStore,
  useDespesasStore,
  useReceitasStore,
  useTransferenciasStore,
} from "../stores/lancamentosStore";
import { useParcelasStore } from "../stores/parcelasStore";
import { useVeiculoStore } from "../stores/veiculoStore";
import { hojeIso, MESES_CURTOS_PT, mesAtual, somarDias } from "../utils/calculos";
import { calcularFatura, montarDadosFatura } from "../utils/fatura";
import { nomeAtualDoMetodo } from "../utils/instituicoes";
import { formatMoney } from "../utils/money";
import {
  foraDaFatura,
  totalAVencer,
  vencimentosDeFaturas,
  vencimentosDeFixas,
  vencimentosDeParcelas,
  type TipoVencimento,
} from "../utils/vencimentos";
import styles from "./InicioSecoes.module.css";
import Botao from "./Botao";

const ICONE: Record<TipoVencimento, LucideIcon> = {
  fixa: Repeat,
  parcela: CreditCard,
  fatura: Receipt,
};

/** "hoje", "amanhã" ou "30 out" — datas ISO comparam-se como texto. */
function rotuloDia(dia: string, hoje: string): { texto: string; perto: boolean } {
  if (dia === hoje) return { texto: "hoje", perto: true };
  if (dia === somarDias(hoje, 1)) return { texto: "amanhã", perto: true };
  return {
    texto: `${Number(dia.slice(8, 10))} ${MESES_CURTOS_PT[Number(dia.slice(5, 7)) - 1]}`,
    perto: false,
  };
}

/** O que ainda falta pagar no mês de hoje — fixas, parcelas e faturas, pela
 *  mesma conta do Calendário (utils/vencimentos.ts, com `mesReal`/`hoje` para
 *  descontar o que já foi pago). Segue o mês REAL e não o do seletor: "a pagar
 *  este mês" é sobre agora. São previsões, nunca movimentos já realizados.
 *
 *  Diferença para o Calendário, de propósito: a parcela em débito automático
 *  num cartão de crédito fica de fora, porque o valor dela já está dentro da
 *  fatura (ver `debitoAutomaticoParcelas`) — listar as duas contava o mesmo
 *  dinheiro a dobrar. */
const QUANTOS = 4;

export default function APagarEsteMes() {
  const cfg = useCfgStore((s) => s.cfg);
  const navegar = useNavigate();
  const classeDiscreta = cfg.modoDiscreto ? "discreto" : "";
  const despesas = useDespesasStore((s) => s.itens);
  const despesasFixas = useDespesasFixasStore((s) => s.itens);
  const receitas = useReceitasStore((s) => s.itens);
  const transferencias = useTransferenciasStore((s) => s.itens);
  const parcelas = useParcelasStore((s) => s.itens);
  const veiculo = useVeiculoStore((s) => s.dados);
  const mesReal = mesAtual();
  const hoje = hojeIso();

  const vencimentos = useMemo(() => {
    const dadosFatura = montarDadosFatura({
      despesas,
      despesasFixas,
      transferencias,
      parcelas,
      veiculo,
      receitas,
    });
    const restantePorCartao = cfg.contasCartoes
      .filter((c) => cfg.tipoCartao[c] === "credit")
      .map((c) => ({
        cartao: c,
        nome: nomeAtualDoMetodo(cfg, c),
        restante: calcularFatura(c, mesReal, dadosFatura, cfg).restante,
      }));
    const proprios = foraDaFatura(
      [...despesasFixas, ...veiculo.despesasFixas],
      parcelas,
      cfg.tipoCartao,
    );
    return [
      ...vencimentosDeFixas(proprios.fixas, mesReal, mesReal, hoje),
      ...vencimentosDeParcelas(proprios.parcelas, mesReal, cfg.diaVencimentoFatura, mesReal, hoje),
      ...vencimentosDeFaturas(restantePorCartao, mesReal, cfg.diaVencimentoFatura),
    ].sort((a, b) => (a.dia < b.dia ? -1 : a.dia > b.dia ? 1 : 0));
  }, [cfg, despesas, despesasFixas, receitas, transferencias, parcelas, veiculo, mesReal, hoje]);

  if (vencimentos.length === 0) return null;

  // O total e a contagem são de TODOS os pendentes do mês; só a lista é cortada.
  const total = totalAVencer(vencimentos);
  const n = vencimentos.length;

  return (
    <section className={styles.secao} aria-labelledby="a-pagar">
      <div className={styles.cabecalho}>
        <h3 id="a-pagar" className={styles.titulo}>
          A pagar este mês
        </h3>
        <Botao variante="link" type="button" onClick={() => navegar("/calendario")}>
          Ver todos
          <ChevronRight size={15} strokeWidth={2} aria-hidden />
        </Botao>
      </div>
      <p className={styles.resumo}>
        <span className={`${styles.resumoValor} ${classeDiscreta}`}>
          {formatMoney(total, cfg.currency)}
        </span>{" "}
        em {n} {n === 1 ? "pagamento" : "pagamentos"}
      </p>
      <div className={styles.lista}>
        {vencimentos.slice(0, QUANTOS).map((v) => {
          const Icone = ICONE[v.tipo];
          const dia = rotuloDia(v.dia, hoje);
          return (
            <div key={`${v.tipo}-${v.titulo}-${v.dia}`} className={styles.linha}>
              <span className={styles.icone}>
                <Icone size={17} strokeWidth={1.75} aria-hidden />
              </span>
              <div className={styles.texto}>
                <span className={styles.nome}>{v.titulo}</span>
                <span className={styles.sub}>
                  {v.tipo === "fixa" ? "Despesa fixa" : v.detalhe} ·{" "}
                  <span className={dia.perto ? styles.perto : undefined}>{dia.texto}</span>
                </span>
              </div>
              <span className={`${styles.valor} ${classeDiscreta}`}>
                {formatMoney(v.valor, cfg.currency)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

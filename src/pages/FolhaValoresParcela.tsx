import { useState } from "react";
import BottomSheet from "../components/BottomSheet";
import CampoMoeda from "../components/CampoMoeda";
import Botao from "../components/Botao";
import { definirValorDoMes, espelhosDoMes, limparValorDoMes } from "../services/parcelasService";
import { useUidSessao } from "../hooks/useUidSessao";
import { mostrarToast } from "../stores/toastStore";
import type { Cents, Currency, DespesaCorrente, IsoDate, Parcela, YearMonth } from "../types";
import { rotuloMes } from "../utils/calculos";
import { formatMoney } from "../utils/money";
import {
  estaEfetivamentePaga,
  mesesDaParcela,
  valorBaseDaParcela,
  valorDaParcela,
} from "../utils/parcelas";
import styles from "./FolhaValoresParcela.module.css";

/** Ajuste do valor de cada mês de uma parcela.
 *
 *  Existe por causa de serviços como a Klarna, que às vezes cobram parcelas
 *  DESIGUAIS — 160,75 em 3× veio 53,33 + 53,71 + 53,71, bem mais do que
 *  arredondamento. A divisão automática do total nunca acerta nesses casos, e
 *  a despesa criada ao pagar o mês sai com o valor errado.
 *
 *  Mês em aberto: `pagarMesParcela` lê o valor do mês na hora de criar a
 *  despesa. Mês já pago também se ajusta: a despesa espelho em Despesas
 *  (origem "parc") é corrigida na mesma escrita. Pago sem espelho — débito
 *  automático, cobrado na fatura do cartão — só muda o cálculo da parcela, e
 *  a nota do mês diz isso.
 *
 *  A soma que não bate com o total é só um aviso: ajuda a apanhar um dígito
 *  trocado, mas nunca impede de salvar (a Klarna pode cobrar um total um
 *  pouco diferente do que foi registado). */
export default function FolhaValoresParcela({
  aberta,
  aoFechar,
  p,
  moeda,
  mesRef,
  hoje,
  despesas,
}: {
  aberta: boolean;
  aoFechar: () => void;
  /** A parcela vem sempre fresca do store (quem chama re-renderiza a cada
   *  gravação), então o valor salvo aparece aqui sem estado extra. */
  p: Parcela;
  moeda: Currency;
  /** Mesma régua da linha da parcela: um mês em débito automático já cobrado
   *  conta como pago, igual à contagem "N/M" da lista. */
  mesRef: YearMonth;
  hoje: IsoDate;
  /** Para achar a despesa espelho de um mês já pago e corrigi-la junto. */
  despesas: DespesaCorrente[];
}) {
  const uid = useUidSessao();
  // Rascunho por mês: só existe enquanto se está a escrever. Sem entrada, o
  // campo mostra o valor que vale hoje.
  const [rascunho, setRascunho] = useState<Partial<Record<YearMonth, Cents | null>>>({});

  const meses = mesesDaParcela(p);
  const soma = meses.reduce((s, m) => s + valorDaParcela(p, m), 0);
  const diferenca = soma - p.total;

  function fechar() {
    setRascunho({});
    aoFechar();
  }

  function esquecerRascunho(mes: YearMonth) {
    setRascunho((r) => {
      const resto = { ...r };
      delete resto[mes];
      return resto;
    });
  }

  async function guardar(mes: YearMonth, valor: Cents) {
    try {
      await definirValorDoMes(uid, p, mes, valor, despesas);
      esquecerRascunho(mes);
      mostrarToast(`✓ ${rotuloMes(mes)}: ${formatMoney(valor, moeda)}`);
    } catch {
      mostrarToast("Não foi possível guardar. Tente de novo.");
    }
  }

  async function usarAutomatico(mes: YearMonth) {
    try {
      await limparValorDoMes(uid, p, mes, despesas);
      esquecerRascunho(mes);
      mostrarToast(`✓ ${rotuloMes(mes)} volta ao valor automático`);
    } catch {
      mostrarToast("Não foi possível guardar. Tente de novo.");
    }
  }

  return (
    <BottomSheet aberta={aberta} aoFechar={fechar} titulo={`Valores por mês — ${p.descricao}`}>
      <div className={styles.conteudo}>
        <p className={styles.nota}>
          Quando o serviço cobra parcelas diferentes umas das outras, ajuste aqui o valor de cada
          mês antes de o pagar — a despesa sai com o valor certo.
        </p>

        <ul className={styles.lista}>
          {meses.map((m, idx) => {
            const rotulo = rotuloMes(m);
            const atual = valorDaParcela(p, m);
            const ajustado = p.overridePorMes?.[m] != null;
            const pago = estaEfetivamentePaga(p, m, mesRef, hoje);

            const emEdicao = m in rascunho ? (rascunho[m] ?? null) : atual;
            const podeSalvar = emEdicao !== null && emEdicao > 0 && emEdicao !== atual;
            return (
              <li key={m} className={styles.mes}>
                <span className={styles.cabecalhoMes}>
                  <span className={styles.rotulo}>{rotulo}</span>
                  {ajustado && <span className={styles.selo}>ajustado</span>}
                </span>
                <form
                  className={styles.linhaEdicao}
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (podeSalvar) void guardar(m, emEdicao);
                  }}
                >
                  <CampoMoeda
                    valor={emEdicao}
                    aoMudar={(v) => setRascunho((r) => ({ ...r, [m]: v }))}
                    className={styles.campo}
                    aria-label={`Valor de ${rotulo}`}
                  />
                  <Botao
                    type="submit"
                    variante="texto"
                    disabled={!podeSalvar}
                    aria-label={`Guardar ${rotulo}`}
                  >
                    Guardar
                  </Botao>
                </form>
                {pago && (
                  <span className={styles.detalhe}>
                    {espelhosDoMes(p, m, despesas).length > 0
                      ? "Já pago — ajustar aqui também corrige o lançamento em Despesas."
                      : p.autoDebit
                        ? "Já pago via débito direto — ajustar aqui só muda o cálculo da parcela, não a fatura do cartão."
                        : "Já pago, sem lançamento ligado em Despesas — ajustar aqui só muda o cálculo da parcela."}
                  </span>
                )}
                {ajustado && (
                  <span className={styles.linhaAutomatico}>
                    <span className={styles.detalhe}>
                      Automático: {formatMoney(valorBaseDaParcela(p, idx), moeda)}
                    </span>
                    <Botao
                      variante="texto"
                      aria-label={`Usar valor automático em ${rotulo}`}
                      onClick={() => void usarAutomatico(m)}
                    >
                      Usar valor automático
                    </Botao>
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        <div className={styles.totais}>
          <span className={styles.linhaTotal}>
            <span>Total da compra</span>
            <span className={styles.numero}>{formatMoney(p.total, moeda)}</span>
          </span>
          <span className={styles.linhaTotal}>
            <span>Soma dos meses</span>
            <span className={styles.numero}>{formatMoney(soma, moeda)}</span>
          </span>
          {diferenca !== 0 && (
            <p className={styles.aviso}>
              A soma dos meses está {formatMoney(Math.abs(diferenca), moeda)}{" "}
              {diferenca > 0 ? "acima" : "abaixo"} do total da compra. Confira se algum valor foi
              digitado errado.
            </p>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}

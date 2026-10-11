import { useState } from "react";
import BottomSheet from "../components/BottomSheet";
import CampoMoeda from "../components/CampoMoeda";
import Botao from "../components/Botao";
import { definirValorDoMes, limparValorDoMes } from "../services/parcelasService";
import { useUidSessao } from "../hooks/useUidSessao";
import { mostrarToast } from "../stores/toastStore";
import type { Cents, Currency, IsoDate, Parcela, YearMonth } from "../types";
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
 *  O ajuste vale para o que ainda vai ser pago: `pagarMesParcela` lê o valor
 *  do mês na hora de criar a despesa. Um mês já pago fica só para leitura —
 *  mudar o valor dele aqui não mexeria na despesa que já nasceu.
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

  async function salvar(mes: YearMonth, valor: Cents) {
    try {
      await definirValorDoMes(uid, p, mes, valor);
      esquecerRascunho(mes);
      mostrarToast(`✓ ${rotuloMes(mes)}: ${formatMoney(valor, moeda)}`);
    } catch {
      mostrarToast("Não foi possível salvar. Tente de novo.");
    }
  }

  async function usarAutomatico(mes: YearMonth) {
    try {
      await limparValorDoMes(uid, p, mes);
      esquecerRascunho(mes);
      mostrarToast(`✓ ${rotuloMes(mes)} volta ao valor automático`);
    } catch {
      mostrarToast("Não foi possível salvar. Tente de novo.");
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

            if (pago) {
              return (
                <li key={m} className={styles.mes}>
                  <span className={styles.cabecalhoMes}>
                    <span className={styles.rotulo}>{rotulo}</span>
                    <span className={styles.valorPago}>{formatMoney(atual, moeda)}</span>
                  </span>
                  <span className={styles.detalhe}>
                    Já pago — mudar aqui não corrige o lançamento.
                  </span>
                </li>
              );
            }

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
                    if (podeSalvar) void salvar(m, emEdicao);
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
                    aria-label={`Salvar ${rotulo}`}
                  >
                    Salvar
                  </Botao>
                </form>
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

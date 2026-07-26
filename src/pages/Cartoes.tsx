import { useState, type FormEvent } from "react";
import { CreditCard } from "lucide-react";
import Pagina, { EstadoVazio, Kpis } from "../components/Pagina";
import KpiCard from "../components/KpiCard";
import BottomSheet from "../components/BottomSheet";
import { adicionarCartao, definirFaturaManual } from "../services/cfgService";
import { pagarFatura, removerPagamentoFatura, reabrirFatura } from "../services/faturaService";
import { useAuthStore } from "../stores/authStore";
import { useCfgStore } from "../stores/cfgStore";
import { useMesVisivelStore } from "../stores/mesVisivelStore";
import {
  useDespesasFixasStore,
  useDespesasStore,
  useReceitasStore,
  useTransferenciasStore,
} from "../stores/lancamentosStore";
import { useParcelasStore } from "../stores/parcelasStore";
import { mostrarToast } from "../stores/toastStore";
import { useVeiculoStore } from "../stores/veiculoStore";
import type { FaturaCalculada, TipoCartao } from "../types";
import { rotuloMes } from "../utils/calculos";
import {
  calcularFatura,
  cicloDaFatura,
  pagamentosDaFatura,
  type DadosFatura,
} from "../utils/fatura";
import { resumosDasContas, type DadosContas } from "../utils/contas";
import { formatCents, formatMoney, parseMoney } from "../utils/money";
import styles from "./Cartoes.module.css";

/** Controles de fatura do cartão de crédito — agora vivem DENTRO da folha de
 *  detalhes da conta (item 13), não mais como quadro solto na tela. */
function ControlesFatura({
  fatura,
  aoPagar,
  aoAjustar,
}: {
  fatura: FaturaCalculada;
  aoPagar: () => void;
  aoAjustar: () => void;
}) {
  const uid = useAuthStore((s) => s.sessao?.uid);
  const cfg = useCfgStore((s) => s.cfg);
  const paga = fatura.devido > 0 && fatura.restante === 0;

  return (
    <div className={styles.blocoFatura}>
      <div className={styles.topo}>
        <div>
          <p className={styles.ciclo}>
            Ciclo: {rotuloMes(cicloDaFatura(fatura.mes))}
            {fatura.overrideManual !== null && (
              <span className={styles.badgeManual}> · valor manual</span>
            )}
          </p>
        </div>
        <span className={`${styles.estado} ${paga ? styles.paga : ""}`}>
          {paga ? "Paga" : fatura.pago > 0 ? "Parcial" : "Em aberto"}
        </span>
      </div>

      <div className={styles.valores}>
        <div>
          <p className={styles.rotuloValor}>Devido</p>
          <p className={styles.valor}>{formatMoney(fatura.devido, cfg.currency)}</p>
        </div>
        <div>
          <p className={styles.rotuloValor}>Pago</p>
          <p className={`${styles.valor} ${styles.verde}`}>
            {formatMoney(fatura.pago, cfg.currency)}
          </p>
        </div>
        <div>
          <p className={styles.rotuloValor}>Restante</p>
          <p className={`${styles.valor} ${fatura.restante > 0 ? styles.amarelo : styles.verde}`}>
            {formatMoney(fatura.restante, cfg.currency)}
          </p>
        </div>
      </div>

      {fatura.pago > 0 && (
        <ul className={styles.pagamentos}>
          {calcularPagamentos(fatura).map((p) => (
            <li key={p.id} className={styles.pagamento}>
              <span>
                {p.data.slice(8, 10)}/{p.data.slice(5, 7)}
                {p.de ? ` · ${p.de}` : ""}
              </span>
              <span className={styles.pagamentoValor}>
                {formatMoney(p.valor, cfg.currency)}
                <button
                  className={styles.remover}
                  onClick={() => {
                    if (!window.confirm("Remover este pagamento?")) return;
                    void removerPagamentoFatura(
                      uid!,
                      fatura.cartao,
                      fatura.mes,
                      p,
                      calcularPagamentos(fatura),
                    )
                      .then(() => mostrarToast("↩ Pagamento removido"))
                      .catch(() => mostrarToast("Não foi possível remover."));
                  }}
                  aria-label="Remover pagamento"
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.acoes}>
        {fatura.restante > 0 && (
          <button className={styles.acaoPrimaria} onClick={aoPagar}>
            Pagar
          </button>
        )}
        <button className={styles.acao} onClick={aoAjustar}>
          Ajustar valor
        </button>
        {fatura.pago > 0 && (
          <button
            className={styles.acao}
            onClick={() => {
              const n = calcularPagamentos(fatura).length;
              if (
                !window.confirm(
                  `Reabrir a fatura de ${rotuloMes(fatura.mes)}? Remove ${n} pagamento(s).`,
                )
              )
                return;
              void reabrirFatura(uid!, fatura.cartao, fatura.mes, calcularPagamentos(fatura))
                .then(() => mostrarToast("↩ Fatura reaberta"))
                .catch(() => mostrarToast("Não foi possível reabrir."));
            }}
          >
            Reabrir
          </button>
        )}
      </div>
    </div>
  );
}

// A FaturaCalculada não carrega a lista de pagamentos — este helper devolve a
// lista atual a partir da store, com a mesma compat de formato legado do cálculo.
function calcularPagamentos(fatura: FaturaCalculada) {
  const cfg = useCfgStore.getState().cfg;
  return pagamentosDaFatura(cfg.faturasPagas?.[fatura.cartao]?.[fatura.mes]);
}

export default function Cartoes() {
  const uid = useAuthStore((s) => s.sessao?.uid);
  const cfg = useCfgStore((s) => s.cfg);
  const cfgCarregada = useCfgStore((s) => s.carregado);
  const despesas = useDespesasStore((s) => s.itens);
  const despesasFixas = useDespesasFixasStore((s) => s.itens);
  const transferencias = useTransferenciasStore((s) => s.itens);
  const parcelas = useParcelasStore((s) => s.itens);
  const veiculo = useVeiculoStore((s) => s.dados);

  const receitas = useReceitasStore((s) => s.itens);

  const mes = useMesVisivelStore((s) => s.mes);
  const [contaAberta, setContaAberta] = useState<string | null>(null);
  const [pagando, setPagando] = useState<FaturaCalculada | null>(null);
  const [ajustando, setAjustando] = useState<FaturaCalculada | null>(null);
  const [novoNome, setNovoNome] = useState("");
  const [novoTipo, setNovoTipo] = useState<TipoCartao>("credit");
  const [valorTexto, setValorTexto] = useState("");
  const [pagarDe, setPagarDe] = useState("");

  const dados: DadosFatura = {
    despesasFixas,
    despesasFixasVeiculo: veiculo.despesasFixas,
    despesasCorrentes: despesas,
    parcelas,
    transferencias,
  };

  const dadosContas: DadosContas = {
    receitas,
    despesasCorrentes: despesas,
    despesasFixas,
    despesasFixasVeiculo: veiculo.despesasFixas,
    transferencias,
  };

  const cartoesCredito = cfg.contasCartoes.filter((c) => cfg.tipoCartao[c] === "credit");
  const contasDebito = cfg.contasCartoes.filter((c) => cfg.tipoCartao[c] !== "credit");
  const faturas = cartoesCredito.map((c) => calcularFatura(c, mes, dados, cfg));
  const resumos = resumosDasContas(dadosContas, cfg, mes);
  const resumoAberto = resumos.find((r) => r.conta === contaAberta) ?? null;
  const faturaAberta =
    resumoAberto?.tipo === "credit"
      ? (faturas.find((f) => f.cartao === resumoAberto.conta) ?? null)
      : null;
  const totalDevido = faturas.reduce((s, f) => s + f.devido, 0);
  const totalPago = faturas.reduce((s, f) => s + f.pago, 0);
  const totalRestante = faturas.reduce((s, f) => s + f.restante, 0);

  async function adicionar(e: FormEvent) {
    e.preventDefault();
    const nome = novoNome.trim();
    if (!nome) return mostrarToast("Escreva um nome primeiro.");
    try {
      await adicionarCartao(uid!, cfg, nome, novoTipo);
      mostrarToast(`✓ ${novoTipo === "credit" ? "Cartão de crédito" : "Conta/débito"} adicionado`);
      setNovoNome("");
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : "Não foi possível adicionar.");
    }
  }

  async function submeterPagamento(e: FormEvent) {
    e.preventDefault();
    if (!pagando) return;
    const valor = parseMoney(valorTexto);
    if (valor === null || valor <= 0) return mostrarToast("Valor inválido.");
    if (!pagarDe) return mostrarToast("Escolha de onde sai o dinheiro.");
    try {
      await pagarFatura(uid!, {
        cartao: pagando.cartao,
        mes: pagando.mes,
        valor,
        de: pagarDe,
        pagamentosAtuais: calcularPagamentos(pagando),
        devido: pagando.devido,
        parcelas,
      });
      const quitou = valor >= pagando.restante;
      mostrarToast(quitou ? "✓ Fatura paga" : "✓ Pagamento parcial registrado");
      setPagando(null);
    } catch {
      mostrarToast("Não foi possível registrar o pagamento.");
    }
  }

  async function submeterAjuste(e: FormEvent) {
    e.preventDefault();
    if (!ajustando) return;
    const texto = valorTexto.trim();
    const valor = texto === "" ? null : parseMoney(texto);
    if (texto !== "" && (valor === null || valor < 0)) return mostrarToast("Valor inválido.");
    try {
      await definirFaturaManual(uid!, ajustando.cartao, ajustando.mes, valor);
      mostrarToast(
        valor === null
          ? "✓ Reposto para cálculo automático"
          : `✓ Fatura manual: ${formatMoney(valor, cfg.currency)}`,
      );
      setAjustando(null);
    } catch {
      mostrarToast("Não foi possível ajustar.");
    }
  }

  return (
    <Pagina titulo="Cartões">
      <Kpis pagina="cartoes">
        <KpiCard
          rotulo="Devido no mês"
          valor={formatMoney(totalDevido, cfg.currency)}
          tom="acento"
        />
        <KpiCard rotulo="Pago" valor={formatMoney(totalPago, cfg.currency)} tom="verde" />
        <KpiCard rotulo="Restante" valor={formatMoney(totalRestante, cfg.currency)} tom="amarelo" />
      </Kpis>

      {cfgCarregada && cfg.contasCartoes.length === 0 ? (
        <EstadoVazio
          Icone={CreditCard}
          mensagem="Nenhuma conta ou cartão"
          sub="Adicione abaixo para acompanhar gastos e faturas."
        />
      ) : (
        <div className={styles.grade}>
          {resumos.map((r) => (
            <button key={r.conta} className={styles.quadro} onClick={() => setContaAberta(r.conta)}>
              <span className={styles.quadroTopo}>
                <span className={styles.nome}>{r.conta}</span>
                <span className={styles.tipoBadge}>
                  {r.tipo === "credit" ? "crédito" : "débito"}
                </span>
              </span>
              <span className={styles.quadroValor}>{formatMoney(r.gastoMes, cfg.currency)}</span>
              <span className={styles.quadroNota}>
                {r.transacoesMes} {r.transacoesMes === 1 ? "transação" : "transações"} em{" "}
                {rotuloMes(mes)}
              </span>
            </button>
          ))}
        </div>
      )}

      <form className={styles.gerir} onSubmit={adicionar}>
        <p className={styles.gerirTitulo}>Cartões e contas</p>
        {cfg.contasCartoes.length > 0 && (
          <ul className={styles.chips}>
            {cfg.contasCartoes.map((c) => (
              <li key={c} className={styles.chip}>
                {c}
                <span className={styles.chipTipo}>
                  {cfg.tipoCartao[c] === "credit" ? "crédito" : "débito"}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className={styles.gerirLinha}>
          <input
            placeholder="Nome (ex. AB Gold)"
            aria-label="Nome da conta ou cartão"
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
          />
          <select
            aria-label="Tipo"
            value={novoTipo}
            onChange={(e) => setNovoTipo(e.target.value as TipoCartao)}
          >
            <option value="credit">Crédito</option>
            <option value="debit">Débito</option>
          </select>
          <button type="submit" className={styles.gerirBotao}>
            Adicionar
          </button>
        </div>
      </form>

      <BottomSheet
        aberta={contaAberta !== null}
        aoFechar={() => setContaAberta(null)}
        titulo={contaAberta ?? ""}
      >
        {resumoAberto && (
          <div className={styles.detalhes}>
            <div className={styles.linhaDetalhe}>
              <span>Tipo</span>
              <strong>{resumoAberto.tipo === "credit" ? "Crédito" : "Débito"}</strong>
            </div>
            <div className={styles.linhaDetalhe}>
              <span>{resumoAberto.tipo === "credit" ? "Fatura até agora" : "Saldo atual"}</span>
              <strong>
                {formatMoney(
                  resumoAberto.tipo === "credit"
                    ? (faturaAberta?.devido ?? 0)
                    : resumoAberto.saldoAtual,
                  cfg.currency,
                )}
              </strong>
            </div>
            <div className={styles.linhaDetalhe}>
              <span>Despesas em {rotuloMes(mes)}</span>
              <strong>{resumoAberto.despesasMes}</strong>
            </div>
            <div className={styles.linhaDetalhe}>
              <span>Receitas em {rotuloMes(mes)}</span>
              <strong>{resumoAberto.receitasMes}</strong>
            </div>

            {faturaAberta && (
              <ControlesFatura
                fatura={faturaAberta}
                aoPagar={() => {
                  setValorTexto(formatCents(faturaAberta.restante));
                  setPagarDe(contasDebito[0] ?? "");
                  setContaAberta(null);
                  setPagando(faturaAberta);
                }}
                aoAjustar={() => {
                  setValorTexto(
                    faturaAberta.overrideManual !== null
                      ? formatCents(faturaAberta.overrideManual)
                      : "",
                  );
                  setContaAberta(null);
                  setAjustando(faturaAberta);
                }}
              />
            )}
          </div>
        )}
      </BottomSheet>

      <BottomSheet
        aberta={pagando !== null}
        aoFechar={() => setPagando(null)}
        titulo={pagando ? `Pagar fatura — ${pagando.cartao} · ${rotuloMes(pagando.mes)}` : ""}
      >
        {pagando && (
          <form className={styles.form} onSubmit={submeterPagamento}>
            <p className={styles.resumoPagar}>
              Devido {formatMoney(pagando.devido, cfg.currency)} · Pago{" "}
              {formatMoney(pagando.pago, cfg.currency)} · Restante{" "}
              {formatMoney(pagando.restante, cfg.currency)}
            </p>
            <label className={styles.campo}>
              Valor (€) — pode ser parcial
              <input
                inputMode="decimal"
                value={valorTexto}
                onChange={(e) => setValorTexto(e.target.value)}
                required
              />
            </label>
            <label className={styles.campo}>
              Sai de
              <select value={pagarDe} onChange={(e) => setPagarDe(e.target.value)} required>
                <option value="">Escolher…</option>
                {contasDebito.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            {contasDebito.length === 0 && (
              <p className={styles.aviso}>Adicione primeiro uma conta/cartão de débito.</p>
            )}
            <button type="submit" className={styles.salvar} disabled={contasDebito.length === 0}>
              Registrar pagamento
            </button>
          </form>
        )}
      </BottomSheet>

      <BottomSheet
        aberta={ajustando !== null}
        aoFechar={() => setAjustando(null)}
        titulo={ajustando ? `Fatura — ${ajustando.cartao} · ${rotuloMes(ajustando.mes)}` : ""}
      >
        {ajustando && (
          <form className={styles.form} onSubmit={submeterAjuste}>
            <p className={styles.resumoPagar}>
              Cálculo automático: {formatMoney(ajustando.devidoAutomatico, cfg.currency)}
            </p>
            <label className={styles.campo}>
              Valor manual (€) — vazio volta ao automático
              <input
                inputMode="decimal"
                value={valorTexto}
                onChange={(e) => setValorTexto(e.target.value)}
                placeholder="automático"
              />
            </label>
            <button type="submit" className={styles.salvar}>
              Salvar
            </button>
          </form>
        )}
      </BottomSheet>
    </Pagina>
  );
}

import { useState, type FormEvent } from "react";
import { ArrowLeftRight, CreditCard, Pencil, Plus, X } from "lucide-react";
import Pagina, { EstadoVazio, Kpis } from "../components/Pagina";
import KpiCard from "../components/KpiCard";
import BottomSheet from "../components/BottomSheet";
import ErroSincronizacao from "../components/ErroSincronizacao";
import RenomearFolha from "../components/RenomearFolha";
import Seletor from "../components/Seletor";
import SeletorData from "../components/SeletorData";
import {
  adicionarCartao,
  definirFaturaManual,
  definirDiaVencimentoFatura,
  removerCartao,
  renomearCartao,
} from "../services/cfgService";
import { pagarFatura, removerPagamentoFatura, reabrirFatura } from "../services/faturaService";
import {
  atualizarTransferencia,
  criarTransferencia,
  removerTransferencia,
} from "../services/lancamentosService";
import { useConfirmar } from "../hooks/useConfirmar";
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
import type { FaturaCalculada, Id, TipoCartao, Transferencia } from "../types";
import { doMes, hojeIso, ordenarPorDataDesc, rotuloMes } from "../utils/calculos";
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
  const confirmar = useConfirmar();
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
                    void (async () => {
                      if (!(await confirmar("Remover este pagamento?"))) return;
                      await removerPagamentoFatura(
                        uid!,
                        fatura.cartao,
                        fatura.mes,
                        p,
                        calcularPagamentos(fatura),
                      )
                        .then(() => mostrarToast("↩ Pagamento removido"))
                        .catch(() => mostrarToast("Não foi possível remover."));
                    })();
                  }}
                  aria-label="Remover pagamento"
                >
                  <X size={15} aria-hidden />
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
              void (async () => {
                const n = calcularPagamentos(fatura).length;
                if (
                  !(await confirmar(
                    `Reabrir a fatura de ${rotuloMes(fatura.mes)}? Remove ${n} pagamento(s).`,
                  ))
                )
                  return;
                await reabrirFatura(uid!, fatura.cartao, fatura.mes, calcularPagamentos(fatura))
                  .then(() => mostrarToast("↩ Fatura reaberta"))
                  .catch(() => mostrarToast("Não foi possível reabrir."));
              })();
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
  const confirmar = useConfirmar();
  const cfg = useCfgStore((s) => s.cfg);
  const cfgCarregada = useCfgStore((s) => s.carregado);
  const despesas = useDespesasStore((s) => s.itens);
  const despesasFixas = useDespesasFixasStore((s) => s.itens);
  const transferencias = useTransferenciasStore((s) => s.itens);
  const erroTransferencias = useTransferenciasStore((s) => s.erro);
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
  // Dia em que a fatura foi mesmo paga. Começa em hoje — quem regista no
  // próprio dia não mexe nisto —, mas quem está a acertar pagamentos passados
  // consegue pôr a data certa em vez de os amontoar todos no dia de hoje.
  const [pagarData, setPagarData] = useState(hojeIso());
  const [renomeando, setRenomeando] = useState<string | null>(null);

  // ---- caixa de transferência (criar/editar) ----
  // Vive aqui, e não em Despesas, porque transferir é mover dinheiro ENTRE as
  // contas e cartões desta tela — não é uma despesa. Estava escondida numa aba
  // de Despesas, onde ninguém a encontrava.
  const [tfAberta, setTfAberta] = useState(false);
  const [tfEditandoId, setTfEditandoId] = useState<Id | null>(null);
  const [tfData, setTfData] = useState(hojeIso());
  const [tfDe, setTfDe] = useState("");
  const [tfPara, setTfPara] = useState("");
  const [tfValor, setTfValor] = useState("");
  const [tfDescricao, setTfDescricao] = useState("");
  const [tfNota, setTfNota] = useState("");

  const dados: DadosFatura = {
    despesasFixas,
    despesasFixasVeiculo: veiculo.despesasFixas,
    despesasCorrentes: despesas,
    parcelas,
    transferencias,
    cargas: veiculo.cargas,
    despesasVeiculo: veiculo.despesas,
  };

  const dadosContas: DadosContas = {
    receitas,
    despesasCorrentes: despesas,
    despesasFixas,
    despesasFixasVeiculo: veiculo.despesasFixas,
    transferencias,
    cargas: veiculo.cargas,
    despesasVeiculo: veiculo.despesas,
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

  async function renomear(nomeNovo: string) {
    if (!renomeando) return;
    const alvo = renomeando;
    try {
      await renomearCartao(uid!, cfg, alvo, nomeNovo);
      setRenomeando(null);
      mostrarToast(`✓ Agora chama-se "${nomeNovo.trim()}"`);
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : "Não foi possível renomear.");
    }
  }

  async function remover(nome: string) {
    if (
      !(await confirmar(
        `Remover "${nome}"? Lançamentos que já usam esta conta não mudam — para trocar o nome em todos, use Renomear.`,
      ))
    )
      return;
    try {
      await removerCartao(uid!, cfg, nome);
      mostrarToast(`"${nome}" removido`);
    } catch {
      mostrarToast("Não foi possível remover.");
    }
  }

  function abrirNovaTransferencia() {
    setTfEditandoId(null);
    setTfData(hojeIso());
    setTfDe("");
    setTfPara("");
    setTfValor("");
    setTfDescricao("");
    setTfNota("");
    setTfAberta(true);
  }

  function abrirEdicaoTransferencia(t: Transferencia) {
    setTfEditandoId(t.id);
    setTfData(t.data);
    setTfDe(t.de);
    setTfPara(t.para);
    setTfValor((t.valor / 100).toFixed(2).replace(".", ","));
    setTfDescricao(t.descricao ?? "");
    setTfNota(t.nota ?? "");
    setTfAberta(true);
  }

  async function salvarTransferencia(e: FormEvent) {
    e.preventDefault();
    const valor = parseMoney(tfValor);
    if (valor === null || valor <= 0) return mostrarToast("Valor inválido.");
    if (!tfDe || !tfPara) return mostrarToast("Escolha origem e destino.");
    if (tfDe === tfPara) return mostrarToast("Origem e destino não podem ser iguais.");
    const dados = {
      data: tfData,
      de: tfDe,
      para: tfPara,
      valor,
      descricao: tfDescricao || undefined,
      nota: tfNota.trim() || undefined,
    };
    try {
      if (tfEditandoId) {
        await atualizarTransferencia(uid!, { ...dados, id: tfEditandoId });
        mostrarToast("✓ Transferência atualizada");
      } else {
        await criarTransferencia(uid!, dados);
        mostrarToast("✓ Transferência registrada");
      }
      setTfAberta(false);
    } catch {
      mostrarToast("Não foi possível concluir. Tente de novo.");
    }
  }

  async function excluirTransferencia() {
    if (!tfEditandoId) return;
    if (!(await confirmar("Excluir esta transferência?"))) return;
    const id = tfEditandoId;
    setTfAberta(false);
    try {
      await removerTransferencia(uid!, id);
      mostrarToast("Transferência excluída");
    } catch {
      mostrarToast("Não foi possível concluir. Tente de novo.");
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
        data: pagarData,
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
                {/* Só o cartão de crédito tem fatura, e é o dia dela que
                    manda também nas parcelas em débito automático. */}
                {cfg.tipoCartao[c] === "credit" && (
                  <label className={styles.chipDia}>
                    vence dia
                    <input
                      type="text"
                      inputMode="numeric"
                      value={cfg.diaVencimentoFatura?.[c] ?? ""}
                      placeholder="—"
                      aria-label={`Dia de vencimento da fatura de ${c}`}
                      onChange={(e) => {
                        const n = parseInt(e.target.value.replace(/\D/g, ""), 10);
                        void definirDiaVencimentoFatura(uid!, c, Number.isFinite(n) ? n : null)
                          .then(() => mostrarToast("Dia de vencimento guardado"))
                          .catch(() => mostrarToast("Não foi possível guardar."));
                      }}
                    />
                  </label>
                )}
                <button
                  type="button"
                  className={styles.chipAcao}
                  onClick={() => setRenomeando(c)}
                  aria-label={`Renomear ${c}`}
                  title="Renomear"
                >
                  <Pencil size={14} aria-hidden />
                </button>
                <button
                  type="button"
                  className={`${styles.chipAcao} ${styles.chipRemover}`}
                  onClick={() => void remover(c)}
                  aria-label={`Remover ${c}`}
                  title="Remover"
                >
                  <X size={14} aria-hidden />
                </button>
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
          <Seletor
            variante="inline"
            rotulo="Tipo"
            nivel={0}
            valor={novoTipo}
            opcoes={["credit", "debit"]}
            rotuloOpcao={(t) => (t === "credit" ? "Crédito" : "Débito")}
            aoMudar={(t) => setNovoTipo(t as TipoCartao)}
          />
          <button type="submit" className={styles.gerirBotao}>
            Adicionar
          </button>
        </div>
      </form>

      <div className={styles.cabecalhoLista}>
        <h3 className={styles.tituloSecao}>Transferências entre contas</h3>
        <button className={styles.botaoAdicionar} onClick={abrirNovaTransferencia}>
          <Plus size={15} aria-hidden /> Adicionar transferência
        </button>
      </div>

      <div className={styles.lista}>
        {erroTransferencias && doMes(transferencias, mes).length > 0 && (
          <ErroSincronizacao compacto />
        )}
        {erroTransferencias && doMes(transferencias, mes).length === 0 ? (
          <ErroSincronizacao />
        ) : doMes(transferencias, mes).length === 0 ? (
          <p className={styles.vazio}>Nenhuma transferência em {rotuloMes(mes)}.</p>
        ) : (
          ordenarPorDataDesc(doMes(transferencias, mes)).map((t) => (
            <div key={t.id} className={styles.item}>
              <button className={styles.itemCorpo} onClick={() => abrirEdicaoTransferencia(t)}>
                <span className={styles.itemTexto}>
                  <span className={styles.itemNome}>
                    {t.de} <ArrowLeftRight size={12} aria-hidden style={{ display: "inline" }} />{" "}
                    {t.para}
                  </span>
                  <span className={styles.itemDetalhe}>
                    {t.descricao ? `${t.descricao} · ` : ""}
                    {t.nota ? `${t.nota} · ` : ""}
                    {t.data.slice(8, 10)}/{t.data.slice(5, 7)}
                  </span>
                </span>
                <span className={styles.itemValor}>{formatMoney(t.valor, cfg.currency)}</span>
              </button>
            </div>
          ))
        )}
      </div>

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
                  setPagarData(hojeIso());
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
            <SeletorData valor={pagarData} aoMudar={setPagarData} />
            <Seletor rotulo="Sai de" valor={pagarDe} opcoes={contasDebito} aoMudar={setPagarDe} />
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

      <RenomearFolha
        aberta={renomeando !== null}
        nomeAtual={renomeando}
        aoFechar={() => setRenomeando(null)}
        aoConfirmar={(n) => void renomear(n)}
        aviso="Lançamentos, parcelas, saldo inicial e faturas seguem para o nome novo."
      />

      {/* Caixa única de transferência: cria e edita */}
      <BottomSheet
        aberta={tfAberta}
        aoFechar={() => setTfAberta(false)}
        titulo={tfEditandoId ? "Editar transferência" : "Nova transferência"}
      >
        <form className={styles.form} onSubmit={salvarTransferencia}>
          <label className={styles.campo}>
            Valor
            <input
              inputMode="decimal"
              placeholder="0,00"
              value={tfValor}
              onChange={(e) => setTfValor(e.target.value)}
              required
            />
          </label>
          <SeletorData valor={tfData} aoMudar={setTfData} />
          <div className={styles.linhaDupla}>
            <Seletor rotulo="De" valor={tfDe} opcoes={cfg.contasCartoes} aoMudar={setTfDe} />
            <Seletor rotulo="Para" valor={tfPara} opcoes={cfg.contasCartoes} aoMudar={setTfPara} />
          </div>
          <label className={styles.campo}>
            Nome (opcional)
            <input value={tfDescricao} onChange={(e) => setTfDescricao(e.target.value)} />
          </label>
          <label className={styles.campo}>
            Descrição (opcional)
            <input value={tfNota} onChange={(e) => setTfNota(e.target.value)} />
          </label>
          <button type="submit" className={styles.salvar}>
            {tfEditandoId ? "Salvar alterações" : "Registrar transferência"}
          </button>
          {tfEditandoId && (
            <button
              type="button"
              className={styles.excluir}
              onClick={() => void excluirTransferencia()}
            >
              Excluir transferência
            </button>
          )}
        </form>
      </BottomSheet>
    </Pagina>
  );
}

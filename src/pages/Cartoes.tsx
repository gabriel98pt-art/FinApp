import { useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowLeftRight, CreditCard, Pencil, Plus, Trash2, X } from "lucide-react";
import Pagina, { EstadoVazio, Kpis } from "../components/Pagina";
import KpiCard from "../components/KpiCard";
import BottomSheet from "../components/BottomSheet";
import CampoMoeda from "../components/CampoMoeda";
import CampoValorDestaque from "../components/CampoValorDestaque";
import ErroSincronizacao from "../components/ErroSincronizacao";
import MenuAcoesItem, { type AcaoItem } from "../components/MenuAcoesItem";
import Seletor from "../components/Seletor";
import SeletorData from "../components/SeletorData";
import { definirFaturaManual, definirSaldoInicial } from "../services/cfgService";
import { pagarFatura, removerPagamentoFatura, reabrirFatura } from "../services/faturaService";
import {
  atualizarTransferencia,
  criarTransferencia,
  removerTransferencia,
} from "../services/lancamentosService";
import { useConfirmar } from "../hooks/useConfirmar";
import { useUidSessao } from "../hooks/useUidSessao";
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
import type {
  Cents,
  Currency,
  DespesaCorrente,
  FaturaCalculada,
  Id,
  Parcela,
  Transferencia,
  YearMonth,
} from "../types";
import {
  doMes,
  hojeIso,
  mesAtual,
  ordenarPorDataDesc,
  rotuloMes,
  somarMeses,
} from "../utils/calculos";
import {
  calcularFatura,
  cicloDaFatura,
  montarDadosFatura,
  pagamentosDaFatura,
} from "../utils/fatura";
import {
  resumosDasContas,
  saldoInicialParaAlvo,
  type DadosContas,
  type ResumoConta,
} from "../utils/contas";
import { formatMoney } from "../utils/money";
import { debitoDaMesmaInstituicao, nomeAtualDoMetodo } from "../utils/instituicoes";
import styles from "./Cartoes.module.css";
import Botao from "../components/Botao";

/** Controles de fatura do cartão de crédito — agora vivem DENTRO da folha de
 *  detalhes da conta (item 13), não mais como quadro solto na tela. */
function ControlesFatura({
  fatura,
  parcelas,
  despesas,
  aoPagar,
  aoAjustar,
}: {
  fatura: FaturaCalculada;
  parcelas: Parcela[];
  despesas: DespesaCorrente[];
  aoPagar: () => void;
  aoAjustar: () => void;
}) {
  const uid = useUidSessao();
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
          <p className={styles.rotuloValor}>A pagar</p>
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
                {p.de ? ` · ${nomeAtualDoMetodo(cfg, p.de)}` : ""}
              </span>
              <span className={styles.pagamentoValor}>
                {formatMoney(p.valor, cfg.currency)}
                <button
                  className={styles.remover}
                  onClick={() => {
                    void (async () => {
                      if (!(await confirmar("Remover este pagamento?"))) return;
                      await removerPagamentoFatura(
                        uid,
                        fatura.cartao,
                        fatura.mes,
                        p,
                        calcularPagamentos(fatura),
                        fatura.devido,
                        parcelas,
                        despesas,
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
          <Botao variante="primaria" onClick={aoPagar}>
            Pagar
          </Botao>
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
                await reabrirFatura(
                  uid,
                  fatura.cartao,
                  fatura.mes,
                  calcularPagamentos(fatura),
                  parcelas,
                  despesas,
                )
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

/** As duas leituras de um quadro de conta, já na ordem certa de leitura.
 *
 *  A manchete é sempre a POSIÇÃO REAL — quanto a conta tem (débito) ou quanto
 *  se deve mesmo agora (crédito) —, e o movimento do período fica em segundo
 *  plano. Estava ao contrário: o quadro da Conta Principal punha em destaque o
 *  gasto do mês (ex. "€ -57,00") e escondia o saldo de "€ 4.657,00" numa linha
 *  cinzenta, o que faz uma conta com quatro mil euros parecer negativa.
 *
 *  E cada número passa a dizer de que janela de tempo é. Um cartão de crédito
 *  tem duas faturas vivas ao mesmo tempo e elas nunca batem certo: a do mês
 *  exibido (ciclo do mês anterior, já fechada — é a que se paga agora) e a do
 *  mês seguinte, que os gastos do mês exibido ainda estão a formar. Sem rótulo,
 *  eram dois números soltos a competir pelo mesmo nome de "fatura". */
function leiturasDoQuadro(
  r: ResumoConta,
  fatura: FaturaCalculada | null,
  faturaSeguinte: FaturaCalculada | null,
  mes: YearMonth,
  moeda: Currency,
): { rotulo: string; valor: string; tom: string; secundario: string } {
  const proximo = somarMeses(mes, 1);

  if (r.tipo === "credit") {
    const devido = fatura?.devido ?? 0;
    const restante = fatura?.restante ?? 0;
    // "Em formação" só enquanto o ciclo não fechou: olhando para um mês
    // passado, a fatura seguinte já está fechada há muito.
    const emFormacao = mes >= mesAtual();
    return {
      rotulo:
        devido > 0 && restante === 0
          ? `Fatura de ${rotuloMes(mes)} · paga`
          : `Fatura de ${rotuloMes(mes)} · a pagar`,
      valor: formatMoney(restante, moeda),
      tom: restante > 0 ? styles.amarelo : styles.verde,
      secundario: `Fatura de ${rotuloMes(proximo)}${emFormacao ? " (em formação)" : ""}: ${formatMoney(
        faturaSeguinte?.devido ?? 0,
        moeda,
      )}`,
    };
  }

  return {
    rotulo: "Saldo atual",
    valor: formatMoney(r.saldoAtual, moeda),
    // Positivo fica no cinza normal do texto: quem precisa de aviso é o saldo
    // negativo, não o que está em ordem.
    tom: r.saldoAtual < 0 ? styles.vermelho : "",
    secundario:
      r.gastoMes > 0
        ? `Gasto em ${rotuloMes(mes)}: ${formatMoney(r.gastoMes, moeda)}`
        : r.gastoMes < 0
          ? // Gasto negativo é dinheiro que voltou (reembolso, estorno) — chamar
            // isso de "gasto de −57,00" era pedir para ser lido como dívida.
            `Devolvido em ${rotuloMes(mes)}: ${formatMoney(-r.gastoMes, moeda)}`
          : `Sem gastos em ${rotuloMes(mes)}`,
  };
}

/** Uma linha de transferência — item 2 do lote de UX/nav (30/08): a linha
 *  inteira abre o menu único (Editar/Excluir), em vez de ir direto pro
 *  formulário. */
function LinhaTransferencia({
  t,
  moeda,
  nomeDe,
  aoEditar,
  aoExcluir,
}: {
  t: Transferencia;
  moeda: Currency;
  nomeDe: (id: string) => string;
  aoEditar: (t: Transferencia) => void;
  aoExcluir: (t: Transferencia) => void;
}) {
  const [menuAberto, setMenuAberto] = useState(false);
  const ancoraRef = useRef<HTMLButtonElement>(null);

  const acoes: AcaoItem[] = [
    { rotulo: "Editar", Icone: Pencil, onClick: () => aoEditar(t) },
    { rotulo: "Excluir", Icone: Trash2, onClick: () => aoExcluir(t), tone: "perigo" },
  ];

  const nome = `${nomeDe(t.de)} → ${nomeDe(t.para)}`;

  return (
    <div className={styles.item}>
      <button
        ref={ancoraRef}
        className={styles.itemCorpo}
        onClick={() => setMenuAberto(true)}
        aria-haspopup="dialog"
      >
        <span className={styles.itemTexto}>
          <span className={styles.itemNome}>
            {nomeDe(t.de)} <ArrowLeftRight size={12} aria-hidden style={{ display: "inline" }} />{" "}
            {nomeDe(t.para)}
          </span>
          <span className={styles.itemDetalhe}>
            {t.descricao ? `${t.descricao} · ` : ""}
            {t.nota ? `${t.nota} · ` : ""}
            {t.data.slice(8, 10)}/{t.data.slice(5, 7)}
          </span>
        </span>
        <span className={styles.itemValor}>{formatMoney(t.valor, moeda)}</span>
      </button>
      <MenuAcoesItem
        aberta={menuAberto}
        aoFechar={() => setMenuAberto(false)}
        titulo={nome}
        ancoraRef={ancoraRef}
        acoes={acoes}
      />
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
  const uid = useUidSessao();
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

  // O que anda por todo o lado nesta tela (chips, quadros, títulos de folha,
  // pontas de uma transferência) é o ID da conta, que é estável e não muda
  // quando se renomeia. Quem MOSTRA tem de resolver o nome de hoje — senão um
  // rename só se via aqui... e nem aqui.
  const nomeDe = (id: string) => nomeAtualDoMetodo(cfg, id);

  // O valor das faturas e os quatro KPIs saem de seis domínios, transferências
  // incluídas: `montarDadosFatura`/`dadosContas` somam `transferencias` em
  // "Devido no mês", "Restante" e "Saldo em contas" (ver utils/fatura.ts e
  // utils/contas.ts). O banner de `erroTransferencias` mais abaixo só cobre a
  // lista de transferências — sem transferências aqui, um erro de sync desse
  // domínio deixava os KPIs do topo errados em silêncio, o mesmo problema que
  // Início já teve.
  const erroValores = [
    useDespesasStore((s) => s.erro),
    useDespesasFixasStore((s) => s.erro),
    useParcelasStore((s) => s.erro),
    useVeiculoStore((s) => s.erro),
    useReceitasStore((s) => s.erro),
    erroTransferencias,
  ].some(Boolean);

  const mes = useMesVisivelStore((s) => s.mes);
  // Era `doMes(transferencias, mes)` repetido quatro vezes no mesmo render —
  // a mesma varredura da lista feita quatro vezes para responder à mesma
  // pergunta.
  const transferenciasDoMes = doMes(transferencias, mes);
  const [contaAberta, setContaAberta] = useState<string | null>(null);
  const [pagando, setPagando] = useState<FaturaCalculada | null>(null);
  const [ajustando, setAjustando] = useState<FaturaCalculada | null>(null);
  // Ajuste do saldo de uma conta de débito. Guarda o resumo COMO ESTAVA quando
  // a folha abriu, junto com o saldo inicial de então: é sobre esses números
  // que a conta inversa é feita, e não sobre um resumo que entretanto mudou
  // (a folha da conta já fechou quando esta abre).
  const [ajustandoSaldo, setAjustandoSaldo] = useState<{
    resumo: ResumoConta;
    saldoInicial: Cents;
  } | null>(null);
  const [valorTexto, setValorTexto] = useState<Cents | null>(null);
  const [pagarDe, setPagarDe] = useState("");
  // Dia em que a fatura foi mesmo paga. Começa em hoje — quem regista no
  // próprio dia não mexe nisto —, mas quem está a acertar pagamentos passados
  // consegue pôr a data certa em vez de os amontoar todos no dia de hoje.
  const [pagarData, setPagarData] = useState(hojeIso());

  // ---- caixa de transferência (criar/editar) ----
  // Vive aqui, e não em Despesas, porque transferir é mover dinheiro ENTRE as
  // contas e cartões desta tela — não é uma despesa. Estava escondida numa aba
  // de Despesas, onde ninguém a encontrava.
  const [tfAberta, setTfAberta] = useState(false);
  const [tfEditandoId, setTfEditandoId] = useState<Id | null>(null);
  const [tfData, setTfData] = useState(hojeIso());
  const [tfDe, setTfDe] = useState("");
  const [tfPara, setTfPara] = useState("");
  const [tfValor, setTfValor] = useState<Cents | null>(null);
  // Um só campo de texto livre (01/09/2026): a folha tinha "Nome (opcional)"
  // e "Descrição (opcional)" lado a lado, dois campos para a mesma coisa, e
  // ninguém sabia em qual escrever. Segue o Registro Rápido, que já unificou
  // Nome + Nota num "Descrição" único (item 4 do lote de UX/nav, 30/08).
  const [tfDescricao, setTfDescricao] = useState("");

  // useMemo (achado da auditoria de Performance): a tela tem 9 useState de
  // formulário local (renomear, adicionar cartão, pagar fatura, transferência)
  // — sem isto, digitar uma letra em qualquer um recalculava a fatura de TODOS
  // os cartões duas vezes (mês atual + seguinte), além de a cada onValue do
  // RTDB em qualquer domínio, mesmo sem relação com cartões.
  const dados = useMemo(
    () =>
      montarDadosFatura({ despesas, despesasFixas, transferencias, parcelas, veiculo, receitas }),
    [despesas, despesasFixas, transferencias, parcelas, veiculo, receitas],
  );

  const dadosContas: DadosContas = useMemo(
    () => ({
      receitas,
      despesasCorrentes: despesas,
      despesasFixas,
      despesasFixasVeiculo: veiculo.despesasFixas,
      transferencias,
      cargas: veiculo.cargas,
      despesasVeiculo: veiculo.despesas,
    }),
    [receitas, despesas, despesasFixas, veiculo, transferencias],
  );

  const cartoesCredito = useMemo(
    () => cfg.contasCartoes.filter((c) => cfg.tipoCartao[c] === "credit"),
    [cfg],
  );
  const contasDebito = useMemo(
    () => cfg.contasCartoes.filter((c) => cfg.tipoCartao[c] !== "credit"),
    [cfg],
  );
  const faturas = useMemo(
    () => cartoesCredito.map((c) => calcularFatura(c, mes, dados, cfg)),
    [cartoesCredito, mes, dados, cfg],
  );
  // A fatura do mês SEGUINTE é a que o ciclo do mês exibido está a formar
  // (ver `cicloDaFatura`): é ela que dá sentido aos gastos lançados agora no
  // cartão, e é o número que o sino do header mostra quando o mês exibido é o
  // corrente. Sem ela, o quadro do cartão mostrava o "gasto do mês" da conta —
  // que nem sequer inclui as parcelas em débito automático que vão cair nessa
  // mesma fatura, e por isso nunca batia com nada.
  const mesSeguinte = somarMeses(mes, 1);
  const faturasSeguintes = useMemo(
    () => cartoesCredito.map((c) => calcularFatura(c, mesSeguinte, dados, cfg)),
    [cartoesCredito, mesSeguinte, dados, cfg],
  );
  const resumos = useMemo(
    () => resumosDasContas(dadosContas, cfg, mes, hojeIso()),
    [dadosContas, cfg, mes],
  );
  const resumoAberto = resumos.find((r) => r.conta === contaAberta) ?? null;
  const faturaAberta =
    resumoAberto?.tipo === "credit"
      ? (faturas.find((f) => f.cartao === resumoAberto.conta) ?? null)
      : null;
  const faturaSeguinteAberta =
    resumoAberto?.tipo === "credit"
      ? (faturasSeguintes.find((f) => f.cartao === resumoAberto.conta) ?? null)
      : null;
  const totalDevido = faturas.reduce((s, f) => s + f.devido, 0);
  const totalPago = faturas.reduce((s, f) => s + f.pago, 0);
  const totalRestante = faturas.reduce((s, f) => s + f.restante, 0);
  // Soma do saldo de caixa das contas de débito — cartões de crédito não têm
  // saldo próprio, só fatura (já coberta por Devido/Pago/Restante acima).
  const saldoEmContas = resumos
    .filter((r) => r.tipo !== "credit")
    .reduce((s, r) => s + r.saldoAtual, 0);

  function abrirNovaTransferencia() {
    setTfEditandoId(null);
    setTfData(hojeIso());
    setTfDe("");
    setTfPara("");
    setTfValor(null);
    setTfDescricao("");
    setTfAberta(true);
  }

  function abrirEdicaoTransferencia(t: Transferencia) {
    setTfEditandoId(t.id);
    setTfData(t.data);
    setTfDe(t.de);
    setTfPara(t.para);
    setTfValor(t.valor);
    // Transferência antiga com os dois campos preenchidos: junta-os no campo
    // único em vez de esconder a `nota` num campo que já não existe — assim
    // ela continua editável, e o registo migra sozinho ao ser guardado.
    setTfDescricao([t.descricao, t.nota].filter(Boolean).join(" — "));
    setTfAberta(true);
  }

  async function salvarTransferencia(e: FormEvent) {
    e.preventDefault();
    const valor = tfValor;
    if (valor === null || valor <= 0) return mostrarToast("Valor inválido.");
    if (!tfDe || !tfPara) return mostrarToast("Escolha origem e destino.");
    if (tfDe === tfPara) return mostrarToast("Origem e destino não podem ser iguais.");
    const dados = {
      data: tfData,
      de: tfDe,
      para: tfPara,
      valor,
      descricao: tfDescricao.trim() || undefined,
      // O campo único grava só em `descricao`. `undefined` limpa a `nota` do
      // registo antigo (o serviço grava com `set` e descarta indefinidos), o
      // que é o que se quer: o texto dela já veio junto no campo acima.
      nota: undefined,
    };
    try {
      if (tfEditandoId) {
        await atualizarTransferencia(uid, { ...dados, id: tfEditandoId });
        mostrarToast("✓ Transferência atualizada");
      } else {
        await criarTransferencia(uid, dados);
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
      await removerTransferencia(uid, id);
      mostrarToast("Transferência excluída");
    } catch {
      mostrarToast("Não foi possível concluir. Tente de novo.");
    }
  }

  // Item 2 do lote de UX/nav: Excluir vira ação do menu único da linha.
  async function excluirTransferenciaDaLista(t: Transferencia) {
    if (!(await confirmar("Excluir esta transferência?"))) return;
    try {
      await removerTransferencia(uid, t.id);
      mostrarToast("Transferência excluída");
    } catch {
      mostrarToast("Não foi possível concluir. Tente de novo.");
    }
  }

  async function submeterPagamento(e: FormEvent) {
    e.preventDefault();
    if (!pagando) return;
    const valor = valorTexto;
    if (valor === null || valor <= 0) return mostrarToast("Valor inválido.");
    if (!pagarDe) return mostrarToast("Escolha de onde sai o dinheiro.");
    try {
      await pagarFatura(uid, {
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
    // Vazio repõe o cálculo automático — é o que este campo quer dizer.
    const valor = valorTexto;
    try {
      await definirFaturaManual(uid, ajustando.cartao, ajustando.mes, valor);
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

  async function submeterSaldo(e: FormEvent) {
    e.preventDefault();
    if (!ajustandoSaldo) return;
    const alvo = valorTexto;
    if (alvo === null) return mostrarToast("Informe o saldo da conta.");
    const { resumo, saldoInicial } = ajustandoSaldo;
    try {
      // O usuário diz quanto a conta tem hoje; o que se guarda é de onde ela
      // teve de partir para lá chegar com os movimentos já lançados.
      await definirSaldoInicial(
        uid,
        resumo.conta,
        saldoInicialParaAlvo(resumo, saldoInicial, alvo),
      );
      mostrarToast("✓ Saldo ajustado");
      setAjustandoSaldo(null);
    } catch {
      mostrarToast("Não foi possível ajustar.");
    }
  }

  return (
    <Pagina titulo="Cartões">
      <Kpis pagina="cartoes">
        {/* O rótulo sozinho deixa supor que é o que se gastou no mês; é a
            fatura DESTE mês, que cobra o ciclo do mês anterior. */}
        <KpiCard
          rotulo="A pagar este mês"
          // A escolha de KPIs em Definições é guardada por este texto: mudar
          // só o rótulo visível deixaria de casar com quem já escolheu este
          // cartão, e a página cairia nos 2 primeiros. `chave` mantém o nome
          // antigo do lado dos dados, onde ninguém o lê.
          chave="Devido no mês"
          valor={formatMoney(totalDevido, cfg.currency)}
          sub={`ciclo de ${rotuloMes(cicloDaFatura(mes))}`}
          tom="acento"
        />
        <KpiCard rotulo="Pago" valor={formatMoney(totalPago, cfg.currency)} tom="verde" />
        <KpiCard rotulo="Restante" valor={formatMoney(totalRestante, cfg.currency)} tom="amarelo" />
        <KpiCard
          rotulo="Saldo em contas"
          valor={formatMoney(saldoEmContas, cfg.currency)}
          // Era "laranja" — a cor do TVDE (--lrj), que por design não é uma
          // das 5 personalizáveis em Definições. "Saldo em contas" não tem
          // nada a ver com TVDE; "acento" combina com "A pagar este mês" ao
          // lado, outro total informativo (achado da auditoria de Design).
          tom="acento"
        />
      </Kpis>

      {/* Compacta: os cartões e as faturas continuam a valer e a ser úteis —
          o que se perdeu foi a garantia de que os valores estão completos. */}
      {erroValores && <ErroSincronizacao compacto mensagem="Alguns valores não sincronizaram" />}

      {cfgCarregada && cfg.contasCartoes.length === 0 ? (
        <EstadoVazio
          Icone={CreditCard}
          mensagem="Nenhuma conta ou cartão"
          // "Adicione abaixo" deixou de ser verdade em 01/09: a lista e o
          // formulário saíram desta tela e a instrução tem de dizer para onde.
          sub="Crie a primeira em Definições → Contas e cartões."
        />
      ) : (
        <div className={styles.grade}>
          {resumos.map((r) => {
            const leituras = leiturasDoQuadro(
              r,
              faturas.find((f) => f.cartao === r.conta) ?? null,
              faturasSeguintes.find((f) => f.cartao === r.conta) ?? null,
              mes,
              cfg.currency,
            );
            return (
              <button
                key={r.conta}
                className={styles.quadro}
                onClick={() => setContaAberta(r.conta)}
              >
                <span className={styles.quadroTopo}>
                  <span className={styles.nome}>{nomeDe(r.conta)}</span>
                  <span className={styles.tipoBadge}>
                    {r.tipo === "credit" ? "crédito" : "débito"}
                  </span>
                </span>
                {/* Manchete: o saldo da conta, ou o que falta pagar da fatura
                    já fechada. O rótulo vem ANTES do número — sem ele, um
                    valor de cartão não diz de que fatura é. */}
                <span className={styles.quadroRotulo}>{leituras.rotulo}</span>
                <span className={`${styles.quadroValor} ${leituras.tom}`}>{leituras.valor}</span>
                {/* Segunda leitura, de propósito mais pequena: o movimento do
                    período, que ainda não é uma obrigação a pagar. */}
                <span className={styles.quadroEstado}>{leituras.secundario}</span>
                <span className={styles.quadroNota}>
                  {r.transacoesMes} {r.transacoesMes === 1 ? "transação" : "transações"} em{" "}
                  {rotuloMes(mes)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className={styles.cabecalhoLista}>
        <h3 className={styles.tituloSecao}>Transferências entre contas</h3>
        <Botao variante="primaria" onClick={abrirNovaTransferencia}>
          <Plus size={15} aria-hidden /> Adicionar transferência
        </Botao>
      </div>

      <div className={styles.lista}>
        {erroTransferencias && transferenciasDoMes.length > 0 && <ErroSincronizacao compacto />}
        {erroTransferencias && transferenciasDoMes.length === 0 ? (
          <ErroSincronizacao />
        ) : transferenciasDoMes.length === 0 ? (
          // Era um <p> à parte; o resto do app usa o EstadoVazio para listas
          // reais sem dados. Mesmo alinhamento feito no vazio das fixas.
          <EstadoVazio
            Icone={ArrowLeftRight}
            mensagem={`Nenhuma transferência em ${rotuloMes(mes)}`}
            sub="Mova dinheiro entre contas com o botão Adicionar transferência."
          />
        ) : (
          ordenarPorDataDesc(transferenciasDoMes).map((t) => (
            <LinhaTransferencia
              key={t.id}
              t={t}
              moeda={cfg.currency}
              nomeDe={nomeDe}
              aoEditar={abrirEdicaoTransferencia}
              aoExcluir={(item) => void excluirTransferenciaDaLista(item)}
            />
          ))
        )}
      </div>

      <BottomSheet
        aberta={contaAberta !== null}
        aoFechar={() => setContaAberta(null)}
        titulo={contaAberta ? nomeDe(contaAberta) : ""}
      >
        {resumoAberto && (
          <div className={styles.detalhes}>
            <div className={styles.linhaDetalhe}>
              <span>Tipo</span>
              <strong>{resumoAberto.tipo === "credit" ? "Crédito" : "Débito"}</strong>
            </div>
            {/* "Fatura até agora" dizia o contrário do que mostrava: o valor é
                o da fatura do mês exibido, que cobra o ciclo JÁ FECHADO do mês
                anterior — nada do que se gastou "até agora" entra nele. O que
                está a acontecer agora é a fatura do mês seguinte, na linha a
                seguir. */}
            <div className={styles.linhaDetalhe}>
              <span>
                {resumoAberto.tipo === "credit" ? `Fatura de ${rotuloMes(mes)}` : "Saldo atual"}
              </span>
              <strong>
                {formatMoney(
                  resumoAberto.tipo === "credit"
                    ? (faturaAberta?.devido ?? 0)
                    : resumoAberto.saldoAtual,
                  cfg.currency,
                )}
              </strong>
            </div>
            {resumoAberto.tipo === "credit" && (
              <div className={styles.linhaDetalhe}>
                <span>
                  Fatura de {rotuloMes(mesSeguinte)}
                  {mes >= mesAtual() ? " (em formação)" : ""}
                </span>
                <strong>{formatMoney(faturaSeguinteAberta?.devido ?? 0, cfg.currency)}</strong>
              </div>
            )}
            <div className={styles.linhaDetalhe}>
              <span>Despesas em {rotuloMes(mes)}</span>
              <strong>{resumoAberto.despesasMes}</strong>
            </div>
            <div className={styles.linhaDetalhe}>
              <span>Receitas em {rotuloMes(mes)}</span>
              <strong>{resumoAberto.receitasMes}</strong>
            </div>

            {/* Débito não tem fatura para ajustar, mas tem o saldo — e era o
                único número da tela que não havia como corrigir sem ir mexer
                nos lançamentos um a um. */}
            {resumoAberto.tipo !== "credit" && (
              <div className={styles.acoes}>
                <button
                  className={styles.acao}
                  onClick={() => {
                    setValorTexto(resumoAberto.saldoAtual);
                    setContaAberta(null);
                    setAjustandoSaldo({
                      resumo: resumoAberto,
                      saldoInicial: cfg.saldosIniciais?.[resumoAberto.conta] ?? 0,
                    });
                  }}
                >
                  Ajustar saldo
                </button>
              </div>
            )}

            {faturaAberta && (
              <ControlesFatura
                fatura={faturaAberta}
                parcelas={parcelas}
                despesas={despesas}
                aoPagar={() => {
                  setValorTexto(faturaAberta.restante);
                  // Sugere o débito do MESMO banco do cartão, quando existir
                  // (Fase C4) — cai para a primeira conta de débito da lista
                  // quando não há (comportamento de sempre).
                  setPagarDe(
                    debitoDaMesmaInstituicao(cfg, faturaAberta.cartao) ?? contasDebito[0] ?? "",
                  );
                  setPagarData(hojeIso());
                  setContaAberta(null);
                  setPagando(faturaAberta);
                }}
                aoAjustar={() => {
                  setValorTexto(faturaAberta.overrideManual);
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
        titulo={
          pagando ? `Pagar fatura — ${nomeDe(pagando.cartao)} · ${rotuloMes(pagando.mes)}` : ""
        }
      >
        {pagando && (
          <form className={styles.form} onSubmit={submeterPagamento}>
            <p className={styles.resumoPagar}>
              A pagar {formatMoney(pagando.devido, cfg.currency)} · Pago{" "}
              {formatMoney(pagando.pago, cfg.currency)} · Restante{" "}
              {formatMoney(pagando.restante, cfg.currency)}
            </p>
            <label className={styles.campo}>
              Valor (€) — pode ser parcial
              <CampoMoeda valor={valorTexto} aoMudar={setValorTexto} required />
            </label>
            <SeletorData valor={pagarData} aoMudar={setPagarData} />
            <Seletor
              rotulo="Sai de"
              valor={pagarDe}
              opcoes={contasDebito}
              rotuloOpcao={nomeDe}
              aoMudar={setPagarDe}
            />
            {contasDebito.length === 0 && (
              <p className={styles.aviso}>Adicione primeiro uma conta/cartão de débito.</p>
            )}
            <Botao type="submit" variante="submeter" disabled={contasDebito.length === 0}>
              Registrar pagamento
            </Botao>
          </form>
        )}
      </BottomSheet>

      <BottomSheet
        aberta={ajustando !== null}
        aoFechar={() => setAjustando(null)}
        titulo={
          ajustando ? `Fatura — ${nomeDe(ajustando.cartao)} · ${rotuloMes(ajustando.mes)}` : ""
        }
      >
        {ajustando && (
          <form className={styles.form} onSubmit={submeterAjuste}>
            <p className={styles.resumoPagar}>
              Cálculo automático: {formatMoney(ajustando.devidoAutomatico, cfg.currency)}
            </p>
            <label className={styles.campo}>
              Valor manual (€) — vazio volta ao automático
              <CampoMoeda valor={valorTexto} aoMudar={setValorTexto} placeholder="automático" />
            </label>
            <Botao type="submit" variante="submeter">
              Salvar
            </Botao>
          </form>
        )}
      </BottomSheet>

      <BottomSheet
        aberta={ajustandoSaldo !== null}
        aoFechar={() => setAjustandoSaldo(null)}
        titulo={ajustandoSaldo ? `Saldo — ${nomeDe(ajustandoSaldo.resumo.conta)}` : ""}
      >
        {ajustandoSaldo && (
          <form className={styles.form} onSubmit={submeterSaldo}>
            <p className={styles.resumoPagar}>
              Calculado agora: {formatMoney(ajustandoSaldo.resumo.saldoAtual, cfg.currency)}
            </p>
            <label className={styles.campo}>
              Saldo que a conta tem hoje (€)
              <CampoMoeda valor={valorTexto} aoMudar={setValorTexto} required />
            </label>
            {/* Nota, não aviso: nada aqui corre mal, só se explica o que a
                gravação faz por baixo. */}
            <p className={styles.resumoPagar}>
              Os lançamentos não mudam — o que se acerta é o ponto de partida da conta, para o saldo
              bater com o do banco.
            </p>
            <Botao type="submit" variante="submeter">
              Salvar
            </Botao>
          </form>
        )}
      </BottomSheet>

      {/* Caixa única de transferência: cria e edita */}
      <BottomSheet
        aberta={tfAberta}
        aoFechar={() => setTfAberta(false)}
        titulo={tfEditandoId ? "Editar transferência" : "Nova transferência"}
      >
        <form className={styles.form} onSubmit={salvarTransferencia}>
          {/* Valor em destaque, e em primeiro: o mesmo padrão do Registro
              Rápido (CampoValorDestaque) — quanto se move é a decisão que se
              toma primeiro, o resto só descreve o movimento. */}
          <CampoValorDestaque valor={tfValor} aoMudar={setTfValor} required />
          <SeletorData valor={tfData} aoMudar={setTfData} />
          <div className={styles.linhaDupla}>
            <Seletor
              rotulo="De"
              valor={tfDe}
              opcoes={cfg.contasCartoes}
              rotuloOpcao={nomeDe}
              aoMudar={setTfDe}
            />
            <Seletor
              rotulo="Para"
              valor={tfPara}
              opcoes={cfg.contasCartoes}
              rotuloOpcao={nomeDe}
              aoMudar={setTfPara}
            />
          </div>
          <label className={styles.campo}>
            Descrição (opcional)
            <input
              value={tfDescricao}
              onChange={(e) => setTfDescricao(e.target.value)}
              maxLength={120}
            />
          </label>
          <Botao type="submit" variante="submeter">
            {tfEditandoId ? "Salvar alterações" : "Registrar transferência"}
          </Botao>
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

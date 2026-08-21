import { useRef, useState, type FormEvent } from "react";
import { Sparkles } from "lucide-react";
import {
  useDespesasFixasStore,
  useDespesasStore,
  useReceitasStore,
  useTransferenciasStore,
} from "../stores/lancamentosStore";
import { useEventosStore } from "../stores/eventosStore";
import { useFundosStore } from "../stores/fundosStore";
import { useParcelasStore } from "../stores/parcelasStore";
import { useVeiculoStore } from "../stores/veiculoStore";
import { useAuthStore } from "../stores/authStore";
import { useCfgStore } from "../stores/cfgStore";
import { useMesVisivelStore } from "../stores/mesVisivelStore";
import { despesasNosTotais, hojeIso, mesAtual, receitasNosTotais } from "../utils/calculos";
import { responderPergunta, RESPOSTA_PADRAO } from "../utils/copiloto";
import {
  acaoDoPlano,
  responderCenarios,
  responderPlano,
  type AcaoPlano,
} from "../utils/copilotoPlano";
import { responderComIA } from "../services/copilotoIA";
import { contribuirFundo } from "../services/fundosService";
import { confirmarAcao } from "../stores/confirmarStore";
import { mostrarToast } from "../stores/toastStore";
import { formatMoney } from "../utils/money";
import styles from "./CopilotoCard.module.css";

const SUGESTOES = [
  "resumo do mês",
  "o que está pesando?",
  "estou dentro do orçamento?",
  "qual meu saldo?",
  "o que eu devo fazer?",
];

/** Copiloto (seção 3.9): pergunta em linguagem natural, em duas camadas.
 *
 *  A camada 1 responde localmente, na hora e sem rede — é ela que trata de
 *  tudo o que a app sabe calcular: números do passado (`responderPergunta`),
 *  o passo mais urgente do plano (`responderPlano`) e os três cenários de
 *  poupança do mês (`responderCenarios`). Só quando nenhuma delas souber
 *  responder é que a camada 2 (IA) entra, e mesmo essa nunca produz um
 *  número: recebe o resumo já calculado e limita-se a escrevê-lo. */
export default function CopilotoCard() {
  const receitas = receitasNosTotais(useReceitasStore((s) => s.itens));
  const despesas = despesasNosTotais(useDespesasStore((s) => s.itens));
  const parcelas = useParcelasStore((s) => s.itens);
  const veiculo = useVeiculoStore((s) => s.dados);
  const despesasFixas = useDespesasFixasStore((s) => s.itens);
  const transferencias = useTransferenciasStore((s) => s.itens);
  const eventos = useEventosStore((s) => s.itens);
  const fundos = useFundosStore((s) => s.itens);
  const cfg = useCfgStore((s) => s.cfg);
  const sessao = useAuthStore((s) => s.sessao);
  const mesVisivel = useMesVisivelStore((s) => s.mes);

  const [pergunta, setPergunta] = useState("");
  const [resposta, setResposta] = useState<string | null>(null);
  const [aPensar, setAPensar] = useState(false);
  // Só preenchido quando a resposta em cima veio de `responderPlano` E o
  // passo mais urgente tinha uma ação executável por trás (ver
  // `acaoDoPlano`). Some sempre que uma pergunta nova é feita ou executada
  // com sucesso — nunca fica pendurado a apontar para uma resposta antiga.
  const [acaoPendente, setAcaoPendente] = useState<AcaoPlano | null>(null);
  const [aExecutar, setAExecutar] = useState(false);
  // Roda o fraseado a cada pergunta, para a mesma pergunta duas vezes seguidas
  // não devolver a frase idêntica. Vive na sessão: recarregar a página começa
  // outra vez pela frase de sempre, o que é o comportamento certo por omissão.
  const [variante, setVariante] = useState(0);
  // Identifica a pergunta em curso. Sem isto, uma resposta lenta da camada 2
  // podia aterrar por cima de uma pergunta mais recente já respondida.
  const pedidoAtual = useRef(0);

  async function perguntar(q: string) {
    if (!q.trim()) return;
    const pedido = ++pedidoAtual.current;
    const hoje = hojeIso();
    const ctx = {
      variante,
      receitas,
      despesas,
      parcelas,
      veiculo,
      despesasFixas,
      transferencias,
      eventos,
      fundos,
      cfg,
      mesReal: mesAtual(),
      // O Copiloto vive no Início, que mostra o mês do seletor do header — as
      // respostas têm de falar DESSE mês, senão o cartão respondia sobre
      // agosto com julho escolhido logo acima dele.
      mesVisivel,
      diaDeHoje: parseInt(hoje.slice(8, 10), 10),
    };
    setVariante((v) => v + 1);
    // Uma pergunta nova invalida qualquer ação pendente da anterior — só a
    // resposta que está prestes a ser calculada pode reabri-la.
    setAcaoPendente(null);

    // Camada 1: local e imediata. Se soube responder, acabou aqui — nunca se
    // paga uma ida à rede por uma resposta que a app já tem.
    const local = responderPergunta(q, ctx);
    if (local !== RESPOSTA_PADRAO) {
      setAPensar(false);
      setResposta(local);
      return;
    }

    // Ainda camada 1: "o que eu devo fazer?" não é uma pergunta sobre um
    // número do passado, é sobre o passo mais urgente do plano. Zero rede
    // também, só que o motor vive noutro módulo (ver a nota em
    // `responderPlano`).
    const doPlano = responderPlano(q, ctx);
    if (doPlano !== null) {
      setAPensar(false);
      setResposta(doPlano);
      // O mesmo passo pode trazer uma ação executável (hoje só
      // "contribuirFundo") — ver a nota em `acaoDoPlano`.
      setAcaoPendente(acaoDoPlano(q, ctx));
      return;
    }

    // Ainda camada 1: os três cenários de poupança do mês (conservador/
    // equilibrado/acelerar), verificados depois do plano para não roubar as
    // perguntas que já eram dele. Ver a nota em `responderCenarios`.
    const doCenarios = responderCenarios(q, ctx);
    if (doCenarios !== null) {
      setAPensar(false);
      setResposta(doCenarios);
      return;
    }

    // Camada 2: só para o que a camada 1 não soube. O "Ainda não sei responder
    // a isso" deixou de chegar sozinho ao ecrã.
    setAPensar(true);
    setResposta(null);
    const daIA = await responderComIA(q, ctx, sessao?.uid, hoje);
    if (pedidoAtual.current !== pedido) return;
    setAPensar(false);
    setResposta(daIA);
  }

  /** Executa a ação pendente, sempre com confirmação explícita antes — nunca
   *  a partir só de uma pergunta em texto livre. Hoje só existe
   *  "contribuirFundo"; o `tipo` fica pronto para outras ações que o plano
   *  venha a ganhar. */
  async function executarAcao() {
    if (!acaoPendente || aExecutar) return;
    const uid = sessao?.uid;
    const fundo = fundos.find((f) => f.id === acaoPendente.fundoId);
    if (!uid || !fundo) return;

    const moeda = cfg.currency;
    const ok = await confirmarAcao(
      `Separar ${formatMoney(acaoPendente.valor, moeda)} para ${acaoPendente.nomeFundo}?`,
    );
    if (!ok) return;

    setAExecutar(true);
    try {
      await contribuirFundo(uid, fundo, acaoPendente.valor);
      mostrarToast(`✓ ${formatMoney(acaoPendente.valor, moeda)} separado(s) para ${fundo.nome}`);
      setAcaoPendente(null);
    } catch {
      mostrarToast("Não foi possível separar agora.");
    } finally {
      setAExecutar(false);
    }
  }

  function aoSubmeter(e: FormEvent) {
    e.preventDefault();
    void perguntar(pergunta);
  }

  return (
    <div className={styles.card}>
      <div className={styles.cabecalho}>
        <Sparkles size={16} aria-hidden />
        <h3 className={styles.titulo}>Copiloto</h3>
      </div>
      <p className={styles.sub}>Pergunte sobre seus dados — as contas são feitas aqui, sempre.</p>

      <form className={styles.form} onSubmit={aoSubmeter}>
        <input
          className={styles.input}
          value={pergunta}
          onChange={(e) => setPergunta(e.target.value)}
          placeholder="Ex.: quanto gastei em mercado?"
        />
        <button type="submit" className={styles.botao}>
          Perguntar
        </button>
      </form>

      {aPensar && <p className={styles.resposta}>A pensar…</p>}

      {resposta !== null && (
        // Ver escaparHtml em utils/copiloto.ts: único tag permitido é <b>, e
        // todo texto interpolado é escapado antes. O que vem da camada 2 é
        // escapado por inteiro em services/copilotoIA.ts — texto gerado não
        // ganha o direito de emitir HTML só por ter passado por um modelo.
        <p className={styles.resposta} dangerouslySetInnerHTML={{ __html: resposta }} />
      )}

      {acaoPendente && (
        <button
          type="button"
          className={styles.acaoPlano}
          disabled={aExecutar}
          onClick={() => void executarAcao()}
        >
          {aExecutar
            ? "A separar…"
            : `Separar ${formatMoney(acaoPendente.valor, cfg.currency)} para ${acaoPendente.nomeFundo}`}
        </button>
      )}

      <div className={styles.sugestoes}>
        {SUGESTOES.map((s) => (
          <button
            key={s}
            className={styles.sugestao}
            onClick={() => {
              setPergunta(s);
              void perguntar(s);
            }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

import { useState, type FormEvent } from "react";
import { Layers } from "lucide-react";
import Pagina, { EstadoVazio, Kpis } from "../components/Pagina";
import KpiCard from "../components/KpiCard";
import BottomSheet from "../components/BottomSheet";
import {
  criarParcela,
  estornarMesParcela,
  excluirParcela,
  pagarMesParcela,
  quitarParcela,
} from "../services/parcelasService";
import { useAuthStore } from "../stores/authStore";
import { useCfgStore } from "../stores/cfgStore";
import { useDespesasStore } from "../stores/lancamentosStore";
import { useParcelasStore } from "../stores/parcelasStore";
import { mostrarToast } from "../stores/toastStore";
import type { Parcela } from "../types";
import { mesAtual, rotuloMes } from "../utils/calculos";
import { formatMoney, parseMoney } from "../utils/money";
import {
  mesesDaParcela,
  mesesNaoPagos,
  parcelaQuitada,
  progressoDaParcela,
  valorDaParcela,
  valorQuitacao,
} from "../utils/parcelas";
import styles from "./Parcelas.module.css";

function LinhaParcela({ p }: { p: Parcela }) {
  const uid = useAuthStore((s) => s.sessao?.uid);
  const despesas = useDespesasStore((s) => s.itens);
  const quitada = parcelaQuitada(p);
  const { pagas, total } = progressoDaParcela(p);
  const abertos = mesesNaoPagos(p);
  const proximo = abertos[0];
  // estorno: só meses pagos por FORA da fatura (true) podem ser estornados aqui
  const pagosManuais = mesesDaParcela(p).filter((m) => p.pagoPorMes[m] === true);
  const ultimoPago = pagosManuais[pagosManuais.length - 1];

  async function agir(acao: () => Promise<void>, msg: string) {
    try {
      await acao();
      mostrarToast(msg);
    } catch {
      mostrarToast("Não foi possível concluir. Tente de novo.");
    }
  }

  return (
    <div className={styles.parcela}>
      <div className={styles.topo}>
        <div className={styles.info}>
          <p className={styles.nome}>{p.descricao}</p>
          <p className={styles.detalhe}>
            {formatMoney(p.total, "EUR")}
            {p.cartao ? ` · ${p.cartao}${p.autoDebit ? " (débito autom.)" : ""}` : ""}
          </p>
        </div>
        <span className={`${styles.progresso} ${quitada ? styles.quitada : ""}`}>
          {pagas}/{total}
        </span>
      </div>

      <div className={styles.barra} role="progressbar" aria-valuenow={pagas} aria-valuemax={total}>
        <div className={styles.preenchido} style={{ width: `${(pagas / total) * 100}%` }} />
      </div>

      {!quitada && proximo !== undefined && (
        <p className={styles.proxima}>
          Próxima: {formatMoney(valorDaParcela(p, proximo), "EUR")} em {rotuloMes(proximo)}
        </p>
      )}

      <div className={styles.acoes}>
        {!quitada && proximo !== undefined && !p.autoDebit && (
          <button
            className={styles.acao}
            onClick={() =>
              agir(
                () => pagarMesParcela(uid!, p, proximo),
                `✓ ${p.descricao} — ${rotuloMes(proximo)} paga`,
              )
            }
          >
            Pagar {rotuloMes(proximo).split(" ")[0]}
          </button>
        )}
        {ultimoPago !== undefined && (
          <button
            className={styles.acao}
            onClick={() => {
              if (!window.confirm(`Estornar ${rotuloMes(ultimoPago)} de "${p.descricao}"?`)) return;
              void agir(() => estornarMesParcela(uid!, p, ultimoPago, despesas), "↩ Mês estornado");
            }}
          >
            Estornar
          </button>
        )}
        {!quitada && abertos.length > 0 && (
          <button
            className={styles.acao}
            onClick={() => {
              const totalQuit = valorQuitacao(p);
              if (
                !window.confirm(
                  `Quitar "${p.descricao}"?\n\n${abertos.length} parcela(s) em aberto → ${formatMoney(totalQuit, "EUR")}\n\nUma única despesa de quitação será criada hoje.`,
                )
              )
                return;
              void agir(
                () => quitarParcela(uid!, p),
                `✓ ${p.descricao} quitada — ${formatMoney(totalQuit, "EUR")}`,
              );
            }}
          >
            Quitar
          </button>
        )}
        <button
          className={`${styles.acao} ${styles.perigo}`}
          onClick={() => {
            if (
              !window.confirm(
                `Excluir a parcela "${p.descricao}"?\nOs meses já pagos continuam no histórico de despesas.`,
              )
            )
              return;
            void agir(() => excluirParcela(uid!, p), "Parcela excluída");
          }}
        >
          Excluir
        </button>
      </div>
    </div>
  );
}

function FormNovaParcela({ aberta, aoFechar }: { aberta: boolean; aoFechar: () => void }) {
  const uid = useAuthStore((s) => s.sessao?.uid);
  const cfg = useCfgStore((s) => s.cfg);
  const [descricao, setDescricao] = useState("");
  const [totalTexto, setTotalTexto] = useState("");
  const [num, setNum] = useState("3");
  const [primeiroMes, setPrimeiroMes] = useState(mesAtual());
  const [categoria, setCategoria] = useState("");
  const [cartao, setCartao] = useState("");
  const [autoDebit, setAutoDebit] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const cartaoCredito = cfg.tipoCartao[cartao] === "credit";

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const total = parseMoney(totalTexto);
    const numParcelas = parseInt(num, 10);
    if (total === null || total <= 0) return setErro("Valor total inválido.");
    if (!Number.isFinite(numParcelas) || numParcelas < 1)
      return setErro("Nº de parcelas inválido.");
    try {
      await criarParcela(uid!, {
        descricao,
        total,
        numParcelas,
        primeiroMes,
        categoria: categoria || "Parcelas",
        cartao: cartao || null,
        autoDebit: cartaoCredito && autoDebit,
        pagoPorMes: {},
      });
      mostrarToast("✓ Parcela criada");
      aoFechar();
      setDescricao("");
      setTotalTexto("");
      setNum("3");
      setCartao("");
      setAutoDebit(false);
      setErro(null);
    } catch {
      setErro("Não foi possível salvar. Tente de novo.");
    }
  }

  return (
    <BottomSheet aberta={aberta} aoFechar={aoFechar} titulo="Nova parcela">
      <form className={styles.form} onSubmit={salvar}>
        <label className={styles.campo}>
          Descrição
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)} required />
        </label>
        <div className={styles.linhaDupla}>
          <label className={styles.campo}>
            Total (€)
            <input
              inputMode="decimal"
              placeholder="0,00"
              value={totalTexto}
              onChange={(e) => setTotalTexto(e.target.value)}
              required
            />
          </label>
          <label className={styles.campo}>
            Nº parcelas
            <input
              type="number"
              min={1}
              max={120}
              value={num}
              onChange={(e) => setNum(e.target.value)}
              required
            />
          </label>
        </div>
        <div className={styles.linhaDupla}>
          <label className={styles.campo}>
            Primeiro mês
            <input
              type="month"
              value={primeiroMes}
              onChange={(e) => setPrimeiroMes(e.target.value)}
              required
            />
          </label>
          <label className={styles.campo}>
            Categoria
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="">Parcelas</option>
              {cfg.categoriasCorrentes.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <label className={styles.campo}>
          Cartão (opcional)
          <select value={cartao} onChange={(e) => setCartao(e.target.value)}>
            <option value="">Sem cartão</option>
            {cfg.contasCartoes.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        {cartaoCredito && (
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={autoDebit}
              onChange={(e) => setAutoDebit(e.target.checked)}
            />
            Débito automático — entra na fatura do cartão
          </label>
        )}
        {erro !== null && (
          <p className={styles.erro} role="alert">
            {erro}
          </p>
        )}
        <button type="submit" className={styles.salvar}>
          Criar parcela
        </button>
      </form>
    </BottomSheet>
  );
}

export default function Parcelas() {
  const parcelas = useParcelasStore((s) => s.itens);
  const carregado = useParcelasStore((s) => s.carregado);
  const [novaAberta, setNovaAberta] = useState(false);

  const ativas = parcelas.filter((p) => !parcelaQuitada(p));
  const quitadas = parcelas.filter(parcelaQuitada);
  const debitoMensal = ativas.reduce((s, p) => {
    const proximo = mesesNaoPagos(p)[0];
    return proximo !== undefined ? s + valorDaParcela(p, proximo) : s;
  }, 0);
  const faltaPagar = ativas.reduce((s, p) => s + valorQuitacao(p), 0);

  return (
    <Pagina titulo="Parcelas">
      <Kpis>
        <KpiCard rotulo="Em andamento" valor={String(ativas.length)} />
        <KpiCard rotulo="Débito mensal" valor={formatMoney(debitoMensal, "EUR")} tom="vermelho" />
        <KpiCard rotulo="Falta pagar" valor={formatMoney(faltaPagar, "EUR")} tom="amarelo" />
      </Kpis>

      <div className={styles.cabecalho}>
        <h3 className={styles.subtitulo}>Compras parceladas</h3>
        <button className={styles.adicionar} onClick={() => setNovaAberta(true)}>
          + Nova parcela
        </button>
      </div>

      {carregado && parcelas.length === 0 ? (
        <EstadoVazio
          Icone={Layers}
          mensagem="Nenhuma compra parcelada"
          sub="Crie uma parcela para acompanhar o progresso mês a mês."
        />
      ) : (
        <div className={styles.lista}>
          {[...ativas, ...quitadas].map((p) => (
            <LinhaParcela key={p.id} p={p} />
          ))}
        </div>
      )}

      <FormNovaParcela aberta={novaAberta} aoFechar={() => setNovaAberta(false)} />
    </Pagina>
  );
}

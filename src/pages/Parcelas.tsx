import { useState, type FormEvent } from "react";
import { Layers } from "lucide-react";
import Pagina, { EstadoVazio, Kpis } from "../components/Pagina";
import KpiCard from "../components/KpiCard";
import ErroSincronizacao from "../components/ErroSincronizacao";
import BottomSheet from "../components/BottomSheet";
import Seletor from "../components/Seletor";
import SeletorCategoria from "../components/SeletorCategoria";
import SeletorOrdemFolha from "../components/SeletorOrdemFolha";
import {
  ORDENS_PARCELA,
  parcelasVisiveis,
  ROTULOS_ORDEM_PARCELA,
  type OrdemParcela,
} from "../utils/ordemParcelas";
import {
  criarParcela,
  excluirParcela,
  pagarMesParcela,
  quitarParcela,
} from "../services/parcelasService";
import { atualizarParcela } from "../services/lancamentosService";
import { useConfirmar } from "../hooks/useConfirmar";
import { useAuthStore } from "../stores/authStore";
import { useCfgStore } from "../stores/cfgStore";
import { useParcelasStore } from "../stores/parcelasStore";
import { mostrarToast } from "../stores/toastStore";
import type { Currency, Parcela } from "../types";
import { mesAtual, rotuloMes } from "../utils/calculos";
import { formatMoney, parseMoney } from "../utils/money";
import {
  debitoMensalDaParcela,
  mesesNaoPagos,
  parcelaQuitada,
  progressoDaParcela,
  valorDaParcela,
  valorQuitacao,
} from "../utils/parcelas";
import styles from "./Parcelas.module.css";

function LinhaParcela({
  p,
  moeda,
  aoEditar,
}: {
  p: Parcela;
  moeda: Currency;
  aoEditar: (p: Parcela) => void;
}) {
  const uid = useAuthStore((s) => s.sessao?.uid);
  const confirmar = useConfirmar();
  const quitada = parcelaQuitada(p);
  const { pagas, total } = progressoDaParcela(p);
  const abertos = mesesNaoPagos(p);
  const proximo = abertos[0];

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
      {/* Corpo inteiro abre a caixa de edição, com "Excluir" dentro (item 7) */}
      <button className={styles.corpo} onClick={() => aoEditar(p)}>
        <span className={styles.topo}>
          <span className={styles.info}>
            <span className={styles.nome}>{p.descricao}</span>
            <span className={styles.detalhe}>
              {formatMoney(p.total, moeda)}
              {p.cartao ? ` · ${p.cartao}${p.autoDebit ? " (débito autom.)" : ""}` : ""}
              {p.diaVencimento ? ` · dia ${p.diaVencimento}` : ""}
            </span>
          </span>
          <span className={`${styles.progresso} ${quitada ? styles.quitada : ""}`}>
            {pagas}/{total}
          </span>
        </span>

        <span
          className={styles.barra}
          role="progressbar"
          aria-valuenow={pagas}
          aria-valuemax={total}
        >
          <span className={styles.preenchido} style={{ width: `${(pagas / total) * 100}%` }} />
        </span>

        {!quitada && proximo !== undefined && (
          <span className={styles.proxima}>
            Próxima: {formatMoney(valorDaParcela(p, proximo), moeda)} em {rotuloMes(proximo)}
          </span>
        )}
      </button>

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
        {!quitada && abertos.length > 0 && (
          <button
            className={styles.acao}
            onClick={() => {
              void (async () => {
                const totalQuit = valorQuitacao(p);
                if (
                  !(await confirmar(
                    `Quitar "${p.descricao}"?\n\n${abertos.length} parcela(s) em aberto → ${formatMoney(totalQuit, moeda)}\n\nUma única despesa de quitação será criada hoje.`,
                  ))
                )
                  return;
                await agir(
                  () => quitarParcela(uid!, p),
                  `✓ ${p.descricao} quitada — ${formatMoney(totalQuit, moeda)}`,
                );
              })();
            }}
          >
            Quitar
          </button>
        )}
      </div>
    </div>
  );
}

/** Caixa única de parcela: cria e edita (itens 7, 11, 12, 17, 19). */
function FormParcela({
  aberta,
  aoFechar,
  editando,
}: {
  aberta: boolean;
  aoFechar: () => void;
  editando: Parcela | null;
}) {
  const uid = useAuthStore((s) => s.sessao?.uid);
  const confirmar = useConfirmar();
  const cfg = useCfgStore((s) => s.cfg);
  const [descricao, setDescricao] = useState("");
  const [nota, setNota] = useState("");
  const [totalTexto, setTotalTexto] = useState("");
  const [num, setNum] = useState("3");
  const [primeiroMes, setPrimeiroMes] = useState(mesAtual());
  const [dia, setDia] = useState("");
  const [categoria, setCategoria] = useState("");
  const [cartao, setCartao] = useState("");
  const [autoDebit, setAutoDebit] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const cartaoCredito = cfg.tipoCartao[cartao] === "credit";

  // A folha só monta os campos quando abre; a chave abaixo (em Parcelas)
  // remonta o componente a cada abertura, então dá pra semear o estado aqui.
  const [semeadoPara, setSemeadoPara] = useState<string | null>(null);
  const chave = editando?.id ?? "nova";
  if (aberta && semeadoPara !== chave) {
    setSemeadoPara(chave);
    setDescricao(editando?.descricao ?? "");
    setNota(editando?.nota ?? "");
    setTotalTexto(editando ? (editando.total / 100).toFixed(2).replace(".", ",") : "");
    setNum(String(editando?.numParcelas ?? 3));
    setPrimeiroMes(editando?.primeiroMes ?? mesAtual());
    setDia(editando?.diaVencimento ? String(editando.diaVencimento) : "");
    setCategoria(editando?.categoria ?? "");
    setCartao(editando?.cartao ?? "");
    setAutoDebit(!!editando?.autoDebit);
    setErro(null);
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const total = parseMoney(totalTexto);
    const numParcelas = parseInt(num, 10);
    if (total === null || total <= 0) return setErro("Valor total inválido.");
    if (!Number.isFinite(numParcelas) || numParcelas < 1)
      return setErro("Nº de parcelas inválido.");
    const diaNum = dia.trim() === "" ? undefined : Number(dia);
    if (diaNum !== undefined && (!Number.isInteger(diaNum) || diaNum < 1 || diaNum > 31))
      return setErro("Dia do vencimento deve ser entre 1 e 31.");
    const dados = {
      descricao,
      nota: nota.trim() || undefined,
      total,
      numParcelas,
      primeiroMes,
      diaVencimento: diaNum,
      categoria: categoria || "Parcelas",
      cartao: cartao || null,
      autoDebit: cartaoCredito && autoDebit,
    };
    try {
      if (editando) {
        await atualizarParcela(uid!, { ...editando, ...dados });
        mostrarToast("✓ Parcela atualizada");
      } else {
        await criarParcela(uid!, { ...dados, pagoPorMes: {} });
        mostrarToast("✓ Parcela criada");
      }
      setSemeadoPara(null);
      aoFechar();
    } catch {
      setErro("Não foi possível salvar. Tente de novo.");
    }
  }

  async function excluir() {
    if (!editando) return;
    if (
      !(await confirmar(
        `Excluir a parcela "${editando.descricao}"?\nOs meses já pagos continuam no histórico de despesas.`,
      ))
    )
      return;
    try {
      await excluirParcela(uid!, editando);
      mostrarToast("Parcela excluída");
      setSemeadoPara(null);
      aoFechar();
    } catch {
      setErro("Não foi possível excluir. Tente de novo.");
    }
  }

  return (
    <BottomSheet
      aberta={aberta}
      aoFechar={() => {
        setSemeadoPara(null);
        aoFechar();
      }}
      titulo={editando ? "Editar parcela" : "Nova parcela"}
    >
      <form className={styles.form} onSubmit={salvar}>
        <label className={styles.campo}>
          Nome
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)} required />
        </label>
        <label className={styles.campo}>
          Descrição (opcional)
          <input value={nota} onChange={(e) => setNota(e.target.value)} />
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
            Dia do vencimento
            <input
              inputMode="numeric"
              placeholder="1-31"
              value={dia}
              onChange={(e) => setDia(e.target.value)}
            />
          </label>
        </div>
        <SeletorCategoria
          valor={categoria}
          opcoes={cfg.categoriasCorrentes}
          aoMudar={setCategoria}
          rotuloVazio="Parcelas"
        />
        <Seletor
          rotulo="Cartão (opcional)"
          valor={cartao}
          opcoes={cfg.contasCartoes}
          aoMudar={setCartao}
          rotuloVazio="Sem cartão"
        />
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
          {editando ? "Salvar alterações" : "Criar parcela"}
        </button>
        {editando && (
          <button type="button" className={styles.excluirParcela} onClick={() => void excluir()}>
            Excluir parcela
          </button>
        )}
      </form>
    </BottomSheet>
  );
}

export default function Parcelas() {
  const moeda = useCfgStore((s) => s.cfg.currency);
  const parcelas = useParcelasStore((s) => s.itens);
  const carregado = useParcelasStore((s) => s.carregado);
  const erro = useParcelasStore((s) => s.erro);
  const [folhaAberta, setFolhaAberta] = useState(false);
  const [editando, setEditando] = useState<Parcela | null>(null);
  // Ordem da lista (item 14) — não persiste entre visitas. Esta tela tem 6
  // opções, duas delas só de parcela (ver utils/ordemParcelas.ts).
  const [ordem, setOrdem] = useState<OrdemParcela>("recentes");
  // Esconder as já pagas até ao fim: escolha da visita, não uma preferência
  // guardada — quem quer conferir o histórico volta a mostrar num toque.
  const [esconderQuitadas, setEsconderQuitadas] = useState(false);

  function abrirNova() {
    setEditando(null);
    setFolhaAberta(true);
  }

  function abrirEdicao(p: Parcela) {
    setEditando(p);
    setFolhaAberta(true);
  }

  const ativas = parcelas.filter((p) => !parcelaQuitada(p));
  const quitadas = parcelas.filter(parcelaQuitada);
  const debitoMensal = ativas.reduce((s, p) => s + debitoMensalDaParcela(p), 0);
  const faltaPagar = ativas.reduce((s, p) => s + valorQuitacao(p), 0);

  const visiveis = parcelasVisiveis(parcelas, ordem, esconderQuitadas);

  return (
    <Pagina titulo="Parcelas">
      <Kpis pagina="parcelas">
        <KpiCard rotulo="Em andamento" valor={String(ativas.length)} />
        <KpiCard rotulo="Débito mensal" valor={formatMoney(debitoMensal, moeda)} tom="vermelho" />
        <KpiCard rotulo="Falta pagar" valor={formatMoney(faltaPagar, moeda)} tom="amarelo" />
      </Kpis>

      <div className={styles.cabecalho}>
        <h3 className={styles.subtitulo}>Compras parceladas</h3>
        <div className={styles.acoesCabecalho}>
          {quitadas.length > 0 && (
            <button
              className={`${styles.filtro} ${esconderQuitadas ? styles.filtroAtivo : ""}`}
              aria-pressed={esconderQuitadas}
              onClick={() => setEsconderQuitadas(!esconderQuitadas)}
            >
              Esconder quitadas
              <span className={styles.filtroContagem}>{quitadas.length}</span>
            </button>
          )}
          {parcelas.length > 1 && (
            <SeletorOrdemFolha
              valor={ordem}
              opcoes={ORDENS_PARCELA}
              rotulos={ROTULOS_ORDEM_PARCELA}
              aoMudar={setOrdem}
            />
          )}
          <button className={styles.adicionar} onClick={abrirNova}>
            + Nova parcela
          </button>
        </div>
      </div>

      {erro && parcelas.length > 0 && <ErroSincronizacao compacto />}

      {erro && parcelas.length === 0 ? (
        <ErroSincronizacao />
      ) : carregado && parcelas.length === 0 ? (
        <EstadoVazio
          Icone={Layers}
          mensagem="Nenhuma compra parcelada"
          sub="Crie uma parcela para acompanhar o progresso mês a mês."
        />
      ) : (
        <div className={styles.lista}>
          {visiveis.map((p) => (
            <LinhaParcela key={p.id} p={p} moeda={moeda} aoEditar={abrirEdicao} />
          ))}
        </div>
      )}

      <FormParcela
        aberta={folhaAberta}
        aoFechar={() => setFolhaAberta(false)}
        editando={editando}
      />
    </Pagina>
  );
}

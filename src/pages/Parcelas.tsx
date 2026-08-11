import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Layers } from "lucide-react";
import Pagina, { EstadoVazio, Kpis } from "../components/Pagina";
import KpiCard from "../components/KpiCard";
import ErroSincronizacao from "../components/ErroSincronizacao";
import BottomSheet from "../components/BottomSheet";
import CampoMoeda from "../components/CampoMoeda";
import Seletor from "../components/Seletor";
import SeletorCategoria from "../components/SeletorCategoria";
import SeletorOrdemFolha from "../components/SeletorOrdemFolha";
import { LINHAS_ORDEM_PARCELA, parcelasVisiveis, type OrdemParcela } from "../utils/ordemParcelas";
import {
  criarParcela,
  excluirParcela,
  pagarMesParcela,
  quitarParcela,
} from "../services/parcelasService";
import { atualizarParcela } from "../services/lancamentosService";
import { adicionarItemLista, removerItemLista } from "../services/cfgService";
import { useConfirmar } from "../hooks/useConfirmar";
import { useAuthStore } from "../stores/authStore";
import { useCfgStore } from "../stores/cfgStore";
import { useParcelasStore } from "../stores/parcelasStore";
import { useMesVisivelStore } from "../stores/mesVisivelStore";
import { mostrarToast } from "../stores/toastStore";
import type { Cents, Currency, Parcela, YearMonth } from "../types";
import { mesAtual, rotuloMes } from "../utils/calculos";
import { formatMoney } from "../utils/money";
import {
  mesesNaoPagos,
  diaVencimentoEfetivo,
  pagoNoMes,
  parcelaQuitada,
  progressoDaParcela,
  totalParcelasNoMes,
  valorDaParcela,
  valorQuitacao,
} from "../utils/parcelas";
import styles from "./Parcelas.module.css";

function LinhaParcela({
  p,
  moeda,
  aoEditar,
  mesRef,
  diaVencimentoFatura,
}: {
  p: Parcela;
  moeda: Currency;
  aoEditar: (p: Parcela) => void;
  mesRef: YearMonth;
  diaVencimentoFatura: Record<string, number> | undefined;
}) {
  const uid = useAuthStore((s) => s.sessao?.uid);
  const confirmar = useConfirmar();
  const quitada = parcelaQuitada(p, mesRef);
  const { pagas, total } = progressoDaParcela(p, mesRef);
  const abertos = mesesNaoPagos(p, mesRef);
  // Paga por cartão em débito automático, a parcela vence com a FATURA.
  const diaVenc = diaVencimentoEfetivo(p, diaVencimentoFatura);
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
              {p.nota ? ` · ${p.nota}` : ""}
              {p.cartao ? ` · ${p.cartao}${p.autoDebit ? " (débito autom.)" : ""}` : ""}
              {diaVenc ? ` · dia ${diaVenc}` : ""}
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

        {/* "X de Y em Z": o que sai a seguir, quanto ainda falta ao todo e
            quando. O `mesRef` no restante é o que trata como já resolvido o mês
            que saiu sozinho do cartão em débito automático. */}
        {!quitada && proximo !== undefined && (
          <span className={styles.proxima}>
            {formatMoney(valorDaParcela(p, proximo), moeda)} de{" "}
            {formatMoney(valorQuitacao(p, mesRef), moeda)} em {rotuloMes(proximo)}
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
                // O mesmo `mesRef` da linha acima e do que o serviço grava: o
                // número que se confirma aqui tem de ser o que sai da conta.
                const totalQuit = valorQuitacao(p, mesRef);
                if (
                  !(await confirmar(
                    `Quitar "${p.descricao}"?\n\n${abertos.length} parcela(s) em aberto → ${formatMoney(totalQuit, moeda)}\n\nUma única despesa de quitação será criada hoje.`,
                  ))
                )
                  return;
                await agir(
                  () => quitarParcela(uid!, p, mesRef),
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
  const [totalTexto, setTotalTexto] = useState<Cents | null>(null);
  const [num, setNum] = useState("3");
  const [primeiroMes, setPrimeiroMes] = useState(mesAtual());
  const [dia, setDia] = useState("");
  const [categoria, setCategoria] = useState("");
  const [cartao, setCartao] = useState("");
  const [intermediador, setIntermediador] = useState("");
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
    setTotalTexto(editando ? editando.total : null);
    setNum(String(editando?.numParcelas ?? 3));
    setPrimeiroMes(editando?.primeiroMes ?? mesAtual());
    setDia(editando?.diaVencimento ? String(editando.diaVencimento) : "");
    setCategoria(editando?.categoria ?? "");
    setCartao(editando?.cartao ?? "");
    setIntermediador(editando?.intermediador ?? "");
    setAutoDebit(!!editando?.autoDebit);
    setErro(null);
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const total = totalTexto;
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
      intermediador: intermediador || undefined,
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
            <CampoMoeda valor={totalTexto} aoMudar={setTotalTexto} required />
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
          opcoes={cfg.categoriasDespesa}
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
        <Seletor
          rotulo="Intermediador (opcional)"
          valor={intermediador}
          opcoes={cfg.intermediadoresParcelamento}
          aoMudar={setIntermediador}
          rotuloVazio="Sem intermediador"
          aviso="Nenhum intermediador guardado ainda — adicione um na lista abaixo da tela."
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
  const cfg = useCfgStore((s) => s.cfg);
  const moeda = cfg.currency;
  const mesRef = useMesVisivelStore((s) => s.mes);
  const parcelas = useParcelasStore((s) => s.itens);
  const carregado = useParcelasStore((s) => s.carregado);
  const erro = useParcelasStore((s) => s.erro);
  const [folhaAberta, setFolhaAberta] = useState(false);
  const [editando, setEditando] = useState<Parcela | null>(null);
  // Ordem da lista (item 14) — não persiste entre visitas. Esta tela tem 8
  // opções, quatro delas só de parcela (ver utils/ordemParcelas.ts); a folha
  // mostra-as em 5 linhas, juntando cada par de direções opostas.
  const [ordem, setOrdem] = useState<OrdemParcela>("recentes");
  // Isolar as já pagas para rever o histórico de compras fechadas: escolha da
  // visita, não uma preferência guardada — um toque volta a mostrar tudo.
  const [apenasQuitadas, setApenasQuitadas] = useState(false);
  const [novoIntermediador, setNovoIntermediador] = useState("");
  const uid = useAuthStore((s) => s.sessao?.uid);
  const confirmar = useConfirmar();

  async function adicionarIntermediador(e: FormEvent) {
    e.preventDefault();
    const nome = novoIntermediador.trim();
    if (!nome) return mostrarToast("Escreva um nome primeiro.");
    try {
      await adicionarItemLista(uid!, cfg, "intermediadoresParcelamento", nome);
      mostrarToast(`✓ "${nome}" adicionado`);
      setNovoIntermediador("");
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : "Não foi possível adicionar.");
    }
  }

  async function removerIntermediador(nome: string) {
    if (!(await confirmar(`Remover "${nome}"? Parcelas já criadas não mudam.`))) return;
    try {
      await removerItemLista(uid!, cfg, "intermediadoresParcelamento", nome);
      mostrarToast(`"${nome}" removido`);
    } catch {
      mostrarToast("Não foi possível remover.");
    }
  }

  function abrirNova() {
    setEditando(null);
    setFolhaAberta(true);
  }

  function abrirEdicao(p: Parcela) {
    setEditando(p);
    setFolhaAberta(true);
  }

  // Tudo o que conta parcelas em aberto olha para o mês do header, e não para
  // "hoje": muda-se o mês em cima e os números acompanham. É também esse mês
  // que diz até onde uma parcela em débito automático já está resolvida.
  const ativas = parcelas.filter((p) => !parcelaQuitada(p, mesRef));
  const quitadas = parcelas.filter((p) => parcelaQuitada(p, mesRef));
  // "Total do mês" e "Falta pagar" são a mesma conta partida em dois, os dois
  // olhando só para o mês exibido. "Restante" já é outra coisa: a dívida de
  // TODAS as compras parceladas, de todos os meses — o que ainda falta pagar
  // no total, não só neste mês.
  const totalDoMes = totalParcelasNoMes(parcelas, mesRef);
  const pagoEsteMes = pagoNoMes(parcelas, mesRef, mesAtual());
  const faltaPagar = totalDoMes - pagoEsteMes;
  const restanteTotal = parcelas.reduce((s, p) => s + valorQuitacao(p, mesRef), 0);

  const visiveis = parcelasVisiveis(parcelas, ordem, apenasQuitadas, mesRef);

  return (
    <Pagina titulo="Parcelas">
      <Kpis pagina="parcelas">
        <KpiCard rotulo="Total do mês" valor={formatMoney(totalDoMes, moeda)} tom="acento" />
        <KpiCard rotulo="Falta pagar" valor={formatMoney(faltaPagar, moeda)} tom="vermelho" />
        <KpiCard rotulo="Restante" valor={formatMoney(restanteTotal, moeda)} tom="amarelo" />
        <KpiCard rotulo="Parcelas ativas" valor={String(ativas.length)} />
      </Kpis>

      <div className={styles.cabecalho}>
        <h3 className={styles.subtitulo}>Compras parceladas ({ativas.length})</h3>
        <div className={styles.acoesCabecalho}>
          {parcelas.length > 1 && (
            <SeletorOrdemFolha valor={ordem} linhas={LINHAS_ORDEM_PARCELA} aoMudar={setOrdem} />
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
            <LinhaParcela
              key={p.id}
              p={p}
              moeda={moeda}
              aoEditar={abrirEdicao}
              mesRef={mesRef}
              diaVencimentoFatura={cfg.diaVencimentoFatura}
            />
          ))}
        </div>
      )}

      {/* A lista de intermediadores vive aqui, junto de quem a usa, e não em
          Definições — mesma razão dos locais de carregamento estarem no
          Veículo: é conceito deste domínio, não configuração geral. */}
      <form className={styles.gerir} onSubmit={adicionarIntermediador}>
        <p className={styles.gerirTitulo}>Intermediadores de parcelamento</p>
        {cfg.intermediadoresParcelamento.length > 0 && (
          <ul className={styles.chips}>
            {cfg.intermediadoresParcelamento.map((i) => (
              <li key={i} className={styles.chip}>
                {i}
                <button
                  type="button"
                  className={styles.chipRemover}
                  aria-label={`Remover ${i}`}
                  onClick={() => void removerIntermediador(i)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className={styles.gerirLinha}>
          <input
            placeholder="Nome (ex. Klarna)"
            aria-label="Nome do intermediador"
            value={novoIntermediador}
            onChange={(e) => setNovoIntermediador(e.target.value)}
          />
          <button type="submit" className={styles.gerirBotao}>
            Adicionar
          </button>
        </div>
      </form>

      {/* Rodapé discreto: isolar as quitadas é para rever o histórico de vez em
          quando, não uma ação do dia a dia — por isso saiu do cabeçalho, onde
          disputava espaço com "Nova parcela". O olho aberto é o estado normal
          (nada fora da vista); fechado, são as em aberto que ficam de fora. */}
      {quitadas.length > 0 && (
        <div className={styles.rodape}>
          <button
            className={`${styles.filtroRodape} ${apenasQuitadas ? styles.filtroRodapeAtivo : ""}`}
            aria-pressed={apenasQuitadas}
            aria-label={
              apenasQuitadas
                ? "A mostrar só as quitadas — toque para ver todas"
                : "Mostrar só as quitadas"
            }
            title={
              apenasQuitadas
                ? "A mostrar só as quitadas — toque para ver todas"
                : "Mostrar só as quitadas"
            }
            onClick={() => setApenasQuitadas(!apenasQuitadas)}
          >
            {apenasQuitadas ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
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

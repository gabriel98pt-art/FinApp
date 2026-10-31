import { useRef, useState, type FormEvent } from "react";
import {
  Check,
  CheckCheck,
  History,
  Layers,
  Pencil,
  Plus,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { EstadoVazio } from "../components/Pagina";
import ErroSincronizacao from "../components/ErroSincronizacao";
import BottomSheet from "../components/BottomSheet";
import CampoValorDestaque from "../components/CampoValorDestaque";
import MenuAcoesItem, { type AcaoItem } from "../components/MenuAcoesItem";
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
import { useUidSessao } from "../hooks/useUidSessao";
import { useCfgStore } from "../stores/cfgStore";
import { useDespesasStore } from "../stores/lancamentosStore";
import { useParcelasStore } from "../stores/parcelasStore";
import { useMesVisivelStore } from "../stores/mesVisivelStore";
import { mostrarToast } from "../stores/toastStore";
import type { Cents, Currency, DespesaCorrente, IsoDate, Parcela, YearMonth } from "../types";
import { hojeIso, mesAtual, rotuloMes } from "../utils/calculos";
import { formatMoney } from "../utils/money";
import { nomeAtualDoMetodo } from "../utils/instituicoes";
import { mensagemDeErroDados } from "../utils/erroDados";
import {
  mesesNaoPagos,
  parcelaQuitada,
  progressoDaParcela,
  totalParcelasNoMes,
  debitoMensalDaParcela,
  valorBaseDaParcela,
  valorQuitacao,
} from "../utils/parcelas";
import FolhaValoresParcela from "./FolhaValoresParcela";
import styles from "./Parcelas.module.css";
import Botao from "../components/Botao";

/** Círculo de progresso "pagas/total" (a prévia aprovada de Cartões). */
function AnelProgresso({
  pagas,
  total,
  quitada,
}: {
  pagas: number;
  total: number;
  quitada: boolean;
}) {
  const r = 16;
  const c = 2 * Math.PI * r;
  return (
    <span className={styles.anel} aria-hidden>
      <svg width="40" height="40" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r={r} fill="none" className={styles.anelFundo} strokeWidth="4" />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          className={quitada ? styles.anelQuitada : styles.anelPreenche}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${(total === 0 ? 0 : pagas / total) * c} ${c}`}
          transform="rotate(-90 20 20)"
        />
      </svg>
      <b>
        {pagas}/{total}
      </b>
    </span>
  );
}

function LinhaParcela({
  p,
  moeda,
  aoEditar,
  aoExcluir,
  mesRef,
  hoje,
  nomeDoCartao,
  despesas,
}: {
  p: Parcela;
  moeda: Currency;
  aoEditar: (p: Parcela) => void;
  /** Item 2 do lote de UX/nav: Excluir vira ação do menu único — quem chama
   *  cuida da confirmação, igual ao mesmo padrão de ListaLancamentos. */
  aoExcluir: (p: Parcela) => void;
  mesRef: YearMonth;
  /** Dia de hoje — dá precisão de DIA ao `mesRef` corrente para uma parcela em
   *  débito automático (ver `parcelaQuitada`): sem ela, a parcela contava como
   *  quitada já no dia 1 do mês, antes de o cartão ter cobrado de facto. */
  hoje: IsoDate;
  /** O que a parcela guarda é o id do cartão, que nunca muda; o nome de hoje
   *  vem daqui, para uma parcela antiga não ficar presa a um nome antigo. */
  nomeDoCartao: (id: string) => string;
  /** Repassada à folha de valores: ajustar um mês já pago corrige junto a
   *  despesa espelho dele. */
  despesas: DespesaCorrente[];
}) {
  const uid = useUidSessao();
  const confirmar = useConfirmar();
  const [menuAberto, setMenuAberto] = useState(false);
  const [valoresAbertos, setValoresAbertos] = useState(false);
  const ancoraRef = useRef<HTMLButtonElement>(null);
  const quitada = parcelaQuitada(p, mesRef, hoje);
  const { pagas, total } = progressoDaParcela(p, mesRef, hoje);
  const abertos = mesesNaoPagos(p, mesRef, hoje);
  const proximo = abertos[0];
  // O que pesa por mês: o do próximo mês em aberto; numa quitada, o da primeira.
  const porMes = debitoMensalDaParcela(p, mesRef, hoje) || valorBaseDaParcela(p, 0);

  async function agir(acao: () => Promise<void>, msg: string) {
    try {
      await acao();
      mostrarToast(msg);
    } catch {
      mostrarToast("Não foi possível concluir. Tente de novo.");
    }
  }

  async function pagarTudo() {
    // O mesmo `mesRef` da linha acima e do que o serviço grava: o número que
    // se confirma aqui tem de ser o que sai da conta.
    const totalQuit = valorQuitacao(p, mesRef, hoje);
    // O botão irmão paga UM mês; este paga a compra inteira e cria uma
    // despesa só, sem volta. A confirmação é o único sítio onde essa
    // diferença cabe por extenso.
    if (
      !(await confirmar(
        `Pagar tudo de "${p.descricao}" agora?\n\n${abertos.length} parcela(s) em aberto → ${formatMoney(totalQuit, moeda)} numa única despesa, lançada hoje.\n\nQuita a compra inteira de uma vez e não dá para desfazer.`,
      ))
    )
      return;
    await agir(
      () => quitarParcela(uid, p, mesRef, hoje),
      `✓ ${p.descricao} liquidada — ${formatMoney(totalQuit, moeda)}`,
    );
  }

  // Item 2 do lote de UX/nav (30/08): "Pagar {mês}" e "Pagar tudo" eram
  // botões de texto soltos ao lado do corpo — entram no menu único, junto
  // de Editar/Excluir, condicionais como já eram.
  const acoes: AcaoItem[] = [
    { rotulo: "Editar", Icone: Pencil, onClick: () => aoEditar(p) },
    ...(!quitada && proximo !== undefined && !p.autoDebit
      ? [
          {
            rotulo: `Pagar ${rotuloMes(proximo).split(" ")[0]}`,
            Icone: Check,
            onClick: () =>
              void agir(
                () => pagarMesParcela(uid, p, proximo),
                `✓ ${p.descricao} — ${rotuloMes(proximo)} paga`,
              ),
          },
        ]
      : []),
    ...(!quitada && abertos.length > 0
      ? [{ rotulo: "Pagar tudo", Icone: CheckCheck, onClick: () => void pagarTudo() }]
      : []),
    // Klarna e afins às vezes cobram parcelas desiguais: aqui acerta-se o
    // valor de cada mês ANTES de pagar. Mesma condição do "Pagar tudo" —
    // quitada, não há mais nada que o ajuste mude.
    ...(!quitada && abertos.length > 0
      ? [
          {
            rotulo: "Ajustar valores por mês",
            Icone: SlidersHorizontal,
            onClick: () => setValoresAbertos(true),
          },
        ]
      : []),
    { rotulo: "Excluir", Icone: Trash2, onClick: () => aoExcluir(p), tone: "perigo" },
  ];

  return (
    <div className={styles.parcela}>
      <button
        ref={ancoraRef}
        className={styles.corpo}
        onClick={() => setMenuAberto(true)}
        aria-haspopup="dialog"
      >
        <AnelProgresso pagas={pagas} total={total} quitada={quitada} />
        <span className={styles.info}>
          <span className={styles.nome}>{p.descricao}</span>
          {/* Se faltar espaço encurta-se o nome do cartão, nunca o valor. */}
          <span className={styles.detalhe}>
            {p.cartao && <span className={styles.cartaoNome}>{nomeDoCartao(p.cartao)}</span>}
            <span className={styles.porMes}>
              {p.cartao ? "\u00a0·\u00a0" : ""}
              {formatMoney(porMes, moeda)}/mês
            </span>
          </span>
        </span>
        <span className={styles.porPagar}>
          {quitada ? (
            <span className={styles.quitadaTxt}>liquidada</span>
          ) : (
            <>
              {formatMoney(valorQuitacao(p, mesRef, hoje), moeda)}
              <small>a pagar</small>
            </>
          )}
        </span>
      </button>

      <MenuAcoesItem
        aberta={menuAberto}
        aoFechar={() => setMenuAberto(false)}
        titulo={p.descricao}
        ancoraRef={ancoraRef}
        acoes={acoes}
      />

      {/* Fica dentro da linha para receber sempre a parcela fresca do store:
          o valor salvo aparece na folha logo a seguir, sem estado extra. */}
      <FolhaValoresParcela
        aberta={valoresAbertos}
        aoFechar={() => setValoresAbertos(false)}
        p={p}
        moeda={moeda}
        mesRef={mesRef}
        hoje={hoje}
        despesas={despesas}
      />
    </div>
  );
}

/** Caixa única de parcela: cria e edita (itens 7, 11, 12, 17, 19). */
function FormParcela({
  aberta,
  aoFechar,
  editando,
  despesas,
}: {
  aberta: boolean;
  aoFechar: () => void;
  editando: Parcela | null;
  /** Para soltar o vínculo dos lançamentos já pagos ao excluir — ver
   *  `excluirParcela`. */
  despesas: DespesaCorrente[];
}) {
  const uid = useUidSessao();
  const confirmar = useConfirmar();
  const cfg = useCfgStore((s) => s.cfg);
  const [descricao, setDescricao] = useState("");
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
    // Campo único de Descrição (01/09), como no Registro Rápido e no Veículo:
    // "Nome" e "Descrição (opcional)" eram dois campos para a mesma coisa. Uma
    // parcela antiga pode ter as duas partes gravadas — juntas ficam à vista e
    // editáveis, em vez de a segunda desaparecer calada ao salvar.
    setDescricao([editando?.descricao, editando?.nota].filter(Boolean).join(" · "));
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
      descricao: descricao.trim(),
      // Campo único de Descrição (01/09): a nota antiga já entrou no campo ao
      // abrir a folha, portanto apagá-la aqui não perde nada — deixá-la
      // gravada é que a tornava invisível e impossível de editar.
      nota: undefined,
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
        await atualizarParcela(uid, { ...editando, ...dados });
        mostrarToast("✓ Parcela atualizada");
      } else {
        await criarParcela(uid, { ...dados, pagoPorMes: {} });
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
      await excluirParcela(uid, editando, despesas);
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
        {/* O total da compra é o centro do formulário, não "mais um campo" a
            meia largura ao lado do nº de parcelas (item 4 do lote de UX/nav,
            30/08). Saiu da linha dupla porque o campo grande não cabe em meia
            largura. */}
        <CampoValorDestaque
          rotulo="Quanto no total?"
          valor={totalTexto}
          aoMudar={setTotalTexto}
          required
          // Cada mensagem de erro já descreve UM campo ("Valor total
          // inválido.", "Nº de parcelas inválido.", "Dia do vencimento
          // deve ser entre 1 e 31."), mas o estado não guarda QUAL foi —
          // aria-describedby nos três, não aria-invalid (que exigiria
          // saber exatamente qual, achado da auditoria de Acessibilidade,
          // mesmo raciocínio do Login).
          aria-describedby={erro !== null ? "erro-parcela" : undefined}
        />
        {/* Campo único de Descrição (01/09): eram "Nome" e "Descrição
            (opcional)" seguidos, dois campos para a mesma coisa. */}
        <label className={styles.campo}>
          Descrição
          <input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            required
            maxLength={120}
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
            aria-describedby={erro !== null ? "erro-parcela" : undefined}
          />
        </label>
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
              aria-describedby={erro !== null ? "erro-parcela" : undefined}
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
          rotuloOpcao={(c) => nomeAtualDoMetodo(cfg, c)}
          aoMudar={setCartao}
          rotuloVazio="Sem cartão"
        />
        <Seletor
          rotulo="Serviço de parcelamento (opcional)"
          valor={intermediador}
          opcoes={cfg.intermediadoresParcelamento}
          aoMudar={setIntermediador}
          rotuloVazio="Nenhum serviço"
          aviso="Nenhum serviço guardado ainda — adicione um na lista no fim da tela."
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
          <p id="erro-parcela" className={styles.erro} role="alert">
            {erro}
          </p>
        )}
        <Botao type="submit" variante="submeter">
          {editando ? "Salvar alterações" : "Criar parcela"}
        </Botao>
        {editando && (
          <Botao variante="perigo" onClick={() => void excluir()}>
            Excluir parcela
          </Botao>
        )}
      </form>
    </BottomSheet>
  );
}

/** A secção de Parcelas de Cartões (era a página /parcelas). */
export default function SecaoParcelas() {
  const cfg = useCfgStore((s) => s.cfg);
  const moeda = cfg.currency;
  const mesRef = useMesVisivelStore((s) => s.mes);
  const hoje = hojeIso();
  const parcelas = useParcelasStore((s) => s.itens);
  const despesas = useDespesasStore((s) => s.itens);
  const carregado = useParcelasStore((s) => s.carregado);
  const erro = useParcelasStore((s) => s.erro);
  const [folhaAberta, setFolhaAberta] = useState(false);
  const [editando, setEditando] = useState<Parcela | null>(null);
  // Ordem da lista (item 14) — não persiste entre visitas. Esta tela tem 8
  // opções, quatro delas só de parcela (ver utils/ordemParcelas.ts); a folha
  // mostra-as em 5 linhas, juntando cada par de direções opostas.
  const [ordem, setOrdem] = useState<OrdemParcela>("recentes");
  // Quitadas ficam sempre fora da lista: só aparecem numa folha à parte, para
  // rever o histórico sem misturar com o dia a dia nem rolar a página toda.
  const [quitadasAbertas, setQuitadasAbertas] = useState(false);
  const [novoIntermediador, setNovoIntermediador] = useState("");
  const uid = useUidSessao();
  const confirmar = useConfirmar();

  async function adicionarIntermediador(e: FormEvent) {
    e.preventDefault();
    const nome = novoIntermediador.trim();
    if (!nome) return mostrarToast("Escreva um nome primeiro.");
    try {
      await adicionarItemLista(uid, cfg, "intermediadoresParcelamento", nome);
      mostrarToast(`✓ "${nome}" adicionado`);
      setNovoIntermediador("");
    } catch (err) {
      mostrarToast(mensagemDeErroDados(err, "Não foi possível adicionar."));
    }
  }

  async function removerIntermediador(nome: string) {
    if (!(await confirmar(`Remover "${nome}"? Parcelas já criadas não mudam.`))) return;
    try {
      await removerItemLista(uid, cfg, "intermediadoresParcelamento", nome);
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

  // Item 2 do lote de UX/nav: Excluir vira ação do menu único da linha — o
  // mesmo `excluirParcela` que `FormParcela` já usava, chamado direto, sem
  // precisar abrir a edição primeiro.
  async function excluirDaLista(p: Parcela) {
    if (
      !(await confirmar(
        `Excluir a parcela "${p.descricao}"?\nOs meses já pagos continuam no histórico de despesas.`,
      ))
    )
      return;
    try {
      await excluirParcela(uid, p, despesas);
      mostrarToast("Parcela excluída");
    } catch {
      mostrarToast("Não foi possível excluir. Tente de novo.");
    }
  }

  // Tudo o que conta parcelas em aberto olha para o MÊS do header, e não para
  // o mês de "hoje": muda-se o mês em cima e os números acompanham. É também
  // esse mês que diz até onde uma parcela em débito automático já está
  // resolvida — mas o DIA de hoje ainda entra (parâmetro `hoje` abaixo),
  // porque dentro do mês do header em curso uma parcela vencendo dia 27 não
  // pode contar como quitada logo no dia 1, antes de o cartão cobrar de
  // facto (mesmo bug já corrigido em `pagoNoMes`/`faltaPagar`, abaixo).
  const quitadas = parcelas.filter((p) => parcelaQuitada(p, mesRef, hoje));
  // "/mês" é o total do mês exibido (inclui as quitadas, que vivem na folha
  // "Quitadas"); "por pagar" é a dívida de TODAS as compras parceladas.
  const totalDoMes = totalParcelasNoMes(parcelas, mesRef);
  const restanteTotal = parcelas.reduce((s, p) => s + valorQuitacao(p, mesRef, hoje), 0);

  const ativasVisiveis = parcelasVisiveis(
    parcelas,
    ordem,
    "ocultar",
    mesRef,
    cfg.diaVencimentoFatura,
    hoje,
  );
  const quitadasVisiveis = parcelasVisiveis(
    parcelas,
    ordem,
    "apenas",
    mesRef,
    cfg.diaVencimentoFatura,
    hoje,
  );

  return (
    <section className={styles.secao} aria-label="Parcelas">
      <div className={styles.cabecalho}>
        <h3 className={styles.subtitulo}>Parcelas</h3>
        <div className={styles.acoesCabecalho}>
          {parcelas.length > 1 && (
            <SeletorOrdemFolha valor={ordem} linhas={LINHAS_ORDEM_PARCELA} aoMudar={setOrdem} />
          )}
          {/* Só o "+" (01/09) — o título ao lado já diz "Compras parceladas".
              O texto inteiro vive no aria-label. */}
          <Botao variante="texto" soIcone aria-label="Adicionar parcela" onClick={abrirNova}>
            <Plus size={16} aria-hidden />
          </Botao>
        </div>
        <span className={styles.totais}>
          {formatMoney(totalDoMes, moeda)}/mês · {formatMoney(restanteTotal, moeda)} a pagar
        </span>
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
      ) : ativasVisiveis.length === 0 && quitadas.length > 0 ? (
        <p className={styles.tudoQuitado}>
          Tudo liquidado — toque em "Liquidadas" abaixo para rever.
        </p>
      ) : (
        <div className={styles.lista}>
          {ativasVisiveis.map((p) => (
            <LinhaParcela
              key={p.id}
              p={p}
              moeda={moeda}
              aoEditar={abrirEdicao}
              aoExcluir={(item) => void excluirDaLista(item)}
              mesRef={mesRef}
              hoje={hoje}
              nomeDoCartao={(id) => nomeAtualDoMetodo(cfg, id)}
              despesas={despesas}
            />
          ))}
        </div>
      )}

      {/* Quitadas ficam sempre fora da lista principal: o botão abre uma
          folha à parte com o histórico, em vez de crescer a página. */}
      {quitadas.length > 0 && (
        <div className={styles.rodape}>
          <button className={styles.botaoQuitadas} onClick={() => setQuitadasAbertas(true)}>
            <History size={16} aria-hidden />
            Liquidadas ({quitadas.length})
          </button>
        </div>
      )}

      <BottomSheet
        aberta={quitadasAbertas}
        aoFechar={() => setQuitadasAbertas(false)}
        titulo={`Liquidadas (${quitadas.length})`}
      >
        <div className={styles.lista}>
          {quitadasVisiveis.map((p) => (
            <LinhaParcela
              key={p.id}
              p={p}
              moeda={moeda}
              aoEditar={(item) => {
                setQuitadasAbertas(false);
                abrirEdicao(item);
              }}
              aoExcluir={(item) => void excluirDaLista(item)}
              mesRef={mesRef}
              hoje={hoje}
              nomeDoCartao={(id) => nomeAtualDoMetodo(cfg, id)}
              despesas={despesas}
            />
          ))}
        </div>
      </BottomSheet>

      {/* A lista destes serviços vive aqui, junto de quem a usa, e não em
          Definições — mesma razão dos locais de carregamento estarem no
          Veículo: é conceito deste domínio, não configuração geral.
          No código continuam a chamar-se "intermediadores" (é o nome do campo
          guardado); na tela ninguém diz isso, daí o texto ser outro. */}
      <form className={styles.gerir} onSubmit={adicionarIntermediador}>
        <p className={styles.gerirTitulo}>Serviços de parcelamento</p>
        <p className={styles.gerirNota}>
          Empresas que dividem a compra em prestações por você, quando o parcelamento não é do
          cartão (ex.: Klarna).
        </p>
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
            aria-label="Nome do serviço de parcelamento"
            value={novoIntermediador}
            onChange={(e) => setNovoIntermediador(e.target.value)}
          />
          <button type="submit" className={styles.gerirBotao}>
            Adicionar
          </button>
        </div>
      </form>

      <FormParcela
        aberta={folhaAberta}
        aoFechar={() => setFolhaAberta(false)}
        editando={editando}
        despesas={despesas}
      />
    </section>
  );
}

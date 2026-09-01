import { useRef, useState, type FormEvent } from "react";
import { Check, CheckCheck, History, Layers, Pencil, Plus, Trash2 } from "lucide-react";
import Pagina, { EstadoVazio, Kpis } from "../components/Pagina";
import KpiCard from "../components/KpiCard";
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
import { useParcelasStore } from "../stores/parcelasStore";
import { useMesVisivelStore } from "../stores/mesVisivelStore";
import { mostrarToast } from "../stores/toastStore";
import type { Cents, Currency, Parcela, YearMonth } from "../types";
import { mesAtual, rotuloMes } from "../utils/calculos";
import { formatMoney } from "../utils/money";
import { nomeAtualDoMetodo } from "../utils/instituicoes";
import { mensagemDeErroDados } from "../utils/erroDados";
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
import Botao from "../components/Botao";

function LinhaParcela({
  p,
  moeda,
  aoEditar,
  aoExcluir,
  mesRef,
  diaVencimentoFatura,
  nomeDoCartao,
}: {
  p: Parcela;
  moeda: Currency;
  aoEditar: (p: Parcela) => void;
  /** Item 2 do lote de UX/nav: Excluir vira ação do menu único — quem chama
   *  cuida da confirmação, igual ao mesmo padrão de ListaLancamentos. */
  aoExcluir: (p: Parcela) => void;
  mesRef: YearMonth;
  diaVencimentoFatura: Record<string, number> | undefined;
  /** O que a parcela guarda é o id do cartão, que nunca muda; o nome de hoje
   *  vem daqui, para uma parcela antiga não ficar presa a um nome antigo. */
  nomeDoCartao: (id: string) => string;
}) {
  const uid = useUidSessao();
  const confirmar = useConfirmar();
  const [menuAberto, setMenuAberto] = useState(false);
  const ancoraRef = useRef<HTMLButtonElement>(null);
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

  async function pagarTudo() {
    // O mesmo `mesRef` da linha acima e do que o serviço grava: o número que
    // se confirma aqui tem de ser o que sai da conta.
    const totalQuit = valorQuitacao(p, mesRef);
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
      () => quitarParcela(uid, p, mesRef),
      `✓ ${p.descricao} quitada — ${formatMoney(totalQuit, moeda)}`,
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
        <span className={styles.topo}>
          <span className={styles.info}>
            <span className={styles.nome}>{p.descricao}</span>
            <span className={styles.detalhe}>
              {formatMoney(p.total, moeda)}
              {p.nota ? ` · ${p.nota}` : ""}
              {p.cartao
                ? ` · ${nomeDoCartao(p.cartao)}${p.autoDebit ? " (débito autom.)" : ""}`
                : ""}
              {diaVenc ? ` · dia ${diaVenc}` : ""}
            </span>
          </span>
          <span className={`${styles.progresso} ${quitada ? styles.quitada : ""}`}>
            {pagas}/{total}
          </span>
        </span>

        {/* A barra era role="progressbar" com aria-valuenow/max, dentro de um
            <button> — um widget aninhado noutro widget, que os leitores de ecrã
            expõem mal, e ainda por cima sem nome acessível ("barra de
            progresso, 3" não diz de quê). O número já está ali ao lado, em
            texto, no `.progresso` ("3/10"): a barra é o eco visual dele. Sendo
            eco, o lugar dela é fora da árvore de acessibilidade — assim a linha
            é anunciada uma vez só, e bem. */}
        <span className={styles.barra} aria-hidden>
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

      <MenuAcoesItem
        aberta={menuAberto}
        aoFechar={() => setMenuAberto(false)}
        titulo={p.descricao}
        ancoraRef={ancoraRef}
        acoes={acoes}
      />
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
      await excluirParcela(uid, editando);
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
      await excluirParcela(uid, p);
      mostrarToast("Parcela excluída");
    } catch {
      mostrarToast("Não foi possível excluir. Tente de novo.");
    }
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
  // "Total do mês" soma TODAS as parcelas cujo plano cobre o mês exibido —
  // inclusive as já quitadas, que a lista principal não mostra (vivem na folha
  // "Quitadas", fechada por padrão). Sem dizer isto, o KPI mostrava € 300,00 e
  // a lista à vista só somava € 180,00, sem nada que explicasse a diferença.
  // Fatia do total que vem das quitadas: é ela que está fora da vista. Conta o
  // valor, e não o número delas, para não bater de frente com o "Quitadas (N)"
  // do rodapé, que conta as de TODOS os meses.
  const totalQuitadasNoMes = totalParcelasNoMes(quitadas, mesRef);

  const ativasVisiveis = parcelasVisiveis(
    parcelas,
    ordem,
    "ocultar",
    mesRef,
    cfg.diaVencimentoFatura,
  );
  const quitadasVisiveis = parcelasVisiveis(
    parcelas,
    ordem,
    "apenas",
    mesRef,
    cfg.diaVencimentoFatura,
  );

  return (
    <Pagina titulo="Parcelas">
      <Kpis pagina="parcelas">
        <KpiCard
          rotulo="Total do mês"
          valor={formatMoney(totalDoMes, moeda)}
          sub={
            totalQuitadasNoMes > 0
              ? `inclui ${formatMoney(totalQuitadasNoMes, moeda)} quitado`
              : undefined
          }
          tom="acento"
        />
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
          {/* Só o "+" (01/09) — o título ao lado já diz "Compras parceladas".
              O texto inteiro vive no aria-label. */}
          <Botao variante="texto" soIcone aria-label="Nova parcela" onClick={abrirNova}>
            <Plus size={16} aria-hidden />
          </Botao>
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
      ) : ativasVisiveis.length === 0 && quitadas.length > 0 ? (
        <p className={styles.tudoQuitado}>Tudo quitado — toque em "Quitadas" abaixo para rever.</p>
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
              diaVencimentoFatura={cfg.diaVencimentoFatura}
              nomeDoCartao={(id) => nomeAtualDoMetodo(cfg, id)}
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
            Quitadas ({quitadas.length})
          </button>
        </div>
      )}

      <BottomSheet
        aberta={quitadasAbertas}
        aoFechar={() => setQuitadasAbertas(false)}
        titulo={`Quitadas (${quitadas.length})`}
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
              diaVencimentoFatura={cfg.diaVencimentoFatura}
              nomeDoCartao={(id) => nomeAtualDoMetodo(cfg, id)}
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
      />
    </Pagina>
  );
}

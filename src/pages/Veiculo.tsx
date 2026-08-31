import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import {
  Car,
  Fuel,
  Gauge,
  MoreHorizontal,
  Pencil,
  Repeat,
  Trash2,
  Wrench,
  Zap,
} from "lucide-react";
import Pagina, { EstadoVazio, Kpis } from "../components/Pagina";
import AbaTransicao from "../components/AbaTransicao";
import ErroSincronizacao from "../components/ErroSincronizacao";
import BottomSheet from "../components/BottomSheet";
import CampoMoeda from "../components/CampoMoeda";
import KpiCard from "../components/KpiCard";
import MenuAcoesItem, { type AcaoItem } from "../components/MenuAcoesItem";
import RenomearFolha from "../components/RenomearFolha";
import SeletorData from "../components/SeletorData";
import Seletor from "../components/Seletor";
import SeletorLocal from "../components/SeletorLocal";
import SeletorSemana from "../components/SeletorSemana";
import {
  alternarPagoFixaVeiculo,
  atualizarCarga,
  atualizarDespesaVeiculo,
  atualizarFixaVeiculo,
  atualizarKm,
  criarFixaVeiculo,
  criarKm,
  removerCarga,
  removerDespesaVeiculo,
  removerFixaVeiculo,
  removerKm,
} from "../services/veiculoService";
import { adicionarItemLista, removerItemLista, renomearLocal } from "../services/cfgService";
import { useAbasTeclado } from "../hooks/useAbasTeclado";
import { useAcaoHeader } from "../hooks/useAcaoHeader";
import { useConfirmar } from "../hooks/useConfirmar";
import { useRadiogroupTeclado } from "../hooks/useRadiogroupTeclado";
import { useUidSessao } from "../hooks/useUidSessao";
import { useCfgStore } from "../stores/cfgStore";
import { useMesVisivelStore } from "../stores/mesVisivelStore";
import { mostrarToast } from "../stores/toastStore";
import { useUiStore } from "../stores/uiStore";
import { useVeiculoStore } from "../stores/veiculoStore";
import { hojeIso, mesAtual, mesDe, rotuloMes } from "../utils/calculos";
import { formatMoney } from "../utils/money";
import { nomeAtualDoMetodo } from "../utils/instituicoes";
import { mensagemDeErroDados } from "../utils/erroDados";
import { fixaAtivaNoMes, fixaEfetivamentePaga } from "../utils/fatura";
import { indiceDaSemana, naSemana, rotuloDaSemana, semanasDoMes } from "../utils/semanas";
import {
  kwhPeloCusto,
  litrosPeloCusto,
  precoKwhDoLocal,
  precoLitroDoLocal,
  totalCargasMes,
  totalDespesasVeiculoMes,
  totalVeiculoMes,
} from "../utils/veiculo";
import type { Abastecimento, Cents, DespesaFixa, DespesaVeiculo, Id, RegistroKm } from "../types";
import { idAba, idPainelAba } from "../utils/abas";
import styles from "./Veiculo.module.css";
import Botao from "../components/Botao";
import { rotuloTipoVeiculo } from "../constants/veiculoPadrao";

type Aba = "resumo" | "cargas" | "despesas" | "fixas" | "km";

/** Fonte única da ordem das abas: a lista desenhada e a ordem que as setas do
 *  teclado percorrem têm de ser a mesma. */
const ABAS = [
  ["resumo", "Resumo"],
  ["cargas", "Abastecimentos"],
  ["despesas", "Despesas"],
  ["fixas", "Fixas"],
  ["km", "Km"],
] as const satisfies readonly (readonly [Aba, string])[];

function agir(acao: () => Promise<unknown>, ok: string) {
  return acao()
    .then(() => mostrarToast(ok))
    .catch(() => mostrarToast("Não foi possível concluir. Tente de novo."));
}

/** "12,5 kWh" ou "34,2 L" — o que o abastecimento TEM decide a unidade, não
 *  o tipo do veículo agora (um híbrido reconfigurado ainda tem histórico das
 *  duas dimensões, e um dado antigo é sempre elétrico). */
function rotuloQuantidade(c: Abastecimento): string {
  if (c.kwh !== undefined) return `${c.kwh} kWh`;
  if (c.litros !== undefined) return `${c.litros} L`;
  return "";
}

/** Título de uma despesa do veículo na lista. O nome próprio (`descricao`) é
 *  obrigatório desde o ajuste F do lote de 30/08 (categoria deixou de existir
 *  como escolha) — mas continua opcional NO TIPO, e o fallback fica: registos
 *  antigos sem `descricao` ainda caem na categoria que tinham gravada, como
 *  sempre fizeram. */
function nomeDespesa(d: DespesaVeiculo): string {
  return d.descricao || d.categoria;
}

/** A linha de baixo da mesma despesa: o que não coube no título. A categoria
 *  só entra aqui quando já não é ela o título E ainda diz algo de verdade —
 *  "Veículo" é o valor fixo que todo registo NOVO grava (ajuste F), e
 *  repeti-lo aqui seria só ruído: já se está na tela Veículo. Um registo
 *  antigo com uma categoria de antes (ex. "Manutenção") continua a mostrá-la. */
function detalheDespesa(d: DespesaVeiculo): string {
  return [
    d.descricao && d.categoria !== "Veículo" ? d.categoria : null,
    d.nota,
    `${d.data.slice(8, 10)}/${d.data.slice(5, 7)}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Item de lista com o menu único de ações (item 2 do lote de UX/nav de
 *  30/08): a linha inteira abre Editar/Excluir num popover, em vez de ir
 *  direto pro formulário. Reaproveitado nas 5 listas desta tela (resumo,
 *  cargas, despesas, fixas, km) — cada uma só muda o que `aoEditar`/
 *  `aoExcluir` fazem. `extra` é só pro badge Pago/Pendente das fixas, que
 *  fica FORA do botão — é o próprio toggle, um controlo já dedicado e
 *  único, não um dos "botões espalhados" que este item veio consolidar. */
function ItemComMenu({
  nome,
  detalhe,
  valor,
  aoEditar,
  aoExcluir,
  extra,
}: {
  nome: string;
  detalhe: string;
  valor?: string;
  aoEditar: () => void;
  aoExcluir: () => void;
  extra?: ReactNode;
}) {
  const [menuAberto, setMenuAberto] = useState(false);
  const ancoraRef = useRef<HTMLButtonElement>(null);

  const acoes: AcaoItem[] = [
    { rotulo: "Editar", Icone: Pencil, onClick: aoEditar },
    { rotulo: "Excluir", Icone: Trash2, onClick: aoExcluir, tone: "perigo" },
  ];

  return (
    <div className={styles.item}>
      <button
        ref={ancoraRef}
        className={styles.itemCorpo}
        onClick={() => setMenuAberto(true)}
        aria-haspopup="dialog"
      >
        <span className={styles.itemTexto}>
          <span className={styles.itemNome}>{nome}</span>
          <span className={styles.itemDetalhe}>{detalhe}</span>
        </span>
        {valor !== undefined && <span className={styles.itemValor}>{valor}</span>}
      </button>
      {extra}
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

/** Pílula de local de abastecimento com o mesmo menu único de ações.
 *
 *  Antes tinha dois ícones colados lá dentro (renomear e remover): mesmo
 *  esticados à altura toda da pílula, em LARGURA ficavam nos ~26 pontos, longe
 *  dos 44 mínimos de toque — e dois alvos pequenos lado a lado é onde o dedo
 *  mais erra de botão. Um só botão "⋯", com 44 de largura, abre as mesmas duas
 *  ações em texto. Ver PENDENCIAS.md. */
function ChipComMenu({
  nome,
  aoRenomear,
  aoRemover,
}: {
  nome: string;
  aoRenomear: () => void;
  aoRemover: () => void;
}) {
  const [menuAberto, setMenuAberto] = useState(false);
  const ancoraRef = useRef<HTMLButtonElement>(null);

  const acoes: AcaoItem[] = [
    { rotulo: "Renomear", Icone: Pencil, onClick: aoRenomear },
    { rotulo: "Remover", Icone: Trash2, onClick: aoRemover, tone: "perigo" },
  ];

  return (
    <li className={styles.chip}>
      {nome}
      <button
        ref={ancoraRef}
        type="button"
        className={styles.chipMenu}
        onClick={() => setMenuAberto(true)}
        aria-haspopup="dialog"
        aria-label={`Ações de ${nome}`}
      >
        <MoreHorizontal size={16} aria-hidden />
      </button>
      <MenuAcoesItem
        aberta={menuAberto}
        aoFechar={() => setMenuAberto(false)}
        titulo={nome}
        ancoraRef={ancoraRef}
        acoes={acoes}
      />
    </li>
  );
}

export default function Veiculo() {
  const uid = useUidSessao();
  const confirmar = useConfirmar();
  const abrirRegistro = useUiStore((s) => s.abrirRegistro);
  const cfg = useCfgStore((s) => s.cfg);
  // Item B1: elétrico/combustão/híbrido decide que campos a aba de
  // abastecimento mostra. Sem escolha, "eletrico" preserva o comportamento
  // de sempre — dados antigos (todos elétricos) não pedem migração nenhuma.
  const tipoVeiculo = cfg.tipoVeiculo;
  const dados = useVeiculoStore((s) => s.dados);
  const carregado = useVeiculoStore((s) => s.carregado);
  const erro = useVeiculoStore((s) => s.erro);
  const { ref: radiogroupPeriodoRef, onKeyDown: aoTeclarPeriodo } =
    useRadiogroupTeclado<HTMLDivElement>();
  const { ref: radiogroupCustoRef, onKeyDown: aoTeclarCusto } =
    useRadiogroupTeclado<HTMLDivElement>();
  const { ref: radiogroupDimensaoRef, onKeyDown: aoTeclarDimensao } =
    useRadiogroupTeclado<HTMLDivElement>();

  // Chegar de Transações "Abrir em Veículo → Abastecimentos/Despesas" (item
  // 4.6) já abre na aba certa — a rota manda o destino pelo state da
  // navegação, porque a aba é estado local desta página.
  const location = useLocation();
  const abaPedida = (location.state as { aba?: string } | null)?.aba;
  const abaInicial = ABAS.some(([id]) => id === abaPedida) ? (abaPedida as Aba) : "resumo";
  const [aba, setAba] = useState<Aba>(abaInicial);
  const { propsLista, propsAba } = useAbasTeclado({
    abas: ABAS.map(([id]) => id),
    atual: aba,
    aoMudar: setAba,
  });
  const mes = useMesVisivelStore((s) => s.mes);
  const real = mesAtual();

  const gastoDoMes = totalVeiculoMes(dados, mes, real, hojeIso());
  const cargasDoMes = totalCargasMes(dados, mes);
  const despesasDoMes = totalDespesasVeiculoMes(dados, mes);
  const kmDoMes = dados.quilometragem
    .filter((k) => mesDe(k.data) === mes)
    .reduce((s, k) => s + k.km, 0);

  // Visão Mês / Semana da aba Abastecimentos (item 10). Já nasce na semana de
  // hoje, igual ao mês — sem isto, a primeira vez que se troca para "Semana"
  // abria sempre na primeira do mês em vez da atual.
  const [visaoCargas, setVisaoCargas] = useState<"mes" | "semana">("mes");
  const [semanaIdx, setSemanaIdx] = useState(() =>
    indiceDaSemana(semanasDoMes(mes, cfg.diaInicioSemana), hojeIso()),
  );
  const semanas = semanasDoMes(mes, cfg.diaInicioSemana);
  const [mesDaSemana, setMesDaSemana] = useState(mes);
  if (mesDaSemana !== mes) {
    setMesDaSemana(mes);
    setSemanaIdx(indiceDaSemana(semanas, hojeIso()));
  }
  const semanaAtual = semanas[Math.min(semanaIdx, semanas.length - 1)];
  const cargasVisiveis =
    visaoCargas === "semana" && semanaAtual
      ? naSemana(dados.cargas, semanaAtual)
      : dados.cargas.filter((c) => mesDe(c.data) === mes);

  // Na aba Abastecimentos com "Semana" escolhida, o KPI de cargas acompanha a
  // lista em vez de continuar preso ao mês. Os outros três não têm filtro de
  // semana próprio e ficam mensais.
  const cargasPorSemana = aba === "cargas" && visaoCargas === "semana" && semanaAtual !== undefined;
  const totalCargasVisiveis = cargasVisiveis.reduce((s, c) => s + c.custo, 0);

  // Todas as abas mostram só o mês do seletor no topo — inclusive Km: o
  // registo de km é incremental (o KPI "Km no mês" SOMA os do mês), não uma
  // leitura de odômetro acumulada, então é uma entrada do mês como qualquer
  // outra. Ver o histórico completo = trocar de mês no topo.
  const cargasDoMesLista = dados.cargas.filter((c) => mesDe(c.data) === mes);
  const despesasVisiveis = dados.despesas.filter((d) => mesDe(d.data) === mes);
  const kmVisiveis = dados.quilometragem.filter((k) => mesDe(k.data) === mes);
  const fixasVisiveis = dados.despesasFixas.filter((f) => fixaAtivaNoMes(f, mes));

  // ---- caixa de quilometragem (criar/editar — itens 2, 5, 7) ----
  const [kmAberta, setKmAberta] = useState(false);
  const [kmEditandoId, setKmEditandoId] = useState<Id | null>(null);
  const [kmValor, setKmValor] = useState("");
  const [kmData, setKmData] = useState(hojeIso());
  const [kmNota, setKmNota] = useState("");

  function abrirNovoKm() {
    setKmEditandoId(null);
    setKmValor("");
    setKmData(hojeIso());
    setKmNota("");
    setKmAberta(true);
  }

  function abrirEdicaoKm(k: RegistroKm) {
    setKmEditandoId(k.id);
    setKmValor(String(k.km).replace(".", ","));
    setKmData(k.data);
    setKmNota(k.nota ?? "");
    setKmAberta(true);
  }

  async function salvarKm(e: FormEvent) {
    e.preventDefault();
    const km = parseFloat(kmValor.replace(",", "."));
    if (!Number.isFinite(km) || km <= 0) return mostrarToast("Km inválido.");
    const dados_ = { km, data: kmData || hojeIso(), nota: kmNota.trim() || undefined };
    if (kmEditandoId) {
      await agir(() => atualizarKm(uid, { ...dados_, id: kmEditandoId }), "✓ Registo atualizado");
    } else {
      await agir(() => criarKm(uid, dados_), "✓ Quilometragem registada");
    }
    setKmAberta(false);
  }

  async function excluirKm() {
    if (!kmEditandoId) return;
    if (!(await confirmar("Excluir este registo de km?"))) return;
    const id = kmEditandoId;
    setKmAberta(false);
    await agir(() => removerKm(uid, id), "Registo excluído");
  }

  async function excluirKmDaLista(id: Id) {
    if (!(await confirmar("Excluir este registo de km?"))) return;
    await agir(() => removerKm(uid, id), "Registo excluído");
  }

  // ---- caixa de abastecimento (só edita — ver comentário mais abaixo) ----
  const [cgAberta, setCgAberta] = useState(false);
  const [cgEditandoId, setCgEditandoId] = useState<Id | null>(null);
  // Só existe escolha num veículo híbrido: elétrico/combustão puro já sabe
  // qual é a sua única dimensão, sem perguntar. `dimensao` (mais abaixo) é
  // quem decide de facto — este estado só guarda a escolha QUANDO há uma.
  const [cgDimensaoHibrida, setCgDimensaoHibrida] = useState<"eletrico" | "combustao">("eletrico");
  const dimensao = tipoVeiculo === "hibrido" ? cgDimensaoHibrida : (tipoVeiculo ?? "eletrico");
  const [modoCusto, setModoCusto] = useState<"total" | "unidade">("total");
  const [cgKwh, setCgKwh] = useState("");
  const [cgLitros, setCgLitros] = useState("");
  const [cgCustoTotal, setCgCustoTotal] = useState<Cents | null>(null);
  const [cgPrecoKwh, setCgPrecoKwh] = useState<Cents | null>(null);
  const [cgPrecoLitro, setCgPrecoLitro] = useState<Cents | null>(null);
  const [cgLocal, setCgLocal] = useState("");
  const [cgConta, setCgConta] = useState("");
  const [cgSessao, setCgSessao] = useState("");
  const [cgNota, setCgNota] = useState("");
  const [cgData, setCgData] = useState(hojeIso());
  // O kWh/litros preenche-se sozinho a partir do custo, mas assim que o
  // usuário lhe toca deixa de ser recalculado — o palpite não pode apagar o
  // que ele escreveu. Volta a ligar ao abrir outro abastecimento ou ao
  // trocar de local.
  const [quantidadeTocada, setQuantidadeTocada] = useState(false);

  /** Refaz o palpite de kWh/litros com o custo e o local que valerem agora. Só
   *  no modo "Custo total": no modo €/unidade o usuário já informa o preço,
   *  não há custo de onde derivar. Sem histórico naquele local (na dimensão
   *  certa — elétrico não empresta preço pro combustível nem vice-versa), não
   *  há preço de referência — fica vazio para escrever à mão, como antes. */
  function palpitarQuantidade(custo: Cents | null, local: string) {
    if (modoCusto !== "total" || custo === null || custo <= 0) return;
    if (dimensao === "eletrico") {
      const preco = precoKwhDoLocal(dados.cargas, local);
      if (preco !== undefined) setCgKwh(kwhPeloCusto(custo, preco));
    } else {
      const preco = precoLitroDoLocal(dados.cargas, local);
      if (preco !== undefined) setCgLitros(litrosPeloCusto(custo, preco));
    }
  }

  // Criar um abastecimento novo passou a ser só pelo registro rápido global
  // (FAB), que já cobre este mesmo formulário (item A2) — aqui fica só a
  // edição de um já existente, aberto ao tocar num item da lista.
  function abrirEdicaoCarga(c: Abastecimento) {
    setCgEditandoId(c.id);
    // A dimensão do registo é o que ele TEM, não o tipo do veículo agora —
    // um híbrido pode ter abastecimentos elétricos antigos mesmo depois de
    // reconfigurado, e um dado antigo (sempre elétrico) continua a editar
    // como elétrico.
    setCgDimensaoHibrida(c.kwh !== undefined ? "eletrico" : "combustao");
    setModoCusto("total");
    setCgKwh(c.kwh !== undefined ? String(c.kwh).replace(".", ",") : "");
    setCgLitros(c.litros !== undefined ? String(c.litros).replace(".", ",") : "");
    setCgCustoTotal(c.custo);
    setCgPrecoKwh(c.precoKwh ?? null);
    setCgPrecoLitro(c.precoLitro ?? null);
    setCgLocal(c.local);
    setCgConta(c.contaCartao ?? "");
    setCgSessao(c.sessao ?? "");
    setCgNota(c.nota ?? "");
    setCgData(c.data);
    // Num abastecimento já gravado a quantidade é dado, não palpite: não se
    // mexe nela até o usuário mudar o local de propósito.
    setQuantidadeTocada(true);
    setCgAberta(true);
  }

  // Só edita — criar abastecimento novo é sempre pelo registro rápido global
  // agora (item A2), então esta folha só abre com `cgEditandoId` já
  // preenchido (ver `abrirEdicaoCarga`).
  async function salvarCarga(e: FormEvent) {
    e.preventDefault();
    if (!cgEditandoId) return;
    const local = cgLocal.trim();
    if (!local) return mostrarToast("Escolha o local.");

    let custo: number;
    let campos: Pick<Abastecimento, "kwh" | "precoKwh" | "litros" | "precoLitro">;
    if (dimensao === "eletrico") {
      const kwh = parseFloat(cgKwh.replace(",", "."));
      if (!Number.isFinite(kwh) || kwh <= 0) return mostrarToast("kWh inválido.");
      let precoKwh: number;
      if (modoCusto === "total") {
        const c = cgCustoTotal;
        if (c === null || c <= 0) return mostrarToast("Custo total inválido.");
        custo = c;
        precoKwh = Math.round(c / kwh);
      } else {
        const p = cgPrecoKwh;
        if (p === null || p <= 0) return mostrarToast("Preço/kWh inválido.");
        precoKwh = p;
        custo = Math.round(kwh * p);
      }
      campos = { kwh, precoKwh };
    } else {
      const litros = parseFloat(cgLitros.replace(",", "."));
      if (!Number.isFinite(litros) || litros <= 0) return mostrarToast("Litros inválido.");
      let precoLitro: number;
      if (modoCusto === "total") {
        const c = cgCustoTotal;
        if (c === null || c <= 0) return mostrarToast("Custo total inválido.");
        custo = c;
        precoLitro = Math.round(c / litros);
      } else {
        const p = cgPrecoLitro;
        if (p === null || p <= 0) return mostrarToast("Preço/litro inválido.");
        precoLitro = p;
        custo = Math.round(litros * p);
      }
      campos = { litros, precoLitro };
    }
    const dados_ = {
      data: cgData,
      ...campos,
      custo,
      local,
      contaCartao: cgConta || undefined,
      sessao: cgSessao.trim() || undefined,
      nota: cgNota.trim() || undefined,
    };
    try {
      await atualizarCarga(uid, { ...dados_, id: cgEditandoId });
      mostrarToast("✓ Abastecimento atualizado");
      setCgAberta(false);
    } catch {
      mostrarToast("Não foi possível salvar.");
    }
  }

  // ---- gestão dos locais de abastecimento (mesmo padrão de Cartões) ----
  const [novoLocal, setNovoLocal] = useState("");

  async function adicionarLocal(e: FormEvent) {
    e.preventDefault();
    const nome = novoLocal.trim();
    if (!nome) return mostrarToast("Escreva um nome primeiro.");
    try {
      await adicionarItemLista(uid, cfg, "locaisCarregamento", nome);
      mostrarToast(`✓ "${nome}" adicionado`);
      setNovoLocal("");
    } catch (err) {
      mostrarToast(mensagemDeErroDados(err, "Não foi possível adicionar."));
    }
  }

  async function removerLocal(nome: string) {
    if (!(await confirmar(`Remover "${nome}"? Abastecimentos já registados não mudam.`))) return;
    try {
      await removerItemLista(uid, cfg, "locaisCarregamento", nome);
      mostrarToast(`"${nome}" removido`);
    } catch {
      mostrarToast("Não foi possível remover.");
    }
  }

  // Renomear um local (com cascata nos abastecimentos já registados). As
  // categorias do veículo saíram daqui para Definições › Veículo, onde usam o
  // mesmo editor das categorias de despesa gerais — sobrou só o local, que se
  // escreve enquanto se regista um abastecimento e por isso fica junto dele.
  const [renomeando, setRenomeando] = useState<string | null>(null);

  async function renomear(nomeNovo: string) {
    if (!renomeando) return;
    try {
      await renomearLocal(uid, cfg, renomeando, nomeNovo);
      setRenomeando(null);
      mostrarToast(`✓ Agora chama-se "${nomeNovo.trim()}"`);
    } catch (err) {
      mostrarToast(mensagemDeErroDados(err, "Não foi possível renomear."));
    }
  }

  async function excluirCarga() {
    if (!cgEditandoId) return;
    if (!(await confirmar("Excluir este abastecimento?"))) return;
    const id = cgEditandoId;
    setCgAberta(false);
    await agir(() => removerCarga(uid, id), "Abastecimento excluído");
  }

  // Item 2 do lote de UX/nav: Excluir vira ação do menu único da linha,
  // direto — sem passar pela edição primeiro.
  async function excluirCargaDaLista(id: Id) {
    if (!(await confirmar("Excluir este abastecimento?"))) return;
    await agir(() => removerCarga(uid, id), "Abastecimento excluído");
  }

  // ---- caixa de despesa variável do veículo (criar/editar) ----
  const [dvAberta, setDvAberta] = useState(false);
  const [dvEditandoId, setDvEditandoId] = useState<Id | null>(null);
  const [dvValor, setDvValor] = useState<Cents | null>(null);
  const [dvConta, setDvConta] = useState("");
  const [dvData, setDvData] = useState(hojeIso());
  const [dvDescricao, setDvDescricao] = useState("");
  const [dvNota, setDvNota] = useState("");

  // Mesmo caso da carga: criar despesa nova é sempre pelo registro rápido
  // global agora (item A2) — aqui fica só a edição de uma já existente.
  function abrirEdicaoDespesa(d: DespesaVeiculo) {
    setDvEditandoId(d.id);
    setDvValor(d.valor);
    setDvConta(d.contaCartao ?? "");
    setDvData(d.data);
    setDvDescricao(d.descricao ?? "");
    setDvNota(d.nota ?? "");
    setDvAberta(true);
  }

  // Só edita — mesma ressalva de `salvarCarga`: esta folha só abre com
  // `dvEditandoId` já preenchido (ver `abrirEdicaoDespesa`).
  async function salvarDespesa(e: FormEvent) {
    e.preventDefault();
    if (!dvEditandoId) return;
    const valor = dvValor;
    if (valor === null || valor <= 0) return mostrarToast("Valor inválido.");
    if (!dvDescricao.trim()) return mostrarToast("Nome obrigatório.");
    const dados_ = {
      data: dvData,
      valor,
      // Ajuste F do lote de 30/08: categoria fixa, não é mais escolha do
      // usuário — é o MESMO nome que a cor/ícone únicos do veículo usam
      // (Definições › Veículo).
      categoria: "Veículo",
      descricao: dvDescricao.trim(),
      contaCartao: dvConta || undefined,
      nota: dvNota.trim() || undefined,
    };
    await agir(
      () => atualizarDespesaVeiculo(uid, { ...dados_, id: dvEditandoId }),
      "✓ Despesa atualizada",
    );
    setDvAberta(false);
  }

  async function excluirDespesa() {
    if (!dvEditandoId) return;
    if (!(await confirmar("Excluir esta despesa do veículo?"))) return;
    const id = dvEditandoId;
    setDvAberta(false);
    await agir(() => removerDespesaVeiculo(uid, id), "Despesa excluída");
  }

  async function excluirDespesaDaLista(id: Id) {
    if (!(await confirmar("Excluir esta despesa do veículo?"))) return;
    await agir(() => removerDespesaVeiculo(uid, id), "Despesa excluída");
  }

  // ---- caixa de despesa fixa do veículo (criar/editar) ----
  const [dfAberta, setDfAberta] = useState(false);
  const [dfEditandoId, setDfEditandoId] = useState<Id | null>(null);
  const [dfDescricao, setDfDescricao] = useState("");
  const [dfNota, setDfNota] = useState("");
  const [dfValor, setDfValor] = useState<Cents | null>(null);
  const [dfDia, setDfDia] = useState("");

  function abrirNovaFixa() {
    setDfEditandoId(null);
    setDfDescricao("");
    setDfNota("");
    setDfValor(null);
    setDfDia("");
    setDfAberta(true);
  }

  // O "+" do cabeçalho no Veículo. Aqui há QUATRO coisas diferentes para
  // adicionar, uma por aba, e por isso ele não é sempre igual:
  //
  //  - numa aba de conteúdo (Abastecimentos, Despesas, Fixas, Km) faz logo a
  //    da aba aberta — o que está à vista não deixa dúvida de qual é;
  //  - no "Resumo" não há aba nenhuma a apontar para uma das quatro, e um "+"
  //    que escolhesse por conta própria escolheria mal. Lá ele abre o menu com
  //    as quatro, o mesmo das listas e das pílulas de gerir.
  const ADICIONAR_POR_ABA = {
    cargas: {
      rotulo: "Adicionar abastecimento",
      Icone: Fuel,
      onClick: () => abrirRegistro("carga"),
    },
    despesas: {
      rotulo: "Adicionar despesa do veículo",
      Icone: Wrench,
      onClick: () => abrirRegistro("despesaVeiculo"),
    },
    fixas: { rotulo: "Adicionar despesa fixa do veículo", Icone: Repeat, onClick: abrirNovaFixa },
    km: { rotulo: "Adicionar quilometragem", Icone: Gauge, onClick: abrirNovoKm },
  } as const;

  useAcaoHeader(
    aba === "resumo"
      ? {
          rotulo: "Adicionar no veículo",
          acoes: Object.values(ADICIONAR_POR_ABA).map(({ rotulo, Icone, onClick }) => ({
            // No menu o rótulo é o nome da coisa; o "Adicionar" já está dito
            // pelo botão que o abriu.
            rotulo: rotulo.replace(/^Adicionar /, "").replace(/^./, (c) => c.toUpperCase()),
            Icone,
            onClick,
          })),
        }
      : ADICIONAR_POR_ABA[aba],
  );

  function abrirEdicaoFixa(f: DespesaFixa) {
    setDfEditandoId(f.id);
    setDfDescricao(f.descricao);
    setDfNota(f.nota ?? "");
    setDfValor(f.valor);
    setDfDia(f.diaVencimento ? String(f.diaVencimento) : "");
    setDfAberta(true);
  }

  async function salvarFixa(e: FormEvent) {
    e.preventDefault();
    const valor = dfValor;
    if (valor === null || valor <= 0) return mostrarToast("Valor inválido.");
    if (!dfDescricao.trim()) return mostrarToast("Nome obrigatório.");
    const dia = dfDia.trim() === "" ? undefined : Number(dfDia);
    if (dia !== undefined && (!Number.isInteger(dia) || dia < 1 || dia > 31))
      return mostrarToast("Dia do vencimento deve ser entre 1 e 31.");
    const base = {
      descricao: dfDescricao,
      nota: dfNota.trim() || undefined,
      valor,
      // Ajuste F do lote de 30/08: categoria fixa — ver a mesma nota na
      // despesa variável, acima.
      categoria: "Veículo",
      diaVencimento: dia,
    };
    if (dfEditandoId) {
      const atual = dados.despesasFixas.find((f) => f.id === dfEditandoId);
      if (!atual) return;
      await agir(
        () => atualizarFixaVeiculo(uid, { ...atual, ...base }),
        "✓ Despesa fixa atualizada",
      );
    } else {
      await agir(() => criarFixaVeiculo(uid, { ...base, pagoPorMes: {} }), "✓ Despesa fixa criada");
    }
    setDfAberta(false);
  }

  async function excluirFixa() {
    const atual = dados.despesasFixas.find((f) => f.id === dfEditandoId);
    if (!atual) return;
    if (!(await confirmar(`Excluir "${atual.descricao}"?`))) return;
    setDfAberta(false);
    await agir(() => removerFixaVeiculo(uid, atual.id), "Despesa fixa excluída");
  }

  async function excluirFixaDaLista(f: DespesaFixa) {
    if (!(await confirmar(`Excluir "${f.descricao}"?`))) return;
    await agir(() => removerFixaVeiculo(uid, f.id), "Despesa fixa excluída");
  }

  return (
    <Pagina titulo="Veículo">
      <Kpis pagina="veiculo">
        <KpiCard
          rotulo="Gasto do mês"
          valor={formatMoney(gastoDoMes, cfg.currency)}
          tom="vermelho"
        />
        <KpiCard
          rotulo="Abastecimentos"
          valor={formatMoney(cargasPorSemana ? totalCargasVisiveis : cargasDoMes, cfg.currency)}
          sub={cargasPorSemana && semanaAtual ? rotuloDaSemana(semanaAtual) : undefined}
        />
        <KpiCard rotulo="Despesas" valor={formatMoney(despesasDoMes, cfg.currency)} />
        <KpiCard rotulo="Km no mês" valor={kmDoMes ? kmDoMes.toLocaleString("pt-PT") : "0"} />
      </Kpis>

      <div className={styles.abas} role="tablist" {...propsLista}>
        {ABAS.map(([id, nome]) => (
          <button
            key={id}
            role="tab"
            id={idAba(id)}
            aria-selected={aba === id}
            aria-controls={idPainelAba(id)}
            {...propsAba(id)}
            className={`${styles.abaBotao} ${aba === id ? styles.abaAtiva : ""}`}
            onClick={() => setAba(id)}
          >
            {nome}
          </button>
        ))}
      </div>

      {/* As 5 abas vêm da mesma store, então o aviso é um só, acima delas. Fica
          na versão compacta mesmo sem dados: o "+" do cabeçalho continua a
          fazer sentido, e o estado vazio de cada aba deixa de enganar com a
          tira logo acima a dizer que a sincronização caiu. */}
      {erro && <ErroSincronizacao compacto />}

      <AbaTransicao aba={aba}>
        {aba === "resumo" && (
          <div className={styles.lista}>
            {cargasDoMesLista.length === 0 && despesasVisiveis.length === 0 && carregado ? (
              <EstadoVazio
                Icone={Car}
                mensagem={
                  dados.cargas.length === 0 && dados.despesas.length === 0
                    ? "Nenhum registo do veículo ainda"
                    : `Nenhum registo do veículo em ${rotuloMes(mes)}`
                }
                sub="Toque no + do cabeçalho para registar km, abastecimentos ou despesas."
              />
            ) : (
              <>
                {[...cargasDoMesLista]
                  .sort((a, b) => (a.data < b.data ? 1 : -1))
                  .map((c) => (
                    <ItemComMenu
                      key={c.id}
                      nome={`Abastecimento · ${c.local}`}
                      detalhe={`${rotuloQuantidade(c)} · ${c.data.slice(8, 10)}/${c.data.slice(5, 7)}`}
                      valor={formatMoney(c.custo, cfg.currency)}
                      aoEditar={() => abrirEdicaoCarga(c)}
                      aoExcluir={() => void excluirCargaDaLista(c.id)}
                    />
                  ))}
                {[...despesasVisiveis]
                  .sort((a, b) => (a.data < b.data ? 1 : -1))
                  .map((d) => (
                    <ItemComMenu
                      key={d.id}
                      nome={nomeDespesa(d)}
                      detalhe={detalheDespesa(d)}
                      valor={formatMoney(d.valor, cfg.currency)}
                      aoEditar={() => abrirEdicaoDespesa(d)}
                      aoExcluir={() => void excluirDespesaDaLista(d.id)}
                    />
                  ))}
              </>
            )}
          </div>
        )}

        {aba === "cargas" && (
          <>
            <div className={styles.cabecalhoLista}>
              <h3 className={styles.tituloSecao}>Abastecimentos</h3>
            </div>

            {/* Item B1: a motorização decide que campos o formulário (aqui e
                no registro rápido) mostra — elétrico só kWh, combustão só
                litros, híbrido os dois. Aqui é só leitura: escolhe-se uma vez
                em Definições › Veículo, e é lá que se muda. Sem esta linha, um
                formulário que só pede litros não explicava porquê. */}
            <p className={styles.notaTipo}>
              Veículo {rotuloTipoVeiculo(tipoVeiculo).toLowerCase()} — mude em Definições › Veículo.
            </p>

            <div className={styles.linhaVisao}>
              <div
                className={styles.alternadorVisao}
                role="radiogroup"
                aria-label="Período"
                ref={radiogroupPeriodoRef}
                onKeyDown={aoTeclarPeriodo}
              >
                {(
                  [
                    ["mes", "Mês"],
                    ["semana", "Semana"],
                  ] as const
                ).map(([id, nome]) => (
                  <button
                    key={id}
                    role="radio"
                    aria-checked={visaoCargas === id}
                    className={`${styles.visaoBotao} ${visaoCargas === id ? styles.visaoAtiva : ""}`}
                    onClick={() => setVisaoCargas(id)}
                  >
                    {nome}
                  </button>
                ))}
              </div>
              {visaoCargas === "semana" && (
                <SeletorSemana semanas={semanas} indice={semanaIdx} aoMudar={setSemanaIdx} />
              )}
            </div>

            <div className={styles.lista}>
              {cargasVisiveis.length === 0 ? (
                <EstadoVazio
                  Icone={tipoVeiculo === "combustao" ? Fuel : Zap}
                  mensagem={
                    visaoCargas === "semana" && semanaAtual
                      ? `Nenhum abastecimento em ${rotuloDaSemana(semanaAtual)}`
                      : `Nenhum abastecimento em ${rotuloMes(mes)}`
                  }
                  sub="Registe um abastecimento com o + do cabeçalho."
                />
              ) : (
                [...cargasVisiveis]
                  .sort((a, b) => (a.data < b.data ? 1 : -1))
                  .map((c) => (
                    <ItemComMenu
                      key={c.id}
                      nome={c.local}
                      detalhe={`${rotuloQuantidade(c)} · ${formatMoney(c.precoKwh ?? c.precoLitro ?? 0, cfg.currency)}/${c.kwh !== undefined ? "kWh" : "L"} · ${c.data.slice(8, 10)}/${c.data.slice(5, 7)}${c.sessao ? ` · ${c.sessao}` : ""}`}
                      valor={formatMoney(c.custo, cfg.currency)}
                      aoEditar={() => abrirEdicaoCarga(c)}
                      aoExcluir={() => void excluirCargaDaLista(c.id)}
                    />
                  ))
              )}
            </div>

            {/* Os locais são escolhidos por chip no formulário de carga — a lista
                vive aqui, junto de quem a usa, e não em Definições. */}
            <form className={styles.gerir} onSubmit={adicionarLocal}>
              <p className={styles.gerirTitulo}>Locais de abastecimento</p>
              {cfg.locaisCarregamento.length > 0 && (
                <ul className={styles.chips}>
                  {cfg.locaisCarregamento.map((l) => (
                    <ChipComMenu
                      key={l}
                      nome={l}
                      aoRenomear={() => setRenomeando(l)}
                      aoRemover={() => void removerLocal(l)}
                    />
                  ))}
                </ul>
              )}
              <div className={styles.gerirLinha}>
                <input
                  placeholder="Nome (ex. Galp Matosinhos)"
                  aria-label="Nome do local de abastecimento"
                  value={novoLocal}
                  onChange={(e) => setNovoLocal(e.target.value)}
                />
                <button type="submit" className={styles.gerirBotao}>
                  Adicionar
                </button>
              </div>
            </form>
          </>
        )}

        {aba === "despesas" && (
          <>
            <div className={styles.cabecalhoLista}>
              <h3 className={styles.tituloSecao}>Despesas do veículo</h3>
            </div>

            <div className={styles.lista}>
              {despesasVisiveis.length === 0 ? (
                <EstadoVazio
                  Icone={Wrench}
                  mensagem={`Nenhuma despesa do veículo em ${rotuloMes(mes)}`}
                  sub="Manutenção, seguro, portagens — registe com o + do cabeçalho."
                />
              ) : (
                [...despesasVisiveis]
                  .sort((a, b) => (a.data < b.data ? 1 : -1))
                  .map((d) => (
                    <ItemComMenu
                      key={d.id}
                      nome={nomeDespesa(d)}
                      detalhe={detalheDespesa(d)}
                      valor={formatMoney(d.valor, cfg.currency)}
                      aoEditar={() => abrirEdicaoDespesa(d)}
                      aoExcluir={() => void excluirDespesaDaLista(d.id)}
                    />
                  ))
              )}
            </div>
          </>
        )}

        {aba === "fixas" && (
          <>
            <div className={styles.cabecalhoLista}>
              <h3 className={styles.tituloSecao}>Despesas fixas do veículo</h3>
            </div>

            <div className={styles.lista}>
              {fixasVisiveis.length === 0 ? (
                // Mesmo ícone das fixas gerais em Despesas: é o mesmo conceito.
                <EstadoVazio
                  Icone={Repeat}
                  mensagem={`Nenhuma despesa fixa do veículo em ${rotuloMes(mes)}`}
                  sub="As já criadas começam ou terminam em outros meses."
                />
              ) : (
                fixasVisiveis.map((f) => {
                  // Mesma regra do resto do app (ver Despesas fixas gerais):
                  // débito automático paga sozinha a partir do vencimento, e
                  // por isso não vira ação — não há hoje campo na folha pra
                  // ligar autoDebit numa fixa do veículo, mas o tipo é
                  // partilhado e o cálculo (`fixaEfetivamentePaga`) já cobre.
                  const paga = fixaEfetivamentePaga(f, mes, mesAtual(), hojeIso());
                  return (
                    <ItemComMenu
                      key={f.id}
                      nome={f.descricao}
                      detalhe={`${f.categoria}${f.diaVencimento ? ` · dia ${f.diaVencimento}` : ""}`}
                      valor={formatMoney(f.valor, cfg.currency)}
                      aoEditar={() => abrirEdicaoFixa(f)}
                      aoExcluir={() => void excluirFixaDaLista(f)}
                      extra={
                        f.autoDebit ? (
                          <span
                            className={`${styles.badgeToggle} ${paga ? styles.badgePago : styles.badgePendente}`}
                          >
                            {paga ? "Pago" : "Pendente"}
                          </span>
                        ) : (
                          <button
                            className={`${styles.badgeToggle} ${paga ? styles.badgePago : styles.badgePendente}`}
                            // Mesmo tratamento das fixas gerais: sem isto, uma
                            // lista de fixas dava vários botões chamados só
                            // "Pago"/"Pendente", sem dizer de qual, e sem
                            // anunciar que alternam estado.
                            aria-pressed={paga}
                            aria-label={`${f.descricao} — ${paga ? "pago" : "pendente"}`}
                            onClick={() =>
                              void agir(
                                () => alternarPagoFixaVeiculo(uid, f.id, mes, !paga),
                                paga ? "Marcado como pendente" : "✓ Pago em " + rotuloMes(mes),
                              )
                            }
                          >
                            {paga ? "Pago" : "Pendente"}
                          </button>
                        )
                      }
                    />
                  );
                })
              )}
            </div>
          </>
        )}

        {aba === "km" && (
          <>
            <div className={styles.cabecalhoLista}>
              <h3 className={styles.tituloSecao}>Quilometragem</h3>
            </div>

            <div className={styles.lista}>
              {kmVisiveis.length === 0 ? (
                <EstadoVazio
                  Icone={Gauge}
                  mensagem={`Nenhum registo de km em ${rotuloMes(mes)}`}
                  sub="Anote o conta-quilómetros para acompanhar o consumo."
                />
              ) : (
                [...kmVisiveis]
                  .sort((a, b) => (a.data < b.data ? 1 : -1))
                  .map((k) => (
                    <ItemComMenu
                      key={k.id}
                      nome={`${k.km.toLocaleString("pt-PT")} km`}
                      detalhe={`${k.nota ? `${k.nota} · ` : ""}${k.data.slice(8, 10)}/${k.data.slice(5, 7)}`}
                      aoEditar={() => abrirEdicaoKm(k)}
                      aoExcluir={() => void excluirKmDaLista(k.id)}
                    />
                  ))
              )}
            </div>
          </>
        )}

        {/* Caixa de abastecimento: só edita — criar é pelo registro rápido
            global (item A2, itens 2, 5, 7, 16, 17) */}
      </AbaTransicao>
      <BottomSheet
        aberta={cgAberta}
        aoFechar={() => setCgAberta(false)}
        titulo="Editar abastecimento"
      >
        <form className={styles.formFolha} onSubmit={salvarCarga}>
          {/* Só um veículo híbrido pergunta — elétrico/combustão puro só tem
              uma dimensão possível, sem escolha nenhuma. */}
          {tipoVeiculo === "hibrido" && (
            <div
              className={styles.seletorTipo}
              role="radiogroup"
              aria-label="Elétrico ou combustível"
              ref={radiogroupDimensaoRef}
              onKeyDown={aoTeclarDimensao}
            >
              <button
                type="button"
                className={`${styles.tipoBotao} ${dimensao === "eletrico" ? styles.tipoAtivo : ""}`}
                onClick={() => setCgDimensaoHibrida("eletrico")}
              >
                Elétrico
              </button>
              <button
                type="button"
                className={`${styles.tipoBotao} ${dimensao === "combustao" ? styles.tipoAtivo : ""}`}
                onClick={() => setCgDimensaoHibrida("combustao")}
              >
                Combustível
              </button>
            </div>
          )}
          <label className={styles.campo}>
            {dimensao === "eletrico" ? "kWh" : "Litros"}
            <input
              inputMode="decimal"
              value={dimensao === "eletrico" ? cgKwh : cgLitros}
              onChange={(e) => {
                setQuantidadeTocada(true);
                if (dimensao === "eletrico") setCgKwh(e.target.value);
                else setCgLitros(e.target.value);
              }}
              required
            />
          </label>
          <SeletorData valor={cgData} aoMudar={setCgData} />
          <div
            className={styles.seletorTipo}
            role="radiogroup"
            aria-label="Como informar o custo"
            ref={radiogroupCustoRef}
            onKeyDown={aoTeclarCusto}
          >
            <button
              type="button"
              className={`${styles.tipoBotao} ${modoCusto === "total" ? styles.tipoAtivo : ""}`}
              onClick={() => setModoCusto("total")}
            >
              Custo total
            </button>
            <button
              type="button"
              className={`${styles.tipoBotao} ${modoCusto === "unidade" ? styles.tipoAtivo : ""}`}
              onClick={() => setModoCusto("unidade")}
            >
              {dimensao === "eletrico" ? "€/kWh" : "€/litro"}
            </button>
          </div>
          {modoCusto === "total" ? (
            <label className={styles.campo}>
              Custo total
              <CampoMoeda
                valor={cgCustoTotal}
                aoMudar={(v) => {
                  setCgCustoTotal(v);
                  if (!quantidadeTocada) palpitarQuantidade(v, cgLocal);
                }}
                required
              />
            </label>
          ) : (
            <label className={styles.campo}>
              {dimensao === "eletrico" ? "Preço por kWh" : "Preço por litro"}
              <CampoMoeda
                valor={dimensao === "eletrico" ? cgPrecoKwh : cgPrecoLitro}
                aoMudar={dimensao === "eletrico" ? setCgPrecoKwh : setCgPrecoLitro}
                required
              />
            </label>
          )}
          <SeletorLocal
            valor={cgLocal}
            opcoes={cfg.locaisCarregamento}
            aoMudar={(v) => {
              setCgLocal(v);
              // Outro local, outro preço: o palpite volta a valer.
              setQuantidadeTocada(false);
              palpitarQuantidade(cgCustoTotal, v);
            }}
          />
          <Seletor
            rotulo="Conta/cartão"
            valor={cgConta}
            opcoes={cfg.contasCartoes}
            rotuloOpcao={(c) => nomeAtualDoMetodo(cfg, c)}
            aoMudar={setCgConta}
            rotuloVazio="Sem conta"
          />
          <label className={styles.campo}>
            Sessão (opcional)
            <input value={cgSessao} onChange={(e) => setCgSessao(e.target.value)} />
          </label>
          <label className={styles.campo}>
            Descrição (opcional)
            <input value={cgNota} onChange={(e) => setCgNota(e.target.value)} />
          </label>
          <Botao type="submit" variante="submeter">
            Salvar alterações
          </Botao>
          <button type="button" className={styles.excluir} onClick={() => void excluirCarga()}>
            Excluir abastecimento
          </button>
        </form>
      </BottomSheet>

      {/* Caixa de despesa do veículo: só edita — criar é pelo registro rápido
          global (item A2) */}
      <BottomSheet aberta={dvAberta} aoFechar={() => setDvAberta(false)} titulo="Editar despesa">
        <form className={styles.formFolha} onSubmit={salvarDespesa}>
          <label className={styles.campo}>
            Valor
            <CampoMoeda valor={dvValor} aoMudar={setDvValor} required />
          </label>
          <SeletorData valor={dvData} aoMudar={setDvData} />
          <Seletor
            rotulo="Conta/cartão"
            valor={dvConta}
            opcoes={cfg.contasCartoes}
            rotuloOpcao={(c) => nomeAtualDoMetodo(cfg, c)}
            aoMudar={setDvConta}
            rotuloVazio="Sem conta"
          />
          {/* Ajuste F do lote de 30/08: sem categoria pra cair como título de
              reserva, o nome passou a ser obrigatório. */}
          <label className={styles.campo}>
            Nome
            <input
              value={dvDescricao}
              onChange={(e) => setDvDescricao(e.target.value)}
              required
              maxLength={80}
            />
          </label>
          <label className={styles.campo}>
            Nota
            <input value={dvNota} onChange={(e) => setDvNota(e.target.value)} maxLength={120} />
          </label>
          <Botao type="submit" variante="submeter">
            Salvar alterações
          </Botao>
          <button type="button" className={styles.excluir} onClick={() => void excluirDespesa()}>
            Excluir despesa
          </button>
        </form>
      </BottomSheet>

      {/* Caixa de despesa fixa do veículo: cria e edita */}
      <BottomSheet
        aberta={dfAberta}
        aoFechar={() => setDfAberta(false)}
        titulo={dfEditandoId ? "Editar despesa fixa" : "Nova despesa fixa"}
      >
        <form className={styles.formFolha} onSubmit={salvarFixa}>
          <label className={styles.campo}>
            Nome
            <input value={dfDescricao} onChange={(e) => setDfDescricao(e.target.value)} required />
          </label>
          <label className={styles.campo}>
            Descrição (opcional)
            <input value={dfNota} onChange={(e) => setDfNota(e.target.value)} />
          </label>
          <div className={styles.linhaDupla}>
            <label className={styles.campo}>
              Valor mensal
              <CampoMoeda valor={dfValor} aoMudar={setDfValor} required />
            </label>
            <label className={styles.campo}>
              Dia do vencimento
              <input
                inputMode="numeric"
                placeholder="1-31"
                value={dfDia}
                onChange={(e) => setDfDia(e.target.value)}
              />
            </label>
          </div>
          <Botao type="submit" variante="submeter">
            {dfEditandoId ? "Salvar alterações" : "Criar fixa"}
          </Botao>
          {dfEditandoId && (
            <button type="button" className={styles.excluir} onClick={() => void excluirFixa()}>
              Excluir despesa fixa
            </button>
          )}
        </form>
      </BottomSheet>

      {/* Caixa de quilometragem: cria e edita */}
      <BottomSheet
        aberta={kmAberta}
        aoFechar={() => setKmAberta(false)}
        titulo={kmEditandoId ? "Editar quilometragem" : "Registar quilometragem"}
      >
        <form className={styles.formFolha} onSubmit={salvarKm}>
          <label className={styles.campo}>
            Km
            <input
              inputMode="decimal"
              value={kmValor}
              onChange={(e) => setKmValor(e.target.value)}
              required
            />
          </label>
          <SeletorData valor={kmData} aoMudar={setKmData} />
          <label className={styles.campo}>
            Descrição (opcional)
            <input value={kmNota} onChange={(e) => setKmNota(e.target.value)} />
          </label>
          <Botao type="submit" variante="submeter">
            {kmEditandoId ? "Salvar alterações" : "Registar"}
          </Botao>
          {kmEditandoId && (
            <button type="button" className={styles.excluir} onClick={() => void excluirKm()}>
              Excluir registo
            </button>
          )}
        </form>
      </BottomSheet>

      <RenomearFolha
        aberta={renomeando !== null}
        nomeAtual={renomeando}
        aoFechar={() => setRenomeando(null)}
        aoConfirmar={(n) => void renomear(n)}
        aviso="Os abastecimentos já registados passam a mostrar o nome novo."
      />
    </Pagina>
  );
}

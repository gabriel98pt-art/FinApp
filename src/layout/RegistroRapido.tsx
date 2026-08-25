import { useMemo, useState, type FormEvent } from "react";
import { Check, Square, SquareCheck } from "lucide-react";
import BottomSheet from "../components/BottomSheet";
import CampoMoeda from "../components/CampoMoeda";
import type { Cents } from "../types";
import Seletor from "../components/Seletor";
import SeletorCategoria from "../components/SeletorCategoria";
import SeletorData from "../components/SeletorData";
import SeletorLocal from "../components/SeletorLocal";
import {
  atualizarDespesa,
  atualizarReceita,
  criarDespesa,
  criarReceita,
  removerDespesa,
  removerReceita,
} from "../services/lancamentosService";
import { criarCarga, criarDespesaVeiculo } from "../services/veiculoService";
import { criarParcela } from "../services/parcelasService";
import { useConfirmar } from "../hooks/useConfirmar";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useRadiogroupTeclado } from "../hooks/useRadiogroupTeclado";
import { useAuthStore } from "../stores/authStore";
import { useCfgStore } from "../stores/cfgStore";
import { useDespesasStore, useReceitasStore } from "../stores/lancamentosStore";
import { useParcelasStore } from "../stores/parcelasStore";
import { useVeiculoStore } from "../stores/veiculoStore";
import { mostrarToast } from "../stores/toastStore";
import { useUiStore, type TipoRegistro } from "../stores/uiStore";
import { despesasNosTotais, hojeIso, mesAtual, mesDe } from "../utils/calculos";
import { corDaCategoriaVisual, corDoIconeSobre } from "../utils/categoriaVisual";
import { formatMoney } from "../utils/money";
import { LIMIAR_PERTO_ORCAMENTO, statusOrcamentoMes } from "../utils/orcamento";
import { totalDaCompra } from "../utils/parcelas";
import {
  kwhPeloCusto,
  litrosPeloCusto,
  precoKwhDoLocal,
  precoLitroDoLocal,
} from "../utils/veiculo";

import styles from "./RegistroRapido.module.css";
import Botao from "../components/Botao";

/** Três escolhas de primeiro nível. "Veículo" não é um `TipoRegistro`: é o
 *  guarda-chuva de carga + despesa do veículo, que se resolve na sub-escolha
 *  logo abaixo. Ao entrar em Veículo cai sempre em Carga — como o tipo já
 *  guarda qual sub-escolha está ativa, sair e voltar reinicia sozinho, sem um
 *  segundo estado para manter em sincronia.
 *
 *  A cor de cada um vem do mesmo sistema de cor de categoria que pinta o
 *  botão flutuante e o donut — antes o Veículo era roxo aqui e lima no resto
 *  do app, duas cores para o mesmo conceito no mesmo fluxo. */
const TIPOS: { valor: TipoRegistro | "veiculo"; rotulo: string }[] = [
  { valor: "despesa", rotulo: "Despesa" },
  { valor: "receita", rotulo: "Receita" },
  { valor: "veiculo", rotulo: "Veículo" },
];

/** Os 4 números de parcelas com botão próprio, o caminho rápido. */
const ATALHOS_PARCELAS = [3, 6, 9, 12];

/** Escape dos botões rápidos: de 2x a 36x (3 anos) MENOS os quatro que já têm
 *  botão. Deixá-los na lista fazia o seletor parecer um segundo controlo para
 *  a mesma coisa — tirados, ele é literalmente "os outros números". */
const OPCOES_PARCELAS = Array.from({ length: 35 }, (_, i) => i + 2)
  .filter((n) => !ATALHOS_PARCELAS.includes(n))
  .map(String);

const SUB_VEICULO: { valor: TipoRegistro; rotulo: string }[] = [
  { valor: "carga", rotulo: "Abastecimento" },
  { valor: "despesaVeiculo", rotulo: "Despesa" },
];

/** Mesmo corte do resto do layout (ver `Pagina.tsx`). Acima dele a folha vira
 *  diálogo centrado (BottomSheet.module.css) e o arrasto sai de cena: puxar
 *  para fechar é gesto de dedo, não de rato. */
const MOBILE = "(max-width: 767px)";

/** Bottom sheet de registro rápido: lança (ou edita) receita/despesa, e lança
 *  carga elétrica / despesa do veículo (item 3/6 — estes dois só criam; a
 *  edição deles fica na tela Veículo). */
export default function RegistroRapido() {
  const aberta = useUiStore((s) => s.registroAberto);
  const tipo = useUiStore((s) => s.registroTipo);
  const editandoId = useUiStore((s) => s.editandoId);
  const { abrirRegistro, fecharRegistro } = useUiStore();
  const uid = useAuthStore((s) => s.sessao?.uid);
  const confirmar = useConfirmar();
  const mobile = useMediaQuery(MOBILE);
  const { ref: rgTipoRef, onKeyDown: aoTeclarTipo } = useRadiogroupTeclado<HTMLDivElement>();
  const { ref: rgSubVeiculoRef, onKeyDown: aoTeclarSubVeiculo } =
    useRadiogroupTeclado<HTMLDivElement>();
  const { ref: rgModoCustoRef, onKeyDown: aoTeclarModoCusto } =
    useRadiogroupTeclado<HTMLDivElement>();
  const { ref: rgDimensaoRef, onKeyDown: aoTeclarDimensao } =
    useRadiogroupTeclado<HTMLDivElement>();
  const { ref: rgNaturezaLancRef, onKeyDown: aoTeclarNaturezaLanc } =
    useRadiogroupTeclado<HTMLDivElement>();
  const { ref: rgNaturezaRef, onKeyDown: aoTeclarNatureza } =
    useRadiogroupTeclado<HTMLDivElement>();
  const { ref: rgCartaoRef, onKeyDown: aoTeclarCartao } = useRadiogroupTeclado<HTMLDivElement>();
  const { ref: rgComoValorRef, onKeyDown: aoTeclarComoValor } =
    useRadiogroupTeclado<HTMLDivElement>();
  const receitas = useReceitasStore((s) => s.itens);
  const despesas = useDespesasStore((s) => s.itens);
  const parcelas = useParcelasStore((s) => s.itens);
  const cfg = useCfgStore((s) => s.cfg);
  const veiculo = useVeiculoStore((s) => s.dados);

  const [descricao, setDescricao] = useState("");
  const [nota, setNota] = useState("");
  const [valorTexto, setValorTexto] = useState<Cents | null>(null);
  const [data, setData] = useState(hojeIso());
  const [etiqueta, setEtiqueta] = useState(""); // fonte (receita) ou categoria (despesa)
  const [conta, setConta] = useState(""); // conta/cartão (opcional)
  const [kwh, setKwh] = useState(""); // só abastecimento elétrico
  const [litros, setLitros] = useState(""); // só abastecimento a combustível
  // Só um veículo híbrido pergunta — elétrico/combustão puro só tem uma
  // dimensão possível (item B1, mesma lógica de pages/Veiculo.tsx).
  const [dimensaoCarga, setDimensaoCarga] = useState<"eletrico" | "combustao">("eletrico");
  const tipoVeiculo = cfg.tipoVeiculo;
  const dimensao = tipoVeiculo === "hibrido" ? dimensaoCarga : (tipoVeiculo ?? "eletrico");
  // O kWh/litros preenche-se sozinho a partir do custo e do histórico daquele
  // local (mesmo palpite da tela Veículo — ver `palpitarQuantidade` em
  // pages/Veiculo.tsx), mas some assim que o usuário toca no campo: o
  // palpite não pode apagar o que ele escreveu à mão. Volta a valer ao
  // trocar de local.
  const [quantidadeTocada, setQuantidadeTocada] = useState(false);
  // "Custo total" (padrão) ou "€/unidade" — mesmas duas formas de informar um
  // abastecimento que a tela Veículo já tinha (ver `pages/Veiculo.tsx`). Só
  // no modo €/unidade o preço entra à mão; no modo total ele é derivado do
  // custo.
  const [modoCusto, setModoCusto] = useState<"total" | "unidade">("total");
  const [precoKwh, setPrecoKwh] = useState<Cents | null>(null); // só modo €/kWh
  const [precoLitro, setPrecoLitro] = useState<Cents | null>(null); // só modo €/litro
  const [sessao, setSessao] = useState(""); // só abastecimento elétrico
  // item 24: despesa parcelada direto daqui (não é um tipo novo no radiogroup)
  const [parcelada, setParcelada] = useState(false);
  const [numParcelas, setNumParcelas] = useState("3");
  // Sem isto, uma parcela criada por aqui nunca tinha dia de vencimento — nem
  // aparecia no detalhe da lista, nem entrava na ordem "Próximo vencimento"
  // (tela Parcelas), só o formulário completo daquela tela perguntava.
  const [diaVencimentoParcela, setDiaVencimentoParcela] = useState("");
  const [intermediador, setIntermediador] = useState("");
  // Folha aninhada do parcelamento (os campos dela ficavam dentro desta folha
  // e forçavam rolagem, já que a altura agora é fixa).
  const [folhaParcelamento, setFolhaParcelamento] = useState(false);
  // "Sei o valor total" (padrão) ou "Sei o valor da parcela".
  const [modoValorParcela, setModoValorParcela] = useState<"total" | "parcela">("total");
  // Débito automático: sugerido pelo tipo do cartão, mas o usuário decide.
  // `null` = ainda não mexeu, então continua a seguir a sugestão.
  const [autoDebitEscolhido, setAutoDebitEscolhido] = useState<boolean | null>(null);
  /** "Isto é dinheiro que voltou" — o jantar em grupo que os amigos devolvem.
   *  Grava uma despesa de valor NEGATIVO na mesma categoria (ver
   *  utils/reembolsos.ts). O campo de valor continua a pedir um número
   *  positivo: obrigar a escrever "-75" é pedir à pessoa que saiba a convenção
   *  interna do app. A negação acontece no submit. */
  const [reembolso, setReembolso] = useState(false);
  /** Despesa que este reembolso reduz. Opcional — ver `reembolsoDeId`. */
  const [reembolsoDe, setReembolsoDe] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const ehVeiculo = tipo === "carga" || tipo === "despesaVeiculo";

  /** Despesas que podem ter gerado este reembolso: as dos 30 dias ANTERIORES à
   *  data do reembolso, com as da categoria já escolhida à frente.
   *
   *  A janela conta a partir da data do formulário e não de hoje, por duas
   *  razões. A boa: quem regista hoje um estorno datado do mês passado quer ver
   *  as compras daquela altura, não as desta semana. A outra: ler o relógio
   *  aqui dentro é impuro — o resultado mudava sem nenhuma dependência mudar, e
   *  o próprio ESLint apanha.
   *
   *  Trinta dias porque um estorno que demora mais do que isso já não se liga
   *  de cabeça a uma compra, e a lista com o histórico todo era impossível de
   *  percorrer numa folha. Fora ficam os próprios reembolsos (um reembolso não
   *  reembolsa outro) e o que não é despesa real (pagamento de fatura, espelho
   *  de parcela). */
  const candidatasReembolso = useMemo(() => {
    if (!reembolso) return [];
    const fim = new Date(`${data}T00:00:00Z`);
    const limite = new Date(fim.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return despesasNosTotais(despesas)
      .filter((d) => d.origem !== "reemb" && d.valor > 0 && d.data >= limite && d.data <= data)
      .sort((a, b) => {
        // A categoria escolhida primeiro; dentro de cada grupo, a mais recente.
        const ca = a.categoria === etiqueta ? 0 : 1;
        const cb = b.categoria === etiqueta ? 0 : 1;
        return ca !== cb ? ca - cb : a.data < b.data ? 1 : -1;
      });
  }, [reembolso, despesas, etiqueta, data]);

  /** Lado escolhido à mão numa edição, quando difere do que o lançamento é
   *  hoje. Fica à parte do `tipo` do store porque é esse `tipo` que diz em que
   *  coleção o registo existe — trocá-lo faria procurar no sítio errado. */
  const [tipoTrocado, setTipoTrocado] = useState<"receita" | "despesa" | null>(null);

  const editando =
    editandoId !== null
      ? tipo === "receita"
        ? receitas.find((r) => r.id === editandoId)
        : despesas.find((d) => d.id === editandoId)
      : undefined;

  /** O lado que o formulário está a mostrar e que vai ser gravado. Igual ao
   *  `tipo` em tudo o resto — só a edição de receita/despesa o pode trocar. */
  const lado = tipoTrocado ?? tipo;
  /** Reclassificar entre domínios (fixa, parcela, carga…) é conversão de dados
   *  a sério; aqui é só o interruptor receita↔despesa, o erro comum. */
  const podeTrocarLado = !!editando && (tipo === "receita" || tipo === "despesa");

  // Reinicia o formulário quando a folha abre (novo ou edição) — padrão
  // "ajustar estado durante o render", sem effect.
  const assinatura = aberta ? (editandoId ?? "novo") : null;
  const [anterior, setAnterior] = useState<{ assinatura: string | null; tipo: string }>({
    assinatura: null,
    tipo,
  });
  if (assinatura !== anterior.assinatura || tipo !== anterior.tipo) {
    setAnterior({ assinatura, tipo });
    if (assinatura !== null && assinatura !== anterior.assinatura) {
      setErro(null);
      // Cada abertura começa no lado que o lançamento tem de facto.
      setTipoTrocado(null);
      // Fora do if/else: a folha do parcelamento é FILHA desta, e nenhuma
      // abertura — nova ou edição — deve herdá-la aberta da vez anterior. O
      // ramo da edição não a fechava, e uma folha aninhada a nascer por cima de
      // um formulário de edição não tem nada que fazer ali.
      setFolhaParcelamento(false);
      if (editando) {
        setDescricao(editando.descricao);
        setNota(editando.nota ?? "");
        // Um reembolso está guardado negativo; o campo mostra-o positivo, como
        // o pediu ao ser criado.
        const ehReemb = editando.origem === "reemb";
        setValorTexto(ehReemb ? Math.abs(editando.valor) : editando.valor);
        setReembolso(ehReemb);
        setReembolsoDe(("reembolsoDeId" in editando && editando.reembolsoDeId) || "");
        setData(editando.data);
        setEtiqueta("fonte" in editando ? editando.fonte : editando.categoria);
        setConta(("fonte" in editando ? editando.conta : editando.contaCartao) ?? "");
      } else {
        setDescricao("");
        setNota("");
        setValorTexto(null);
        setData(hojeIso());
        setEtiqueta("");
        setConta("");
        setKwh("");
        setLitros("");
        setDimensaoCarga("eletrico");
        setQuantidadeTocada(false);
        setModoCusto("total");
        setPrecoKwh(null);
        setPrecoLitro(null);
        setSessao("");
        setParcelada(false);
        setNumParcelas("3");
        setDiaVencimentoParcela("");
        // O intermediador não era limpo em lado nenhum, e é GRAVADO na parcela
        // (ver `salvar`): criar uma compra parcelada pela Klarna deixava a
        // Klarna escolhida para sempre, e a compra parcelada seguinte nascia
        // com um intermediador que ninguém tinha escolhido.
        setIntermediador("");
        setModoValorParcela("total");
        setAutoDebitEscolhido(null);
        setReembolso(false);
        setReembolsoDe("");
      }
    } else if (assinatura === "novo") {
      // Trocou de tipo num lançamento novo: a fonte/categoria não se traduz
      // entre as listas — limpa só a etiqueta (e o kWh, que é só da carga).
      setEtiqueta("");
      setKwh("");
      setLitros("");
      setDimensaoCarga("eletrico");
      setQuantidadeTocada(false);
      setModoCusto("total");
      setPrecoKwh(null);
      setPrecoLitro(null);
      setSessao("");
      setNota("");
      setParcelada(false);
      setFolhaParcelamento(false);
      // Desmarcar o parcelamento apaga também o que só a ele pertence.
      setIntermediador("");
      // Sair de Despesa apaga a escolha de reembolso: ela só existe deste lado.
      setReembolso(false);
      setReembolsoDe("");
    }
  }

  /** Refaz o palpite de kWh/litros a partir do custo e do local que valerem
   *  agora, usando o preço da carga mais recente naquele local NA MESMA
   *  dimensão — mesma conta da tela Veículo (`palpitarQuantidade` em
   *  pages/Veiculo.tsx). Sem histórico naquele local não há preço de
   *  referência: fica vazio para escrever à mão. */
  function palpitarQuantidade(custo: Cents | null, local: string) {
    if (modoCusto !== "total" || custo === null || custo <= 0) return;
    if (dimensao === "eletrico") {
      const preco = precoKwhDoLocal(veiculo.cargas, local);
      if (preco !== undefined) setKwh(kwhPeloCusto(custo, preco));
    } else {
      const preco = precoLitroDoLocal(veiculo.cargas, local);
      if (preco !== undefined) setLitros(litrosPeloCusto(custo, preco));
    }
  }

  // Sugestão de débito automático: crédito entra na fatura, débito não. Vale
  // até o usuário tocar no interruptor.
  const autoDebitSugerido = !!conta && cfg.tipoCartao[conta] === "credit";
  const autoDebit = autoDebitEscolhido ?? autoDebitSugerido;
  const ehParcelada = tipo === "despesa" && parcelada && !editando;

  const opcoes =
    lado === "receita"
      ? cfg.fontesReceita
      : lado === "despesaVeiculo"
        ? cfg.categoriasVeiculo
        : cfg.categoriasDespesa;

  // Aviso de teto (seção 4.8): só despesa corrente não parcelada tem
  // categoria com orçamento configurável — fixas, parcelas e veículo vivem
  // fora do que este teto mede. Segue o mês da data escolhida (não sempre
  // "hoje"), pra um lançamento retroativo mostrar o teto do mês certo.
  const statusTeto =
    tipo === "despesa" && !ehParcelada && etiqueta && cfg.orcamentos[etiqueta]
      ? statusOrcamentoMes(
          despesas,
          parcelas,
          cfg.orcamentos,
          mesDe(data),
          mesAtual(),
          hojeIso(),
        ).find((s) => s.categoria === etiqueta)
      : undefined;

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!uid) return;

    // No modo €/unidade do abastecimento, o número obrigatório é o preço por
    // kWh/litro, não o custo total — não há campo de custo total nesse modo,
    // é ele quem se deriva.
    const ehCargaPorUnidade = tipo === "carga" && modoCusto === "unidade";
    const valor = ehCargaPorUnidade
      ? dimensao === "eletrico"
        ? precoKwh
        : precoLitro
      : valorTexto;
    if (valor === null || valor <= 0) {
      setErro(
        ehCargaPorUnidade
          ? `Preço/${dimensao === "eletrico" ? "kWh" : "litro"} inválido.`
          : "Valor inválido — use por exemplo 12,50.",
      );
      return;
    }
    // Todo lançamento sai de algum lugar: conta/cartão é obrigatório assim que
    // existe pelo menos um cadastrado (quem ainda não cadastrou nenhum não tem
    // o que escolher, e o seletor nem aparece).
    if (cfg.contasCartoes.length > 0 && !conta) {
      setErro("Escolha o cartão ou conta.");
      return;
    }
    // Sem escolha explícita cai em "Outros" — por NOME, não por posição: as
    // categorias criadas em Definições entram no fim da lista, então o antigo
    // `opcoes[opcoes.length - 1]` passava a mandar o lançamento pra última
    // categoria que o usuário tinha criado.
    const etiquetaFinal = etiqueta || opcoes.find((o) => o === "Outros") || opcoes[0] || "Outros";
    const notaFinal = nota.trim() || undefined;

    setSalvando(true);
    try {
      if (tipo === "carga") {
        const local = descricao.trim();
        if (!local) {
          setErro("Escolha o local do abastecimento.");
          setSalvando(false);
          return;
        }
        let custo: number;
        let campos: { kwh: number; precoKwh: number } | { litros: number; precoLitro: number };
        if (dimensao === "eletrico") {
          const kwhNum = parseFloat(kwh.replace(",", "."));
          if (!Number.isFinite(kwhNum) || kwhNum <= 0) {
            setErro("kWh inválido.");
            setSalvando(false);
            return;
          }
          custo = modoCusto === "total" ? valor : Math.round(kwhNum * valor);
          const precoKwhFinal = modoCusto === "total" ? Math.round(valor / kwhNum) : valor;
          campos = { kwh: kwhNum, precoKwh: precoKwhFinal };
        } else {
          const litrosNum = parseFloat(litros.replace(",", "."));
          if (!Number.isFinite(litrosNum) || litrosNum <= 0) {
            setErro("Litros inválido.");
            setSalvando(false);
            return;
          }
          custo = modoCusto === "total" ? valor : Math.round(litrosNum * valor);
          const precoLitroFinal = modoCusto === "total" ? Math.round(valor / litrosNum) : valor;
          campos = { litros: litrosNum, precoLitro: precoLitroFinal };
        }
        await criarCarga(uid, {
          data,
          ...campos,
          custo,
          local,
          contaCartao: conta || undefined,
          sessao: dimensao === "eletrico" ? sessao.trim() || undefined : undefined,
          nota: notaFinal,
        });
      } else if (tipo === "despesaVeiculo") {
        await criarDespesaVeiculo(uid, {
          data,
          valor,
          categoria: etiquetaFinal,
          contaCartao: conta || undefined,
          nota: notaFinal,
        });
      } else if (ehParcelada) {
        const n = parseInt(numParcelas, 10);
        if (!Number.isInteger(n) || n < 2) {
          setErro("Escolha em quantas parcelas — pelo menos 2.");
          setSalvando(false);
          return;
        }
        const diaNum =
          diaVencimentoParcela.trim() === "" ? undefined : Number(diaVencimentoParcela);
        if (diaNum !== undefined && (!Number.isInteger(diaNum) || diaNum < 1 || diaNum > 31)) {
          setErro("Dia do vencimento deve ser entre 1 e 31.");
          setSalvando(false);
          return;
        }
        await criarParcela(uid, {
          descricao,
          total: totalDaCompra(valor, n, modoValorParcela),
          numParcelas: n,
          primeiroMes: mesDe(data),
          diaVencimento: diaNum,
          categoria: etiquetaFinal,
          cartao: conta || null,
          autoDebit,
          intermediador: intermediador || undefined,
          pagoPorMes: {},
          nota: notaFinal,
        });
      } else if (editando && lado !== tipo) {
        // Trocou o lado numa edição. Receitas e despesas são coleções separadas
        // no Firebase: não há campo para virar, tem de nascer do outro lado — e
        // com id novo, que é o que se perde nesta troca.
        //
        // Cria primeiro, apaga depois: se apagar falhar fica um repetido, que
        // se resolve à mão; pela ordem contrária teria desaparecido dinheiro.
        // Mesma regra da confirmação da importação.
        if (lado === "receita") {
          await criarReceita(uid, {
            descricao,
            valor,
            data,
            fonte: etiquetaFinal,
            conta: conta || undefined,
            nota: notaFinal,
          });
          await removerDespesa(uid, editando.id);
        } else {
          await criarDespesa(uid, {
            descricao,
            valor,
            data,
            categoria: etiquetaFinal,
            contaCartao: conta || undefined,
            nota: notaFinal,
          });
          await removerReceita(uid, editando.id);
        }
      } else if (tipo === "receita") {
        const dados = {
          descricao,
          valor,
          data,
          fonte: etiquetaFinal,
          conta: conta || undefined,
          nota: notaFinal,
        };
        if (editando) await atualizarReceita(uid, { ...editando, ...dados });
        else await criarReceita(uid, dados);
      } else {
        // A negação acontece AQUI, não no campo: quem usa escreve os 75 € que
        // voltaram, e o app trata de os guardar como -75 na mesma categoria —
        // que é o que faz o Restaurante mostrar 25 em vez de 100.
        //
        // A `origem` tem três casos, e não dois. `atualizar` grava com `set` e
        // limpa os `undefined`, portanto pôr `origem: undefined` aqui APAGA a
        // que estiver guardada: escrevê-lo sempre que não é reembolso fazia um
        // ajuste de reconciliação perder o 'recon' só por ser editado, e com
        // ele a exclusão dos totais. Só se mexe na origem quando ela é mesmo
        // deste formulário — virou reembolso, ou deixou de o ser.
        const eraReembolso = editando?.origem === "reemb";
        const origem = reembolso ? ("reemb" as const) : eraReembolso ? undefined : editando?.origem;

        const dados = {
          descricao,
          valor: reembolso ? -valor : valor,
          data,
          categoria: etiquetaFinal,
          contaCartao: conta || undefined,
          nota: notaFinal,
          origem,
          reembolsoDeId: reembolso ? reembolsoDe || undefined : undefined,
        };
        if (editando) await atualizarDespesa(uid, { ...editando, ...dados });
        else await criarDespesa(uid, dados);
      }
      mostrarToast(
        editando && lado !== tipo
          ? lado === "receita"
            ? "✓ Virou receita"
            : "✓ Virou despesa"
          : editando
            ? "Alterações salvas"
            : tipo === "receita"
              ? "Receita adicionada"
              : tipo === "despesa" && parcelada
                ? `Parcela criada em ${numParcelas}x`
                : tipo === "carga"
                  ? "Abastecimento registado"
                  : tipo === "despesaVeiculo"
                    ? "Despesa do veículo adicionada"
                    : "Despesa adicionada",
      );
      fecharRegistro();
    } catch {
      setErro("Não foi possível salvar. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!uid || !editando) return;
    if (!(await confirmar(`Excluir "${editando.descricao}"?`))) return;
    setSalvando(true);
    try {
      if (tipo === "receita") await removerReceita(uid, editando.id);
      else await removerDespesa(uid, editando.id);
      mostrarToast("Lançamento excluído");
      fecharRegistro();
    } catch {
      setErro("Não foi possível excluir. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <BottomSheet
      aberta={aberta}
      aoFechar={fecharRegistro}
      titulo={editando ? "Editar lançamento" : "Registro rápido"}
      arrastavel={mobile}
      tamanho="grande"
    >
      <form className={styles.form} onSubmit={salvar}>
        {!editando && (
          <>
            <div
              className={styles.seletorTipo}
              role="radiogroup"
              aria-label="Tipo de lançamento"
              ref={rgTipoRef}
              onKeyDown={aoTeclarTipo}
            >
              {TIPOS.map((t) => {
                const ativo = t.valor === "veiculo" ? ehVeiculo : tipo === t.valor;
                const fundo = corDaCategoriaVisual(cfg, t.rotulo);
                return (
                  <button
                    key={t.valor}
                    type="button"
                    role="radio"
                    aria-checked={ativo}
                    className={`${styles.tipo} ${ativo ? styles.tipoAtivo : ""}`}
                    style={ativo ? { background: fundo, color: corDoIconeSobre(fundo) } : undefined}
                    onClick={() => abrirRegistro(t.valor === "veiculo" ? "carga" : t.valor)}
                  >
                    {t.rotulo}
                  </button>
                );
              })}
            </div>

            {ehVeiculo && (
              <div
                className={styles.subTipos}
                role="radiogroup"
                aria-label="Lançamento do veículo"
                ref={rgSubVeiculoRef}
                onKeyDown={aoTeclarSubVeiculo}
              >
                {SUB_VEICULO.map((s) => (
                  <button
                    key={s.valor}
                    type="button"
                    role="radio"
                    aria-checked={tipo === s.valor}
                    className={`${styles.subTipo} ${tipo === s.valor ? styles.subTipoAtivo : ""}`}
                    onClick={() => abrirRegistro(s.valor)}
                  >
                    {s.rotulo}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* Na edição dá para trocar de lado: classificar mal receita/despesa é
            o engano mais comum, e até aqui a única saída era apagar e lançar de
            novo. Só estes dois — os outros tipos vivem noutros domínios. */}
        {podeTrocarLado && (
          <div
            className={styles.seletorTipo}
            role="radiogroup"
            aria-label="Receita ou despesa"
            ref={rgNaturezaLancRef}
            onKeyDown={aoTeclarNaturezaLanc}
          >
            {(["despesa", "receita"] as const).map((t) => {
              const ativo = lado === t;
              const rotulo = t === "receita" ? "Receita" : "Despesa";
              const fundo = corDaCategoriaVisual(cfg, rotulo);
              return (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={ativo}
                  className={`${styles.tipo} ${ativo ? styles.tipoAtivo : ""}`}
                  style={ativo ? { background: fundo, color: corDoIconeSobre(fundo) } : undefined}
                  onClick={() => {
                    if (t === lado) return;
                    setTipoTrocado(t);
                    // Fonte de receita e categoria de despesa são listas
                    // diferentes: a escolha antiga não se traduz.
                    setEtiqueta("");
                  }}
                >
                  {rotulo}
                </button>
              );
            })}
          </div>
        )}

        {/* Nome + Nota lado a lado. A despesa do veículo não tem nome próprio
            no modelo de dados (só categoria + nota), então ali a Nota ocupa a
            linha inteira. */}
        {tipo === "carga" && (
          <SeletorLocal
            valor={descricao}
            opcoes={cfg.locaisCarregamento}
            aoMudar={(v) => {
              setDescricao(v);
              // Outro local, outro preço: o palpite volta a valer.
              setQuantidadeTocada(false);
              palpitarQuantidade(valorTexto, v);
            }}
          />
        )}

        {/* Só um veículo híbrido pergunta — elétrico/combustão puro já sabe
            qual é a sua única dimensão (item B1). */}
        {tipo === "carga" && tipoVeiculo === "hibrido" && (
          <div
            className={styles.subTipos}
            role="radiogroup"
            aria-label="Elétrico ou combustível"
            ref={rgDimensaoRef}
            onKeyDown={aoTeclarDimensao}
          >
            <button
              type="button"
              role="radio"
              aria-checked={dimensaoCarga === "eletrico"}
              className={`${styles.subTipo} ${dimensaoCarga === "eletrico" ? styles.subTipoAtivo : ""}`}
              onClick={() => setDimensaoCarga("eletrico")}
            >
              Elétrico
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={dimensaoCarga === "combustao"}
              className={`${styles.subTipo} ${dimensaoCarga === "combustao" ? styles.subTipoAtivo : ""}`}
              onClick={() => setDimensaoCarga("combustao")}
            >
              Combustível
            </button>
          </div>
        )}

        <div className={styles.linhaDupla}>
          {tipo !== "despesaVeiculo" && tipo !== "carga" && (
            <label className={styles.campo}>
              Nome
              <input
                type="text"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                required
                maxLength={80}
              />
            </label>
          )}

          <label className={styles.campo}>
            Nota
            <input
              type="text"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              maxLength={120}
            />
          </label>
        </div>

        {/* Duas formas de informar um abastecimento: custo total (deriva o
            €/unidade) ou €/unidade direto (deriva o custo) — mesmo par de
            modos da tela Veículo. */}
        {tipo === "carga" && (
          <div
            className={styles.subTipos}
            role="radiogroup"
            aria-label="Como informar o custo"
            ref={rgModoCustoRef}
            onKeyDown={aoTeclarModoCusto}
          >
            <button
              type="button"
              role="radio"
              aria-checked={modoCusto === "total"}
              className={`${styles.subTipo} ${modoCusto === "total" ? styles.subTipoAtivo : ""}`}
              onClick={() => setModoCusto("total")}
            >
              Custo total
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={modoCusto === "unidade"}
              className={`${styles.subTipo} ${modoCusto === "unidade" ? styles.subTipoAtivo : ""}`}
              onClick={() => setModoCusto("unidade")}
            >
              {dimensao === "eletrico" ? "€/kWh" : "€/litro"}
            </button>
          </div>
        )}

        {/* Numa despesa parcelada o valor vive só dentro da folha de
            Parcelamento — ter os dois seria pedir o mesmo número duas vezes. */}
        <div className={styles.linhaDupla}>
          {!ehParcelada && !(tipo === "carga" && modoCusto === "unidade") && (
            <label className={styles.campo}>
              {tipo === "carga" ? "Custo total (€)" : "Valor (€)"}
              <CampoMoeda
                valor={valorTexto}
                aoMudar={(v) => {
                  setValorTexto(v);
                  if (tipo === "carga" && !quantidadeTocada) palpitarQuantidade(v, descricao);
                }}
                required
                // As mensagens de erro deste formulário já descrevem UM
                // campo cada ("Valor inválido...", "kWh inválido.", "Escolha
                // em quantas parcelas...", "Dia do vencimento..."), mas o
                // estado só guarda o texto, não qual campo — aria-describedby
                // nos campos relevantes, não aria-invalid (exigiria saber
                // exatamente qual — achado da auditoria de Acessibilidade).
                aria-describedby={erro !== null ? "erro-registro" : undefined}
              />
            </label>
          )}

          {tipo === "carga" && modoCusto === "unidade" && (
            <label className={styles.campo}>
              {dimensao === "eletrico" ? "Preço por kWh (€)" : "Preço por litro (€)"}
              <CampoMoeda
                valor={dimensao === "eletrico" ? precoKwh : precoLitro}
                aoMudar={dimensao === "eletrico" ? setPrecoKwh : setPrecoLitro}
                required
                aria-describedby={erro !== null ? "erro-registro" : undefined}
              />
            </label>
          )}

          {tipo === "carga" && (
            <label className={styles.campo}>
              {dimensao === "eletrico" ? "kWh" : "Litros"}
              <input
                type="text"
                inputMode="decimal"
                value={dimensao === "eletrico" ? kwh : litros}
                onChange={(e) => {
                  setQuantidadeTocada(true);
                  if (dimensao === "eletrico") setKwh(e.target.value);
                  else setLitros(e.target.value);
                }}
                required
                aria-describedby={erro !== null ? "erro-registro" : undefined}
              />
            </label>
          )}
        </div>

        {/* Despesa ou dinheiro que voltou. Só do lado da despesa e fora do
            veículo: uma receita já é dinheiro a entrar, e o veículo tem os
            seus próprios fluxos. Mesmo desenho do alternador Mês/Semana das
            listas — é o segmentado que este app já usa para "duas vistas da
            mesma coisa", e um reembolso é isso: a mesma despesa, ao contrário. */}
        {lado === "despesa" && !ehVeiculo && (
          <div
            className={styles.alternadorTipoDespesa}
            role="radiogroup"
            aria-label="Natureza"
            ref={rgNaturezaRef}
            onKeyDown={aoTeclarNatureza}
          >
            {/* "Gasto" e não "Despesa": o radiogroup de cima já tem uma opção
                chamada "Despesa", e dois controles com o mesmo nome no mesmo
                formulário deixam quem usa leitor de ecrã sem saber em qual
                está. */}
            {(
              [
                [false, "Gasto"],
                [true, "Reembolso"],
              ] as const
            ).map(([valor, rotulo]) => (
              <button
                key={rotulo}
                type="button"
                role="radio"
                aria-checked={reembolso === valor}
                className={`${styles.opcaoTipoDespesa} ${
                  reembolso === valor ? styles.opcaoTipoDespesaAtiva : ""
                }`}
                onClick={() => {
                  setReembolso(valor);
                  if (valor) {
                    // Um reembolso não se parcela, e não herda o cartão que
                    // pagou a conta original: o dinheiro costuma voltar para a
                    // conta ou em numerário. Quem receber o estorno pelo
                    // próprio cartão escolhe-o à mão.
                    setParcelada(false);
                    setFolhaParcelamento(false);
                    setConta("");
                  } else {
                    setReembolsoDe("");
                  }
                }}
              >
                {rotulo}
              </button>
            ))}
          </div>
        )}

        <SeletorData valor={data} aoMudar={setData} />

        {tipo === "carga" && dimensao === "eletrico" && (
          <label className={styles.campo}>
            Sessão (opcional)
            <input value={sessao} onChange={(e) => setSessao(e.target.value)} />
          </label>
        )}

        {lado !== "carga" && (
          <SeletorCategoria
            // Segue o lado escolhido, não o que o lançamento era: trocado para
            // receita, a lista passa a ser de fontes e o rótulo tem de a
            // acompanhar, senão dizia "Categoria" sobre uma lista de fontes.
            rotulo={lado === "receita" ? "Fonte" : "Categoria"}
            valor={etiqueta}
            opcoes={opcoes}
            aoMudar={setEtiqueta}
          />
        )}

        {statusTeto && (
          <p
            className={`${styles.avisoTeto} ${
              statusTeto.estourado
                ? styles.avisoTetoEstourado
                : statusTeto.pct >= LIMIAR_PERTO_ORCAMENTO
                  ? styles.avisoTetoAlerta
                  : ""
            }`}
          >
            Já gastou {formatMoney(statusTeto.gasto, cfg.currency)} de{" "}
            {formatMoney(statusTeto.teto, cfg.currency)} em {etiqueta} este mês
            {statusTeto.estourado
              ? " — orçamento estourado."
              : statusTeto.pct >= LIMIAR_PERTO_ORCAMENTO
                ? " — perto do limite."
                : "."}
          </p>
        )}

        {/* Reembolso de qual despesa — opcional. Só faz sentido depois de a
            categoria estar escolhida: é ela que decide o que se sugere. */}
        {reembolso && lado === "despesa" && (
          <Seletor
            rotulo="Reembolso de qual despesa? (opcional)"
            valor={reembolsoDe}
            opcoes={candidatasReembolso.map((d) => d.id)}
            aoMudar={setReembolsoDe}
            rotuloOpcao={(id) => {
              const d = candidatasReembolso.find((x) => x.id === id);
              if (!d) return id;
              return `${d.descricao} · ${formatMoney(d.valor, cfg.currency)} · ${d.data.slice(8, 10)}/${d.data.slice(5, 7)}`;
            }}
            rotuloVazio="Sem despesa de origem"
            aviso="Nenhuma despesa nos últimos 30 dias para associar."
            nivel={1}
          />
        )}

        {cfg.contasCartoes.length > 0 && (
          <div className={styles.campo}>
            <span>Cartão</span>
            <div
              className={styles.fileiraContas}
              role="radiogroup"
              aria-label="Cartão"
              ref={rgCartaoRef}
              onKeyDown={aoTeclarCartao}
            >
              {cfg.contasCartoes.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={conta === c}
                  className={`${styles.conta} ${conta === c ? styles.contaAtiva : ""}`}
                  onClick={() => setConta(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* item 24: um toque transforma a despesa numa compra parcelada. Marcar
            abre a folha do parcelamento; desmarcar volta à despesa simples.
            Fora do reembolso: dinheiro que volta não se parcela, e deixar o
            interruptor à mão não era só ruído — marcá-lo depois de escolher
            Reembolso fazia o submit cair no ramo da parcela, que ignora a
            `origem` e o sinal, e o reembolso desaparecia sem aviso. */}
        {tipo === "despesa" && !editando && !reembolso && (
          <div className={styles.campo}>
            <button
              type="button"
              role="checkbox"
              aria-checked={parcelada}
              className={`${styles.parceladaToggle} ${parcelada ? styles.parceladaAtiva : ""}`}
              onClick={() => {
                const marcando = !parcelada;
                setParcelada(marcando);
                setFolhaParcelamento(marcando);
              }}
            >
              {parcelada ? <SquareCheck size={18} aria-hidden /> : <Square size={18} aria-hidden />}
              Parcelada
            </button>
            {parcelada && (
              <button
                type="button"
                className={styles.parceladaResumo}
                onClick={() => setFolhaParcelamento(true)}
              >
                {numParcelas}x ·{" "}
                {modoValorParcela === "parcela" ? "valor da parcela" : "valor total"}
                {autoDebit ? " · débito automático" : ""} — tocar para ajustar
              </button>
            )}
          </div>
        )}

        {erro !== null && (
          <p id="erro-registro" className={styles.erro} role="alert">
            {erro}
          </p>
        )}

        <div className={styles.acoes}>
          <Botao type="submit" variante="submeter" disabled={salvando}>
            {salvando ? "Aguarde…" : editando ? "Salvar alterações" : "Adicionar"}
          </Botao>

          {editando && (
            <button type="button" className={styles.excluir} onClick={excluir} disabled={salvando}>
              Excluir lançamento
            </button>
          )}
        </div>
      </form>

      {/* Folha do parcelamento — empilhada sobre a do Registro Rápido, como o
          calendário do SeletorData. Os campos estão ligados ao mesmo estado do
          formulário, então "Confirmar" não grava nada por si — só fecha a
          folha e volta pro resumo, já com o que foi preenchido aqui. */}
      <BottomSheet
        aberta={folhaParcelamento}
        aoFechar={() => setFolhaParcelamento(false)}
        titulo="Parcelamento"
        nivel={1}
      >
        <div className={styles.folhaParcelamento}>
          <button
            type="button"
            className={styles.confirmarSub}
            onClick={() => setFolhaParcelamento(false)}
          >
            <Check size={16} aria-hidden /> Confirmar
          </button>

          <button
            type="button"
            role="checkbox"
            aria-checked={autoDebit}
            className={`${styles.marcacao} ${autoDebit ? styles.marcacaoAtiva : ""}`}
            onClick={() => setAutoDebitEscolhido(!autoDebit)}
          >
            {autoDebit ? <SquareCheck size={18} aria-hidden /> : <Square size={18} aria-hidden />}
            Débito automático — entra na fatura do cartão
          </button>

          <Seletor
            rotulo="Intermediador (opcional)"
            valor={intermediador}
            opcoes={cfg.intermediadoresParcelamento}
            aoMudar={setIntermediador}
            rotuloVazio="Sem intermediador"
            aviso="Nenhum intermediador guardado — a lista vive na aba Parcelas."
            nivel={2}
          />

          <div className={styles.campo}>
            <span>Como você sabe o valor</span>
            {/* Segmentado subordinado, como a sub-escolha do Veículo — e NÃO o
                seletor de tipo: aquele tira o fundo do estado ativo de uma cor
                de categoria aplicada inline (Despesa/Receita/Veículo), que aqui
                não existe. Reaproveitado tal e qual, a opção escolhida ficava
                sem fundo nenhum, só a negrito, e a caixa parecia morta ao lado
                dos outros controlos da folha. */}
            <div
              className={`${styles.subTipos} ${styles.alternadorValor}`}
              role="radiogroup"
              aria-label="Como você sabe o valor"
              ref={rgComoValorRef}
              onKeyDown={aoTeclarComoValor}
            >
              {(
                [
                  ["total", "Sei o valor total"],
                  ["parcela", "Sei o valor da parcela"],
                ] as const
              ).map(([v, rotulo]) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={modoValorParcela === v}
                  className={`${styles.subTipo} ${modoValorParcela === v ? styles.subTipoAtivo : ""}`}
                  onClick={() => setModoValorParcela(v)}
                >
                  {rotulo}
                </button>
              ))}
            </div>
          </div>

          <label className={styles.campo}>
            {modoValorParcela === "parcela" ? "Valor parcela (€)" : "Valor total (€)"}
            <CampoMoeda
              valor={valorTexto}
              aoMudar={setValorTexto}
              aria-describedby={erro !== null ? "erro-registro" : undefined}
            />
          </label>

          <div className={styles.campo}>
            <span>Nº de parcelas</span>
            <div className={styles.fileiraContas}>
              {ATALHOS_PARCELAS.map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={numParcelas === String(n)}
                  className={`${styles.conta} ${numParcelas === String(n) ? styles.contaAtiva : ""}`}
                  onClick={() => setNumParcelas(String(n))}
                >
                  {n}x
                </button>
              ))}
            </div>
            {/* Enquanto o número escolhido for um dos atalhos, este seletor não
                mostra número nenhum: mostrava "3x" ao mesmo tempo que o botão
                "3x" estava aceso, e os dois pareciam dois controlos a mandar
                na mesma coisa. Vazio, lê-se pelo que é — a saída para os
                números que os atalhos não cobrem. Escolher aqui apaga o
                atalho, e tocar num atalho volta a esvaziar isto: continua a
                ser um valor só. */}
            <Seletor
              rotulo="Outro número de parcelas"
              nivel={2}
              valor={ATALHOS_PARCELAS.includes(Number(numParcelas)) ? "" : numParcelas}
              opcoes={OPCOES_PARCELAS}
              rotuloOpcao={(n) => `${n}x`}
              aoMudar={setNumParcelas}
            />
          </div>

          <SeletorData valor={data} aoMudar={setData} rotulo="Data 1º pagamento" nivel={2} />

          <label className={styles.campo}>
            Dia do vencimento (opcional)
            <input
              inputMode="numeric"
              placeholder="1-31"
              value={diaVencimentoParcela}
              onChange={(e) => setDiaVencimentoParcela(e.target.value)}
              aria-describedby={erro !== null ? "erro-registro" : undefined}
            />
          </label>
        </div>
      </BottomSheet>
    </BottomSheet>
  );
}

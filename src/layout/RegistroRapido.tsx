import { useState, type FormEvent } from "react";
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
import { useAuthStore } from "../stores/authStore";
import { useCfgStore } from "../stores/cfgStore";
import { useDespesasStore, useReceitasStore } from "../stores/lancamentosStore";
import { useParcelasStore } from "../stores/parcelasStore";
import { useVeiculoStore } from "../stores/veiculoStore";
import { mostrarToast } from "../stores/toastStore";
import { useUiStore, type TipoRegistro } from "../stores/uiStore";
import { hojeIso, mesAtual, mesDe } from "../utils/calculos";
import { corDaCategoriaVisual, corDoIconeSobre } from "../utils/categoriaVisual";
import { formatMoney } from "../utils/money";
import { LIMIAR_PERTO_ORCAMENTO, statusOrcamentoMes } from "../utils/orcamento";
import { totalDaCompra } from "../utils/parcelas";
import { kwhPeloCusto, precoKwhDoLocal } from "../utils/veiculo";

import styles from "./RegistroRapido.module.css";

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

/** Escape dos botões rápidos 3x/6x/9x/12x — cobre de 2x a 36x (3 anos). */
const OPCOES_PARCELAS = Array.from({ length: 35 }, (_, i) => String(i + 2));

const SUB_VEICULO: { valor: TipoRegistro; rotulo: string }[] = [
  { valor: "carga", rotulo: "Carga" },
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
  const [kwh, setKwh] = useState(""); // só carga elétrica
  // O kWh preenche-se sozinho a partir do custo e do histórico daquele local
  // (mesmo palpite da tela Veículo — ver `palpitarKwh` em pages/Veiculo.tsx),
  // mas some assim que o usuário toca no campo: o palpite não pode apagar o
  // que ele escreveu à mão. Volta a valer ao trocar de local.
  const [kwhTocado, setKwhTocado] = useState(false);
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
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const ehVeiculo = tipo === "carga" || tipo === "despesaVeiculo";

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
      if (editando) {
        setDescricao(editando.descricao);
        setNota(editando.nota ?? "");
        setValorTexto(editando.valor);
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
        setKwhTocado(false);
        setParcelada(false);
        setNumParcelas("3");
        setDiaVencimentoParcela("");
        setFolhaParcelamento(false);
        setModoValorParcela("total");
        setAutoDebitEscolhido(null);
      }
    } else if (assinatura === "novo") {
      // Trocou de tipo num lançamento novo: a fonte/categoria não se traduz
      // entre as listas — limpa só a etiqueta (e o kWh, que é só da carga).
      setEtiqueta("");
      setKwh("");
      setKwhTocado(false);
      setNota("");
      setParcelada(false);
      setFolhaParcelamento(false);
    }
  }

  /** Refaz o palpite de kWh a partir do custo e do local que valerem agora,
   *  usando o preço/kWh da carga mais recente naquele local — mesma conta da
   *  tela Veículo (`palpitarKwh` em pages/Veiculo.tsx). Sem histórico naquele
   *  local não há preço de referência: fica vazio para escrever à mão. */
  function palpitarKwh(custo: Cents | null, local: string) {
    if (custo === null || custo <= 0) return;
    const preco = precoKwhDoLocal(veiculo.cargas, local);
    if (preco !== undefined) setKwh(kwhPeloCusto(custo, preco));
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
      ? statusOrcamentoMes(despesas, parcelas, cfg.orcamentos, mesDe(data), mesAtual()).find(
          (s) => s.categoria === etiqueta,
        )
      : undefined;

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!uid) return;

    const valor = valorTexto;
    if (valor === null || valor <= 0) {
      setErro("Valor inválido — use por exemplo 12,50.");
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
        const kwhNum = parseFloat(kwh.replace(",", "."));
        if (!Number.isFinite(kwhNum) || kwhNum <= 0) {
          setErro("kWh inválido.");
          setSalvando(false);
          return;
        }
        const local = descricao.trim();
        if (!local) {
          setErro("Escolha o local do carregamento.");
          setSalvando(false);
          return;
        }
        await criarCarga(uid, {
          data,
          kwh: kwhNum,
          custo: valor,
          precoKwh: Math.round(valor / kwhNum),
          local,
          contaCartao: conta || undefined,
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
        const dados = {
          descricao,
          valor,
          data,
          categoria: etiquetaFinal,
          contaCartao: conta || undefined,
          nota: notaFinal,
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
                  ? "Carregamento registado"
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
            <div className={styles.seletorTipo} role="radiogroup" aria-label="Tipo de lançamento">
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
              <div className={styles.subTipos} role="radiogroup" aria-label="Lançamento do veículo">
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
          <div className={styles.seletorTipo} role="radiogroup" aria-label="Receita ou despesa">
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
              setKwhTocado(false);
              palpitarKwh(valorTexto, v);
            }}
          />
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

        {/* Numa despesa parcelada o valor vive só dentro da folha de
            Parcelamento — ter os dois seria pedir o mesmo número duas vezes. */}
        <div className={styles.linhaDupla}>
          {!ehParcelada && (
            <label className={styles.campo}>
              {tipo === "carga" ? "Custo total (€)" : "Valor (€)"}
              <CampoMoeda
                valor={valorTexto}
                aoMudar={(v) => {
                  setValorTexto(v);
                  if (tipo === "carga" && !kwhTocado) palpitarKwh(v, descricao);
                }}
                required
              />
            </label>
          )}

          {tipo === "carga" && (
            <label className={styles.campo}>
              kWh
              <input
                type="text"
                inputMode="decimal"
                value={kwh}
                onChange={(e) => {
                  setKwhTocado(true);
                  setKwh(e.target.value);
                }}
                required
              />
            </label>
          )}
        </div>

        <SeletorData valor={data} aoMudar={setData} />

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

        {cfg.contasCartoes.length > 0 && (
          <div className={styles.campo}>
            <span>Cartão</span>
            <div className={styles.fileiraContas} role="radiogroup" aria-label="Cartão">
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
            abre a folha do parcelamento; desmarcar volta à despesa simples. */}
        {tipo === "despesa" && !editando && (
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
          <p className={styles.erro} role="alert">
            {erro}
          </p>
        )}

        <div className={styles.acoes}>
          <button type="submit" className={styles.salvar} disabled={salvando}>
            {salvando ? "Aguarde…" : editando ? "Salvar alterações" : "Adicionar"}
          </button>

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
            <CampoMoeda valor={valorTexto} aoMudar={setValorTexto} />
          </label>

          <div className={styles.campo}>
            <span>Nº de parcelas</span>
            <div className={styles.fileiraContas}>
              {[3, 6, 9, 12].map((n) => (
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
            <Seletor
              rotulo="Outro número de parcelas"
              nivel={2}
              valor={numParcelas}
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
            />
          </label>
        </div>
      </BottomSheet>
    </BottomSheet>
  );
}

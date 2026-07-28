import { useState, type FormEvent } from "react";
import BottomSheet from "../components/BottomSheet";
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
import { useAuthStore } from "../stores/authStore";
import { useCfgStore } from "../stores/cfgStore";
import { useDespesasStore, useReceitasStore } from "../stores/lancamentosStore";
import { mostrarToast } from "../stores/toastStore";
import { useUiStore, type TipoRegistro } from "../stores/uiStore";
import { hojeIso, mesDe } from "../utils/calculos";
import { formatCents, parseMoney } from "../utils/money";
import styles from "./RegistroRapido.module.css";

/** Três escolhas de primeiro nível. "Veículo" não é um `TipoRegistro`: é o
 *  guarda-chuva de carga + despesa do veículo, que se resolve na sub-escolha
 *  logo abaixo. Ao entrar em Veículo cai sempre em Carga — como o tipo já
 *  guarda qual sub-escolha está ativa, sair e voltar reinicia sozinho, sem um
 *  segundo estado para manter em sincronia. */
const TIPOS: {
  valor: TipoRegistro | "veiculo";
  rotulo: string;
  classeAtiva: keyof typeof styles;
}[] = [
  { valor: "despesa", rotulo: "Despesa", classeAtiva: "tipoAtivoDespesa" },
  { valor: "receita", rotulo: "Receita", classeAtiva: "tipoAtivoReceita" },
  { valor: "veiculo", rotulo: "Veículo", classeAtiva: "tipoAtivoVeiculo" },
];

const SUB_VEICULO: { valor: TipoRegistro; rotulo: string }[] = [
  { valor: "carga", rotulo: "Carga" },
  { valor: "despesaVeiculo", rotulo: "Despesa" },
];

/** Bottom sheet de registro rápido: lança (ou edita) receita/despesa, e lança
 *  carga elétrica / despesa do veículo (item 3/6 — estes dois só criam; a
 *  edição deles fica na tela Veículo). */
export default function RegistroRapido() {
  const aberta = useUiStore((s) => s.registroAberto);
  const tipo = useUiStore((s) => s.registroTipo);
  const editandoId = useUiStore((s) => s.editandoId);
  const { abrirRegistro, fecharRegistro } = useUiStore();
  const uid = useAuthStore((s) => s.sessao?.uid);
  const receitas = useReceitasStore((s) => s.itens);
  const despesas = useDespesasStore((s) => s.itens);
  const cfg = useCfgStore((s) => s.cfg);

  const [descricao, setDescricao] = useState("");
  const [nota, setNota] = useState("");
  const [valorTexto, setValorTexto] = useState("");
  const [data, setData] = useState(hojeIso());
  const [etiqueta, setEtiqueta] = useState(""); // fonte (receita) ou categoria (despesa)
  const [conta, setConta] = useState(""); // conta/cartão (opcional)
  const [kwh, setKwh] = useState(""); // só carga elétrica
  // item 24: despesa parcelada direto daqui (não é um tipo novo no radiogroup)
  const [parcelada, setParcelada] = useState(false);
  const [numParcelas, setNumParcelas] = useState("3");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const ehVeiculo = tipo === "carga" || tipo === "despesaVeiculo";

  const editando =
    editandoId !== null
      ? tipo === "receita"
        ? receitas.find((r) => r.id === editandoId)
        : despesas.find((d) => d.id === editandoId)
      : undefined;

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
      if (editando) {
        setDescricao(editando.descricao);
        setNota(editando.nota ?? "");
        setValorTexto(formatCents(editando.valor));
        setData(editando.data);
        setEtiqueta("fonte" in editando ? editando.fonte : editando.categoria);
        setConta(("fonte" in editando ? editando.conta : editando.contaCartao) ?? "");
      } else {
        setDescricao("");
        setNota("");
        setValorTexto("");
        setData(hojeIso());
        setEtiqueta("");
        setConta("");
        setKwh("");
        setParcelada(false);
        setNumParcelas("3");
      }
    } else if (assinatura === "novo") {
      // Trocou de tipo num lançamento novo: a fonte/categoria não se traduz
      // entre as listas — limpa só a etiqueta (e o kWh, que é só da carga).
      setEtiqueta("");
      setKwh("");
      setNota("");
      setParcelada(false);
    }
  }

  const opcoes =
    tipo === "receita"
      ? cfg.fontesReceita
      : tipo === "despesaVeiculo"
        ? cfg.categoriasVeiculo
        : cfg.categoriasCorrentes;

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!uid) return;

    const valor = parseMoney(valorTexto);
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
      } else if (tipo === "despesa" && parcelada && !editando) {
        // Valor preenchido = total DA COMPRA; a divisão por mês é da Parcela.
        const n = parseInt(numParcelas, 10);
        if (!Number.isInteger(n) || n < 2) {
          setErro("Escolha em quantas parcelas — pelo menos 2.");
          setSalvando(false);
          return;
        }
        await criarParcela(uid, {
          descricao,
          total: valor,
          numParcelas: n,
          primeiroMes: mesDe(data),
          categoria: etiquetaFinal,
          cartao: conta || null,
          autoDebit: !!conta && cfg.tipoCartao[conta] === "credit",
          pagoPorMes: {},
          nota: notaFinal,
        });
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
        editando
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
    if (!window.confirm(`Excluir "${editando.descricao}"?`)) return;
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
      arrastavel
      tamanho="grande"
    >
      <form className={styles.form} onSubmit={salvar}>
        {!editando && (
          <>
            <div className={styles.seletorTipo} role="radiogroup" aria-label="Tipo de lançamento">
              {TIPOS.map((t) => {
                const ativo = t.valor === "veiculo" ? ehVeiculo : tipo === t.valor;
                return (
                  <button
                    key={t.valor}
                    type="button"
                    role="radio"
                    aria-checked={ativo}
                    className={`${styles.tipo} ${ativo ? styles[t.classeAtiva] : ""}`}
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

        {/* Nome + Nota lado a lado. A despesa do veículo não tem nome próprio
            no modelo de dados (só categoria + nota), então ali a Nota ocupa a
            linha inteira. */}
        {tipo === "carga" && (
          <SeletorLocal valor={descricao} opcoes={cfg.locaisCarregamento} aoMudar={setDescricao} />
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

        <div className={styles.linhaDupla}>
          <label className={styles.campo}>
            {tipo === "carga" ? "Custo total (€)" : "Valor (€)"}
            <input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={valorTexto}
              onChange={(e) => setValorTexto(e.target.value)}
              required
            />
          </label>

          {tipo === "carga" && (
            <label className={styles.campo}>
              kWh
              <input
                type="text"
                inputMode="decimal"
                value={kwh}
                onChange={(e) => setKwh(e.target.value)}
                required
              />
            </label>
          )}
        </div>

        <SeletorData valor={data} aoMudar={setData} />

        {tipo !== "carga" && (
          <SeletorCategoria
            rotulo={tipo === "receita" ? "Fonte" : "Categoria"}
            valor={etiqueta}
            opcoes={opcoes}
            aoMudar={setEtiqueta}
          />
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

        {/* item 24: um toque transforma a despesa numa compra parcelada */}
        {tipo === "despesa" && !editando && (
          <div className={styles.campo}>
            <button
              type="button"
              aria-pressed={parcelada}
              className={`${styles.parceladaToggle} ${parcelada ? styles.parceladaAtiva : ""}`}
              onClick={() => setParcelada(!parcelada)}
            >
              Parcelada
            </button>
            {parcelada && (
              <>
                <span className={styles.parceladaPergunta}>Quantas parcelas?</span>
                <div className={styles.fileiraContas}>
                  {[2, 3, 6, 10, 12, 24].map((n) => (
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
                  <input
                    className={styles.numParcelas}
                    inputMode="numeric"
                    aria-label="Número de parcelas"
                    value={numParcelas}
                    onChange={(e) => setNumParcelas(e.target.value)}
                  />
                </div>
                <span className={styles.parceladaNota}>
                  O valor acima é o TOTAL da compra — a divisão por mês é feita na tela Parcelas.
                </span>
              </>
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
    </BottomSheet>
  );
}

import { useState, type FormEvent } from "react";
import BottomSheet from "../components/BottomSheet";
import SeletorCategoria from "../components/SeletorCategoria";
import SeletorData from "../components/SeletorData";
import {
  atualizarDespesa,
  atualizarReceita,
  criarDespesa,
  criarReceita,
  removerDespesa,
  removerReceita,
} from "../services/lancamentosService";
import { criarCarga, criarDespesaVeiculo } from "../services/veiculoService";
import { adicionarItemLista } from "../services/cfgService";
import { useAuthStore } from "../stores/authStore";
import { useCfgStore } from "../stores/cfgStore";
import { useDespesasStore, useReceitasStore } from "../stores/lancamentosStore";
import { mostrarToast } from "../stores/toastStore";
import { useUiStore, type TipoRegistro } from "../stores/uiStore";
import { hojeIso } from "../utils/calculos";
import { formatCents, parseMoney } from "../utils/money";
import styles from "./RegistroRapido.module.css";

const TIPOS: { valor: TipoRegistro; rotulo: string; classeAtiva: keyof typeof styles }[] = [
  { valor: "despesa", rotulo: "Despesa", classeAtiva: "tipoAtivoDespesa" },
  { valor: "receita", rotulo: "Receita", classeAtiva: "tipoAtivoReceita" },
  { valor: "carga", rotulo: "Carga", classeAtiva: "tipoAtivoVeiculo" },
  { valor: "despesaVeiculo", rotulo: "Desp. veículo", classeAtiva: "tipoAtivoVeiculo" },
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
  const [valorTexto, setValorTexto] = useState("");
  const [data, setData] = useState(hojeIso());
  const [etiqueta, setEtiqueta] = useState(""); // fonte (receita) ou categoria (despesa)
  const [conta, setConta] = useState(""); // conta/cartão (opcional)
  const [kwh, setKwh] = useState(""); // só carga elétrica
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
        setValorTexto(formatCents(editando.valor));
        setData(editando.data);
        setEtiqueta("fonte" in editando ? editando.fonte : editando.categoria);
        setConta(("fonte" in editando ? editando.conta : editando.contaCartao) ?? "");
      } else {
        setDescricao("");
        setValorTexto("");
        setData(hojeIso());
        setEtiqueta("");
        setConta("");
        setKwh("");
      }
    } else if (assinatura === "novo") {
      // Trocou de tipo num lançamento novo: a fonte/categoria não se traduz
      // entre as listas — limpa só a etiqueta (e o kWh, que é só da carga).
      setEtiqueta("");
      setKwh("");
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
    const etiquetaFinal = etiqueta || opcoes[opcoes.length - 1];

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
          setErro("Informe o local do carregamento.");
          setSalvando(false);
          return;
        }
        await criarCarga(uid, {
          data,
          kwh: kwhNum,
          custo: valor,
          precoKwh: Math.round(valor / kwhNum),
          local,
        });
        if (!cfg.locaisCarregamento.includes(local)) {
          await adicionarItemLista(uid, cfg, "locaisCarregamento", local).catch(() => null);
        }
      } else if (tipo === "despesaVeiculo") {
        await criarDespesaVeiculo(uid, {
          data,
          valor,
          categoria: etiquetaFinal,
          nota: descricao.trim() || undefined,
        });
      } else if (tipo === "receita") {
        const dados = { descricao, valor, data, fonte: etiquetaFinal, conta: conta || undefined };
        if (editando) await atualizarReceita(uid, { ...editando, ...dados });
        else await criarReceita(uid, dados);
      } else {
        const dados = {
          descricao,
          valor,
          data,
          categoria: etiquetaFinal,
          contaCartao: conta || undefined,
        };
        if (editando) await atualizarDespesa(uid, { ...editando, ...dados });
        else await criarDespesa(uid, dados);
      }
      mostrarToast(
        editando
          ? "Alterações salvas"
          : tipo === "receita"
            ? "Receita adicionada"
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
    >
      <form className={styles.form} onSubmit={salvar}>
        {!editando && (
          <div className={styles.seletorTipo} role="radiogroup" aria-label="Tipo de lançamento">
            {TIPOS.map((t) => (
              <button
                key={t.valor}
                type="button"
                role="radio"
                aria-checked={tipo === t.valor}
                className={`${styles.tipo} ${tipo === t.valor ? styles[t.classeAtiva] : ""}`}
                onClick={() => abrirRegistro(t.valor)}
              >
                {t.rotulo}
              </button>
            ))}
          </div>
        )}

        <label className={styles.campo}>
          {tipo === "carga" ? "Local" : tipo === "despesaVeiculo" ? "Descrição" : "Descrição"}
          <input
            type="text"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            required={tipo !== "despesaVeiculo"}
            maxLength={80}
          />
        </label>

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

        {!ehVeiculo && cfg.contasCartoes.length > 0 && (
          <label className={styles.campo}>
            Conta/cartão (opcional)
            <select value={conta} onChange={(e) => setConta(e.target.value)}>
              <option value="">Sem conta</option>
              {cfg.contasCartoes.map((c) => (
                <option key={c} value={c}>
                  {c}
                  {cfg.tipoCartao[c] === "credit" ? " · crédito" : ""}
                </option>
              ))}
            </select>
          </label>
        )}

        {erro !== null && (
          <p className={styles.erro} role="alert">
            {erro}
          </p>
        )}

        <button type="submit" className={styles.salvar} disabled={salvando}>
          {salvando ? "Aguarde…" : editando ? "Salvar alterações" : "Adicionar"}
        </button>

        {editando && (
          <button type="button" className={styles.excluir} onClick={excluir} disabled={salvando}>
            Excluir lançamento
          </button>
        )}
      </form>
    </BottomSheet>
  );
}

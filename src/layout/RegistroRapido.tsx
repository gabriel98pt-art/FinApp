import { useState, type FormEvent } from "react";
import BottomSheet from "../components/BottomSheet";
import {
  atualizarDespesa,
  atualizarReceita,
  criarDespesa,
  criarReceita,
  removerDespesa,
  removerReceita,
} from "../services/lancamentosService";
import { useAuthStore } from "../stores/authStore";
import { useCfgStore } from "../stores/cfgStore";
import { useDespesasStore, useReceitasStore } from "../stores/lancamentosStore";
import { mostrarToast } from "../stores/toastStore";
import { useUiStore } from "../stores/uiStore";
import { hojeIso } from "../utils/calculos";
import { formatCents, parseMoney } from "../utils/money";
import styles from "./RegistroRapido.module.css";

/** Bottom sheet de registro rápido: lança (ou edita) receita/despesa. */
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
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

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
      }
    } else if (assinatura === "novo") {
      // Trocou receita↔despesa num lançamento novo: a fonte/categoria não
      // se traduz entre as listas — limpa só a etiqueta.
      setEtiqueta("");
    }
  }

  const opcoes = tipo === "receita" ? cfg.fontesReceita : cfg.categoriasCorrentes;

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
      if (tipo === "receita") {
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
            <button
              type="button"
              role="radio"
              aria-checked={tipo === "despesa"}
              className={`${styles.tipo} ${tipo === "despesa" ? styles.tipoAtivoDespesa : ""}`}
              onClick={() => abrirRegistro("despesa")}
            >
              Despesa
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={tipo === "receita"}
              className={`${styles.tipo} ${tipo === "receita" ? styles.tipoAtivoReceita : ""}`}
              onClick={() => abrirRegistro("receita")}
            >
              Receita
            </button>
          </div>
        )}

        <label className={styles.campo}>
          Descrição
          <input
            type="text"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            required
            maxLength={80}
          />
        </label>

        <div className={styles.linhaDupla}>
          <label className={styles.campo}>
            Valor (€)
            <input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={valorTexto}
              onChange={(e) => setValorTexto(e.target.value)}
              required
            />
          </label>

          <label className={styles.campo}>
            Data
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
          </label>
        </div>

        <label className={styles.campo}>
          {tipo === "receita" ? "Fonte" : "Categoria"}
          <select value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)}>
            <option value="">Escolher…</option>
            {opcoes.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>

        {cfg.contasCartoes.length > 0 && (
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

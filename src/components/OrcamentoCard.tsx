import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import BottomSheet from "./BottomSheet";
import CampoMoeda from "./CampoMoeda";
import CategoriaBolha from "./CategoriaBolha";
import Seletor from "./Seletor";
import { definirOrcamento } from "../services/cfgService";
import { useAuthStore } from "../stores/authStore";
import { useCfgStore } from "../stores/cfgStore";
import { useDespesasStore } from "../stores/lancamentosStore";
import { useMesVisivelStore } from "../stores/mesVisivelStore";
import { useParcelasStore } from "../stores/parcelasStore";
import { mostrarToast } from "../stores/toastStore";
import { mesAtual } from "../utils/calculos";
import { corDaCategoriaVisual } from "../utils/categoriaVisual";
import { formatMoney } from "../utils/money";
import { LIMIAR_PERTO_ORCAMENTO, statusOrcamentoMes } from "../utils/orcamento";
import type { Cents } from "../types";
import styles from "./OrcamentoCard.module.css";

/** Caixa única de teto: define (escolhendo a categoria) ou edita/remove (a
 *  categoria já vem fixa). Vive aqui, junto do que ele afeta — era um
 *  formulário solto em Definições, sem nenhuma pista de quanto já se tinha
 *  gasto enquanto se digitava o valor. */
function FormTeto({
  aberta,
  aoFechar,
  categoriaFixa,
  tetoAtual,
  categoriasDisponiveis,
  uid,
}: {
  aberta: boolean;
  aoFechar: () => void;
  /** Vazia = modo "definir novo" (escolhe a categoria na hora). */
  categoriaFixa: string;
  tetoAtual: Cents | undefined;
  categoriasDisponiveis: string[];
  uid: string;
}) {
  const editando = categoriaFixa !== "";
  const [categoria, setCategoria] = useState(categoriaFixa);
  const [valor, setValor] = useState<Cents | null>(tetoAtual ?? null);
  const [salvando, setSalvando] = useState(false);

  // A folha só monta os campos quando abre; a chave abaixo remonta o estado a
  // cada abertura (mesmo padrão do FormParcela em Parcelas.tsx).
  const chave = editando ? categoriaFixa : "novo";
  const [semeadoPara, setSemeadoPara] = useState<string | null>(null);
  if (aberta && semeadoPara !== chave) {
    setSemeadoPara(chave);
    setCategoria(categoriaFixa);
    setValor(tetoAtual ?? null);
  }

  function fechar() {
    setSemeadoPara(null);
    aoFechar();
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const alvo = editando ? categoriaFixa : categoria;
    if (!alvo) return mostrarToast("Escolha uma categoria.");
    if (valor === null || valor <= 0) return mostrarToast("Informe um teto maior que zero.");
    setSalvando(true);
    try {
      await definirOrcamento(uid, alvo, valor);
      mostrarToast(editando ? "✓ Teto atualizado" : "✓ Teto definido");
      fechar();
    } catch {
      mostrarToast("Não foi possível salvar o teto.");
    } finally {
      setSalvando(false);
    }
  }

  async function remover() {
    setSalvando(true);
    try {
      await definirOrcamento(uid, categoriaFixa, null);
      mostrarToast("Teto removido");
      fechar();
    } catch {
      mostrarToast("Não foi possível remover.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <BottomSheet
      aberta={aberta}
      aoFechar={fechar}
      titulo={editando ? `Teto — ${categoriaFixa}` : "Definir teto"}
    >
      <form className={styles.form} onSubmit={salvar}>
        {!editando && (
          <Seletor
            rotulo="Categoria"
            valor={categoria}
            opcoes={categoriasDisponiveis}
            aoMudar={setCategoria}
            renderIcone={(c, tamanho) => <CategoriaBolha categoria={c} tamanho={tamanho} />}
            aviso="Todas as categorias já têm um teto definido."
          />
        )}
        <label className={styles.campo}>
          Teto mensal
          <CampoMoeda valor={valor} aoMudar={setValor} required disabled={salvando} />
        </label>
        <button type="submit" className={styles.salvar} disabled={salvando}>
          {salvando ? "Aguarde…" : editando ? "Salvar alterações" : "Definir teto"}
        </button>
        {editando && (
          <button
            type="button"
            className={styles.remover}
            onClick={() => void remover()}
            disabled={salvando}
          >
            Remover teto
          </button>
        )}
      </form>
    </BottomSheet>
  );
}

/** Orçamento por categoria (seção 4.8): gasto real vs. teto do mês exibido,
 *  cor da própria categoria na barra e selo quando fica perto ou estoura. O
 *  teto define-se e edita-se aqui mesmo — tocar numa linha abre a folha de
 *  edição, "+ Definir teto" abre a de criação. */
export default function OrcamentoCard() {
  const uid = useAuthStore((s) => s.sessao?.uid);
  const cfg = useCfgStore((s) => s.cfg);
  const despesas = useDespesasStore((s) => s.itens);
  const parcelas = useParcelasStore((s) => s.itens);
  const mes = useMesVisivelStore((s) => s.mes);

  const [formAberto, setFormAberto] = useState(false);
  const [editandoCategoria, setEditandoCategoria] = useState<string | null>(null);

  const status = statusOrcamentoMes(despesas, parcelas, cfg.orcamentos, mes, mesAtual());
  const comTeto = new Set(status.map((s) => s.categoria));
  const categoriasDisponiveis = cfg.categoriasDespesa.filter((c) => !comTeto.has(c));
  // Breakdown por categoria é sensível (seção 4.6) — borra em modo discreto
  const classeDiscreta = cfg.modoDiscreto ? "discreto" : "";

  function abrirNovo() {
    setEditandoCategoria(null);
    setFormAberto(true);
  }

  function abrirEdicao(categoria: string) {
    setEditandoCategoria(categoria);
    setFormAberto(true);
  }

  if (!uid) return null;

  return (
    <div className={styles.card}>
      <div className={styles.cabecalho}>
        <p className={styles.titulo}>Orçamento por categoria</p>
        <button className={styles.botaoAdicionar} onClick={abrirNovo}>
          <Plus size={15} aria-hidden /> Definir teto
        </button>
      </div>

      {status.length === 0 ? (
        <p className={styles.vazio}>
          Defina um teto mensal por categoria pra acompanhar o gasto aqui.
        </p>
      ) : (
        <div className={styles.lista}>
          {status.map((s) => {
            const perto = !s.estourado && s.pct >= LIMIAR_PERTO_ORCAMENTO;
            const cor = corDaCategoriaVisual(cfg, s.categoria);
            return (
              <button
                key={s.categoria}
                className={styles.linha}
                onClick={() => abrirEdicao(s.categoria)}
              >
                <div className={styles.linhaTopo}>
                  <span className={styles.categoriaNome}>
                    <CategoriaBolha categoria={s.categoria} tamanho={24} />
                    {s.categoria}
                  </span>
                  <span className={`${styles.valores} ${classeDiscreta}`}>
                    {formatMoney(s.gasto, cfg.currency)}
                    <span className={styles.valoresTeto}>
                      {" "}
                      / {formatMoney(s.teto, cfg.currency)}
                    </span>
                  </span>
                </div>
                <div className={styles.barra}>
                  <div
                    className={styles.preenchido}
                    style={{
                      width: `${Math.min(100, s.pct)}%`,
                      background: s.estourado ? "var(--red)" : cor,
                    }}
                  />
                </div>
                <div className={styles.linhaBase}>
                  <span className={styles.pct}>{s.pct}%</span>
                  {(s.estourado || perto) && (
                    <span
                      className={`${styles.selo} ${s.estourado ? styles.seloEstourado : styles.seloPerto}`}
                    >
                      {s.estourado ? "Estourou" : "Perto do limite"}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <FormTeto
        aberta={formAberto}
        aoFechar={() => setFormAberto(false)}
        categoriaFixa={editandoCategoria ?? ""}
        tetoAtual={editandoCategoria ? cfg.orcamentos[editandoCategoria] : undefined}
        categoriasDisponiveis={categoriasDisponiveis}
        uid={uid}
      />
    </div>
  );
}

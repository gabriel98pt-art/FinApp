import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import BottomSheet from "./BottomSheet";
import CampoValorDestaque from "./CampoValorDestaque";
import CategoriaBolha from "./CategoriaBolha";
import Seletor from "./Seletor";
import { definirOrcamento } from "../services/cfgService";
import { useAuthStore } from "../stores/authStore";
import { useCfgStore } from "../stores/cfgStore";
import { useDespesasStore } from "../stores/lancamentosStore";
import { useMesVisivelStore } from "../stores/mesVisivelStore";
import { useParcelasStore } from "../stores/parcelasStore";
import { mostrarToast } from "../stores/toastStore";
import { hojeIso, mesAtual } from "../utils/calculos";
import { corDaCategoriaVisual } from "../utils/categoriaVisual";
import { formatMoney } from "../utils/money";
import {
  gastosDaCategoriaMes,
  LIMIAR_PERTO_ORCAMENTO,
  statusOrcamentoMes,
} from "../utils/orcamento";
import type { Transacao } from "../utils/transacoes";
import type { Cents, Currency } from "../types";
import styles from "./OrcamentoCard.module.css";
import Botao from "./Botao";

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
  transacoes,
  moeda,
  uid,
}: {
  aberta: boolean;
  aoFechar: () => void;
  /** Vazia = modo "definir novo" (escolhe a categoria na hora). */
  categoriaFixa: string;
  tetoAtual: Cents | undefined;
  categoriasDisponiveis: string[];
  /** O que compõe o gasto desta categoria no mês exibido, já filtrado. Vazio
   *  no modo "definir novo" — ainda não há categoria escolhida. */
  transacoes: Transacao[];
  moeda: Currency;
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

  const gastoDaLista = transacoes.reduce((s, t) => s + t.valor, 0);

  return (
    <BottomSheet
      aberta={aberta}
      aoFechar={fechar}
      titulo={editando ? `Teto — ${categoriaFixa}` : "Definir teto"}
      tamanho={editando ? "grande" : "padrao"}
    >
      {/* O que já foi gasto, item a item — a prova do número que a linha
          mostra. Vem de `transacoesDoMes`, o mesmo cálculo que alimenta a tela
          Transações: contar aqui à parte seria a segunda implementação da
          mesma pergunta, que foi exatamente o que fez o orçamento e o extrato
          discordarem sobre uma parcela por vencer (ver
          coerenciaMesCorrente.test.ts). */}
      {editando && (
        <div className={styles.gastos}>
          <p className={styles.gastosTitulo}>
            Gastos que contam para este teto
            <span className={styles.gastosTotal}>{formatMoney(gastoDaLista, moeda)}</span>
          </p>
          {transacoes.length === 0 ? (
            <p className={styles.vazio}>Nada nesta categoria no mês exibido.</p>
          ) : (
            <ul className={styles.gastosLista}>
              {transacoes.map((t) => (
                <li key={t.chave} className={styles.gasto}>
                  <span className={styles.gastoDia}>{t.data.slice(8, 10)}</span>
                  <span className={styles.gastoTitulo}>{t.titulo}</span>
                  <span className={styles.gastoValor}>{formatMoney(t.valor, moeda)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

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
        {/* O teto é o número que a folha inteira existe para definir (item 4 do
            lote de UX/nav, 30/08) — mesmo campo grande de Cartões, Despesas,
            Veículo, Parcelas e Fundos. A categoria fica ANTES dele quando se
            está a criar: escolher a categoria é que dá sentido ao número, e
            invertê-los era pedir "quanto?" sem dizer de quê. */}
        <CampoValorDestaque
          rotulo="Quanto por mês?"
          valor={valor}
          aoMudar={setValor}
          required
          disabled={salvando}
        />
        <Botao type="submit" variante="submeter" disabled={salvando}>
          {salvando ? "Aguarde…" : editando ? "Salvar alterações" : "Definir teto"}
        </Botao>
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
 *  edição, o "+" ao lado do título abre a de criação. */
export default function OrcamentoCard() {
  const uid = useAuthStore((s) => s.sessao?.uid);
  const cfg = useCfgStore((s) => s.cfg);
  const despesas = useDespesasStore((s) => s.itens);
  const parcelas = useParcelasStore((s) => s.itens);
  const mes = useMesVisivelStore((s) => s.mes);

  const [formAberto, setFormAberto] = useState(false);
  const [editandoCategoria, setEditandoCategoria] = useState<string | null>(null);

  const status = statusOrcamentoMes(despesas, parcelas, cfg.orcamentos, mes, mesAtual(), hojeIso());
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
        {/* Só o "+" (01/09): o título ao lado já diz "Orçamento por categoria".
            O texto inteiro vive no aria-label. */}
        <Botao variante="primaria" soIcone aria-label="Definir teto" onClick={abrirNovo}>
          <Plus size={16} aria-hidden />
        </Botao>
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
                {/* span e não div: o conteúdo de um <button> é, por
                    especificação, conteúdo de frase — um <div> lá dentro é HTML
                    inválido. As outras listas clicáveis do app (Transações,
                    Parcelas, ListaLancamentos) já usavam span; este cartão é que
                    tinha derivado. Os estilos não mudam: .linhaTopo e .linhaBase
                    já são flex, e .barra/.preenchido ganharam display: block. */}
                <span className={styles.linhaTopo}>
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
                </span>
                <span className={styles.barra}>
                  <span
                    className={styles.preenchido}
                    style={{
                      width: `${Math.min(100, s.pct)}%`,
                      background: s.estourado ? "var(--red)" : cor,
                    }}
                  />
                </span>
                <span className={styles.linhaBase}>
                  <span className={styles.pct}>{s.pct}%</span>
                  {(s.estourado || perto) && (
                    <span
                      className={`${styles.selo} ${s.estourado ? styles.seloEstourado : styles.seloPerto}`}
                    >
                      {s.estourado ? "Estourou" : "Perto do limite"}
                    </span>
                  )}
                </span>
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
        transacoes={
          editandoCategoria
            ? gastosDaCategoriaMes(
                despesas,
                parcelas,
                editandoCategoria,
                mes,
                mesAtual(),
                hojeIso(),
              )
            : []
        }
        moeda={cfg.currency}
        uid={uid}
      />
    </div>
  );
}

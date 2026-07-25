import { useRef, useState, type FormEvent } from "react";
import {
  CarTaxiFront,
  Download,
  EyeOff,
  LogOut,
  Moon,
  Palette,
  Smile,
  Sun,
  Upload,
  X,
} from "lucide-react";
import Pagina from "../components/Pagina";
import CategoriaBolha from "../components/CategoriaBolha";
import { KPIS_POR_PAGINA } from "../constants/kpis";
import SeletorCor from "../components/SeletorCor";
import SeletorEmoji from "../components/SeletorEmoji";
import { exportarBackup, importarBackup } from "../services/backupService";
import { sair } from "../services/authService";
import {
  adicionarItemLista,
  atualizarConfig,
  definirCorCategoria,
  definirEmojiCategoria,
  definirOrcamento,
  removerItemLista,
} from "../services/cfgService";
import { useAuthStore } from "../stores/authStore";
import { useCfgStore } from "../stores/cfgStore";
import { mostrarToast } from "../stores/toastStore";
import { useThemeStore } from "../stores/themeStore";
import type { Cents, ConfigConta, Currency } from "../types";
import { formatCents, parseMoney } from "../utils/money";
import styles from "./Definicoes.module.css";

const MOEDAS: { valor: Currency; rotulo: string }[] = [
  { valor: "EUR", rotulo: "Euro (€)" },
  { valor: "BRL", rotulo: "Real (R$)" },
  { valor: "USD", rotulo: "Dólar ($)" },
  { valor: "GBP", rotulo: "Libra (£)" },
];

function EditorLista({
  titulo,
  itens,
  lista,
  cfg,
  uid,
}: {
  titulo: string;
  itens: string[];
  lista: "categoriasFixas" | "categoriasCorrentes" | "fontesReceita";
  cfg: ConfigConta;
  uid: string;
}) {
  const [novo, setNovo] = useState("");
  // Categoria cujo emoji/cor está sendo escolhido agora (item 19).
  const [emojiDe, setEmojiDe] = useState<string | null>(null);
  const [corDe, setCorDe] = useState<string | null>(null);

  async function escolherEmoji(emoji: string | null) {
    if (!emojiDe) return;
    const alvo = emojiDe;
    setEmojiDe(null);
    try {
      await definirEmojiCategoria(uid, alvo, emoji);
    } catch {
      mostrarToast("Não foi possível salvar o emoji.");
    }
  }

  async function escolherCor(cor: string | null) {
    if (!corDe) return;
    const alvo = corDe;
    setCorDe(null);
    try {
      await definirCorCategoria(uid, alvo, cor);
    } catch {
      mostrarToast("Não foi possível salvar a cor.");
    }
  }

  async function adicionar(e: FormEvent) {
    e.preventDefault();
    const nome = novo.trim();
    if (!nome) return;
    try {
      await adicionarItemLista(uid, cfg, lista, nome);
      setNovo("");
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : "Não foi possível adicionar.");
    }
  }

  async function remover(item: string) {
    if (!window.confirm(`Remover "${item}"? Lançamentos que já usam esse nome não mudam.`)) return;
    try {
      await removerItemLista(uid, cfg, lista, item);
    } catch {
      mostrarToast("Não foi possível remover.");
    }
  }

  return (
    <div className={styles.grupo}>
      <p className={styles.grupoTitulo}>{titulo}</p>
      {itens.length > 0 && (
        <ul className={styles.listaCategorias}>
          {itens.map((item) => (
            <li key={item} className={styles.linhaCategoria}>
              <CategoriaBolha categoria={item} />
              <span className={styles.nomeCategoria}>{item}</span>
              <button
                className={styles.acaoCategoria}
                onClick={() => setEmojiDe(item)}
                aria-label={`Emoji de ${item}`}
                title="Emoji"
              >
                <Smile size={16} aria-hidden />
              </button>
              <button
                className={styles.acaoCategoria}
                onClick={() => setCorDe(item)}
                aria-label={`Cor de ${item}`}
                title="Cor"
              >
                <Palette size={16} aria-hidden />
              </button>
              <button
                className={`${styles.acaoCategoria} ${styles.acaoRemover}`}
                onClick={() => void remover(item)}
                aria-label={`Remover ${item}`}
                title="Remover"
              >
                <X size={16} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className={styles.linhaAdicionar} onSubmit={adicionar}>
        <input
          className={styles.inputPequeno}
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          placeholder="Nova categoria…"
        />
        <button type="submit" className={styles.botaoPequeno}>
          Adicionar
        </button>
      </form>

      <SeletorEmoji
        aberta={emojiDe !== null}
        aoFechar={() => setEmojiDe(null)}
        titulo={emojiDe ? `Emoji de ${emojiDe}` : "Emoji"}
        valor={emojiDe ? (cfg.categoriaEmoji?.[emojiDe] ?? "") : ""}
        aoEscolher={(e) => void escolherEmoji(e)}
      />
      <SeletorCor
        aberta={corDe !== null}
        aoFechar={() => setCorDe(null)}
        titulo={corDe ? `Cor de ${corDe}` : "Cor"}
        valor={corDe ? (cfg.categoriaCor?.[corDe] ?? "") : ""}
        aoEscolher={(c) => void escolherCor(c)}
      />
    </div>
  );
}

/** Escolha dos 2 KPIs que a página mostra no mobile (item 8). No desktop
 *  continuam todos visíveis; TVDE fica de fora, sempre com os 4. */
function EscolhaKpis({ cfg, uid }: { cfg: ConfigConta; uid: string }) {
  async function alternar(paginaId: string, rotulo: string, atuais: string[]) {
    let novos: string[];
    if (atuais.includes(rotulo)) {
      // Não deixa ficar com menos de 2 — desmarcar o 3º é o que troca.
      if (atuais.length <= 2) return;
      novos = atuais.filter((r) => r !== rotulo);
    } else {
      // Já tem 2: o mais antigo sai e o novo entra.
      novos = [...atuais, rotulo].slice(-2);
    }
    try {
      await atualizarConfig(uid, {
        kpisMobile: { ...cfg.kpisMobile, [paginaId]: [novos[0], novos[1]] },
      });
    } catch {
      mostrarToast("Não foi possível salvar.");
    }
  }

  return (
    <div className={styles.grupo}>
      <p className={styles.grupoTitulo}>KPIs no mobile</p>
      <p className={styles.nota}>
        Cada página mostra 2 cartões no telemóvel — escolha quais. No computador continuam
        aparecendo todos.
      </p>
      {KPIS_POR_PAGINA.map((pag) => {
        const atuais = cfg.kpisMobile?.[pag.id] ?? pag.rotulos.slice(0, 2);
        return (
          <div key={pag.id} className={styles.grupoKpis}>
            <p className={styles.nomePagina}>{pag.titulo}</p>
            <div className={styles.chipsKpis}>
              {pag.rotulos.map((r) => {
                const ativo = atuais.includes(r);
                return (
                  <button
                    key={r}
                    className={`${styles.chipKpi} ${ativo ? styles.chipKpiAtivo : ""}`}
                    aria-pressed={ativo}
                    onClick={() => void alternar(pag.id, r, [...atuais])}
                  >
                    {r}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LinhaOrcamento({
  categoria,
  tetoAtual,
  uid,
}: {
  categoria: string;
  tetoAtual: Cents | undefined;
  uid: string;
}) {
  const [texto, setTexto] = useState(tetoAtual ? formatCents(tetoAtual) : "");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    const t = texto.trim();
    const valor = t === "" ? null : parseMoney(t);
    if (t !== "" && (valor === null || valor < 0)) {
      mostrarToast("Valor inválido.");
      setTexto(tetoAtual ? formatCents(tetoAtual) : "");
      return;
    }
    setSalvando(true);
    try {
      await definirOrcamento(uid, categoria, valor);
    } catch {
      mostrarToast("Não foi possível salvar o teto.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className={styles.linhaOrcamento}>
      <span className={styles.orcamentoCategoria}>{categoria}</span>
      <input
        className={styles.inputPequeno}
        inputMode="decimal"
        placeholder="sem teto"
        value={texto}
        disabled={salvando}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={salvar}
      />
    </div>
  );
}

export default function Definicoes() {
  const sessao = useAuthStore((s) => s.sessao);
  const theme = useThemeStore((s) => s.theme);
  const alternarTema = useThemeStore((s) => s.alternarTema);
  const cfg = useCfgStore((s) => s.cfg);
  const arquivoRef = useRef<HTMLInputElement>(null);
  const [importando, setImportando] = useState(false);

  const uid = sessao?.uid;

  async function alternarTvde() {
    if (!uid) return;
    try {
      await atualizarConfig(uid, { showTvde: !cfg.showTvde });
      mostrarToast(cfg.showTvde ? "Módulo TVDE desligado" : "✓ Módulo TVDE ligado");
    } catch {
      mostrarToast("Não foi possível alterar.");
    }
  }

  async function alternarModoDiscreto() {
    if (!uid) return;
    try {
      await atualizarConfig(uid, { modoDiscreto: !cfg.modoDiscreto });
    } catch {
      mostrarToast("Não foi possível alterar.");
    }
  }

  async function mudarMoeda(e: React.ChangeEvent<HTMLSelectElement>) {
    if (!uid) return;
    try {
      await atualizarConfig(uid, { currency: e.target.value as Currency });
      mostrarToast("✓ Moeda atualizada");
    } catch {
      mostrarToast("Não foi possível alterar.");
    }
  }

  async function exportar() {
    if (!uid) return;
    try {
      const json = await exportarBackup(uid);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `finapp-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      mostrarToast("✓ Backup baixado");
    } catch {
      mostrarToast("Não foi possível exportar.");
    }
  }

  function aoEscolherArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo || !uid) return;
    if (
      !window.confirm(
        "Importar backup? Isto SOBRESCREVE todos os dados atuais desta conta — a ação não pode ser desfeita.",
      )
    )
      return;
    const leitor = new FileReader();
    leitor.onload = async () => {
      setImportando(true);
      try {
        await importarBackup(uid, String(leitor.result ?? ""));
        mostrarToast("✓ Backup importado");
      } catch (err) {
        mostrarToast(err instanceof Error ? err.message : "Backup inválido.");
      } finally {
        setImportando(false);
      }
    };
    leitor.readAsText(arquivo);
  }

  if (!uid) return null;

  return (
    <Pagina titulo="Definições">
      <div className={styles.grupo}>
        <button className={styles.linha} onClick={alternarTema}>
          {theme === "dark" ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
          Tema: {theme === "dark" ? "escuro" : "claro"} (tocar para alternar)
        </button>
        <button className={styles.linha} onClick={() => void alternarTvde()}>
          <CarTaxiFront size={18} aria-hidden />
          Módulo TVDE: {cfg.showTvde ? "ligado" : "desligado"} (tocar para alternar)
        </button>
        <button className={styles.linha} onClick={() => void alternarModoDiscreto()}>
          <EyeOff size={18} aria-hidden />
          Modo discreto: {cfg.modoDiscreto ? "ligado" : "desligado"} (tocar para alternar)
        </button>
      </div>

      <div className={styles.grupo}>
        <label className={styles.linhaSelect}>
          <span>Moeda da conta</span>
          <select
            className={styles.select}
            value={cfg.currency}
            onChange={(e) => void mudarMoeda(e)}
          >
            {MOEDAS.map((m) => (
              <option key={m.valor} value={m.valor}>
                {m.rotulo}
              </option>
            ))}
          </select>
        </label>
        <p className={styles.nota}>
          Só o símbolo muda — a formatação de milhar/decimal é a mesma para todas.
        </p>
      </div>

      <EditorLista
        titulo="Categorias de despesa fixa"
        itens={cfg.categoriasFixas}
        lista="categoriasFixas"
        cfg={cfg}
        uid={uid}
      />
      <EditorLista
        titulo="Categorias de despesa corrente"
        itens={cfg.categoriasCorrentes}
        lista="categoriasCorrentes"
        cfg={cfg}
        uid={uid}
      />
      <EditorLista
        titulo="Fontes de receita"
        itens={cfg.fontesReceita}
        lista="fontesReceita"
        cfg={cfg}
        uid={uid}
      />

      <EscolhaKpis cfg={cfg} uid={uid} />

      <div className={styles.grupo}>
        <p className={styles.grupoTitulo}>Orçamento por categoria</p>
        <p className={styles.nota}>Teto mensal de despesa — deixe em branco pra não ter teto.</p>
        <div className={styles.listaOrcamento}>
          {cfg.categoriasCorrentes.map((c) => (
            <LinhaOrcamento key={c} categoria={c} tetoAtual={cfg.orcamentos[c]} uid={uid} />
          ))}
        </div>
      </div>

      <div className={styles.grupo}>
        <p className={styles.grupoTitulo}>Backup</p>
        <p className={styles.nota}>
          Exporte todos os dados desta conta, ou restaure de um arquivo.
        </p>
        <div className={styles.linhaAdicionar}>
          <button className={styles.botaoPequeno} onClick={() => void exportar()}>
            <Download size={14} aria-hidden /> Exportar dados
          </button>
          <button
            className={styles.botaoPequeno}
            onClick={() => arquivoRef.current?.click()}
            disabled={importando}
          >
            <Upload size={14} aria-hidden /> {importando ? "Importando…" : "Importar dados"}
          </button>
          <input
            ref={arquivoRef}
            type="file"
            accept=".json"
            className={styles.arquivoOculto}
            onChange={aoEscolherArquivo}
          />
        </div>
      </div>

      <div className={styles.grupo}>
        <p className={styles.conta}>Sessão: {sessao?.email ?? "—"}</p>
        <button className={`${styles.linha} ${styles.sair}`} onClick={() => void sair()}>
          <LogOut size={18} aria-hidden />
          Sair da conta
        </button>
      </div>
    </Pagina>
  );
}

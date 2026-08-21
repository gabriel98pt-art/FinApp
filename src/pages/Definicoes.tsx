import { useEffect, useState, type FormEvent } from "react";
import {
  ChevronDown,
  Copy,
  LogOut,
  Moon,
  Palette,
  Pencil,
  Shapes,
  Sparkles,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import Pagina from "../components/Pagina";
import CategoriaBolha from "../components/CategoriaBolha";
import { KPIS_POR_PAGINA } from "../constants/kpis";
import PainelCoresApp from "../components/PainelCoresApp";
import RenomearFolha from "../components/RenomearFolha";
import Seletor from "../components/Seletor";
import SeletorCor from "../components/SeletorCor";
import SeletorIcone from "../components/SeletorIcone";
import { apagarConta, mensagemDeErroSenhaAtual, sair } from "../services/authService";
import { limparErros, observarErros, type ErroRegistado } from "../services/erroService";
import {
  adicionarItemLista,
  atualizarConfig,
  definirCorCategoria,
  definirIconeCategoria,
  definirPreferenciasCopiloto,
  removerItemLista,
  renomearCategoria,
  renomearFonte,
} from "../services/cfgService";
import { useConfirmar } from "../hooks/useConfirmar";
import { useAuthStore } from "../stores/authStore";
import { useCfgStore } from "../stores/cfgStore";
import { mostrarToast } from "../stores/toastStore";
import { useThemeStore } from "../stores/themeStore";
import type { ConfigConta, Currency, TomCopiloto } from "../types";
import { corDaCategoriaVisual } from "../utils/categoriaVisual";
import styles from "./Definicoes.module.css";
import Botao from "../components/Botao";
import SettingsSwitchRow from "../components/settings/SettingsSwitchRow";
import SettingsRow from "../components/settings/SettingsRow";
import FolhaSenha from "./definicoes/FolhaSenha";
import FolhaBackup from "./definicoes/FolhaBackup";

const MOEDAS: { valor: Currency; rotulo: string }[] = [
  { valor: "EUR", rotulo: "Euro (€)" },
  { valor: "BRL", rotulo: "Real (R$)" },
  { valor: "USD", rotulo: "Dólar ($)" },
  { valor: "GBP", rotulo: "Libra (£)" },
];

/** Nomes por extenso, na ordem de `Date#getDay()` (0=domingo) — o índice vira
 *  string porque `Seletor` só aceita opções de texto. */
const DIAS_SEMANA_NOMES = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];
const OPCOES_INICIO_SEMANA = DIAS_SEMANA_NOMES.map((_, i) => String(i));

function EditorLista({
  titulo,
  itens,
  lista,
  cfg,
  uid,
}: {
  titulo: string;
  itens: string[];
  lista: "categoriasDespesa" | "fontesReceita";
  cfg: ConfigConta;
  uid: string;
}) {
  const [novo, setNovo] = useState("");
  const confirmar = useConfirmar();
  // Categoria cujo ícone/cor está sendo escolhido agora (item 19).
  const [iconeDe, setIconeDe] = useState<string | null>(null);
  const [corDe, setCorDe] = useState<string | null>(null);
  const [renomeando, setRenomeando] = useState<string | null>(null);

  async function renomear(nomeNovo: string) {
    if (!renomeando) return;
    const alvo = renomeando;
    try {
      if (lista === "fontesReceita") await renomearFonte(uid, cfg, alvo, nomeNovo);
      else await renomearCategoria(uid, cfg, lista, alvo, nomeNovo);
      setRenomeando(null);
      mostrarToast(`✓ Agora chama-se "${nomeNovo.trim()}"`);
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : "Não foi possível renomear.");
    }
  }

  async function escolherIcone(icone: string | null) {
    if (!iconeDe) return;
    const alvo = iconeDe;
    setIconeDe(null);
    try {
      await definirIconeCategoria(uid, alvo, icone);
    } catch {
      mostrarToast("Não foi possível salvar o ícone.");
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
    if (!nome) return mostrarToast("Escreva um nome primeiro.");
    try {
      await adicionarItemLista(uid, cfg, lista, nome);
      mostrarToast(`✓ "${nome}" adicionado`);
      setNovo("");
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : "Não foi possível adicionar.");
    }
  }

  async function remover(item: string) {
    if (!(await confirmar(`Remover "${item}"? Lançamentos que já usam esse nome não mudam.`)))
      return;
    try {
      await removerItemLista(uid, cfg, lista, item);
      mostrarToast(`"${item}" removido`);
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
                onClick={() => setIconeDe(item)}
                aria-label={`Ícone de ${item}`}
                title="Ícone"
              >
                <Shapes size={16} aria-hidden />
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
                className={styles.acaoCategoria}
                onClick={() => setRenomeando(item)}
                aria-label={`Renomear ${item}`}
                title="Renomear"
              >
                <Pencil size={16} aria-hidden />
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
          aria-label={`Adicionar em ${titulo}`}
        />
        <button type="submit" className={styles.botaoPequeno}>
          Adicionar
        </button>
      </form>

      <SeletorIcone
        aberta={iconeDe !== null}
        aoFechar={() => setIconeDe(null)}
        titulo={iconeDe ? `Ícone de ${iconeDe}` : "Ícone"}
        valor={iconeDe ? (cfg.categoriaIcone?.[iconeDe] ?? "") : ""}
        aoEscolher={(i) => void escolherIcone(i)}
      />
      <SeletorCor
        aberta={corDe !== null}
        aoFechar={() => setCorDe(null)}
        titulo={corDe ? `Cor de ${corDe}` : "Cor"}
        valor={corDe ? (cfg.categoriaCor?.[corDe] ?? "") : ""}
        aoEscolher={(c) => void escolherCor(c)}
      />
      <RenomearFolha
        aberta={renomeando !== null}
        nomeAtual={renomeando}
        aoFechar={() => setRenomeando(null)}
        aoConfirmar={(n) => void renomear(n)}
        aviso="Lançamentos, orçamento e o ícone/cor seguem para o nome novo."
      />
    </div>
  );
}

/** Cor do botão flutuante em Despesas, Receitas e Veículo. Não é um campo
 *  novo em cfg: estes 3 nomes entram no mesmo `categoriaCor` das categorias,
 *  então o picker e o serviço são exatamente os que já existiam. */
const PAGINAS_COLORIDAS = ["Despesa", "Receita", "Veículo"] as const;

function CorBotaoFlutuante({ cfg, uid }: { cfg: ConfigConta; uid: string }) {
  const [corDe, setCorDe] = useState<string | null>(null);

  async function escolher(cor: string | null) {
    if (!corDe) return;
    const alvo = corDe;
    setCorDe(null);
    try {
      await definirCorCategoria(uid, alvo, cor);
    } catch {
      mostrarToast("Não foi possível salvar a cor.");
    }
  }

  return (
    <div className={styles.grupo}>
      <p className={styles.grupoTitulo}>Cor do botão flutuante</p>
      <p className={styles.nota}>
        O botão de registro rápido veste esta cor quando você está na página. Nas outras fica no
        azul do app.
      </p>
      <ul className={styles.listaCategorias}>
        {PAGINAS_COLORIDAS.map((nome) => (
          <li key={nome} className={styles.linhaCategoria}>
            <span
              className={styles.amostraCor}
              style={{ background: corDaCategoriaVisual(cfg, nome) }}
              aria-hidden
            />
            <span className={styles.nomeCategoria}>{nome}</span>
            <button
              className={styles.acaoCategoria}
              onClick={() => setCorDe(nome)}
              aria-label={`Cor do botão em ${nome}`}
              title="Cor"
            >
              <Palette size={16} aria-hidden />
            </button>
          </li>
        ))}
      </ul>

      <SeletorCor
        aberta={corDe !== null}
        aoFechar={() => setCorDe(null)}
        titulo={corDe ? `Cor do botão em ${corDe}` : "Cor"}
        valor={corDe ? (cfg.categoriaCor?.[corDe] ?? "") : ""}
        aoEscolher={(c) => void escolher(c)}
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
      if (atuais.length <= 2) return mostrarToast("São sempre 2 KPIs — escolha outro para trocar.");
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
                    {/* O chip mostra o mesmo texto do cartão na página; `r` é
                        a chave guardada, que às vezes já não é esse texto. */}
                    {pag.textos?.[r] ?? r}
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

/** Data legível para quem vai reportar o erro ("quinta às 14h32", não um
 *  timestamp). */
function quando(ts: number): string {
  return new Date(ts).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Os últimos erros que o app apanhou (últimos 14 dias, e no máximo 30 — ver
 *  erroService.ts), para poderem ser copiados e enviados sem depender de
 *  descrever de memória o que aconteceu. A pilha não é mostrada (ilegível na
 *  tela), mas vai inteira no "Copiar".
 *
 *  A seção inteira some quando não há nada registado — sem isto ocupava
 *  espaço numa tela de preferências mesmo vazia. Havendo erro, a lista
 *  começa fechada atrás de um botão: é texto técnico, não algo pra saltar
 *  aos olhos de quem só veio trocar a moeda.
 *
 *  Leitura local com useState/useEffect: é a única tela que lê isto, não
 *  justifica uma store global. */
function ErrosRecentes({ uid }: { uid: string }) {
  const [erros, setErros] = useState<ErroRegistado[]>([]);
  const [aberta, setAberta] = useState(false);

  useEffect(() => observarErros(uid, setErros), [uid]);

  async function copiar(e: ErroRegistado) {
    const texto = [`${quando(e.timestamp)} — ${e.mensagem}`, e.url, e.pilha ?? ""]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(texto);
      mostrarToast("✓ Erro copiado");
    } catch {
      mostrarToast("Não foi possível copiar.");
    }
  }

  async function limpar() {
    try {
      await limparErros(uid);
      mostrarToast("✓ Registo limpo");
    } catch {
      mostrarToast("Não foi possível limpar.");
    }
  }

  if (erros.length === 0) return null;

  return (
    <div className={styles.grupo}>
      <button
        type="button"
        className={styles.toggleErros}
        onClick={() => setAberta((a) => !a)}
        aria-expanded={aberta}
      >
        <span>Erros recentes ({erros.length})</span>
        <ChevronDown
          size={16}
          className={`${styles.toggleErrosSeta} ${aberta ? styles.toggleErrosAberto : ""}`}
          aria-hidden
        />
      </button>
      {aberta && (
        <>
          <p className={styles.nota}>
            Se algo correu mal, copie o erro e envie — evita ter de o descrever de memória.
          </p>
          <div className={styles.listaErros}>
            {erros.map((e) => (
              <div key={e.id} className={styles.linhaErro}>
                <div className={styles.erroTexto}>
                  <span className={styles.erroQuando}>{quando(e.timestamp)}</span>
                  <span className={styles.erroMensagem}>{e.mensagem}</span>
                </div>
                <button
                  className={styles.acaoCategoria}
                  onClick={() => void copiar(e)}
                  aria-label={`Copiar erro de ${quando(e.timestamp)}`}
                >
                  <Copy size={14} aria-hidden />
                </button>
              </div>
            ))}
          </div>
          <div className={styles.linhaAdicionar}>
            <button className={styles.botaoPequeno} onClick={() => void limpar()}>
              <Trash2 size={14} aria-hidden /> Limpar registo
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const TONS: { valor: TomCopiloto; rotulo: string }[] = [
  { valor: "direto", rotulo: "Direto" },
  { valor: "acolhedor", rotulo: "Acolhedor" },
];

/** Personalização do Copiloto.
 *
 *  Fica desligada até alguém a ligar de propósito, e o botão de desligar
 *  apaga o nó inteiro em vez de o esvaziar — quem escreveu o nome tem de
 *  conseguir tirá-lo de lá, não só deixá-lo em branco. */
function PersonalizarCopiloto({ cfg, uid }: { cfg: ConfigConta; uid: string }) {
  const [nome, setNome] = useState(cfg.copiloto?.nome ?? "");
  const [tom, setTom] = useState<TomCopiloto>(cfg.copiloto?.tom ?? "direto");
  const [salvando, setSalvando] = useState(false);
  const configurado = cfg.copiloto !== undefined;

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (salvando) return;
    setSalvando(true);
    try {
      await definirPreferenciasCopiloto(uid, { nome: nome.trim() || undefined, tom });
      mostrarToast("✓ Copiloto personalizado");
    } catch {
      mostrarToast("Não foi possível guardar.");
    } finally {
      setSalvando(false);
    }
  }

  async function desligar() {
    try {
      await definirPreferenciasCopiloto(uid, null);
      setNome("");
      setTom("direto");
      mostrarToast("Personalização removida");
    } catch {
      mostrarToast("Não foi possível remover.");
    }
  }

  return (
    <form className={styles.grupo} onSubmit={(e) => void guardar(e)}>
      <p className={styles.grupoTitulo}>Copiloto</p>
      <p className={styles.nota}>
        Opcional. Com um nome, o Copiloto trata-o por ele; o tom muda só o jeito das frases, nunca
        os números. Fica guardado na sua conta e sai daqui quando quiser.
      </p>
      <div className={styles.linhaAdicionar}>
        <input
          className={styles.inputPequeno}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Como quer ser tratado"
          aria-label="Nome para o Copiloto"
          maxLength={40}
        />
        <Seletor
          variante="inline"
          rotulo="Tom do Copiloto"
          nivel={0}
          valor={tom}
          opcoes={TONS.map((t) => t.valor)}
          rotuloOpcao={(v) => TONS.find((t) => t.valor === v)?.rotulo ?? v}
          aoMudar={(v) => setTom(v as TomCopiloto)}
        />
        <button type="submit" className={styles.botaoPequeno} disabled={salvando}>
          <Sparkles size={14} aria-hidden /> {salvando ? "A guardar…" : "Guardar"}
        </button>
        {configurado && (
          <button type="button" className={styles.botaoPequeno} onClick={() => void desligar()}>
            <X size={14} aria-hidden /> Desligar
          </button>
        )}
      </div>
    </form>
  );
}

/** Apagar a conta — o direito ao apagamento, que até aqui não tinha botão e
 *  só se resolvia pedindo a alguém para ir à consola do Firebase à mão.
 *
 *  Pede a senha e ainda assim confirma: é a única ação da app que destrói
 *  dados sem qualquer forma de recuperar, nem por backup. */
function ApagarConta() {
  const [senha, setSenha] = useState("");
  const [apagando, setApagando] = useState(false);
  const confirmar = useConfirmar();

  async function submeter(e: FormEvent) {
    e.preventDefault();
    if (apagando) return;
    if (
      !(await confirmar(
        "Apagar a conta? Isto remove DEFINITIVAMENTE todos os seus dados — lançamentos, cartões, parcelas, metas e configurações. Não há como desfazer, e nem o backup recupera o que for apagado aqui.",
      ))
    )
      return;

    setApagando(true);
    try {
      await apagarConta(senha);
      // Sem toast de sucesso de propósito: o Firebase encerra a sessão sozinho
      // e o app volta para o login. Um toast sobre a tela de login seria só
      // estranho — e não há mais conta a que ele pertença.
    } catch (err) {
      mostrarToast(mensagemDeErroSenhaAtual(err));
      setApagando(false);
    }
  }

  return (
    <form className={styles.grupo} onSubmit={(e) => void submeter(e)}>
      <p className={styles.grupoTitulo}>Apagar conta</p>
      <p className={styles.nota}>
        Remove a conta e todos os dados guardados nela, sem volta. Se quiser ficar com uma cópia,
        exporte o backup antes.
      </p>
      <div className={styles.linhaAdicionar}>
        <input
          className={styles.inputPequeno}
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="Senha"
          aria-label="Senha para apagar a conta"
          autoComplete="current-password"
          required
        />
        <Botao type="submit" variante="perigoForte" disabled={apagando}>
          <Trash2 size={14} aria-hidden /> {apagando ? "A apagar…" : "Apagar conta"}
        </Botao>
      </div>
    </form>
  );
}

export default function Definicoes() {
  const sessao = useAuthStore((s) => s.sessao);
  const theme = useThemeStore((s) => s.theme);
  const alternarTema = useThemeStore((s) => s.alternarTema);
  const cfg = useCfgStore((s) => s.cfg);
  const [coresAbertas, setCoresAbertas] = useState(false);
  const [senhaAberta, setSenhaAberta] = useState(false);
  const [backupAberto, setBackupAberto] = useState(false);

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

  async function mudarMoeda(valor: string) {
    if (!uid) return;
    try {
      await atualizarConfig(uid, { currency: valor as Currency });
      mostrarToast("✓ Moeda atualizada");
    } catch {
      mostrarToast("Não foi possível alterar.");
    }
  }

  async function mudarInicioSemana(valor: string) {
    if (!uid) return;
    try {
      await atualizarConfig(uid, { diaInicioSemana: Number(valor) });
      mostrarToast("✓ Início da semana atualizado");
    } catch {
      mostrarToast("Não foi possível alterar.");
    }
  }

  if (!uid) return null;

  return (
    <Pagina titulo="Definições">
      <div className={styles.grupo}>
        <button className={styles.linha} onClick={alternarTema}>
          {theme === "dark" ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
          Tema: {theme === "dark" ? "escuro" : "claro"} (tocar para alternar)
        </button>
        <SettingsSwitchRow
          titulo="Módulo TVDE"
          checked={cfg.showTvde}
          onChange={() => void alternarTvde()}
        />
        <SettingsSwitchRow
          titulo="Modo discreto"
          checked={cfg.modoDiscreto}
          onChange={() => void alternarModoDiscreto()}
        />
        <button className={styles.linha} onClick={() => setCoresAbertas(true)}>
          <Palette size={18} aria-hidden />
          Editar cores (destaque, positivo, negativo, alerta, roxo)
        </button>
      </div>

      <div className={styles.grupo}>
        <div className={styles.linhaSelect}>
          <span>Moeda da conta</span>
          <Seletor
            variante="inline"
            rotulo="Moeda da conta"
            nivel={0}
            valor={cfg.currency}
            opcoes={MOEDAS.map((m) => m.valor)}
            rotuloOpcao={(v) => MOEDAS.find((m) => m.valor === v)?.rotulo ?? v}
            aoMudar={(v) => void mudarMoeda(v)}
          />
        </div>
        <p className={styles.nota}>
          Só o símbolo muda — a formatação de milhar/decimal é a mesma para todas.
        </p>
      </div>

      <div className={styles.grupo}>
        <div className={styles.linhaSelect}>
          <span>Início da semana</span>
          <Seletor
            variante="inline"
            rotulo="Início da semana"
            nivel={0}
            valor={String(cfg.diaInicioSemana)}
            opcoes={OPCOES_INICIO_SEMANA}
            rotuloOpcao={(v) => DIAS_SEMANA_NOMES[Number(v)]}
            aoMudar={(v) => void mudarInicioSemana(v)}
          />
        </div>
        <p className={styles.nota}>
          Vale para o Calendário, o seletor de data e a visão "Semana" de Despesas e Veículo — todos
          seguem o mesmo dia.
        </p>
      </div>

      <EditorLista
        titulo="Categorias de despesa"
        itens={cfg.categoriasDespesa}
        lista="categoriasDespesa"
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

      <CorBotaoFlutuante cfg={cfg} uid={uid} />

      <EscolhaKpis cfg={cfg} uid={uid} />

      <PersonalizarCopiloto cfg={cfg} uid={uid} />

      <div className={styles.grupo}>
        <SettingsRow titulo="Backup" navegavel onClick={() => setBackupAberto(true)} />
      </div>

      <ErrosRecentes uid={uid} />

      <div className={styles.grupo}>
        <SettingsRow titulo="Trocar senha" navegavel onClick={() => setSenhaAberta(true)} />
      </div>

      <div className={styles.grupo}>
        <p className={styles.conta}>Sessão: {sessao?.email ?? "—"}</p>
        <button className={`${styles.linha} ${styles.sair}`} onClick={() => void sair()}>
          <LogOut size={18} aria-hidden />
          Sair da conta
        </button>
      </div>

      <ApagarConta />
      <PainelCoresApp
        aberta={coresAbertas}
        aoFechar={() => setCoresAbertas(false)}
        cfg={cfg}
        uid={uid}
      />
      <FolhaSenha aberta={senhaAberta} aoFechar={() => setSenhaAberta(false)} />
      <FolhaBackup uid={uid} aberta={backupAberto} aoFechar={() => setBackupAberto(false)} />
    </Pagina>
  );
}

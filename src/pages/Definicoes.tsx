import { useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import Pagina from "../components/Pagina";
import PainelCoresApp from "../components/PainelCoresApp";
import Seletor from "../components/Seletor";
import { apagarConta, mensagemDeErroSenhaAtual, sair } from "../services/authService";
import { atualizarConfig } from "../services/cfgService";
import { useConfirmar } from "../hooks/useConfirmar";
import { useAuthStore } from "../stores/authStore";
import { useCfgStore } from "../stores/cfgStore";
import { mostrarToast } from "../stores/toastStore";
import { useThemeStore } from "../stores/themeStore";
import type { Currency, Theme } from "../types";
import styles from "./Definicoes.module.css";
import Botao from "../components/Botao";
import SettingsSection from "../components/settings/SettingsSection";
import SettingsSwitchRow from "../components/settings/SettingsSwitchRow";
import SettingsRow from "../components/settings/SettingsRow";
import FolhaSenha from "./definicoes/FolhaSenha";
import FolhaBackup from "./definicoes/FolhaBackup";
import FolhaDiagnostico from "./definicoes/FolhaDiagnostico";
import FolhaCopiloto from "./definicoes/FolhaCopiloto";
import FolhaCategorias from "./definicoes/FolhaCategorias";
import FolhaCorBotao from "./definicoes/FolhaCorBotao";
import FolhaKpisMobile from "./definicoes/FolhaKpisMobile";

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

const OPCOES_TEMA: { valor: Theme; rotulo: string }[] = [
  { valor: "system", rotulo: "Sistema" },
  { valor: "dark", rotulo: "Escuro" },
  { valor: "light", rotulo: "Claro" },
];

/** Apagar a conta — o direito ao apagamento, que até aqui não tinha botão e
 *  só se resolvia pedindo a alguém para ir à consola do Firebase à mão.
 *
 *  Pede a senha e ainda assim confirma: é a única ação da app que destrói
 *  dados sem qualquer forma de recuperar, nem por backup.
 *
 *  Fica fora das folhas de propósito: ao contrário das outras configurações,
 *  esta continua sempre visível na tela principal, nunca escondida atrás de
 *  navegação — é a ação mais grave da app. */
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
  const definirTema = useThemeStore((s) => s.definirTema);
  const cfg = useCfgStore((s) => s.cfg);
  const [coresAbertas, setCoresAbertas] = useState(false);
  const [senhaAberta, setSenhaAberta] = useState(false);
  const [backupAberto, setBackupAberto] = useState(false);
  const [copilotoAberto, setCopilotoAberto] = useState(false);
  const [categoriasAberto, setCategoriasAberto] = useState(false);
  const [fontesAberto, setFontesAberto] = useState(false);
  const [corBotaoAberto, setCorBotaoAberto] = useState(false);
  const [kpisAberto, setKpisAberto] = useState(false);

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
      <SettingsSection titulo="Geral">
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
      </SettingsSection>

      <SettingsSection titulo="Aparência">
        <div className={styles.linhaSelect}>
          <span>Tema</span>
          <Seletor
            variante="inline"
            rotulo="Tema"
            nivel={0}
            valor={theme}
            opcoes={OPCOES_TEMA.map((t) => t.valor)}
            rotuloOpcao={(v) => OPCOES_TEMA.find((t) => t.valor === v)?.rotulo ?? v}
            aoMudar={(v) => definirTema(v as Theme)}
          />
        </div>
        <SettingsRow titulo="Cores do aplicativo" navegavel onClick={() => setCoresAbertas(true)} />
        <SettingsRow
          titulo="Cor do botão flutuante"
          navegavel
          onClick={() => setCorBotaoAberto(true)}
        />
      </SettingsSection>

      <SettingsSection titulo="Registo">
        <SettingsRow
          titulo="Categorias de despesa"
          valor={`${cfg.categoriasDespesa.length} ativas`}
          navegavel
          onClick={() => setCategoriasAberto(true)}
        />
        <SettingsRow
          titulo="Fontes de receita"
          valor={`${cfg.fontesReceita.length} ativas`}
          navegavel
          onClick={() => setFontesAberto(true)}
        />
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
      </SettingsSection>

      <SettingsSection titulo="Personalização">
        <SettingsRow titulo="KPIs no telemóvel" navegavel onClick={() => setKpisAberto(true)} />
        <SettingsRow
          titulo="Copiloto"
          valor={cfg.copiloto !== undefined ? "Configurado" : undefined}
          navegavel
          onClick={() => setCopilotoAberto(true)}
        />
      </SettingsSection>

      <SettingsSection titulo="Dados">
        <SettingsRow titulo="Backup" navegavel onClick={() => setBackupAberto(true)} />
        <FolhaDiagnostico uid={uid} />
      </SettingsSection>

      <SettingsSection titulo="Conta">
        <p className={styles.conta}>Sessão: {sessao?.email ?? "—"}</p>
        <SettingsRow titulo="Trocar senha" navegavel onClick={() => setSenhaAberta(true)} />
        <SettingsRow titulo="Sair da conta" tone="perigo" onClick={() => void sair()} />
      </SettingsSection>

      <ApagarConta />

      <PainelCoresApp
        aberta={coresAbertas}
        aoFechar={() => setCoresAbertas(false)}
        cfg={cfg}
        uid={uid}
      />
      <FolhaSenha aberta={senhaAberta} aoFechar={() => setSenhaAberta(false)} />
      <FolhaBackup uid={uid} aberta={backupAberto} aoFechar={() => setBackupAberto(false)} />
      <FolhaCopiloto
        cfg={cfg}
        uid={uid}
        aberta={copilotoAberto}
        aoFechar={() => setCopilotoAberto(false)}
      />
      <FolhaCategorias
        titulo="Categorias de despesa"
        itens={cfg.categoriasDespesa}
        lista="categoriasDespesa"
        cfg={cfg}
        uid={uid}
        aberta={categoriasAberto}
        aoFechar={() => setCategoriasAberto(false)}
      />
      <FolhaCategorias
        titulo="Fontes de receita"
        itens={cfg.fontesReceita}
        lista="fontesReceita"
        cfg={cfg}
        uid={uid}
        aberta={fontesAberto}
        aoFechar={() => setFontesAberto(false)}
      />
      <FolhaCorBotao
        cfg={cfg}
        uid={uid}
        aberta={corBotaoAberto}
        aoFechar={() => setCorBotaoAberto(false)}
      />
      <FolhaKpisMobile
        cfg={cfg}
        uid={uid}
        aberta={kpisAberto}
        aoFechar={() => setKpisAberto(false)}
      />
    </Pagina>
  );
}

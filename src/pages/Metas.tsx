import { createElement, useState, type FormEvent } from "react";
import { Check, Plus, Target, X, XCircle } from "lucide-react";
import Pagina, { EstadoVazio, Kpis } from "../components/Pagina";
import KpiCard from "../components/KpiCard";
import ErroSincronizacao from "../components/ErroSincronizacao";
import BottomSheet from "../components/BottomSheet";
import CampoMoeda from "../components/CampoMoeda";
import type { Cents } from "../types";
import ResumoAnual from "../components/ResumoAnual";
import { contribuirFundo, criarFundo, removerFundo } from "../services/fundosService";
import { useConfirmar } from "../hooks/useConfirmar";
import { useAuthStore } from "../stores/authStore";
import { useCfgStore } from "../stores/cfgStore";
import { useFundosStore } from "../stores/fundosStore";
import { useMesVisivelStore } from "../stores/mesVisivelStore";
import {
  useDespesasFixasStore,
  useDespesasStore,
  useReceitasStore,
} from "../stores/lancamentosStore";
import { mostrarToast } from "../stores/toastStore";
import { useParcelasStore } from "../stores/parcelasStore";
import { useVeiculoStore } from "../stores/veiculoStore";
import { hojeIso, mesAtual, mesesRecentes, rotuloMes } from "../utils/calculos";
import { calcularMetaMensal, poupancaMeses, totalFundos } from "../utils/metas";
import { formatMoney } from "../utils/money";
import styles from "./Metas.module.css";

export default function Metas() {
  const uid = useAuthStore((s) => s.sessao?.uid);
  const confirmar = useConfirmar();
  const cfg = useCfgStore((s) => s.cfg);
  const receitas = useReceitasStore((s) => s.itens);
  const despesas = useDespesasStore((s) => s.itens);
  const despesasFixas = useDespesasFixasStore((s) => s.itens);
  const parcelas = useParcelasStore((s) => s.itens);
  const veiculo = useVeiculoStore((s) => s.dados);
  const fundos = useFundosStore((s) => s.itens);
  const carregado = useFundosStore((s) => s.carregado);
  const erro = useFundosStore((s) => s.erro);

  const real = mesAtual();
  // O mês do header manda no que se vê; `real` continua a ser o mês de
  // verdade, que é o que diz se o mês olhado ainda está a decorrer.
  const mesVisivel = useMesVisivelStore((s) => s.mes);
  const hoje = hojeIso();
  const diaDeHoje = parseInt(hoje.slice(8, 10), 10);

  const meta = calcularMetaMensal(
    receitas,
    despesas,
    despesasFixas,
    parcelas,
    veiculo,
    mesVisivel,
    real,
    diaDeHoje,
    cfg.metaPoupanca,
    hoje,
  );
  const { atual: fundosAtual, alvo: fundosAlvo } = totalFundos(fundos);
  const poupado12m = poupancaMeses(
    receitas,
    despesas,
    despesasFixas,
    parcelas,
    veiculo,
    mesesRecentes(12, real),
    real,
    hoje,
  );
  const taxaPoupanca =
    meta.receitas > 0 ? Math.round((Math.max(0, meta.saldo) / meta.receitas) * 100) : 0;

  const [novoAberto, setNovoAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [alvo, setAlvo] = useState<Cents | null>(null);
  const [prazo, setPrazo] = useState("");
  const [contribuindo, setContribuindo] = useState<string | null>(null);
  const [contribValor, setContribValor] = useState<Cents | null>(null);

  async function salvarFundo(e: FormEvent) {
    e.preventDefault();
    const valorAlvo = alvo;
    if (!nome.trim()) return mostrarToast("Nome obrigatório.");
    if (valorAlvo === null || valorAlvo <= 0) return mostrarToast("Meta inválida.");
    try {
      await criarFundo(uid!, { nome, alvo: valorAlvo, atual: 0, prazo: prazo || undefined });
      mostrarToast("✓ Fundo criado");
      setNovoAberto(false);
      setNome("");
      setAlvo(null);
      setPrazo("");
    } catch {
      mostrarToast("Não foi possível criar.");
    }
  }

  async function submeterContribuicao(e: FormEvent) {
    e.preventDefault();
    const fundo = fundos.find((f) => f.id === contribuindo);
    if (!fundo) return;
    const valor = contribValor;
    if (valor === null || valor <= 0) return mostrarToast("Valor inválido.");
    try {
      await contribuirFundo(uid!, fundo, valor);
      mostrarToast(`✓ ${formatMoney(valor, cfg.currency)} adicionado(s) a ${fundo.nome}`);
      setContribuindo(null);
      setContribValor(null);
    } catch {
      mostrarToast("Não foi possível contribuir.");
    }
  }

  // Mês fechado é veredicto (ícone + palavra); mês em curso é situação
  // provisória, só palavra — a distinção já existia no texto, agora fica
  // visível no glifo, com ícone do lucide em vez de ✓/✗ tipográficos.
  const badgeIcone = meta.fechado ? (meta.atingiu ? Check : XCircle) : null;
  const badgeTexto = meta.fechado
    ? meta.atingiu
      ? "Atingido"
      : "Não atingido"
    : meta.atingiu
      ? "Na meta"
      : "Fora da meta";

  return (
    <Pagina titulo="Metas">
      <Kpis pagina="metas">
        <KpiCard rotulo="Meta Mensal" valor={formatMoney(meta.meta, cfg.currency)} tom="acento" />
        <KpiCard rotulo="Taxa de Poupança" valor={`${taxaPoupanca}%`} tom="verde" />
        <KpiCard
          rotulo="Total em Fundos"
          valor={formatMoney(fundosAtual, cfg.currency)}
          tom="acento"
        />
        <KpiCard
          rotulo="Poupado (12m)"
          valor={formatMoney(poupado12m, cfg.currency)}
          tom="amarelo"
        />
      </Kpis>

      <div className={styles.cardMeta}>
        <div className={styles.cardMetaTopo}>
          <p className={styles.cardMetaTitulo}>Meta — {rotuloMes(real)}</p>
          <span className={`${styles.badge} ${meta.atingiu ? styles.badgeOk : styles.badgeAlerta}`}>
            {badgeIcone && createElement(badgeIcone, { size: 13, "aria-hidden": true })}
            {badgeTexto}
          </span>
        </div>
        <div className={styles.cardMetaGrid}>
          <div>
            <p className={`${styles.saldoGrande} ${meta.atingiu ? styles.verde : styles.vermelho}`}>
              {formatMoney(meta.saldo, cfg.currency)}
            </p>
            <p className={styles.cardMetaSub}>
              de {formatMoney(meta.meta, cfg.currency)} · {meta.pct}%
            </p>
            <div className={styles.barra}>
              <div
                className={`${styles.preenchido} ${meta.atingiu ? styles.preenchidoOk : styles.preenchidoAlerta}`}
                style={{ width: `${meta.pct}%` }}
              />
            </div>
          </div>
          <div className={styles.cardMetaLinhas}>
            <div className={styles.linhaValor}>
              <span>Receitas</span>
              <span className={styles.verde}>{formatMoney(meta.receitas, cfg.currency)}</span>
            </div>
            <div className={styles.linhaValor}>
              <span>Despesas</span>
              <span className={styles.vermelho}>{formatMoney(meta.despesas, cfg.currency)}</span>
            </div>
            <div className={`${styles.linhaValor} ${styles.linhaSaldo}`}>
              <span>Saldo</span>
              <span className={meta.atingiu ? styles.verde : styles.vermelho}>
                {formatMoney(meta.saldo, cfg.currency)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.cabecalho}>
        <h3 className={styles.subtitulo}>
          Fundos{" "}
          {fundos.length > 0 &&
            `— ${formatMoney(fundosAtual, cfg.currency)}${fundosAlvo > 0 ? ` / ${formatMoney(fundosAlvo, cfg.currency)}` : ""}`}
        </h3>
        <button className={styles.adicionar} onClick={() => setNovoAberto(true)}>
          <Plus size={15} aria-hidden /> Novo fundo
        </button>
      </div>

      {erro && fundos.length > 0 && <ErroSincronizacao compacto />}

      {erro && fundos.length === 0 ? (
        <ErroSincronizacao />
      ) : carregado && fundos.length === 0 ? (
        <EstadoVazio
          Icone={Target}
          mensagem="Nenhum fundo criado"
          sub="Adicione um fundo de poupança com o botão + Novo fundo."
        />
      ) : (
        <div className={styles.fundos}>
          {fundos.map((f) => {
            const pct = f.alvo > 0 ? Math.min(100, Math.round((f.atual / f.alvo) * 100)) : 0;
            const falta = Math.max(0, f.alvo - f.atual);
            const corBarra =
              pct >= 80
                ? styles.preenchidoOk
                : pct >= 40
                  ? styles.preenchidoMeio
                  : styles.preenchidoAlerta;

            let diasRestantes: number | null = null;
            if (f.prazo) {
              diasRestantes = Math.ceil(
                (new Date(f.prazo + "T00:00:00").getTime() -
                  new Date(hoje + "T00:00:00").getTime()) /
                  86400000,
              );
            }
            let projecao: string | null = null;
            if (diasRestantes !== null && diasRestantes > 0 && falta > 0) {
              const mesesRest = Math.max(1, Math.ceil(diasRestantes / 30));
              projecao = `≈ ${formatMoney(Math.ceil(falta / mesesRest), cfg.currency)}/mês necessários`;
            }

            return (
              <div key={f.id} className={styles.fundoCard}>
                <div className={styles.fundoTopo}>
                  <p className={styles.fundoNome}>{f.nome}</p>
                  <button
                    className={styles.remover}
                    onClick={() => {
                      void (async () => {
                        if (!(await confirmar(`Excluir o fundo "${f.nome}"?`))) return;
                        await removerFundo(uid!, f.id)
                          .then(() => mostrarToast("Fundo excluído"))
                          .catch(() => mostrarToast("Não foi possível excluir."));
                      })();
                    }}
                    aria-label="Excluir fundo"
                  >
                    <X size={16} aria-hidden />
                  </button>
                </div>
                <div className={styles.barra}>
                  <div
                    className={`${styles.preenchido} ${corBarra}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className={styles.fundoStat}>
                  <span className={styles.fundoAtual}>{formatMoney(f.atual, cfg.currency)}</span>
                  <span className={styles.cardMetaSub}> / {formatMoney(f.alvo, cfg.currency)}</span>
                  <span className={styles.fundoPct}>{pct}%</span>
                </div>
                {falta > 0 ? (
                  <p className={styles.fundoFalta}>
                    Em falta: <strong>{formatMoney(falta, cfg.currency)}</strong>
                    {f.prazo ? ` · ${f.prazo.slice(8, 10)}/${f.prazo.slice(5, 7)}` : ""}
                  </p>
                ) : (
                  <p className={styles.fundoAtingido}>Meta atingida!</p>
                )}
                {projecao && <p className={styles.fundoProj}>{projecao}</p>}
                <button
                  className={styles.contribuirBotao}
                  onClick={() => {
                    setContribValor(null);
                    setContribuindo(f.id);
                  }}
                >
                  <Plus size={15} aria-hidden /> Contribuir
                </button>
              </div>
            );
          })}
        </div>
      )}

      <ResumoAnual meses={12} titulo="Resumo Anual" />

      <BottomSheet aberta={novoAberto} aoFechar={() => setNovoAberto(false)} titulo="Novo fundo">
        <form className={styles.form} onSubmit={salvarFundo}>
          <label className={styles.campo}>
            Nome
            <input value={nome} onChange={(e) => setNome(e.target.value)} required />
          </label>
          <label className={styles.campo}>
            Meta
            <CampoMoeda valor={alvo} aoMudar={setAlvo} required />
          </label>
          <label className={styles.campo}>
            Prazo (opcional)
            <input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
          </label>
          <button type="submit" className={styles.salvar}>
            Criar fundo
          </button>
        </form>
      </BottomSheet>

      <BottomSheet
        aberta={contribuindo !== null}
        aoFechar={() => setContribuindo(null)}
        titulo={`Contribuir — ${fundos.find((f) => f.id === contribuindo)?.nome ?? ""}`}
      >
        <form className={styles.form} onSubmit={submeterContribuicao}>
          <label className={styles.campo}>
            Valor
            <CampoMoeda valor={contribValor} aoMudar={setContribValor} required />
          </label>
          <button type="submit" className={styles.salvar}>
            Contribuir
          </button>
        </form>
      </BottomSheet>
    </Pagina>
  );
}

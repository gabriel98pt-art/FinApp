import { createElement, useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { Check, Plus, Target, X, XCircle } from "lucide-react";
import Pagina, { EstadoVazio, Kpis } from "../components/Pagina";
import AbaTransicao from "../components/AbaTransicao";
import BottomSheet from "../components/BottomSheet";
import CampoMoeda from "../components/CampoMoeda";
import ErroSincronizacao from "../components/ErroSincronizacao";
import KpiCard from "../components/KpiCard";
import OrcamentoCard from "../components/OrcamentoCard";
import FolhaOrcamentoTotal from "../components/FolhaOrcamentoTotal";
import ResumoAnual from "../components/ResumoAnual";
import type { Cents } from "../types";
import { contribuirFundo, criarFundo, removerFundo } from "../services/fundosService";
import { useAbasTeclado } from "../hooks/useAbasTeclado";
import { useConfirmar } from "../hooks/useConfirmar";
import { useUidSessao } from "../hooks/useUidSessao";
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
import { diasDoMes, hojeIso, mesAtual, mesesRecentes, rotuloMes } from "../utils/calculos";
import { calcularMetaMensal, poupancaMeses, totalFundos } from "../utils/metas";
import { formatMoney } from "../utils/money";
import { statusOrcamentoMes } from "../utils/orcamento";
import { idAba, idPainelAba } from "../utils/abas";
import styles from "./Planejamento.module.css";

type Aba = "orcamento" | "metas";

/** Fonte única da ordem das abas: a lista desenhada e a ordem que as setas do
 *  teclado percorrem têm de ser a mesma, senão a seta salta para o lado
 *  errado. */
const ABAS = [
  ["orcamento", "Orçamento"],
  ["metas", "Metas"],
] as const satisfies readonly (readonly [Aba, string])[];

/** Planejamento — o plano financeiro inteiro numa tela só.
 *
 *  Eram duas abas do menu, "Planejamento" e "Metas", a responder à MESMA
 *  pergunta ("o meu plano está a aguentar?") por dois lados: uma media o que
 *  se pode gastar, a outra o que se pretende guardar. Ninguém decide um sem
 *  olhar para o outro — subir o teto de uma categoria é baixar a poupança do
 *  mês — e mesmo assim os dois números viviam em telas que nunca se viam. Ficam
 *  agora em duas abas da mesma página, com o mês do header a mandar nas duas.
 *
 *  - **Orçamento**: o teto do mês inteiro (quanto se pretende gastar, quanto
 *    sobra, a que ritmo dá por dia) e, por baixo, o mesmo por categoria no
 *    OrcamentoCard, onde o teto de cada uma se define e edita.
 *
 *    O que os quatro cartões desta aba medem é o gasto das categorias QUE TÊM
 *    TETO, e não o gasto do mês todo: um gasto numa categoria sem teto não tem
 *    plano contra o qual ser medido, e somá-lo aqui faria os cartões
 *    contradizerem a lista logo abaixo.
 *
 *  - **Metas**: a meta de poupança do mês, os fundos ("cofrinhos") e o resumo
 *    dos últimos 12 meses. */
export default function Planejamento() {
  const uid = useUidSessao();
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

  // Chegar por /metas (a rota antiga, hoje um redirecionamento) já abre na aba
  // certa — a rota manda o destino pelo state da navegação, porque a aba é
  // estado local desta página. Mesmo mecanismo de Despesas → Fixas.
  const location = useLocation();
  const abaPedida = (location.state as { aba?: string } | null)?.aba;
  const abaInicial = ABAS.some(([id]) => id === abaPedida) ? (abaPedida as Aba) : "orcamento";
  const [aba, setAba] = useState<Aba>(abaInicial);
  const { propsLista, propsAba } = useAbasTeclado({
    abas: ABAS.map(([id]) => id),
    atual: aba,
    aoMudar: setAba,
  });

  const moeda = cfg.currency;
  const real = mesAtual();
  // O mês do header manda no que se vê; `real` continua a ser o mês de
  // verdade, que é o que diz se o mês olhado ainda está a decorrer.
  const mes = useMesVisivelStore((s) => s.mes);
  const hoje = hojeIso();
  const diaDeHoje = parseInt(hoje.slice(8, 10), 10);

  // ---- aba Orçamento ----
  const [folhaTotal, setFolhaTotal] = useState(false);
  const status = statusOrcamentoMes(despesas, parcelas, cfg.orcamentos, mes, real, hoje);
  const gastoTotal = status.reduce((s, c) => s + c.gasto, 0);
  const totalPlanejado = cfg.orcamentoTotalMensal;

  // Enquanto não houver total definido, os três cartões de cálculo não têm
  // como responder — e "0" seria uma resposta errada, não uma ausência. Ficam
  // no travessão, e o primeiro cartão convida a definir. Não é estado de erro:
  // é a primeira vez que a pessoa abre a tela.
  const definido = totalPlanejado !== undefined && totalPlanejado > 0;
  const restam = definido ? totalPlanejado - gastoTotal : 0;
  const pctUsado = definido ? Math.round((gastoTotal / totalPlanejado) * 100) : 0;

  // ---- aba Metas ----
  const meta = calcularMetaMensal(
    receitas,
    despesas,
    despesasFixas,
    parcelas,
    veiculo,
    mes,
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

  /** Cada abertura recomeça em branco — o mesmo que "Contribuir" aqui ao lado
   *  já fazia com o valor. Sem isto, escrever "Viagem ao Japão", fechar a folha
   *  sem criar e tocar outra vez em "+ Novo fundo" reabria com "Viagem ao
   *  Japão" lá dentro: os campos só eram limpos depois de um `criarFundo` bem
   *  sucedido, nunca no fecho. */
  function abrirNovoFundo() {
    setNome("");
    setAlvo(null);
    setPrazo("");
    setNovoAberto(true);
  }

  async function salvarFundo(e: FormEvent) {
    e.preventDefault();
    const valorAlvo = alvo;
    if (!nome.trim()) return mostrarToast("Nome obrigatório.");
    if (valorAlvo === null || valorAlvo <= 0) return mostrarToast("Meta inválida.");
    try {
      await criarFundo(uid, { nome, alvo: valorAlvo, atual: 0, prazo: prazo || undefined });
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
      await contribuirFundo(uid, fundo, valor);
      mostrarToast(`✓ ${formatMoney(valor, moeda)} adicionado(s) a ${fundo.nome}`);
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
    <Pagina titulo="Planejamento">
      {/* Os KPIs ficam DENTRO de cada aba, ao contrário de Despesas: aqui as
          duas abas medem coisas diferentes (tetos de gasto vs. poupança), e um
          cartão de uma não diz nada sobre a outra. */}
      <div className={styles.abas} role="tablist" {...propsLista}>
        {ABAS.map(([id, nomeAba]) => (
          <button
            key={id}
            role="tab"
            id={idAba(id)}
            aria-selected={aba === id}
            aria-controls={idPainelAba(id)}
            {...propsAba(id)}
            className={`${styles.abaBotao} ${aba === id ? styles.abaAtiva : ""}`}
            onClick={() => setAba(id)}
          >
            {nomeAba}
          </button>
        ))}
      </div>

      <AbaTransicao aba={aba}>
        {aba === "orcamento" && (
          <>
            <Kpis pagina="planejamento">
              <KpiCard
                rotulo="Total"
                valor={definido ? formatMoney(totalPlanejado, moeda) : "Definir"}
                sub={definido ? "planeado por mês" : "quanto pretende gastar por mês"}
                tom="acento"
                aoClicar={() => setFolhaTotal(true)}
              />
              <KpiCard
                rotulo="Restam"
                valor={definido ? formatMoney(restam, moeda) : "—"}
                sub={definido && restam < 0 ? "passou do plano" : undefined}
                tom={definido && restam < 0 ? "vermelho" : "verde"}
              />
              <KpiCard
                rotulo="% usado"
                valor={definido ? `${pctUsado}%` : "—"}
                tom={definido && pctUsado > 100 ? "vermelho" : "neutro"}
              />
              <KpiCard
                rotulo="Valor/dia"
                valor={
                  definido ? formatMoney(Math.round(totalPlanejado / diasDoMes(mes)), moeda) : "—"
                }
                sub={definido ? `${diasDoMes(mes)} dias no mês` : undefined}
                // Era "laranja" (cor exclusiva do TVDE) — "neutro" porque é
                // um dado contextual, não um sinal de bom/mau (achado da
                // auditoria de Design).
                tom="neutro"
              />
            </Kpis>

            <OrcamentoCard />
          </>
        )}

        {aba === "metas" && (
          <>
            <Kpis pagina="metas">
              <KpiCard rotulo="Meta Mensal" valor={formatMoney(meta.meta, moeda)} tom="acento" />
              <KpiCard rotulo="Taxa de Poupança" valor={`${taxaPoupanca}%`} tom="verde" />
              <KpiCard
                rotulo="Total em Fundos"
                valor={formatMoney(fundosAtual, moeda)}
                tom="acento"
              />
              <KpiCard
                rotulo="Poupado (12m)"
                valor={formatMoney(poupado12m, moeda)}
                // Era "amarelo" — destoava de "Taxa de Poupança" ao lado,
                // sempre verde (achado da auditoria de Design: as duas KPIs
                // de poupança desta MESMA tela usavam tons diferentes). Sem
                // condicional: `poupancaMeses` já é `Math.max(0, ...)` por
                // mês, nunca fica negativo — verde fixo é o tom correto, não
                // só o mais conveniente.
                tom="verde"
              />
            </Kpis>

            <div className={styles.cardMeta}>
              <div className={styles.cardMetaTopo}>
                {/* O mês do TÍTULO é o mesmo que gerou os números por baixo dele
                    (o do seletor do header), nunca o mês real: com julho
                    escolhido, o cartão dizia "Meta — Agosto 2026" por cima de
                    receitas, despesas e saldo de julho. */}
                <p className={styles.cardMetaTitulo}>Meta — {rotuloMes(mes)}</p>
                <span
                  className={`${styles.badge} ${meta.atingiu ? styles.badgeOk : styles.badgeAlerta}`}
                >
                  {badgeIcone && createElement(badgeIcone, { size: 13, "aria-hidden": true })}
                  {badgeTexto}
                </span>
              </div>
              <div className={styles.cardMetaGrid}>
                <div>
                  <p
                    className={`${styles.saldoGrande} ${meta.atingiu ? styles.verde : styles.vermelho}`}
                  >
                    {formatMoney(meta.saldo, moeda)}
                  </p>
                  <p className={styles.cardMetaSub}>
                    de {formatMoney(meta.meta, moeda)} · {meta.pct}%
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
                    <span className={styles.verde}>{formatMoney(meta.receitas, moeda)}</span>
                  </div>
                  <div className={styles.linhaValor}>
                    <span>Despesas</span>
                    <span className={styles.vermelho}>{formatMoney(meta.despesas, moeda)}</span>
                  </div>
                  <div className={`${styles.linhaValor} ${styles.linhaSaldo}`}>
                    <span>Saldo</span>
                    <span className={meta.atingiu ? styles.verde : styles.vermelho}>
                      {formatMoney(meta.saldo, moeda)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.cabecalho}>
              <h3 className={styles.subtitulo}>
                Fundos{" "}
                {fundos.length > 0 &&
                  `— ${formatMoney(fundosAtual, moeda)}${fundosAlvo > 0 ? ` / ${formatMoney(fundosAlvo, moeda)}` : ""}`}
              </h3>
              <button className={styles.adicionar} onClick={abrirNovoFundo}>
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
                    projecao = `≈ ${formatMoney(Math.ceil(falta / mesesRest), moeda)}/mês necessários`;
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
                              await removerFundo(uid, f.id)
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
                        <span className={styles.fundoAtual}>{formatMoney(f.atual, moeda)}</span>
                        <span className={styles.cardMetaSub}> / {formatMoney(f.alvo, moeda)}</span>
                        <span className={styles.fundoPct}>{pct}%</span>
                      </div>
                      {falta > 0 ? (
                        <p className={styles.fundoFalta}>
                          Em falta: <strong>{formatMoney(falta, moeda)}</strong>
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

            {/* "Últimos 12 meses", e não "Resumo Anual": o Início mostra o MESMO
                quadro com uma janela mais curta (6 meses, ancorada no mês do
                seletor). Chamar os dois de "Resumo Anual" punha dois totais
                diferentes com o mesmo nome em telas vizinhas, sem nada que
                explicasse a diferença. Agora cada título diz a janela que soma. */}
            <ResumoAnual meses={12} titulo="Últimos 12 meses" />
          </>
        )}
      </AbaTransicao>

      {uid && (
        <FolhaOrcamentoTotal
          aberta={folhaTotal}
          aoFechar={() => setFolhaTotal(false)}
          totalAtual={totalPlanejado}
          status={status}
          uid={uid}
        />
      )}

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

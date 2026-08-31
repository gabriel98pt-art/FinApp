import { useRef, useState, type FormEvent } from "react";
import { CarTaxiFront, Check, Pencil, RotateCcw, Trash2, X } from "lucide-react";
import Pagina, { EstadoVazio, Kpis } from "../components/Pagina";
import AbaTransicao from "../components/AbaTransicao";
import KpiCard from "../components/KpiCard";
import ErroSincronizacao from "../components/ErroSincronizacao";
import BottomSheet from "../components/BottomSheet";
import CampoMoeda from "../components/CampoMoeda";
import MenuAcoesItem, { type AcaoItem } from "../components/MenuAcoesItem";
import {
  criarDespesaTvde,
  definirSegMes,
  desfazerLancamentoSemana,
  lancarReceitaSemana,
  removerDespesaTvde,
  removerSemana,
  salvarConfigTvde,
  salvarSemana,
} from "../services/tvdeService";
import { useAbasTeclado } from "../hooks/useAbasTeclado";
import { useAcaoHeader } from "../hooks/useAcaoHeader";
import { useConfirmar } from "../hooks/useConfirmar";
import { useUidSessao } from "../hooks/useUidSessao";
import { useCfgStore } from "../stores/cfgStore";
import { useTvdeStore } from "../stores/tvdeStore";
import { useMesVisivelStore } from "../stores/mesVisivelStore";
import { useVeiculoStore } from "../stores/veiculoStore";
import { mostrarToast } from "../stores/toastStore";
import type { Cents, SemanaTvde } from "../types";
import { hojeIso, mesAtual, rotuloMes } from "../utils/calculos";
import {
  calcularSemana,
  dadosPorMes,
  dadosPorPeriodo,
  numerosDasSemanas,
  recargaPropriaDaSemana,
  rotuloDaSemana,
  rotuloDoPeriodo,
  semanaDeHoje,
  totaisPerformance,
} from "../utils/tvde";
import { idAba, idPainelAba } from "../utils/abas";
import { nomeAtualDoMetodo } from "../utils/instituicoes";
import styles from "./Tvde.module.css";

// Moeda FIXA em EUR (seção 4.4) — este módulo NÃO segue a moeda da conta.
// Se multi-moeda um dia existir no resto do app, o TVDE fica de fora.
function eur(cents: number): string {
  const negativo = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const unidades = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negativo ? "−" : ""}€ ${unidades},${(abs % 100).toString().padStart(2, "0")}`;
}

type AbaTvde = "semanas" | "meses" | "periodos" | "extras";

/** Fonte única da ordem das abas: a lista desenhada e a ordem que as setas do
 *  teclado percorrem têm de ser a mesma. */
const ABAS = [
  ["semanas", "Semanas"],
  ["meses", "Meses"],
  ["periodos", "Períodos"],
  // A aba guarda quatro coisas — conta destino, fonte da receita, Segurança
  // Social e despesas do TVDE. O nome antigo ("Seg. Social & Despesas")
  // anunciava só duas, e quem procurava as outras duas não as achava.
  ["extras", "Extras e definições"],
] as const satisfies readonly (readonly [AbaTvde, string])[];

const CAMPOS_DINHEIRO = [
  ["fat", "Faturamento"],
  ["port", "Portagens"],
  ["alu", "Aluguel"],
  ["recF", "Recarga frota"],
  ["extra", "Extra"],
  ["gorj", "Gorjetas (anotação)"],
  ["recP", "Recarga própria"],
] as const;

function FormSemana({
  n,
  aoFechar,
}: {
  n: number | null; // número da semana a editar/criar; null = fechado
  aoFechar: () => void;
}) {
  const uid = useUidSessao();
  const confirmar = useConfirmar();
  const dados = useTvdeStore((s) => s.dados);
  const cargas = useVeiculoStore((s) => s.dados.cargas);
  const existente = n !== null ? dados.semanas[String(n)] : undefined;
  // Sugestão de "Recarga própria" vinda das Cargas do veículo (item 9).
  const recargaAuto = n !== null ? recargaPropriaDaSemana(cargas, dados.cfg.inicioSemana1, n) : 0;

  const [valores, setValores] = useState<Record<string, Cents | null>>({});
  const [horas, setHoras] = useState("");
  const [viag, setViag] = useState("");
  const [pct, setPct] = useState("");
  const [teste, setTeste] = useState(false);
  const [chave, setChave] = useState<number | null>(null);

  // reinicia quando abre para outra semana (ajuste durante o render)
  if (n !== null && n !== chave) {
    setChave(n);
    const v: Record<string, Cents | null> = {};
    for (const [k] of CAMPOS_DINHEIRO) {
      const c =
        existente?.[k] ?? (k === "alu" ? dados.cfg.aluguel : k === "recP" ? recargaAuto : 0);
      v[k] = c || null;
    }
    setValores(v);
    setHoras(existente?.horas ? String(existente.horas) : "");
    setViag(existente?.viag ? String(existente.viag) : "");
    setPct(String(existente?.pct ?? dados.cfg.pctFrota));
    setTeste(existente?.teste ?? false);
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (n === null || !uid) return;
    const semana: SemanaTvde = {
      fat: 0,
      port: 0,
      alu: 0,
      recF: 0,
      extra: 0,
      gorj: 0,
      recP: 0,
      horas: parseFloat(horas.replace(",", ".")) || 0,
      viag: parseInt(viag, 10) || 0,
      // % frota gravada NA SEMANA — histórico protegido (seção 4.4)
      pct: parseFloat(pct.replace(",", ".")) || 0,
      teste,
    };
    // Campo vazio fica em 0, como estava; o campo já não deixa escrever nada
    // que não seja um valor, portanto não há mais "valor inválido" aqui.
    for (const [k] of CAMPOS_DINHEIRO) {
      const c = valores[k];
      if (c != null) semana[k] = c;
    }
    try {
      await salvarSemana(uid, n, semana);
      mostrarToast(`✓ Semana ${n} salva`);
      aoFechar();
      setChave(null);
    } catch {
      mostrarToast("Não foi possível salvar.");
    }
  }

  return (
    <BottomSheet
      aberta={n !== null}
      aoFechar={() => {
        aoFechar();
        setChave(null);
      }}
      titulo={n !== null ? `Semana ${n} · ${rotuloDaSemana(dados.cfg.inicioSemana1, n)}` : ""}
    >
      <form className={styles.form} onSubmit={salvar}>
        {CAMPOS_DINHEIRO.map(([k, nome]) => (
          <label key={k} className={styles.campoLinha}>
            <span>
              {nome}
              {k === "recP" && recargaAuto > 0 && (
                <span className={styles.dicaAuto}> · cargas da semana: {eur(recargaAuto)}</span>
              )}
            </span>
            <CampoMoeda
              valor={valores[k] ?? null}
              aoMudar={(v) => setValores({ ...valores, [k]: v })}
            />
          </label>
        ))}
        <div className={styles.linhaTripla}>
          <label className={styles.campo}>
            Horas
            <input inputMode="decimal" value={horas} onChange={(e) => setHoras(e.target.value)} />
          </label>
          <label className={styles.campo}>
            Viagens
            <input inputMode="numeric" value={viag} onChange={(e) => setViag(e.target.value)} />
          </label>
          <label className={styles.campo}>
            % frota
            <input inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} />
          </label>
        </div>
        <button type="submit" className={styles.salvar}>
          Salvar semana
        </button>
        {existente && (
          <button
            type="button"
            className={styles.excluirSemana}
            onClick={() => {
              void (async () => {
                if (n === null) return;
                if (dados.lancamentos[String(n)]) {
                  mostrarToast("Desfaça o lançamento antes de excluir a semana.");
                  return;
                }
                if (!(await confirmar(`Excluir a semana ${n}?`))) return;
                aoFechar();
                setChave(null);
                await removerSemana(uid, n)
                  .then(() => mostrarToast("Semana excluída"))
                  .catch(() => mostrarToast("Não foi possível concluir. Tente de novo."));
              })();
            }}
          >
            Excluir semana
          </button>
        )}
      </form>
    </BottomSheet>
  );
}

/** Uma linha de semana — item 2 do lote de UX/nav (30/08): o corpo clicável
 *  + o botão de texto solto ao lado ("Desfazer lançamento"/"Lançar
 *  receita") viram um menu único, junto de Editar/Excluir. */
function LinhaSemana({
  nSem,
  rotulo,
  teste,
  detalhe,
  lucro,
  lancada,
  aoEditar,
  aoLancarReceita,
  aoDesfazerLancamento,
  aoExcluir,
}: {
  nSem: number;
  rotulo: string;
  teste: boolean;
  detalhe: string;
  lucro: string;
  lancada: boolean;
  aoEditar: () => void;
  aoLancarReceita: () => void;
  aoDesfazerLancamento: () => void;
  aoExcluir: () => void;
}) {
  const [menuAberto, setMenuAberto] = useState(false);
  const ancoraRef = useRef<HTMLButtonElement>(null);

  const acoes: AcaoItem[] = [
    { rotulo: "Editar", Icone: Pencil, onClick: aoEditar },
    lancada
      ? { rotulo: "Desfazer lançamento", Icone: RotateCcw, onClick: aoDesfazerLancamento }
      : { rotulo: "Lançar receita", Icone: Check, onClick: aoLancarReceita },
    { rotulo: "Excluir", Icone: Trash2, onClick: aoExcluir, tone: "perigo" },
  ];

  return (
    <div className={styles.semana}>
      <button
        ref={ancoraRef}
        className={styles.semanaInfo}
        onClick={() => setMenuAberto(true)}
        aria-haspopup="dialog"
      >
        <span className={styles.semanaNome}>
          {rotulo}
          {teste ? <em className={styles.badgeTeste}>teste</em> : null}
        </span>
        <span className={styles.semanaDetalhe}>{detalhe}</span>
      </button>
      <div className={styles.semanaLado}>
        <span className={styles.semanaLucro}>{lucro}</span>
      </div>
      <MenuAcoesItem
        aberta={menuAberto}
        aoFechar={() => setMenuAberto(false)}
        titulo={`Semana ${nSem}`}
        ancoraRef={ancoraRef}
        acoes={acoes}
      />
    </div>
  );
}

export default function Tvde() {
  const uid = useUidSessao();
  const confirmar = useConfirmar();
  const dados = useTvdeStore((s) => s.dados);
  const carregado = useTvdeStore((s) => s.carregado);
  const erro = useTvdeStore((s) => s.erro);
  const contasCartoes = useCfgStore((s) => s.cfg.contasCartoes);
  // `cfg` nesta tela é a config do TVDE; as instituições vêm da config da
  // conta e são o que traduz o id de uma conta no nome que ela tem hoje.
  const instituicoes = useCfgStore((s) => s.cfg.instituicoes);
  const fontesReceita = useCfgStore((s) => s.cfg.fontesReceita);

  const [editando, setEditando] = useState<number | null>(null);
  const [aba, setAba] = useState<AbaTvde>("semanas");
  const { propsLista, propsAba } = useAbasTeclado({
    abas: ABAS.map(([id]) => id),
    atual: aba,
    aoMudar: setAba,
  });
  const [segMes, setSegMes] = useState(mesAtual());
  const mesVisivel = useMesVisivelStore((s) => s.mes);
  const [segValor, setSegValor] = useState<Cents | null>(null);
  const [despDescricao, setDespDescricao] = useState("");
  const [despValor, setDespValor] = useState<Cents | null>(null);

  const { cfg, semanas, segPorMes, lancamentos, despesas } = dados;
  const numeros = numerosDasSemanas(semanas);
  const t = totaisPerformance(semanas, segPorMes, cfg.inicioSemana1, cfg.pctFrota);
  const meses = dadosPorMes(semanas, segPorMes, cfg.inicioSemana1, cfg.pctFrota);
  const periodos = dadosPorPeriodo(semanas, cfg.pctFrota);

  const semanaAtualN = semanaDeHoje(cfg.inicioSemana1);
  // A "próxima que falta": segue a sequência das semanas já registradas, em vez
  // da semana do calendário de hoje (que muda sozinha e pula buracos). Sem
  // nenhuma registrada ainda, a semana de hoje é o melhor palpite inicial.
  const proximaSemanaFalta = numeros.length ? numeros[numeros.length - 1] + 1 : semanaAtualN;

  // O "+" do cabeçalho só existe na aba "Semanas": é a única das quatro onde
  // se cria alguma coisa — "Meses" e "Períodos" são vistas de leitura e
  // "Extras" são definições, que se gravam ali mesmo.
  useAcaoHeader(
    aba === "semanas"
      ? { rotulo: "Adicionar semana", onClick: () => setEditando(proximaSemanaFalta) }
      : null,
  );
  const semanaDestaque =
    semanas[String(semanaAtualN)] ??
    (numeros.length ? semanas[String(numeros[numeros.length - 1])] : undefined);
  const destaqueN = semanas[String(semanaAtualN)]
    ? semanaAtualN
    : numeros.length
      ? numeros[numeros.length - 1]
      : null;
  const calcDestaque = semanaDestaque ? calcularSemana(semanaDestaque, cfg.pctFrota) : null;

  // A fonte tem padrão sensato ("TVDE" existe nas fontes padrão), então nunca
  // bloqueia o lançamento. Se o usuário apagou essa fonte em Definições, a atual
  // entra na lista mesmo assim — senão o select ficaria sem seleção visível.
  const fonteReceitaAtual = cfg.fonteReceita ?? "TVDE";
  const opcoesFonteReceita = fontesReceita.includes(fonteReceitaAtual)
    ? fontesReceita
    : [...fontesReceita, fonteReceitaAtual];

  async function agir(acao: () => Promise<void>, ok: string) {
    try {
      await acao();
      mostrarToast(ok);
    } catch (e) {
      mostrarToast(e instanceof Error ? e.message : "Não foi possível concluir.");
    }
  }

  // Item 2 do lote de UX/nav: Excluir vira ação do menu único da linha —
  // mesma guarda que `FormSemana` já tinha (não dá pra excluir uma semana
  // com lançamento nas finanças ainda de pé).
  async function excluirSemanaDaLista(nSem: number) {
    if (lancamentos[String(nSem)]) {
      mostrarToast("Desfaça o lançamento antes de excluir a semana.");
      return;
    }
    if (!(await confirmar(`Excluir a semana ${nSem}?`))) return;
    await agir(() => removerSemana(uid, nSem), "Semana excluída");
  }

  return (
    <Pagina titulo="TVDE">
      {calcDestaque && destaqueN !== null ? (
        <div className={styles.hero}>
          <p className={styles.heroRotulo}>
            Lucro — Semana {destaqueN} ({rotuloDaSemana(cfg.inicioSemana1, destaqueN)})
            {semanas[String(destaqueN)]?.teste ? " · TESTE" : ""}
          </p>
          <p className={styles.heroValor}>{eur(calcDestaque.lucro)}</p>
          <div className={styles.heroChips}>
            <span>{semanas[String(destaqueN)]?.horas || 0}h</span>
            <span>
              {calcDestaque.ganhosPorHora !== null ? `${eur(calcDestaque.ganhosPorHora)}/h` : "—"}
            </span>
            <span>{semanas[String(destaqueN)]?.viag || 0} viagens</span>
            <span>
              {calcDestaque.eurPorViagem !== null ? `${eur(calcDestaque.eurPorViagem)}/viag.` : "—"}
            </span>
          </div>
        </div>
      ) : null}

      {/* denso: 4 KPIs por linha mesmo no mobile (só o TVDE) */}
      <Kpis denso>
        <KpiCard rotulo="Lucro total" valor={eur(t.lucro)} tom="laranja" />
        <KpiCard rotulo="Média/semana" valor={eur(t.mediaSemana)} />
        <KpiCard rotulo="Média €/hora" valor={t.mediaPorHora ? eur(t.mediaPorHora) : "—"} />
        {/* No fim e sem cor: ao lado do "Lucro total" eram dois valores
            grandes e coloridos a disputar a mesma atenção. */}
        <KpiCard rotulo="Líquido (− Seg. Social)" valor={eur(t.lucroLiquido)} />
      </Kpis>

      <div className={styles.abas} role="tablist" {...propsLista}>
        {ABAS.map(([id, nome]) => (
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
            {nome}
          </button>
        ))}
      </div>

      <AbaTransicao aba={aba}>
        {aba === "semanas" && (
          <>
            <div className={styles.cabecalho}>
              <h3 className={styles.subtitulo}>Semanas</h3>
            </div>
            {erro && numeros.length > 0 && <ErroSincronizacao compacto />}
            {erro && numeros.length === 0 ? (
              <ErroSincronizacao />
            ) : carregado && numeros.length === 0 ? (
              <EstadoVazio
                Icone={CarTaxiFront}
                mensagem="Nenhuma semana registrada"
                sub={`A semana atual é a ${semanaAtualN} (${rotuloDaSemana(cfg.inicioSemana1, semanaAtualN)}).`}
              />
            ) : (
              <div className={styles.lista}>
                {[...numeros].reverse().map((nSem) => {
                  const w = semanas[String(nSem)];
                  const c = calcularSemana(w, cfg.pctFrota);
                  const lancada = lancamentos[String(nSem)];
                  return (
                    <LinhaSemana
                      key={nSem}
                      nSem={nSem}
                      rotulo={`Semana ${nSem} · ${rotuloDaSemana(cfg.inicioSemana1, nSem)}`}
                      teste={w.teste ?? false}
                      detalhe={`Fat. ${eur(w.fat)} · Receita ${eur(c.receita)} · Custos ${eur(c.custos)}`}
                      lucro={eur(c.lucro)}
                      lancada={!!lancada}
                      aoEditar={() => setEditando(nSem)}
                      aoDesfazerLancamento={() =>
                        void agir(
                          () => desfazerLancamentoSemana(uid, nSem, lancada!),
                          "↩ Lançamento desfeito",
                        )
                      }
                      aoLancarReceita={() => {
                        void (async () => {
                          if (
                            !(await confirmar(
                              `Lançar ${eur(Math.round(c.receita))} como receita nas finanças?\n\nSemana ${nSem} (${rotuloDaSemana(cfg.inicioSemana1, nSem)}).`,
                            ))
                          )
                            return;
                          await agir(
                            () => lancarReceitaSemana(uid, nSem, dados),
                            "✓ Receita lançada nas finanças",
                          );
                        })();
                      }}
                      aoExcluir={() => void excluirSemanaDaLista(nSem)}
                    />
                  );
                })}
              </div>
            )}
            <p className={styles.notaEur}>
              Valores sempre em EUR — este módulo não segue a moeda da conta.
            </p>
          </>
        )}

        {aba === "meses" && (
          <div className={styles.tabela}>
            <div className={`${styles.linhaTab} ${styles.linhaCab}`}>
              <span>Mês</span>
              <span>Lucro</span>
              <span>Seg. Social</span>
              <span>Líquido</span>
            </div>
            {meses.length === 0 ? (
              <p className={styles.vazioTab}>Sem meses ainda.</p>
            ) : (
              meses.map((m) => (
                // O mês escolhido no header fica destacado aqui — a navegação
                // por período desta aba continua a ser a dela, não se mexeu.
                <div
                  key={m.mes}
                  className={`${styles.linhaTab} ${m.mes === mesVisivel ? styles.linhaMesAtual : ""}`}
                >
                  <span className={styles.mesNome}>{rotuloMes(m.mes)}</span>
                  <span>{eur(m.lucro)}</span>
                  <span>{m.seg ? `− ${eur(m.seg)}` : "—"}</span>
                  <span className={styles.liquido}>{eur(m.liquido)}</span>
                </div>
              ))
            )}
            <p className={styles.notaEur}>
              Semanas de teste contam aqui (dinheiro real); só ficam fora das médias.
            </p>
          </div>
        )}

        {aba === "periodos" && (
          <div className={styles.tabela}>
            <div className={`${styles.linhaTab} ${styles.linhaCab}`}>
              <span>Período</span>
              <span>Faturamento</span>
              <span>Receita</span>
              <span>Lucro</span>
            </div>
            {periodos.length === 0 ? (
              <p className={styles.vazioTab}>Sem períodos ainda.</p>
            ) : (
              periodos.map((p) => (
                <div key={p.periodo} className={styles.linhaTab}>
                  <span className={styles.mesNome}>
                    P{p.periodo} · {rotuloDoPeriodo(cfg.inicioSemana1, p.periodo)}
                  </span>
                  <span>{eur(p.fat)}</span>
                  <span>{eur(p.receita)}</span>
                  <span className={styles.liquido}>{eur(p.lucro)}</span>
                </div>
              ))
            )}
          </div>
        )}

        {aba === "extras" && (
          <div className={styles.extras}>
            {/* Sem conta destino a receita nascia órfã e desalinhava os saldos
                por conta. A conta NUNCA é fixa no código: cada usuário tem as
                suas, definidas em Definições. */}
            <div className={styles.blocoExtra}>
              <p className={styles.blocoTitulo}>Conta destino da receita</p>
              <p className={styles.blocoNota}>
                Onde a receita lançada da semana (aba Semanas) entra nas finanças.
              </p>
              {contasCartoes.length === 0 ? (
                <p className={styles.blocoNota}>
                  Configure suas contas em Definições antes de escolher a conta destino da receita
                  do TVDE.
                </p>
              ) : (
                <div className={styles.linhaDupla}>
                  <select
                    value={cfg.contaReceita ?? ""}
                    aria-label="Conta destino da receita"
                    onChange={(e) =>
                      void agir(
                        () => salvarConfigTvde(uid, { contaReceita: e.target.value }),
                        "✓ Conta destino salva",
                      )
                    }
                  >
                    <option value="" disabled>
                      Escolher conta…
                    </option>
                    {contasCartoes.map((c) => (
                      <option key={c} value={c}>
                        {nomeAtualDoMetodo({ instituicoes }, c)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* A fonte também não é fixa: quem já usa uma fonte própria para
                este rendimento (ex.: "Vencimento") escolhe-a aqui em vez de
                ficar com duas categorias a fazer a mesma coisa. */}
            <div className={styles.blocoExtra}>
              <p className={styles.blocoTitulo}>Fonte da receita</p>
              <p className={styles.blocoNota}>
                Qual fonte usar ao lançar a receita da semana (TVDE) nas finanças — evita duplicar
                categoria com uma fonte que você já usa.
              </p>
              <div className={styles.linhaDupla}>
                <select
                  value={fonteReceitaAtual}
                  aria-label="Fonte da receita"
                  onChange={(e) =>
                    void agir(
                      () => salvarConfigTvde(uid, { fonteReceita: e.target.value }),
                      "✓ Fonte da receita salva",
                    )
                  }
                >
                  {opcoesFonteReceita.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <form
              className={styles.blocoExtra}
              onSubmit={(e) => {
                e.preventDefault();
                // Zero remove o registo do mês; vazio não faz nada.
                const v = segValor ?? 0;
                void agir(
                  () => definirSegMes(uid, segMes, v === 0 ? null : v),
                  v === 0 ? "Seg. Social removida" : "✓ Seg. Social registrada",
                );
                setSegValor(null);
              }}
            >
              <p className={styles.blocoTitulo}>Segurança Social (por mês de pagamento)</p>
              <p className={styles.blocoNota}>
                Lançar no mês em que o valor saiu da conta — normalmente o trimestre anterior.
              </p>
              <div className={styles.linhaDupla}>
                <input type="month" value={segMes} onChange={(e) => setSegMes(e.target.value)} />
                <CampoMoeda valor={segValor} aoMudar={setSegValor} required />
                <button type="submit" className={styles.botaoMini}>
                  Salvar
                </button>
              </div>
              {Object.entries(segPorMes).length > 0 && (
                <ul className={styles.listaSimples}>
                  {Object.entries(segPorMes)
                    .sort(([a], [b]) => (a < b ? 1 : -1))
                    .map(([m, v]) => (
                      <li key={m}>
                        <span>{rotuloMes(m)}</span>
                        <span>{eur(v)}</span>
                      </li>
                    ))}
                </ul>
              )}
            </form>

            <form
              className={styles.blocoExtra}
              onSubmit={(e) => {
                e.preventDefault();
                const v = despValor;
                if (v === null || v <= 0) return mostrarToast("Valor inválido.");
                void agir(
                  () =>
                    criarDespesaTvde(uid, { data: hojeIso(), descricao: despDescricao, valor: v }),
                  "✓ Despesa TVDE adicionada",
                );
                setDespDescricao("");
                setDespValor(null);
              }}
            >
              <p className={styles.blocoTitulo}>Despesas do TVDE</p>
              <p className={styles.blocoNota}>
                Separadas das Despesas gerais — específicas do trabalho de motorista.
              </p>
              <div className={styles.linhaDupla}>
                <input
                  placeholder="Descrição"
                  value={despDescricao}
                  onChange={(e) => setDespDescricao(e.target.value)}
                  required
                />
                <CampoMoeda valor={despValor} aoMudar={setDespValor} required />
                <button type="submit" className={styles.botaoMini}>
                  Adicionar
                </button>
              </div>
              {despesas.length > 0 && (
                <ul className={styles.listaSimples}>
                  {despesas.map((d) => (
                    <li key={d.id}>
                      <span>
                        {d.descricao} · {d.data.slice(8, 10)}/{d.data.slice(5, 7)}
                      </span>
                      <span>
                        {eur(d.valor)}{" "}
                        <button
                          className={styles.remover}
                          onClick={(e) => {
                            e.preventDefault();
                            void (async () => {
                              if (!(await confirmar(`Excluir "${d.descricao}"?`))) return;
                              await agir(() => removerDespesaTvde(uid, d.id), "Despesa excluída");
                            })();
                          }}
                          aria-label={`Excluir ${d.descricao}`}
                        >
                          <X size={16} aria-hidden />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </form>
          </div>
        )}

        <FormSemana n={editando} aoFechar={() => setEditando(null)} />
      </AbaTransicao>
    </Pagina>
  );
}

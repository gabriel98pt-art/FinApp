import { useState, type FormEvent } from "react";
import { CarTaxiFront } from "lucide-react";
import Pagina, { EstadoVazio, Kpis } from "../components/Pagina";
import KpiCard from "../components/KpiCard";
import BottomSheet from "../components/BottomSheet";
import {
  criarDespesaTvde,
  definirSegMes,
  desfazerLancamentoSemana,
  lancarReceitaSemana,
  removerDespesaTvde,
  removerSemana,
  salvarSemana,
} from "../services/tvdeService";
import { useAuthStore } from "../stores/authStore";
import { useTvdeStore } from "../stores/tvdeStore";
import { mostrarToast } from "../stores/toastStore";
import type { SemanaTvde } from "../types";
import { hojeIso, mesAtual, rotuloMes } from "../utils/calculos";
import { parseMoney } from "../utils/money";
import {
  calcularSemana,
  dadosPorMes,
  dadosPorPeriodo,
  numerosDasSemanas,
  rotuloDaSemana,
  rotuloDoPeriodo,
  semanaDeHoje,
  totaisPerformance,
} from "../utils/tvde";
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
  const uid = useAuthStore((s) => s.sessao?.uid);
  const dados = useTvdeStore((s) => s.dados);
  const existente = n !== null ? dados.semanas[String(n)] : undefined;

  const [valores, setValores] = useState<Record<string, string>>({});
  const [horas, setHoras] = useState("");
  const [viag, setViag] = useState("");
  const [pct, setPct] = useState("");
  const [teste, setTeste] = useState(false);
  const [chave, setChave] = useState<number | null>(null);

  // reinicia quando abre para outra semana (ajuste durante o render)
  if (n !== null && n !== chave) {
    setChave(n);
    const v: Record<string, string> = {};
    for (const [k] of CAMPOS_DINHEIRO) {
      const c = existente?.[k] ?? (k === "alu" ? dados.cfg.aluguel : 0);
      v[k] = c ? (c / 100).toFixed(2).replace(".", ",") : "";
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
    for (const [k] of CAMPOS_DINHEIRO) {
      const texto = (valores[k] ?? "").trim();
      if (texto === "") continue;
      const c = parseMoney(texto);
      if (c === null) {
        mostrarToast(`Valor inválido em ${CAMPOS_DINHEIRO.find(([ck]) => ck === k)?.[1]}.`);
        return;
      }
      semana[k] = c;
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
            <span>{nome}</span>
            <input
              inputMode="decimal"
              placeholder="0,00"
              value={valores[k] ?? ""}
              onChange={(e) => setValores({ ...valores, [k]: e.target.value })}
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
        <label className={styles.checkbox}>
          <input type="checkbox" checked={teste} onChange={(e) => setTeste(e.target.checked)} />
          Semana de teste — conta no dinheiro real, fora das médias/performance
        </label>
        <button type="submit" className={styles.salvar}>
          Salvar semana
        </button>
      </form>
    </BottomSheet>
  );
}

export default function Tvde() {
  const uid = useAuthStore((s) => s.sessao?.uid);
  const dados = useTvdeStore((s) => s.dados);
  const carregado = useTvdeStore((s) => s.carregado);

  const [editando, setEditando] = useState<number | null>(null);
  const [aba, setAba] = useState<"semanas" | "meses" | "periodos" | "extras">("semanas");
  const [segMes, setSegMes] = useState(mesAtual());
  const [segValor, setSegValor] = useState("");
  const [despDescricao, setDespDescricao] = useState("");
  const [despValor, setDespValor] = useState("");

  const { cfg, semanas, segPorMes, lancamentos, despesas } = dados;
  const numeros = numerosDasSemanas(semanas);
  const t = totaisPerformance(semanas, segPorMes, cfg.inicioSemana1, cfg.pctFrota);
  const meses = dadosPorMes(semanas, segPorMes, cfg.inicioSemana1, cfg.pctFrota);
  const periodos = dadosPorPeriodo(semanas, cfg.pctFrota);

  const semanaAtualN = semanaDeHoje(cfg.inicioSemana1);
  const semanaDestaque =
    semanas[String(semanaAtualN)] ??
    (numeros.length ? semanas[String(numeros[numeros.length - 1])] : undefined);
  const destaqueN = semanas[String(semanaAtualN)]
    ? semanaAtualN
    : numeros.length
      ? numeros[numeros.length - 1]
      : null;
  const calcDestaque = semanaDestaque ? calcularSemana(semanaDestaque, cfg.pctFrota) : null;

  async function agir(acao: () => Promise<void>, ok: string) {
    try {
      await acao();
      mostrarToast(ok);
    } catch (e) {
      mostrarToast(e instanceof Error ? e.message : "Não foi possível concluir.");
    }
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

      <Kpis>
        <KpiCard rotulo="Lucro total" valor={eur(t.lucro)} tom="acento" />
        <KpiCard rotulo="Líquido (− Seg. Social)" valor={eur(t.lucroLiquido)} tom="verde" />
        <KpiCard rotulo="Média/semana" valor={eur(t.mediaSemana)} />
        <KpiCard rotulo="Média €/hora" valor={t.mediaPorHora ? eur(t.mediaPorHora) : "—"} />
      </Kpis>

      <div className={styles.abas} role="tablist">
        {(
          [
            ["semanas", "Semanas"],
            ["meses", "Meses"],
            ["periodos", "Períodos"],
            ["extras", "Seg. Social & Despesas"],
          ] as const
        ).map(([id, nome]) => (
          <button
            key={id}
            role="tab"
            aria-selected={aba === id}
            className={`${styles.abaBotao} ${aba === id ? styles.abaAtiva : ""}`}
            onClick={() => setAba(id)}
          >
            {nome}
          </button>
        ))}
      </div>

      {aba === "semanas" && (
        <>
          <div className={styles.cabecalho}>
            <h3 className={styles.subtitulo}>Semanas</h3>
            <button className={styles.adicionar} onClick={() => setEditando(semanaAtualN)}>
              + Semana atual ({semanaAtualN})
            </button>
          </div>
          {carregado && numeros.length === 0 ? (
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
                  <div key={nSem} className={styles.semana}>
                    <button className={styles.semanaInfo} onClick={() => setEditando(nSem)}>
                      <span className={styles.semanaNome}>
                        Semana {nSem} · {rotuloDaSemana(cfg.inicioSemana1, nSem)}
                        {w.teste ? <em className={styles.badgeTeste}>teste</em> : null}
                      </span>
                      <span className={styles.semanaDetalhe}>
                        Fat. {eur(w.fat)} · Receita {eur(c.receita)} · Custos {eur(c.custos)}
                      </span>
                    </button>
                    <div className={styles.semanaLado}>
                      <span className={styles.semanaLucro}>{eur(c.lucro)}</span>
                      {lancada ? (
                        <button
                          className={styles.acaoMini}
                          onClick={() =>
                            agir(
                              () => desfazerLancamentoSemana(uid!, nSem, lancada),
                              "↩ Lançamento desfeito",
                            )
                          }
                        >
                          Desfazer lançamento
                        </button>
                      ) : (
                        <button
                          className={styles.acaoMini}
                          onClick={() => {
                            if (
                              !window.confirm(
                                `Lançar ${eur(Math.round(c.lucro))} como receita nas finanças?\n\nSemana ${nSem} (${rotuloDaSemana(cfg.inicioSemana1, nSem)}).`,
                              )
                            )
                              return;
                            void agir(
                              () => lancarReceitaSemana(uid!, nSem, dados),
                              "✓ Receita lançada nas finanças",
                            );
                          }}
                        >
                          Lançar receita
                        </button>
                      )}
                      <button
                        className={`${styles.acaoMini} ${styles.perigo}`}
                        onClick={() => {
                          if (lancada) {
                            mostrarToast("Desfaça o lançamento antes de excluir a semana.");
                            return;
                          }
                          if (!window.confirm(`Excluir a semana ${nSem}?`)) return;
                          void agir(() => removerSemana(uid!, nSem), "Semana excluída");
                        }}
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
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
              <div key={m.mes} className={styles.linhaTab}>
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
          <form
            className={styles.blocoExtra}
            onSubmit={(e) => {
              e.preventDefault();
              const v = parseMoney(segValor);
              if (v === null || v < 0) return mostrarToast("Valor inválido.");
              void agir(
                () => definirSegMes(uid!, segMes, v === 0 ? null : v),
                v === 0 ? "Seg. Social removida" : "✓ Seg. Social registrada",
              );
              setSegValor("");
            }}
          >
            <p className={styles.blocoTitulo}>Segurança Social (por mês de pagamento)</p>
            <p className={styles.blocoNota}>
              Lançar no mês em que o valor saiu da conta — normalmente o trimestre anterior.
            </p>
            <div className={styles.linhaDupla}>
              <input type="month" value={segMes} onChange={(e) => setSegMes(e.target.value)} />
              <input
                inputMode="decimal"
                placeholder="0,00"
                value={segValor}
                onChange={(e) => setSegValor(e.target.value)}
                required
              />
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
              const v = parseMoney(despValor);
              if (v === null || v <= 0) return mostrarToast("Valor inválido.");
              void agir(
                () =>
                  criarDespesaTvde(uid!, { data: hojeIso(), descricao: despDescricao, valor: v }),
                "✓ Despesa TVDE adicionada",
              );
              setDespDescricao("");
              setDespValor("");
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
              <input
                inputMode="decimal"
                placeholder="0,00"
                value={despValor}
                onChange={(e) => setDespValor(e.target.value)}
                required
              />
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
                          if (!window.confirm(`Excluir "${d.descricao}"?`)) return;
                          void agir(() => removerDespesaTvde(uid!, d.id), "Despesa excluída");
                        }}
                        aria-label={`Excluir ${d.descricao}`}
                      >
                        ×
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
    </Pagina>
  );
}

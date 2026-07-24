// Persistência do módulo TVDE em users/{uid}/fin_v5/tvde — autocontido
// (seção 4.4): nada daqui entra nos totais gerais do app, exceto a receita
// LANÇADA explicitamente pelo usuário (rastreada em `lancamentos`).

import { onValue, push, ref, remove, set, update } from "firebase/database";
import { db } from "./firebase";
import { semIndefinidos } from "./lancamentosService";
import { snapshotHistorico } from "../stores/historicoStore";
import type {
  Cents,
  ConfigTvde,
  DadosTvde,
  DespesaTvde,
  Id,
  Receita,
  SemanaTvde,
  YearMonth,
} from "../types";
import { calcularSemana, dataPagamentoDaSemana, rotuloDaSemana } from "../utils/tvde";

const raiz = (uid: string) => `users/${uid}/fin_v5/tvde`;

/** Defaults do app de origem (TVD_SEEDCFG, valores em centavos). */
export const TVDE_CFG_PADRAO: ConfigTvde = {
  inicioSemana1: "2026-03-02",
  pctFrota: 6,
  aluguel: 26000,
  metaSem: 32000,
  metaMes: 130000,
};

export const TVDE_VAZIO: DadosTvde = {
  cfg: TVDE_CFG_PADRAO,
  semanas: {},
  segPorMes: {},
  lancamentos: {},
  despesas: [],
};

/** O RTDB transforma objetos de chaves numéricas em arrays (com buracos) e
 *  remove {} vazios — reverte para mapa, igual ao _fixMap da origem. */
function fixMapa<T>(o: unknown): Record<string, T> {
  if (Array.isArray(o)) {
    const m: Record<string, T> = {};
    o.forEach((v, i) => {
      if (v != null) m[String(i)] = v as T;
    });
    return m;
  }
  return o && typeof o === "object" ? (o as Record<string, T>) : {};
}

interface TvdeBruto {
  cfg?: Partial<ConfigTvde>;
  semanas?: unknown;
  segPorMes?: Record<YearMonth, Cents>;
  lancamentos?: unknown;
  despesas?: Record<string, Omit<DespesaTvde, "id">> | null;
}

export function normalizarTvde(bruto: TvdeBruto | null): DadosTvde {
  const b = bruto ?? {};
  return {
    cfg: { ...TVDE_CFG_PADRAO, ...(b.cfg ?? {}) },
    semanas: fixMapa<SemanaTvde>(b.semanas),
    segPorMes: b.segPorMes ?? {},
    lancamentos: fixMapa<Id>(b.lancamentos),
    despesas: b.despesas ? Object.entries(b.despesas).map(([id, d]) => ({ ...d, id })) : [],
  };
}

export function observarTvde(uid: string, cb: (dados: DadosTvde) => void): () => void {
  return onValue(ref(db, raiz(uid)), (snap) => cb(normalizarTvde(snap.val())));
}

export async function salvarConfigTvde(uid: string, mudancas: Partial<ConfigTvde>) {
  snapshotHistorico();
  await update(ref(db, `${raiz(uid)}/cfg`), mudancas);
}

export async function salvarSemana(uid: string, n: number, semana: SemanaTvde) {
  snapshotHistorico();
  await set(ref(db, `${raiz(uid)}/semanas/${n}`), semIndefinidos(semana));
}

/** Remove a semana. A UI impede remover semana já lançada nas finanças
 *  (desfazer o lançamento primeiro). */
export async function removerSemana(uid: string, n: number) {
  snapshotHistorico();
  await remove(ref(db, `${raiz(uid)}/semanas/${n}`));
}

export async function definirSegMes(uid: string, mes: YearMonth, valor: Cents | null) {
  snapshotHistorico();
  const r = ref(db, `${raiz(uid)}/segPorMes/${mes}`);
  if (valor === null || valor === 0) await remove(r);
  else await set(r, valor);
}

export async function criarDespesaTvde(uid: string, dados: Omit<DespesaTvde, "id">) {
  snapshotHistorico();
  const novo = push(ref(db, `${raiz(uid)}/despesas`));
  await set(novo, semIndefinidos(dados));
}

export async function removerDespesaTvde(uid: string, id: Id) {
  snapshotHistorico();
  await remove(ref(db, `${raiz(uid)}/despesas/${id}`));
}

/** Lança o lucro da semana como Receita nas finanças gerais — sempre manual,
 *  com rastreio para nunca lançar a mesma semana duas vezes. Multi-path
 *  atômico: receita + marca nascem juntas. */
export async function lancarReceitaSemana(uid: string, n: number, dados: DadosTvde) {
  if (dados.lancamentos[String(n)]) throw new Error("Semana já lançada nas finanças.");
  const semana = dados.semanas[String(n)];
  if (!semana) throw new Error("Semana inexistente.");
  snapshotHistorico();
  const lucro = Math.round(calcularSemana(semana, dados.cfg.pctFrota).lucro);
  const receitaId = push(ref(db, `users/${uid}/fin_v5/receitas`)).key!;
  const receita: Omit<Receita, "id"> = {
    descricao: `TVDE — Semana ${n} (${rotuloDaSemana(dados.cfg.inicioSemana1, n)})`,
    valor: lucro,
    data: dataPagamentoDaSemana(dados.cfg.inicioSemana1, n),
    fonte: "TVDE",
  };
  await update(ref(db, `users/${uid}/fin_v5`), {
    [`receitas/${receitaId}`]: semIndefinidos(receita),
    [`tvde/lancamentos/${n}`]: receitaId,
  });
}

/** Desfaz o lançamento: remove a receita das finanças E a marca — juntos. */
export async function desfazerLancamentoSemana(uid: string, n: number, receitaId: Id) {
  snapshotHistorico();
  await update(ref(db, `users/${uid}/fin_v5`), {
    [`receitas/${receitaId}`]: null,
    [`tvde/lancamentos/${n}`]: null,
  });
}

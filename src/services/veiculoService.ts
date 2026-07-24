// Persistência do veículo (Parte A) em users/{uid}/fin_v5/veiculo/{cargas,
// despesas,despesasFixas,quilometragem} — 4 sub-coleções combinadas num único
// DadosVeiculo pra quem consome (utils/veiculo.ts, telas).

import { onValue, push, ref, remove, set } from "firebase/database";
import { db } from "./firebase";
import { semIndefinidos } from "./lancamentosService";
import { snapshotHistorico } from "../stores/historicoStore";
import type {
  CargaEletrica,
  DadosVeiculo,
  DespesaFixa,
  DespesaVeiculo,
  Id,
  RegistroKm,
  YearMonth,
} from "../types";

type SubDominio = "cargas" | "despesas" | "despesasFixas" | "quilometragem";

const raiz = (uid: string) => `users/${uid}/fin_v5/veiculo`;
const caminho = (uid: string, sub: SubDominio, id?: Id) =>
  `${raiz(uid)}/${sub}${id ? `/${id}` : ""}`;

function paraLista<T extends { id: Id }>(val: Record<string, Omit<T, "id">> | null): T[] {
  if (!val) return [];
  return Object.entries(val).map(([id, dados]) => ({ ...dados, id }) as T);
}

export const VEICULO_VAZIO: DadosVeiculo = {
  cargas: [],
  despesas: [],
  despesasFixas: [],
  quilometragem: [],
};

/** Observa as 4 sub-coleções e chama `cb` com o DadosVeiculo combinado
 *  sempre que qualquer uma mudar. */
export function observarVeiculo(uid: string, cb: (dados: DadosVeiculo) => void): () => void {
  const atual: DadosVeiculo = { ...VEICULO_VAZIO };

  const paraCargas = onValue(ref(db, caminho(uid, "cargas")), (snap) => {
    atual.cargas = paraLista<CargaEletrica>(snap.val());
    cb({ ...atual });
  });
  const paraDespesas = onValue(ref(db, caminho(uid, "despesas")), (snap) => {
    atual.despesas = paraLista<DespesaVeiculo>(snap.val());
    cb({ ...atual });
  });
  const paraFixas = onValue(ref(db, caminho(uid, "despesasFixas")), (snap) => {
    atual.despesasFixas = paraLista<DespesaFixa>(snap.val()).map((f) => ({
      ...f,
      pagoPorMes: f.pagoPorMes ?? {},
    }));
    cb({ ...atual });
  });
  const paraKm = onValue(ref(db, caminho(uid, "quilometragem")), (snap) => {
    atual.quilometragem = paraLista<RegistroKm>(snap.val());
    cb({ ...atual });
  });

  return () => {
    paraCargas();
    paraDespesas();
    paraFixas();
    paraKm();
  };
}

async function criar<T extends { id: Id }>(uid: string, sub: SubDominio, dados: Omit<T, "id">) {
  snapshotHistorico();
  const novo = push(ref(db, caminho(uid, sub)));
  await set(novo, semIndefinidos(dados));
  return novo.key!;
}

async function remover(uid: string, sub: SubDominio, id: Id) {
  snapshotHistorico();
  await remove(ref(db, caminho(uid, sub, id)));
}

// ---- Cargas elétricas ----
export const criarCarga = (uid: string, dados: Omit<CargaEletrica, "id">) =>
  criar<CargaEletrica>(uid, "cargas", dados);
export const removerCarga = (uid: string, id: Id) => remover(uid, "cargas", id);

// ---- Despesas variáveis do veículo ----
export const criarDespesaVeiculo = (uid: string, dados: Omit<DespesaVeiculo, "id">) =>
  criar<DespesaVeiculo>(uid, "despesas", dados);
export const removerDespesaVeiculo = (uid: string, id: Id) => remover(uid, "despesas", id);

// ---- Despesas fixas do veículo ----
export const criarFixaVeiculo = (uid: string, dados: Omit<DespesaFixa, "id">) =>
  criar<DespesaFixa>(uid, "despesasFixas", dados);
export const removerFixaVeiculo = (uid: string, id: Id) => remover(uid, "despesasFixas", id);

export async function alternarPagoFixaVeiculo(
  uid: string,
  fixaId: Id,
  mes: YearMonth,
  pago: boolean,
) {
  snapshotHistorico();
  const r = ref(db, `${caminho(uid, "despesasFixas", fixaId)}/pagoPorMes/${mes}`);
  if (pago) await set(r, true);
  else await remove(r);
}

// ---- Quilometragem ----
export const criarKm = (uid: string, dados: Omit<RegistroKm, "id">) =>
  criar<RegistroKm>(uid, "quilometragem", dados);
export const removerKm = (uid: string, id: Id) => remover(uid, "quilometragem", id);

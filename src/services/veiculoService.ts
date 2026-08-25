// Persistência do veículo (Parte A) em users/{uid}/fin_v5/veiculo/{cargas,
// despesas,despesasFixas,quilometragem} — 4 sub-coleções combinadas num único
// DadosVeiculo pra quem consome (utils/veiculo.ts, telas).

import { onValue, push, ref, remove, set } from "firebase/database";
import { db } from "./firebase";
import { semIndefinidos } from "./lancamentosService";
import { snapshotHistorico } from "../stores/historicoStore";
import { VEICULO_VAZIO } from "../constants/veiculoPadrao";
import type {
  Abastecimento,
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

// Movida para constants/veiculoPadrao.ts (quebra de ciclo de import com
// stores/veiculoStore.ts — achado da auditoria de Arquitetura & Código);
// re-exportada daqui porque é onde o resto do app já a importava.
export { VEICULO_VAZIO };

/** Observa as 4 sub-coleções e chama `cb` com o DadosVeiculo combinado
 *  sempre que qualquer uma mudar. `aoErro` vai nas 4: se qualquer uma cair,
 *  o DadosVeiculo combinado fica incompleto, então a tela toda tem que
 *  avisar em vez de mostrar um veículo pela metade como se fosse o certo.
 *
 *  A PRIMEIRA chamada de `cb` só acontece depois que as 4 já responderam ao
 *  menos uma vez (achado da auditoria de Arquitetura). Sem isto, `cb` disparava
 *  assim que a mais rápida das 4 respondesse — e syncService.ts, que trata
 *  qualquer disparo como "terminou de carregar" (mesma convenção usada pelas
 *  stores de domínio único, que só têm 1 `onValue` cada), marcava
 *  `carregado: true` com um DadosVeiculo pela metade: 3 das 4 sub-coleções
 *  ainda no vazio inicial, indistinguível de "esta pessoa não tem nada
 *  aqui". Depois da carga inicial completa, qualquer uma mudando sozinha
 *  continua a disparar `cb` na hora, como sempre. */
export function observarVeiculo(
  uid: string,
  cb: (dados: DadosVeiculo) => void,
  aoErro: (erro: Error) => void,
): () => void {
  const atual: DadosVeiculo = { ...VEICULO_VAZIO };
  const respondeu = new Set<SubDominio>();
  function notificar(sub: SubDominio) {
    respondeu.add(sub);
    if (respondeu.size < 4) return;
    cb({ ...atual });
  }

  const paraCargas = onValue(
    ref(db, caminho(uid, "cargas")),
    (snap) => {
      atual.cargas = paraLista<Abastecimento>(snap.val());
      notificar("cargas");
    },
    aoErro,
  );
  const paraDespesas = onValue(
    ref(db, caminho(uid, "despesas")),
    (snap) => {
      atual.despesas = paraLista<DespesaVeiculo>(snap.val());
      notificar("despesas");
    },
    aoErro,
  );
  const paraFixas = onValue(
    ref(db, caminho(uid, "despesasFixas")),
    (snap) => {
      atual.despesasFixas = paraLista<DespesaFixa>(snap.val()).map((f) => ({
        ...f,
        pagoPorMes: f.pagoPorMes ?? {},
      }));
      notificar("despesasFixas");
    },
    aoErro,
  );
  const paraKm = onValue(
    ref(db, caminho(uid, "quilometragem")),
    (snap) => {
      atual.quilometragem = paraLista<RegistroKm>(snap.val());
      notificar("quilometragem");
    },
    aoErro,
  );

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

/** Edição de um item já existente (item 5) — mesma forma do
 *  `atualizarDespesaFixa` de lancamentosService: reescreve o nó inteiro sem os
 *  campos indefinidos, mantendo o id como chave. */
async function atualizar<T extends { id: Id }>(uid: string, sub: SubDominio, item: T) {
  snapshotHistorico();
  const { id, ...dados } = item;
  await set(ref(db, caminho(uid, sub, id)), semIndefinidos(dados));
}

async function remover(uid: string, sub: SubDominio, id: Id) {
  snapshotHistorico();
  await remove(ref(db, caminho(uid, sub, id)));
}

// ---- Cargas elétricas ----
export const criarCarga = (uid: string, dados: Omit<Abastecimento, "id">) =>
  criar<Abastecimento>(uid, "cargas", dados);
export const atualizarCarga = (uid: string, item: Abastecimento) =>
  atualizar<Abastecimento>(uid, "cargas", item);
export const removerCarga = (uid: string, id: Id) => remover(uid, "cargas", id);

// ---- Despesas variáveis do veículo ----
export const criarDespesaVeiculo = (uid: string, dados: Omit<DespesaVeiculo, "id">) =>
  criar<DespesaVeiculo>(uid, "despesas", dados);
export const atualizarDespesaVeiculo = (uid: string, item: DespesaVeiculo) =>
  atualizar<DespesaVeiculo>(uid, "despesas", item);
export const removerDespesaVeiculo = (uid: string, id: Id) => remover(uid, "despesas", id);

// ---- Despesas fixas do veículo ----
export const criarFixaVeiculo = (uid: string, dados: Omit<DespesaFixa, "id">) =>
  criar<DespesaFixa>(uid, "despesasFixas", dados);
export const atualizarFixaVeiculo = (uid: string, item: DespesaFixa) =>
  atualizar<DespesaFixa>(uid, "despesasFixas", item);
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
export const atualizarKm = (uid: string, item: RegistroKm) =>
  atualizar<RegistroKm>(uid, "quilometragem", item);
export const removerKm = (uid: string, id: Id) => remover(uid, "quilometragem", id);

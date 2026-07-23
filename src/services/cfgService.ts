// Configuração da conta (antigo S.cfg) em users/{uid}/fin_v5/cfg.

import { onValue, ref, remove, set, update } from "firebase/database";
import { db } from "./firebase";
import type { Cents, ConfigConta, YearMonth } from "../types";
import type { TipoCartao } from "../types";
import { CONFIG_PADRAO } from "../constants/configPadrao";

const caminho = (uid: string, sufixo = "") => `users/${uid}/fin_v5/cfg${sufixo}`;

/** O RTDB omite objetos/arrays vazios — repõe os defaults campo a campo. */
export function normalizarConfig(bruto: Partial<ConfigConta> | null): ConfigConta {
  return { ...CONFIG_PADRAO, ...(bruto ?? {}) };
}

export function observarConfig(uid: string, cb: (cfg: ConfigConta) => void): () => void {
  return onValue(ref(db, caminho(uid)), (snap) => {
    cb(normalizarConfig(snap.val()));
  });
}

export async function atualizarConfig(uid: string, mudancas: Partial<ConfigConta>) {
  await update(ref(db, caminho(uid)), mudancas);
}

/** Adiciona um cartão/conta com o seu tipo (crédito entra no fluxo de fatura). */
export async function adicionarCartao(
  uid: string,
  cfg: ConfigConta,
  nome: string,
  tipo: TipoCartao,
) {
  if (cfg.contasCartoes.includes(nome)) throw new Error("Já existe um cartão com esse nome.");
  await update(ref(db, caminho(uid)), {
    contasCartoes: [...cfg.contasCartoes, nome],
    [`tipoCartao/${nome}`]: tipo,
  });
}

/** Override manual da fatura (seção 4.1) — `null` volta ao cálculo automático. */
export async function definirFaturaManual(
  uid: string,
  cartao: string,
  mes: YearMonth,
  valor: Cents | null,
) {
  const r = ref(db, caminho(uid, `/faturaManual/${cartao}/${mes}`));
  if (valor === null) await remove(r);
  else await set(r, valor);
}

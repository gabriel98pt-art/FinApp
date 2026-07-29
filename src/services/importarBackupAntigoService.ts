// Grava o resultado já mapeado (utils/importarBackupAntigo.ts) no Firebase —
// um write atômico por domínio (seção da spec: "se um domínio falhar, os
// outros já gravados continuam válidos"), nunca um único set() na árvore
// inteira. Um snapshotHistorico() cobre a importação toda com um só Desfazer.

import { ref, set, update } from "firebase/database";
import { db } from "./firebase";
import { snapshotHistorico } from "../stores/historicoStore";
import { useDespesasFixasStore } from "../stores/lancamentosStore";
import { useParcelasStore } from "../stores/parcelasStore";
import { useVeiculoStore } from "../stores/veiculoStore";
import {
  caminhosDiaVencimento,
  type DominioComDia,
  type DominiosMapeados,
} from "../utils/importarBackupAntigo";

/** "soDia" existe porque reimportar com "somar" para recuperar o dia de
 *  vencimento reescreveria o registo inteiro com o que está no arquivo —
 *  incluindo pagoPorMes e qualquer edição feita desde a importação. Esta
 *  ação grava só o campo do dia, e só em itens que ainda existem na conta. */
export type AcaoDominio = "importar" | "somar" | "soDia" | "pular";

/** Domínios em que a ação "soDia" é oferecida. */
export const DOMINIOS_COM_DIA: DominioComDia[] = [
  "despesasFixas",
  "veiculoDespesasFixas",
  "parcelas",
];

/** Ids que a conta tem HOJE em cada um desses domínios — o filtro que impede
 *  o update de recriar o que já foi apagado. */
function idsNaConta(dominio: DominioComDia): string[] {
  if (dominio === "parcelas") return useParcelasStore.getState().itens.map((p) => p.id);
  if (dominio === "veiculoDespesasFixas")
    return useVeiculoStore.getState().dados.despesasFixas.map((f) => f.id);
  return useDespesasFixasStore.getState().itens.map((f) => f.id);
}

interface EspecDominio {
  caminho: (uid: string) => string;
  /** Domínios "patch" (cfg, tvdeCfg) só fazem sentido como update parcial —
   *  "somar" e "importar" seriam a mesma operação, então só oferecem
   *  "importar"/"pular". */
  suportaSomar: boolean;
}

const ESPECS: Record<keyof DominiosMapeados, EspecDominio> = {
  receitas: { caminho: (uid) => `users/${uid}/fin_v5/receitas`, suportaSomar: true },
  despesasFixas: { caminho: (uid) => `users/${uid}/fin_v5/despesasFixas`, suportaSomar: true },
  despesasCorrentes: {
    caminho: (uid) => `users/${uid}/fin_v5/despesasCorrentes`,
    suportaSomar: true,
  },
  parcelas: { caminho: (uid) => `users/${uid}/fin_v5/parcelas`, suportaSomar: true },
  transferencias: { caminho: (uid) => `users/${uid}/fin_v5/transferencias`, suportaSomar: true },
  eventos: { caminho: (uid) => `users/${uid}/fin_v5/eventos`, suportaSomar: true },
  fundos: { caminho: (uid) => `users/${uid}/fin_v5/fundos`, suportaSomar: true },
  veiculoCargas: { caminho: (uid) => `users/${uid}/fin_v5/veiculo/cargas`, suportaSomar: true },
  veiculoQuilometragem: {
    caminho: (uid) => `users/${uid}/fin_v5/veiculo/quilometragem`,
    suportaSomar: true,
  },
  veiculoDespesas: {
    caminho: (uid) => `users/${uid}/fin_v5/veiculo/despesas`,
    suportaSomar: true,
  },
  veiculoDespesasFixas: {
    caminho: (uid) => `users/${uid}/fin_v5/veiculo/despesasFixas`,
    suportaSomar: true,
  },
  tvdeSemanas: { caminho: (uid) => `users/${uid}/fin_v5/tvde/semanas`, suportaSomar: true },
  tvdeSegPorMes: { caminho: (uid) => `users/${uid}/fin_v5/tvde/segPorMes`, suportaSomar: true },
  tvdeLancamentos: {
    caminho: (uid) => `users/${uid}/fin_v5/tvde/lancamentos`,
    suportaSomar: true,
  },
  tvdeDespesas: { caminho: (uid) => `users/${uid}/fin_v5/tvde/despesas`, suportaSomar: true },
  tvdeCfg: { caminho: (uid) => `users/${uid}/fin_v5/tvde/cfg`, suportaSomar: false },
  cfg: { caminho: (uid) => `users/${uid}/fin_v5/cfg`, suportaSomar: false },
};

/** RTDB rejeita `undefined` em qualquer profundidade — os mapeadores geram
 *  campos opcionais como `undefined` (ex. contaCartao, ou `de` dentro de
 *  faturasPagas.*.pagamentos[]), então uma limpeza rasa não basta. */
function limparUndefinedProfundo<T>(valor: T): T {
  if (Array.isArray(valor)) {
    return valor.map((v) => limparUndefinedProfundo(v)) as unknown as T;
  }
  if (valor !== null && typeof valor === "object") {
    const limpo: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
      if (v === undefined) continue;
      limpo[k] = limparUndefinedProfundo(v);
    }
    return limpo as T;
  }
  return valor;
}

export interface ResultadoImportacaoAntiga {
  sucesso: (keyof DominiosMapeados)[];
  falha: { dominio: keyof DominiosMapeados; erro: string }[];
}

/** Grava cada domínio marcado com uma ação != "pular". Domínios sem nada a
 *  gravar (mapeamento vazio) são pulados silenciosamente mesmo se marcados,
 *  pra não sobrescrever dados existentes com um array vazio à toa. */
export async function importarBackupAntigo(
  uid: string,
  mapeado: DominiosMapeados,
  acoes: Partial<Record<keyof DominiosMapeados, AcaoDominio>>,
): Promise<ResultadoImportacaoAntiga> {
  snapshotHistorico();
  const sucesso: (keyof DominiosMapeados)[] = [];
  const falha: { dominio: keyof DominiosMapeados; erro: string }[] = [];

  for (const chave of Object.keys(ESPECS) as (keyof DominiosMapeados)[]) {
    const acao = acoes[chave] ?? "pular";
    if (acao === "pular") continue;

    const dados = mapeado[chave] as object;
    if (Object.keys(dados).length === 0) continue;

    const spec = ESPECS[chave];
    const payload = limparUndefinedProfundo(dados);
    try {
      const r = ref(db, spec.caminho(uid));
      if (acao === "soDia") {
        const patch = caminhosDiaVencimento(
          dados as Record<string, { diaVencimento?: number }>,
          idsNaConta(chave as DominioComDia),
        );
        // Nenhum item do arquivo com dia continua na conta: não há o que fazer.
        if (Object.keys(patch).length === 0) continue;
        await update(r, patch);
      } else if (acao === "somar" && spec.suportaSomar) {
        await update(r, payload as Record<string, unknown>);
      } else {
        await set(r, payload);
      }
      sucesso.push(chave);
    } catch (err) {
      falha.push({
        dominio: chave,
        erro: err instanceof Error ? err.message : "Erro desconhecido",
      });
    }
  }

  return { sucesso, falha };
}

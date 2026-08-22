import type { ConfigTvde, DadosTvde } from "../types";

// Extraído de tvdeService.ts (achado da auditoria de Arquitetura & Código):
// stores/tvdeStore.ts importava esta constante do serviço só para o estado
// inicial, e services/historicoService.ts lê stores/tvdeStore.ts para tirar
// o snapshot do undo/redo — fechando um ciclo store→serviço→store. A
// constante não depende de Firebase nem de nada em services/, então vive
// aqui; tvdeService.ts continua a exportá-la (re-export) para quem já
// importava dali.

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

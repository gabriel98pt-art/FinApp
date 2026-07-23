import { create } from "zustand";
import type { ConfigConta } from "../types";
import { CONFIG_PADRAO } from "../constants/configPadrao";

/** Espelho da config da conta — alimentado só pelo syncService. */
interface CfgState {
  cfg: ConfigConta;
  carregado: boolean;
}

export const useCfgStore = create<CfgState>(() => ({
  cfg: CONFIG_PADRAO,
  carregado: false,
}));

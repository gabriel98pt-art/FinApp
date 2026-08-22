import { useCfgStore } from "../stores/cfgStore";
import { hojeIso, mesAtual } from "../utils/calculos";
import { todasNotificacoes, type Notificacao } from "../utils/notificacoes";
import { useDadosFatura } from "./useDadosFatura";

/** O que está vencido e por pagar, agora. `useDadosFatura` já junta os
 *  stores que as três fontes precisam — as fixas do veículo entram ao lado
 *  das gerais, e o cálculo da fatura precisa de quase tudo o que sai pelo
 *  cartão.
 *
 *  Sempre o mês de hoje, nunca o do seletor do header: uma pendência não deixa
 *  de existir por se estar a olhar para outro mês. */
export function useNotificacoes(): Notificacao[] {
  const cfg = useCfgStore((s) => s.cfg);
  const dados = useDadosFatura();

  return todasNotificacoes(hojeIso(), mesAtual(), dados, cfg, dados.parcelas, [
    ...dados.despesasFixas,
    ...dados.despesasFixasVeiculo,
  ]);
}

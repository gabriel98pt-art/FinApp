import { useMemo } from "react";
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
  const hoje = hojeIso();
  const mes = mesAtual();

  // useMemo (achado da auditoria de Performance): maior impacto do app —
  // este hook está montado no Header, então roda em TODA página. Sem isto,
  // qualquer onValue do RTDB em qualquer domínio (mesmo sem relação com
  // notificações) somava tudo de novo em toda tela.
  return useMemo(
    () =>
      todasNotificacoes(hoje, mes, dados, cfg, dados.parcelas, [
        ...dados.despesasFixas,
        ...dados.despesasFixasVeiculo,
      ]),
    [hoje, mes, dados, cfg],
  );
}

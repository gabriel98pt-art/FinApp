import { useCfgStore } from "../stores/cfgStore";
import {
  useDespesasFixasStore,
  useDespesasStore,
  useReceitasStore,
  useTransferenciasStore,
} from "../stores/lancamentosStore";
import { useParcelasStore } from "../stores/parcelasStore";
import { useVeiculoStore } from "../stores/veiculoStore";
import { hojeIso, mesAtual } from "../utils/calculos";
import type { DadosFatura } from "../utils/fatura";
import { todasNotificacoes, type Notificacao } from "../utils/notificacoes";

/** O que está vencido e por pagar, agora. Junta os stores que as três fontes
 *  precisam — as fixas do veículo entram ao lado das gerais, e o cálculo da
 *  fatura precisa de quase tudo o que sai pelo cartão.
 *
 *  Sempre o mês de hoje, nunca o do seletor do header: uma pendência não deixa
 *  de existir por se estar a olhar para outro mês. */
export function useNotificacoes(): Notificacao[] {
  const cfg = useCfgStore((s) => s.cfg);
  const despesas = useDespesasStore((s) => s.itens);
  const despesasFixas = useDespesasFixasStore((s) => s.itens);
  const transferencias = useTransferenciasStore((s) => s.itens);
  const parcelas = useParcelasStore((s) => s.itens);
  const veiculo = useVeiculoStore((s) => s.dados);
  const receitas = useReceitasStore((s) => s.itens);

  const dados: DadosFatura = {
    despesasFixas,
    despesasFixasVeiculo: veiculo.despesasFixas,
    despesasCorrentes: despesas,
    parcelas,
    transferencias,
    cargas: veiculo.cargas,
    despesasVeiculo: veiculo.despesas,
    receitas,
  };

  return todasNotificacoes(hojeIso(), mesAtual(), dados, cfg, parcelas, [
    ...despesasFixas,
    ...veiculo.despesasFixas,
  ]);
}

import { useMemo } from "react";
import {
  useDespesasFixasStore,
  useDespesasStore,
  useReceitasStore,
  useTransferenciasStore,
} from "../stores/lancamentosStore";
import { useParcelasStore } from "../stores/parcelasStore";
import { useVeiculoStore } from "../stores/veiculoStore";
import { montarDadosFatura, type DadosFatura } from "../utils/fatura";

/** `DadosFatura` pronto pra quem só precisa DELE — lê os 6 stores sozinho.
 *  Quem já lê alguns desses stores por outro motivo (a maioria das telas que
 *  usam fatura) chama `montarDadosFatura()` direto com o que já tem, pra não
 *  assinar o mesmo store duas vezes. */
export function useDadosFatura(): DadosFatura {
  const despesas = useDespesasStore((s) => s.itens);
  const despesasFixas = useDespesasFixasStore((s) => s.itens);
  const transferencias = useTransferenciasStore((s) => s.itens);
  const parcelas = useParcelasStore((s) => s.itens);
  const veiculo = useVeiculoStore((s) => s.dados);
  const receitas = useReceitasStore((s) => s.itens);

  // useMemo (achado da auditoria de Performance): `montarDadosFatura` só
  // monta, não memoiza — sem isto, cada chamador (ex.: useNotificacoes, que
  // está montado no Header e roda em toda página) recebia um objeto NOVO a
  // cada render, quebrando a memoização de quem depende deste hook mesmo
  // quando nenhum dos 6 stores mudou de verdade.
  return useMemo(
    () =>
      montarDadosFatura({ despesas, despesasFixas, transferencias, parcelas, veiculo, receitas }),
    [despesas, despesasFixas, transferencias, parcelas, veiculo, receitas],
  );
}

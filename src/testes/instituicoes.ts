// Fixtures de instituições/métodos de pagamento, no mesmo espírito de
// `dobras.ts`: o que se partilha é a FORMA, não os dados.
//
// Escrever uma instituição à mão em cada teste são cinco linhas para dizer
// "um cartão de crédito chamado Gold" — e é aí que alguém troca o id pelo nome
// sem reparar, que é justamente a distinção que a Fase C existe para manter.

import type { ConfigConta, Instituicao, MetodoPagamento, TipoMetodo } from "../types";

/** Uma instituição com um método só — a forma de toda a conta migrada 1:1 do
 *  formato antigo. `id` fica igual ao nome quando não se diz o contrário, que
 *  é o que a migração faz; passá-lo à mão é como se escreve o caso que
 *  interessa a esta fase: o id que ficou para trás depois de um rename. */
export function instituicao(
  nome: string,
  tipo: TipoMetodo = "debito",
  extra: Partial<Omit<MetodoPagamento, "id" | "tipo">> & { id?: string } = {},
): Instituicao {
  const { id = nome, ...doMetodo } = extra;
  return { id, nome, metodos: [{ id, tipo, ...doMetodo }] };
}

/** Os quatro campos antigos derivados destas instituições, prontos a espalhar
 *  numa `ConfigConta` de teste — é o que `normalizarConfig` faria. */
export function comInstituicoes(
  ...instituicoes: Instituicao[]
): Pick<
  ConfigConta,
  | "instituicoes"
  | "instituicoesGravadas"
  | "contasCartoes"
  | "tipoCartao"
  | "diaVencimentoFatura"
  | "diaFechamentoFatura"
> {
  const contasCartoes: string[] = [];
  const tipoCartao: ConfigConta["tipoCartao"] = {};
  const diaVencimentoFatura: ConfigConta["diaVencimentoFatura"] = {};
  const diaFechamentoFatura: ConfigConta["diaFechamentoFatura"] = {};
  for (const inst of instituicoes) {
    for (const m of inst.metodos) {
      contasCartoes.push(m.id);
      tipoCartao[m.id] = m.tipo === "credito" ? "credit" : "debit";
      if (m.diaVencimentoFatura) diaVencimentoFatura[m.id] = m.diaVencimentoFatura;
      if (m.diaFechamentoFatura) diaFechamentoFatura[m.id] = m.diaFechamentoFatura;
    }
  }
  return {
    instituicoes,
    instituicoesGravadas: true,
    contasCartoes,
    tipoCartao,
    diaVencimentoFatura,
    diaFechamentoFatura,
  };
}

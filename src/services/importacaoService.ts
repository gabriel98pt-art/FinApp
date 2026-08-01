// Confirmação da importação: grava as linhas marcadas "import" num único
// update() atômico. Nada é gravado sem essa chamada explícita — a tela de
// Importar só manipula estado local até o usuário confirmar.

import { push, ref, update } from "firebase/database";
import { db } from "./firebase";
import { semIndefinidos } from "./lancamentosService";
import type { DespesaCorrente, ExistenteParaDedup, LinhaAnalisada, Receita } from "../types";

/** Lançamentos existentes pra deduplicação: todo o dinheiro já registado que
 *  pode voltar a aparecer numa linha do extrato.
 *
 *  Despesas de QUALQUER origem entram, incluindo a parcela paga (`parc`) e o
 *  pagamento de fatura (`fat`). O app de referência excluía-as (_impExisting)
 *  por não terem sido "digitadas ou importadas organicamente" — mas isso não
 *  interessa aqui: a dedup não pergunta como o lançamento nasceu, pergunta se
 *  aquele MESMO dinheiro já está registado. A prestação e a fatura do cartão
 *  saem da conta e aparecem no extrato do banco como qualquer outra compra;
 *  fora da lista, eram importadas segunda vez sem um aviso.
 */
export function construirExistentes(
  receitas: Receita[],
  despesas: DespesaCorrente[],
): ExistenteParaDedup[] {
  const deReceitas: ExistenteParaDedup[] = receitas.map((r) => ({
    id: r.id,
    data: r.data,
    valor: r.valor,
    descricao: `${r.fonte} ${r.descricao}`,
  }));
  const deDespesas: ExistenteParaDedup[] = despesas.map((d) => ({
    id: d.id,
    data: d.data,
    valor: -d.valor,
    descricao: `${d.descricao} ${d.categoria}`,
  }));
  return [...deReceitas, ...deDespesas];
}

export async function confirmarImportacao(uid: string, linhas: LinhaAnalisada[]) {
  const raiz = `users/${uid}/fin_v5`;
  const atualizacoes: Record<string, unknown> = {};

  for (const linha of linhas) {
    if (linha.acao !== "import") continue;
    const { classificacao } = linha;

    if (classificacao.tipo === "receita") {
      const id = push(ref(db, `${raiz}/receitas`)).key!;
      const receita: Omit<Receita, "id"> = {
        descricao: linha.descricao,
        valor: Math.abs(linha.valor),
        data: linha.data,
        fonte: linha.categoriaEscolhida || "Outros",
      };
      atualizacoes[`receitas/${id}`] = semIndefinidos(receita);
    } else {
      // despesa, fatura ou transferência: todas viram despesa corrente com
      // a categoria escolhida — evita atribuir automaticamente a um cartão/
      // fatura específico sem confirmação do usuário (ver nota em types/importacao.ts)
      const id = push(ref(db, `${raiz}/despesasCorrentes`)).key!;
      const despesa: Omit<DespesaCorrente, "id"> = {
        descricao: linha.descricao,
        valor: Math.abs(linha.valor),
        data: linha.data,
        categoria: linha.categoriaEscolhida || "Outros",
      };
      atualizacoes[`despesasCorrentes/${id}`] = semIndefinidos(despesa);
    }
  }

  if (Object.keys(atualizacoes).length === 0) return 0;
  await update(ref(db, raiz), atualizacoes);
  return Object.keys(atualizacoes).length;
}

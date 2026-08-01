// Confirmação da importação: grava as linhas marcadas "import" num único
// update() atômico. Nada é gravado sem essa chamada explícita — a tela de
// Importar só manipula estado local até o usuário confirmar.

import { push, ref, update } from "firebase/database";
import { db } from "./firebase";
import { semIndefinidos } from "./lancamentosService";
import type {
  CargaEletrica,
  DespesaCorrente,
  DespesaVeiculo,
  ExistenteParaDedup,
  LinhaAnalisada,
  Receita,
} from "../types";

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
 *
 *  Cargas e despesas do veículo entram pela mesma razão. Ficaram de fora só
 *  porque o veículo ainda não era um domínio próprio quando isto foi escrito. */
export function construirExistentes(
  receitas: Receita[],
  despesas: DespesaCorrente[],
  cargas: CargaEletrica[],
  despesasVeiculo: DespesaVeiculo[],
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
  // A carga não tem campo de descrição: `local` é o nome curto do posto
  // ("Ionity A1", "Powerdot"), justamente o que costuma vir escrito na linha
  // do banco. `nota` fica de fora de propósito — é texto livre, e a
  // similaridade aqui é por palavras em comum: acrescentar palavras que o
  // extrato nunca tem só afasta as duas descrições.
  const deCargas: ExistenteParaDedup[] = cargas.map((c) => ({
    id: c.id,
    data: c.data,
    valor: -c.custo,
    descricao: c.local,
  }));
  // Na despesa do veículo é a `nota` que costuma guardar o nome de quem
  // recebeu (a oficina, o seguro), com a categoria a fazer de contexto — o
  // mesmo par de `descricao` + `categoria` das despesas correntes.
  const deVeiculo: ExistenteParaDedup[] = despesasVeiculo.map((d) => ({
    id: d.id,
    data: d.data,
    valor: -d.valor,
    descricao: `${d.nota ?? ""} ${d.categoria}`.trim(),
  }));
  return [...deReceitas, ...deDespesas, ...deCargas, ...deVeiculo];
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

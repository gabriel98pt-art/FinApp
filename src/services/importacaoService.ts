// Confirmação da importação: grava as linhas marcadas "import" num único
// update() atômico. Nada é gravado sem essa chamada explícita — a tela de
// Importar só manipula estado local até o usuário confirmar.

import { push, ref, update } from "firebase/database";
import { db } from "./firebase";
import { criarTransferencia, semIndefinidos } from "./lancamentosService";
import { criarCarga } from "./veiculoService";
import type {
  CargaEletrica,
  DespesaCorrente,
  DespesaVeiculo,
  ExistenteParaDedup,
  LinhaAnalisada,
  Receita,
  Transferencia,
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
 *  porque o veículo ainda não era um domínio próprio quando isto foi escrito.
 *
 *  Transferências entram por duas — ver abaixo. */
export function construirExistentes(
  receitas: Receita[],
  despesas: DespesaCorrente[],
  cargas: CargaEletrica[],
  despesasVeiculo: DespesaVeiculo[],
  transferencias: Transferencia[],
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
  // Uma transferência vale por DUAS: o mesmo dinheiro já é conhecido como
  // saída da conta `de` e como entrada na conta `para`, e a linha nova do
  // extrato pode ser qualquer um dos dois lados — depende de qual conta é o
  // extrato que se está a importar. Sem os dois sinais, importar o extrato do
  // outro lado do mesmo movimento passava sem aviso e duplicava o dinheiro.
  //
  // O `id` repete-se de propósito: é o mesmo registo real, só a comparação é
  // que precisa de o ver dos dois ângulos.
  const deTransferencias: ExistenteParaDedup[] = transferencias.flatMap((t) => {
    const descricao = t.descricao ?? `${t.de} → ${t.para}`;
    return [
      { id: t.id, data: t.data, valor: -t.valor, descricao },
      { id: t.id, data: t.data, valor: t.valor, descricao },
    ];
  });
  return [...deReceitas, ...deDespesas, ...deCargas, ...deVeiculo, ...deTransferencias];
}

/** Uma linha marcada como recarga elétrica, no formato que o veículo guarda.
 *  Devolve `null` se falta o que só o usuário pode dar — a tela de revisão não
 *  deixa confirmar nesse estado, e aqui é a segunda tranca: mais vale falhar
 *  do que gravar uma carga sem kWh.
 *
 *  `precoKwh` sai de custo ÷ kWh, a mesma conta do formulário de registo
 *  rápido (RegistroRapido.tsx) — o preço nunca é digitado em lado nenhum. */
export function dadosDaCarga(linha: LinhaAnalisada): Omit<CargaEletrica, "id"> | null {
  const kwh = parseFloat(linha.kwhCarga.replace(",", "."));
  const local = linha.localCarga.trim();
  if (!Number.isFinite(kwh) || kwh <= 0 || !local) return null;
  const custo = Math.abs(linha.valor);
  return { data: linha.data, kwh, custo, precoKwh: Math.round(custo / kwh), local };
}

/** Uma linha marcada como transferência vinda de cartão de crédito, no formato
 *  que o app já usa para transferências. `null` quando falta o que só o usuário
 *  sabe — mesma tranca dupla da recarga.
 *
 *  `valor` vai POSITIVO, como no formulário manual de transferências: é assim
 *  que `calcularFaturaAutomatica` o soma à fatura do cartão de origem, sem
 *  inverter sinal. Origem e destino diferentes, também como lá. */
export function dadosDaTransferencia(linha: LinhaAnalisada): Omit<Transferencia, "id"> | null {
  const de = linha.contaOrigem.trim();
  const para = linha.contaDestino.trim();
  if (!de || !para || de === para) return null;
  return { data: linha.data, de, para, valor: Math.abs(linha.valor), descricao: linha.descricao };
}

export async function confirmarImportacao(uid: string, linhas: LinhaAnalisada[]) {
  const raiz = `users/${uid}/fin_v5`;
  const atualizacoes: Record<string, unknown> = {};

  // As recargas saem daqui para o domínio do veículo, por `criarCarga` — não
  // são despesa corrente. Preparadas todas ANTES de escrever seja o que for:
  // se uma estiver incompleta, nada é gravado, em vez de metade do extrato
  // entrar e a outra metade rebentar a meio.
  const cargas: Omit<CargaEletrica, "id">[] = [];
  const transferencias: Omit<Transferencia, "id">[] = [];
  for (const linha of linhas) {
    if (linha.acao !== "import") continue;
    if (linha.destino === "carga") {
      const dados = dadosDaCarga(linha);
      if (!dados) throw new Error(`Recarga sem kWh ou sem local: ${linha.descricao}`);
      cargas.push(dados);
    } else if (linha.destino === "transferencia_cartao") {
      const dados = dadosDaTransferencia(linha);
      if (!dados) throw new Error(`Transferência sem cartão ou sem conta: ${linha.descricao}`);
      transferencias.push(dados);
    }
  }

  for (const linha of linhas) {
    if (linha.acao !== "import" || linha.destino !== "lancamento") continue;

    if (linha.tipoEscolhido === "receita") {
      const id = push(ref(db, `${raiz}/receitas`)).key!;
      const receita: Omit<Receita, "id"> = {
        descricao: linha.descricao,
        valor: Math.abs(linha.valor),
        data: linha.data,
        fonte: linha.categoriaEscolhida || "Outros",
      };
      atualizacoes[`receitas/${id}`] = semIndefinidos(receita);
    } else {
      // Despesa é o outro lado do interruptor — e é onde caem também fatura e
      // transferência, que viram despesa corrente com a categoria escolhida:
      // evita atribuir automaticamente a um cartão/fatura específico sem
      // confirmação do usuário (ver nota em types/importacao.ts).
      //
      // Quem manda é a escolha do usuário na revisão, não a classificação: o
      // automático erra o lado (um estorno do supermercado bate numa regra de
      // despesa), e este era o único sítio onde isso ainda dava para corrigir.
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

  if (Object.keys(atualizacoes).length > 0) await update(ref(db, raiz), atualizacoes);
  for (const dados of cargas) await criarCarga(uid, dados);
  for (const dados of transferencias) await criarTransferencia(uid, dados);
  return Object.keys(atualizacoes).length + cargas.length + transferencias.length;
}

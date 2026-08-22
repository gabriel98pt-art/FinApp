// Confirmação da importação: grava as linhas marcadas "import" num único
// update() atômico. Nada é gravado sem essa chamada explícita — a tela de
// Importar só manipula estado local até o usuário confirmar.

import { push, ref, update } from "firebase/database";
import { db } from "./firebase";
import {
  atualizarDespesaFixa,
  criarTransferencia,
  removerDespesa,
  removerReceita,
  removerTransferencia,
  semIndefinidos,
} from "./lancamentosService";
import { criarCarga, removerCarga, removerDespesaVeiculo } from "./veiculoService";
import { snapshotHistorico } from "../stores/historicoStore";
import { diaDoMes } from "../utils/vencimentos";
import { calcularFaturaAutomatica, pagamentosDaFatura, type DadosFatura } from "../utils/fatura";
import { pagarFatura } from "./faturaService";
import type {
  CargaEletrica,
  ConfigConta,
  DespesaCorrente,
  DespesaFixa,
  DespesaVeiculo,
  ExistenteParaDedup,
  LinhaAnalisada,
  Parcela,
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
 *  Transferências entram por duas, e as fixas pagas por uma por mês — ver
 *  abaixo. */
export function construirExistentes(
  receitas: Receita[],
  despesas: DespesaCorrente[],
  cargas: CargaEletrica[],
  despesasVeiculo: DespesaVeiculo[],
  transferencias: Transferencia[],
  despesasFixas: DespesaFixa[],
): ExistenteParaDedup[] {
  const deReceitas: ExistenteParaDedup[] = receitas.map((r) => ({
    id: r.id,
    data: r.data,
    valor: r.valor,
    descricao: `${r.fonte} ${r.descricao}`,
    origem: "receita",
  }));
  const deDespesas: ExistenteParaDedup[] = despesas.map((d) => ({
    id: d.id,
    data: d.data,
    valor: -d.valor,
    descricao: `${d.descricao} ${d.categoria}`,
    origem: "despesa",
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
    origem: "carga",
  }));
  // Na despesa do veículo é a `nota` que costuma guardar o nome de quem
  // recebeu (a oficina, o seguro), com a categoria a fazer de contexto — o
  // mesmo par de `descricao` + `categoria` das despesas correntes.
  const deVeiculo: ExistenteParaDedup[] = despesasVeiculo.map((d) => ({
    id: d.id,
    data: d.data,
    valor: -d.valor,
    descricao: `${d.nota ?? ""} ${d.categoria}`.trim(),
    origem: "despesaVeiculo",
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
      { id: t.id, data: t.data, valor: -t.valor, descricao, origem: "transferencia" as const },
      { id: t.id, data: t.data, valor: t.valor, descricao, origem: "transferencia" as const },
    ];
  });
  // Despesa fixa paga não tem lançamento espelho — o "pago" é só uma marca no
  // mês —, mas o dinheiro saiu à mesma e aparece no extrato. A data sai do dia
  // de vencimento; a folga de dias entre o vencimento e o débito real já está
  // coberta pela janela da comparação.
  //
  // Sem `diaVencimento` não há data nenhuma para comparar, e um dia inventado
  // tanto podia aproximar como afastar da linha certa: essa fica de fora. O
  // `id` repete-se por mês pago, como nas transferências — é o mesmo registo
  // visto em alturas diferentes.
  const deFixas: ExistenteParaDedup[] = despesasFixas.flatMap((d) =>
    d.diaVencimento === undefined
      ? []
      : Object.entries(d.pagoPorMes)
          .filter(([, pago]) => pago === true)
          .map(([mes]) => ({
            id: d.id,
            data: diaDoMes(mes, d.diaVencimento!),
            valor: -d.valor,
            descricao: `${d.descricao} ${d.categoria}`,
            origem: "despesaFixa" as const,
            mes,
          })),
  );
  return [...deReceitas, ...deDespesas, ...deCargas, ...deVeiculo, ...deTransferencias, ...deFixas];
}

/** Uma linha marcada como recarga elétrica, no formato que o veículo guarda.
 *  Devolve `null` só quando falta o LOCAL: sem saber que posto é, a carga não
 *  diz nada, e o local escolhe-se de uma lista — não custa exigi-lo.
 *
 *  `precoKwh` sai de custo ÷ kWh, a mesma conta do formulário de registo
 *  rápido (RegistroRapido.tsx) — o preço nunca é digitado em lado nenhum. */
export function dadosDaCarga(linha: LinhaAnalisada): Omit<CargaEletrica, "id"> | null {
  const local = linha.localCarga.trim();
  if (!local) return null;
  const custo = Math.abs(linha.valor);
  const kwh = parseFloat(linha.kwhCarga.replace(",", "."));
  // Sem kWh a carga entra incompleta (0 e 0) em vez de travar a importação
  // inteira: o valor e a data já estão certos, e o que falta completa-se
  // depois na aba Veículo. Antes, um posto sem histórico para estimar
  // obrigava a escrever um número na hora ou a desistir da linha.
  const nota = linha.notaEscolhida || undefined;
  if (!Number.isFinite(kwh) || kwh <= 0) {
    return { data: linha.data, kwh: 0, custo, precoKwh: 0, local, nota };
  }
  return { data: linha.data, kwh, custo, precoKwh: Math.round(custo / kwh), local, nota };
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
  return {
    data: linha.data,
    de,
    para,
    valor: Math.abs(linha.valor),
    descricao: linha.descricao,
    nota: linha.notaEscolhida || undefined,
  };
}

/** O que uma linha de pagamento de fatura traz por si — o resto (quanto já
 *  foi pago, quanto se deve) vem do contexto, que a tela tem carregado.
 *  `null` quando falta o que só o usuário pode dizer: sem cartão não se sabe
 *  que fatura é, sem conta de origem não se sabe de onde saiu o dinheiro. */
export function pagamentoDaLinha(linha: LinhaAnalisada) {
  const cartao = linha.fatCartaoEscolhido.trim();
  const de = linha.contaOrigem.trim();
  const mes = linha.fatMesEscolhido.trim();
  if (!cartao || !de || !mes) return null;
  return { cartao, de, mes, valor: Math.abs(linha.valor), data: linha.data };
}

/** Tudo o que o serviço precisa para registar um pagamento de fatura e que não
 *  vem da linha. Entregue pela tela, que já tem isto carregado — assim o
 *  serviço de importação não vai buscar dados a lado nenhum nem passa a
 *  depender das stores. */
export interface ContextoFaturas {
  faturasPagas: ConfigConta["faturasPagas"];
  diaFechamentoFatura?: ConfigConta["diaFechamentoFatura"];
  parcelas: Parcela[];
  dados: DadosFatura;
}

export async function confirmarImportacao(
  uid: string,
  linhas: LinhaAnalisada[],
  contextoFaturas?: ContextoFaturas,
) {
  // Achado da auditoria de Arquitetura: era o único caminho de escrita do
  // app que não passava por snapshotHistorico(). criarCarga/criarTransferencia/
  // pagarFatura (chamados mais abaixo) já snapshottam sozinhos antes da
  // própria escrita — mas o update() em lote de receitas/despesasCorrentes
  // logo à frente não tinha nenhum, e era o único write de um extrato feito
  // só de lançamentos comuns (o caso mais frequente). Um snapshot aqui, antes
  // de qualquer escrita, garante que a importação inteira tem pelo menos um
  // ponto de "desfazer" — mesmo com múltiplos writes internos.
  snapshotHistorico();

  const raiz = `users/${uid}/fin_v5`;
  const atualizacoes: Record<string, unknown> = {};

  // As recargas saem daqui para o domínio do veículo, por `criarCarga` — não
  // são despesa corrente. Preparadas todas ANTES de escrever seja o que for:
  // se uma estiver incompleta, nada é gravado, em vez de metade do extrato
  // entrar e a outra metade rebentar a meio.
  const cargas: Omit<CargaEletrica, "id">[] = [];
  const transferencias: Omit<Transferencia, "id">[] = [];
  const pagamentos: NonNullable<ReturnType<typeof pagamentoDaLinha>>[] = [];
  for (const linha of linhas) {
    if (linha.acao !== "import") continue;
    if (linha.destino === "carga") {
      const dados = dadosDaCarga(linha);
      if (!dados) throw new Error(`Recarga sem local: ${linha.descricao}`);
      cargas.push(dados);
    } else if (linha.destino === "transferencia_cartao") {
      const dados = dadosDaTransferencia(linha);
      if (!dados) throw new Error(`Transferência sem cartão ou sem conta: ${linha.descricao}`);
      transferencias.push(dados);
    } else if (linha.destino === "pagamento_fatura") {
      const dados = pagamentoDaLinha(linha);
      if (!dados || !contextoFaturas)
        throw new Error(`Pagamento de fatura sem cartão ou sem conta: ${linha.descricao}`);
      pagamentos.push(dados);
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
        conta: linha.contaEscolhida || undefined,
        nota: linha.notaEscolhida || undefined,
      };
      atualizacoes[`receitas/${id}`] = semIndefinidos(receita);
    } else {
      // Despesa é o outro lado do interruptor — e é onde caem também fatura e
      // transferência, que viram despesa corrente com a categoria escolhida:
      // evita atribuir automaticamente a um cartão/fatura específico sem
      // confirmação do usuário (ver nota em types/importacao.ts). A conta/
      // cartão em si já é escolha do usuário — `contaEscolhida` começa vazia,
      // nunca é palpite.
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
        contaCartao: linha.contaEscolhida || undefined,
        nota: linha.notaEscolhida || undefined,
      };
      atualizacoes[`despesasCorrentes/${id}`] = semIndefinidos(despesa);
    }
  }

  if (Object.keys(atualizacoes).length > 0) await update(ref(db, raiz), atualizacoes);
  for (const dados of cargas) await criarCarga(uid, dados);
  for (const dados of transferencias) await criarTransferencia(uid, dados);
  // Pagamento de fatura vai pelo MESMO caminho do pagamento feito à mão na aba
  // Cartões: cria o lançamento com origem "fat" (fora dos totais de despesa —
  // a compra já contou quando aconteceu), acrescenta o pagamento à fatura do
  // mês e, se quitar, fecha as parcelas em débito automático do ciclo. Nada
  // disso é reescrito aqui.
  for (const p of pagamentos) {
    const ctx = contextoFaturas!;
    await pagarFatura(uid, {
      cartao: p.cartao,
      mes: p.mes,
      valor: p.valor,
      de: p.de,
      data: p.data,
      pagamentosAtuais: pagamentosDaFatura(ctx.faturasPagas?.[p.cartao]?.[p.mes]),
      devido: calcularFaturaAutomatica(
        p.cartao,
        p.mes,
        ctx.dados,
        ctx.diaFechamentoFatura?.[p.cartao],
      ),
      parcelas: ctx.parcelas,
    });
  }
  return (
    Object.keys(atualizacoes).length + cargas.length + transferencias.length + pagamentos.length
  );
}

/** Apaga os registos existentes que o usuário marcou na revisão de duplicatas.
 *
 *  Só corre para o que ELE marcou, uma linha de cada vez — a pontuação de
 *  duplicata é palpite, e apagar sozinho um lançamento verdadeiro seria pior
 *  do que ficar com um repetido.
 *
 *  Despesa fixa é o caso à parte: apagá-la deitaria fora a recorrência toda.
 *  Ali desmarca-se o mês que bateu, que é o que corresponde ao dinheiro
 *  repetido.
 *
 *  A mesma chave nunca é apagada duas vezes: uma transferência aparece na
 *  lista de comparação com os dois sinais, e o mesmo registo pode bater em
 *  mais do que uma linha. */
export async function apagarExistentes(
  uid: string,
  existentes: ExistenteParaDedup[],
  despesasFixas: DespesaFixa[],
) {
  const feitos = new Set<string>();
  for (const ex of existentes) {
    const chave = `${ex.origem}:${ex.id}:${ex.mes ?? ""}`;
    if (feitos.has(chave)) continue;
    feitos.add(chave);
    switch (ex.origem) {
      case "receita":
        await removerReceita(uid, ex.id);
        break;
      case "despesa":
        await removerDespesa(uid, ex.id);
        break;
      case "carga":
        await removerCarga(uid, ex.id);
        break;
      case "despesaVeiculo":
        await removerDespesaVeiculo(uid, ex.id);
        break;
      case "transferencia":
        await removerTransferencia(uid, ex.id);
        break;
      case "despesaFixa": {
        const fixa = despesasFixas.find((f) => f.id === ex.id);
        if (!fixa || !ex.mes) break;
        await atualizarDespesaFixa(uid, {
          ...fixa,
          pagoPorMes: { ...fixa.pagoPorMes, [ex.mes]: false },
        });
        break;
      }
    }
  }
}

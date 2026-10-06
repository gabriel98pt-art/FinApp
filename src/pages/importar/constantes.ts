import { Check, CircleAlert, Dot, TriangleAlert, type LucideIcon } from "lucide-react";
import { formatMoney } from "../../utils/money";
import { somarMeses } from "../../utils/calculos";
import type {
  Confianca,
  Currency,
  DecisaoLinha,
  DestinoLinha,
  ExistenteParaDedup,
  LinhaAnalisada,
  OrigemExistente,
} from "../../types";
import styles from "../Importar.module.css";

export const ROTULO_DECISAO: Record<DecisaoLinha, string> = {
  auto_classificada: "Auto-classificada",
  nova: "Nova",
  duplicata_provavel: "Provável duplicata",
  revisao: "Revisão",
};

/** Forma de cada decisão — usada no filtro e no selo da linha, a mesma nos
 *  dois sítios. Existe para a decisão não se ler só pela cor (WCAG 1.4.1):
 *  ✓ entra sem mexer, · é nova, ⚠ já parece existir, ! pede um olhar. */
export const ICONE_DECISAO: Record<DecisaoLinha, LucideIcon> = {
  auto_classificada: Check,
  nova: Dot,
  duplicata_provavel: TriangleAlert,
  revisao: CircleAlert,
};

/** A confiança do reconhecimento, por extenso — o selo mostra-a em cor, e
 *  isto é o que o leitor de tela lê no lugar dela. */
export const ROTULO_CONFIANCA: Record<Confianca, string> = {
  high: "confiança alta",
  medium: "confiança média",
  low: "confiança baixa",
};

/** Onde um registo já existente mora, em português — usado no "ver detalhes"
 *  de um possível cruzamento (duplicata ou outra ponta de transferência). */
export const ROTULO_ORIGEM: Record<OrigemExistente, string> = {
  receita: "Receitas",
  despesa: "Despesas",
  carga: "Veículo — carga elétrica",
  despesaVeiculo: "Veículo — despesa",
  transferencia: "Transferências",
  despesaFixa: "Despesas fixas",
};

/** Tipo do registo de cada linha na revisão. "Lançamento simples" é o que
 *  sempre houve (receita ou despesa); os outros dois gravam noutros domínios.
 *
 *  A recarga só existe do lado das saídas — não se recarrega o carro a receber
 *  dinheiro. A transferência interna existe dos dois lados: a mesma passagem de
 *  dinheiro aparece a sair no extrato de uma conta e a entrar no da outra. */
export const DESTINOS_SAIDA: DestinoLinha[] = [
  "lancamento",
  "carga",
  "transferencia_cartao",
  "pagamento_fatura",
];
export const DESTINOS_ENTRADA: DestinoLinha[] = ["lancamento", "transferencia_cartao"];

/** A transferência tem o mesmo nome dos dois lados: a direção já se lê no sinal
 *  e na cor do valor, ao lado, e não precisa de ser repetida aqui. */
export function rotuloDestino(destino: DestinoLinha): string {
  if (destino === "lancamento") return "Lançamento simples";
  if (destino === "carga") return "Recarga elétrica";
  if (destino === "pagamento_fatura") return "Fatura paga";
  return "Transferência interna";
}

/** Receita ou despesa, à mão. O automático acerta quase sempre, mas quando
 *  erra o lado — um estorno do supermercado que bate numa regra de despesa —
 *  a revisão é a última oportunidade de corrigir: depois de gravado, o tipo
 *  não se muda (são coleções separadas). */
export const TIPOS: LinhaAnalisada["tipoEscolhido"][] = ["despesa", "receita"];
export const ROTULO_TIPO: Record<LinhaAnalisada["tipoEscolhido"], string> = {
  despesa: "Despesa",
  receita: "Receita",
};

export type FiltroImportacao = DecisaoLinha | "todas";

export const FILTROS: { id: FiltroImportacao; rotulo: string }[] = [
  { id: "todas", rotulo: "Todas" },
  { id: "auto_classificada", rotulo: "Auto-classificadas" },
  { id: "nova", rotulo: "Novas" },
  { id: "duplicata_provavel", rotulo: "Prováveis duplicatas" },
  { id: "revisao", rotulo: "Revisão" },
];

/** Meses possíveis para a fatura paga nesta linha: o mês da linha, dois antes
 *  e um depois. Cobre o pagamento adiantado e o atrasado sem obrigar a
 *  escrever uma data. */
export function mesesDaFatura(data: string): string[] {
  const base = data.slice(0, 7);
  return [-2, -1, 0, 1].map((n) => somarMeses(base, n));
}

/** Descrição legível de um lançamento já existente, pro aviso de duplicata.
 *  A carga elétrica não guarda um texto de descrição — só o local do posto
 *  (ver `construirExistentes`) —, e mostrar isso sozinho ("Ionity A1") não diz
 *  a quem lê que é uma carga nem quanto custou. Os outros domínios já guardam
 *  descrição legível, por isso ficam como estão. */
export function descricaoExistente(ex: ExistenteParaDedup, currency: Currency): string {
  if (ex.origem === "carga") {
    return `Carga elétrica em ${ex.descricao} no valor de ${formatMoney(Math.abs(ex.valor), currency)}`;
  }
  return ex.descricao;
}

/** Cor do selo da linha: segue a decisão, a mesma coisa que o texto do selo
 *  diz. Auto-classificada é positivo, nova é neutro, e as duas que pedem um
 *  olhar (provável duplicata e revisão) ficam no tom de alerta. */
export function corDecisao(d: DecisaoLinha): string {
  if (d === "auto_classificada") return styles.decisaoAuto;
  if (d === "nova") return styles.decisaoNova;
  return styles.decisaoAlerta;
}

import {
  dadosDaCarga,
  dadosDaTransferencia,
  pagamentoDaLinha,
} from "../../services/importacaoService";
import type { LinhaAnalisada } from "../../types";

/** Que campo do editor da linha a pendência aponta — é nele que o erro
 *  aparece (borda + mensagem logo abaixo), e não numa mensagem solta. */
export type CampoPendente =
  | "conta"
  | "categoria"
  | "local"
  | "kwh"
  | "cartaoFatura"
  | "contaPagou"
  | "contaOrigem"
  | "contaDestino"
  | "outraPonta";

export interface Pendencia {
  campo: CampoPendente;
  /** Texto curto, para a segunda linha da lista compacta ("Falta conta"). */
  curta: string;
  /** Texto completo, por baixo do campo no editor. */
  mensagem: string;
  /** `true` trava a importação (vermelho); `false` é só aviso (amarelo). */
  bloqueia: boolean;
}

/** O que falta numa linha marcada para importar. Só apresentação: as
 *  pendências que BLOQUEIAM são exatamente as mesmas condições de
 *  `incompletas` em `useImportacao` (o teste de agrupamento confere isto
 *  linha a linha) — esta função só lhes dá nome e campo. Linha que fica de
 *  fora não tem pendência nenhuma: não vai ser gravada. */
export function pendenciasDaLinha(l: LinhaAnalisada, temContas: boolean): Pendencia[] {
  if (l.acao !== "import") return [];
  const p: Pendencia[] = [];
  if (l.destino === "carga") {
    if (dadosDaCarga(l) === null) {
      p.push({
        campo: "local",
        curta: "Falta local",
        mensagem: "Escolha o local desta recarga.",
        bloqueia: true,
      });
    } else if (!l.kwhCarga.trim()) {
      // Sem kWh a linha entra na mesma — só fica por completar. Aviso.
      p.push({
        campo: "kwh",
        curta: "Falta kWh",
        mensagem: "Sem kWh — entra assim e completa-se depois no Veículo.",
        bloqueia: false,
      });
    }
  } else if (l.destino === "transferencia_cartao") {
    if (dadosDaTransferencia(l) === null) {
      if (!l.contaOrigem.trim()) {
        p.push({
          campo: "contaOrigem",
          curta: "Falta origem",
          mensagem: "Escolha a conta ou cartão de onde veio.",
          bloqueia: true,
        });
      } else if (!l.contaDestino.trim()) {
        p.push({
          campo: "contaDestino",
          curta: "Falta conta que recebeu",
          mensagem: "Escolha a conta que recebeu.",
          bloqueia: true,
        });
      } else {
        p.push({
          campo: "contaDestino",
          curta: "Contas iguais",
          mensagem: "A conta que recebeu tem de ser diferente da de origem.",
          bloqueia: true,
        });
      }
    }
  } else if (l.destino === "pagamento_fatura") {
    if (pagamentoDaLinha(l) === null) {
      p.push(
        !l.fatCartaoEscolhido.trim()
          ? {
              campo: "cartaoFatura",
              curta: "Falta cartão",
              mensagem: "Escolha de que cartão é esta fatura.",
              bloqueia: true,
            }
          : {
              campo: "contaPagou",
              curta: "Falta conta",
              mensagem: "Escolha a conta que pagou.",
              bloqueia: true,
            },
      );
    }
  } else {
    if (temContas && !l.contaEscolhida.trim()) {
      p.push({
        campo: "conta",
        curta: "Falta conta",
        mensagem: "Escolha a conta ou cartão desta linha.",
        bloqueia: true,
      });
    }
    // Não trava: o serviço grava categoria vazia como "Outros", como sempre
    // gravou — o aviso só diz isso em voz alta antes de acontecer.
    if (!l.categoriaEscolhida.trim()) {
      p.push({
        campo: "categoria",
        curta: "Sem categoria",
        mensagem: "Sem categoria — se ficar assim, entra como “Outros”.",
        bloqueia: false,
      });
    }
  }
  // A outra ponta da mesma transferência já lançada do lado contrário: não
  // trava nada, mas pede um olhar antes de contar o dinheiro duas vezes.
  if (l.outraPonta?.correspondencia) {
    p.push({
      campo: "outraPonta",
      curta: "O outro lado pode já estar registado",
      mensagem: "",
      bloqueia: false,
    });
  }
  return p;
}

/** Estado de uma linha na revisão — os quatro segmentos do resumo do topo. */
export type StatusLinha = "atencao" | "duplicata" | "novo" | "pronto";

export function statusDaLinha(l: LinhaAnalisada, temContas: boolean): StatusLinha {
  if (pendenciasDaLinha(l, temContas).length > 0) return "atencao";
  // As mesmas duas decisões que mandam a linha para a folha de duplicatas
  // antes de gravar (ver `suspeitas` em useImportacao).
  if (l.decisao === "duplicata_provavel" || l.decisao === "revisao") return "duplicata";
  if (l.decisao === "nova") return "novo";
  return "pronto";
}

/** Os três grupos recolhíveis da lista, por esta ordem. "Novos" e "prontos"
 *  dividem o último: os dois entram sem pedir nada. */
export type GrupoLinha = "atencao" | "duplicatas" | "prontos";

export const GRUPOS: { id: GrupoLinha; rotulo: string; abertoPorPadrao: boolean }[] = [
  { id: "atencao", rotulo: "Atenção", abertoPorPadrao: true },
  { id: "duplicatas", rotulo: "Duplicatas", abertoPorPadrao: false },
  { id: "prontos", rotulo: "Prontos", abertoPorPadrao: false },
];

export function grupoDoStatus(s: StatusLinha): GrupoLinha {
  if (s === "atencao") return "atencao";
  if (s === "duplicata") return "duplicatas";
  return "prontos";
}

/** Segmentos do resumo do topo, que também filtram a lista. */
export const SEGMENTOS: { id: StatusLinha; rotulo: (n: number) => string }[] = [
  { id: "atencao", rotulo: () => "revisar" },
  { id: "duplicata", rotulo: (n) => (n === 1 ? "duplicata" : "duplicatas") },
  { id: "novo", rotulo: (n) => (n === 1 ? "novo" : "novos") },
  { id: "pronto", rotulo: (n) => (n === 1 ? "pronto" : "prontos") },
];

export function contarStatus(
  linhas: LinhaAnalisada[],
  temContas: boolean,
): Record<StatusLinha, number> {
  const c: Record<StatusLinha, number> = { atencao: 0, duplicata: 0, novo: 0, pronto: 0 };
  for (const l of linhas) c[statusDaLinha(l, temContas)]++;
  return c;
}

/** "1 lançamento" / "3 lançamentos". */
export function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

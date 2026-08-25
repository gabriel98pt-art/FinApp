// Ponte entre o modelo novo (instituições com métodos de pagamento) e os
// quatro campos antigos que o resto do app ainda lê
// (`contasCartoes`/`tipoCartao`/`diaVencimentoFatura`/`diaFechamentoFatura`).
//
// A ponte é de dois sentidos de propósito, e é `normalizarConfig` quem escolhe
// o sentido:
//   - conta JÁ migrada (tem `instituicoes` no RTDB): os quatro campos passam a
//     ser vistas derivadas daí, e não valores gravados à parte — assim uma
//     renomeação de instituição chega sozinha às ~25 telas que só leem os
//     campos antigos, sem cada uma delas mudar;
//   - conta AINDA no formato antigo: sintetiza-se `instituicoes` em memória, um
//     método por conta/cartão, para que quem já lê `cfg.instituicoes` funcione
//     antes de existir migração gravada nenhuma.
//
// Tudo aqui é puro e em memória: nada nesta etapa grava a migração no RTDB.
//
// Porque é que o RTDB guarda mapas indexados por id em vez de arrays: um array
// obriga a reler e regravar a lista inteira para mexer num método só, o que põe
// duas abas da mesma conta a escrever por cima uma da outra. Com mapas, mudar o
// dia de fecho de um cartão é um `update()` num caminho só.

import type {
  ConfigConta,
  Instituicao,
  InstituicaoBruta,
  MetodoPagamento,
  TipoCartao,
  TipoMetodo,
} from "../types";

/** Os quatro campos antigos, no formato em que vivem na `ConfigConta`. */
export type CamposLegados = Pick<
  ConfigConta,
  "contasCartoes" | "tipoCartao" | "diaVencimentoFatura" | "diaFechamentoFatura"
>;

const tipoMetodoDe = (tipo: TipoCartao | undefined): TipoMetodo =>
  tipo === "credit" ? "credito" : "debito";

const tipoCartaoDe = (tipo: TipoMetodo): TipoCartao => (tipo === "credito" ? "credit" : "debit");

/** Um dia de fatura só conta se for um dia de mês a sério (1-31). Vale para os
 *  dois sentidos: lixo gravado não vira uma vista derivada inválida, e um
 *  campo antigo com 0 (que é como as telas apagam o dia) não vira um método
 *  com `diaVencimentoFatura: 0`. */
const diaValido = (dia: unknown): dia is number =>
  typeof dia === "number" && Number.isInteger(dia) && dia >= 1 && dia <= 31;

/** Converte o mapa id→instituição do RTDB para a lista que o app usa.
 *
 *  A ordem é a de inserção das chaves, que é a mesma que a migração vai
 *  gravar — é ela que decide a ordem em que as contas aparecem nos seletores,
 *  por isso não se ordena nada aqui. */
export function instituicoesDoBruto(
  bruto: Record<string, InstituicaoBruta> | undefined,
): Instituicao[] {
  if (!bruto) return [];
  return Object.entries(bruto).map(([id, inst]) => ({
    id,
    // O RTDB omite strings vazias; sem nome gravado, o id serve de nome —
    // na migração 1:1 são o mesmo texto de qualquer forma.
    nome: inst?.nome ?? id,
    metodos: Object.entries(inst?.metodos ?? {}).map(([idMetodo, metodo]) => {
      const m: MetodoPagamento = { id: idMetodo, tipo: metodo?.tipo ?? "debito" };
      if (metodo?.nomeExibicao) m.nomeExibicao = metodo.nomeExibicao;
      if (diaValido(metodo?.diaFechamentoFatura))
        m.diaFechamentoFatura = metodo.diaFechamentoFatura;
      if (diaValido(metodo?.diaVencimentoFatura))
        m.diaVencimentoFatura = metodo.diaVencimentoFatura;
      return m;
    }),
  }));
}

/** Recalcula os quatro campos antigos a partir das instituições. Substitui por
 *  completo o que estivesse gravado neles: numa conta migrada, `instituicoes`
 *  é a única fonte de verdade, e um resto antigo esquecido no RTDB não pode
 *  ressuscitar uma conta já apagada. */
export function camposLegadosDe(instituicoes: Instituicao[]): CamposLegados {
  const contasCartoes: string[] = [];
  const tipoCartao: Record<string, TipoCartao> = {};
  const diaVencimentoFatura: Record<string, number> = {};
  const diaFechamentoFatura: Record<string, number> = {};

  for (const inst of instituicoes) {
    for (const metodo of inst.metodos) {
      contasCartoes.push(metodo.id);
      tipoCartao[metodo.id] = tipoCartaoDe(metodo.tipo);
      if (diaValido(metodo.diaVencimentoFatura)) {
        diaVencimentoFatura[metodo.id] = metodo.diaVencimentoFatura;
      }
      if (diaValido(metodo.diaFechamentoFatura)) {
        diaFechamentoFatura[metodo.id] = metodo.diaFechamentoFatura;
      }
    }
  }

  return { contasCartoes, tipoCartao, diaVencimentoFatura, diaFechamentoFatura };
}

/** Sintetiza `instituicoes` a partir do formato antigo: uma instituição com um
 *  único método por conta/cartão, e o id do método igual ao nome de hoje — que
 *  é exactamente o identificador que os lançamentos já guardam. É por isso que
 *  a migração não toca em transação nenhuma.
 *
 *  Percorre-se `contasCartoes` (um array) e não as chaves de `tipoCartao`, para
 *  que a ordem seja a mesma de sempre e não dependa da ordem de iteração de um
 *  objecto do RTDB. */
export function sintetizarInstituicoes(cfg: CamposLegados): Instituicao[] {
  return cfg.contasCartoes.map((nome) => {
    const metodo: MetodoPagamento = { id: nome, tipo: tipoMetodoDe(cfg.tipoCartao?.[nome]) };
    const fechamento = cfg.diaFechamentoFatura?.[nome];
    const vencimento = cfg.diaVencimentoFatura?.[nome];
    if (diaValido(fechamento)) metodo.diaFechamentoFatura = fechamento;
    if (diaValido(vencimento)) metodo.diaVencimentoFatura = vencimento;
    return { id: nome, nome, metodos: [metodo] };
  });
}

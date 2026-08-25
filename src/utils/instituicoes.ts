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
  MetodoPagamentoBruto,
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

// ---------------------------------------------------------------------------
// Resolver o nome que se MOSTRA (decisão 3 da Fase C)
// ---------------------------------------------------------------------------
//
// O que um lançamento guarda é o id do método, que nunca muda; o que a pessoa
// renomeia é o nome da instituição. Sem resolver, um lançamento de ontem
// continuaria a mostrar o nome de ontem para sempre. Por isso TODA a tela que
// mostra "de que conta/cartão é isto" passa por aqui — e os seletores também,
// porque as opções deles são os ids, não os nomes.

/** Onde é que um método vive: o método e a instituição a que pertence. */
export interface MetodoLocalizado {
  instituicao: Instituicao;
  metodo: MetodoPagamento;
}

/** Só a parte de `ConfigConta` que estas funções precisam — assim um teste (e
 *  uma função pura) não tem de montar uma config inteira. */
export type ComInstituicoes = Pick<ConfigConta, "instituicoes">;

/** Procura o método pelo id estável. `null` quando o id já não existe (a conta
 *  foi removida, por exemplo) — quem chama decide o que fazer com isso. */
export function localizarMetodo(cfg: ComInstituicoes, id: string): MetodoLocalizado | null {
  for (const instituicao of cfg.instituicoes ?? []) {
    const metodo = instituicao.metodos.find((m) => m.id === id);
    if (metodo) return { instituicao, metodo };
  }
  return null;
}

const ROTULO_TIPO: Record<TipoMetodo, string> = { debito: "Débito", credito: "Crédito" };

/** O nome que se mostra hoje para o método `id`.
 *
 *  Uma instituição com um método só (o caso de toda a conta migrada 1:1) diz
 *  simplesmente o nome da instituição — pôr "Banco X · Débito" onde antes se
 *  lia "Banco X" seria mudar a tela de toda a gente sem nada em troca. Com dois
 *  ou mais métodos, o tipo desempata.
 *
 *  Id desconhecido devolve o próprio id: um lançamento numa conta apagada
 *  continua a dizer o nome com que foi feito, em vez de ficar em branco. */
export function nomeAtualDoMetodo(cfg: ComInstituicoes, id: string): string {
  const achado = localizarMetodo(cfg, id);
  if (!achado) return id;
  const { instituicao, metodo } = achado;
  if (metodo.nomeExibicao) return metodo.nomeExibicao;
  if (instituicao.metodos.length <= 1) return instituicao.nome;
  return `${instituicao.nome} · ${ROTULO_TIPO[metodo.tipo]}`;
}

// ---------------------------------------------------------------------------
// Escrever (usado só pelo cfgService)
// ---------------------------------------------------------------------------

/** `Instituicao[]` → o mapa id→instituição no formato do RTDB. Campos ausentes
 *  ficam mesmo ausentes: o RTDB rejeita `undefined`. */
export function brutoDasInstituicoes(
  instituicoes: Instituicao[],
): Record<string, InstituicaoBruta> {
  const mapa: Record<string, InstituicaoBruta> = {};
  for (const inst of instituicoes) {
    const metodos: Record<string, MetodoPagamentoBruto> = {};
    for (const m of inst.metodos) {
      const bruto: MetodoPagamentoBruto = { tipo: m.tipo };
      if (m.nomeExibicao) bruto.nomeExibicao = m.nomeExibicao;
      if (diaValido(m.diaFechamentoFatura)) bruto.diaFechamentoFatura = m.diaFechamentoFatura;
      if (diaValido(m.diaVencimentoFatura)) bruto.diaVencimentoFatura = m.diaVencimentoFatura;
      metodos[m.id] = bruto;
    }
    mapa[inst.id] = { nome: inst.nome, metodos };
  }
  return mapa;
}

/** Todos os ids em uso (instituições e métodos). O id vira chave do RTDB e
 *  fica gravado nos lançamentos: dois iguais colavam duas contas diferentes. */
export function idsUsados(instituicoes: Instituicao[]): Set<string> {
  const ids = new Set<string>();
  for (const inst of instituicoes) {
    ids.add(inst.id);
    for (const m of inst.metodos) ids.add(m.id);
  }
  return ids;
}

/** Um id livre a partir do nome escolhido. O nome é o id na esmagadora maioria
 *  dos casos (é o que a migração 1:1 faz, e é o que mantém os ids legíveis se
 *  alguém for espreitar o RTDB); só quando esse texto já foi usado — por uma
 *  conta apagada, ou por uma que entretanto foi renomeada — é que se junta um
 *  número ao fim. */
export function idDisponivel(nome: string, usados: Set<string>): string {
  if (!usados.has(nome)) return nome;
  for (let n = 2; ; n++) {
    const tentativa = `${nome} ${n}`;
    if (!usados.has(tentativa)) return tentativa;
  }
}

/** Devolve a lista com um método trocado pelo resultado de `mudar`. A
 *  instituição que não tem o método fica exactamente como estava. */
export function comMetodoAtualizado(
  instituicoes: Instituicao[],
  id: string,
  mudar: (m: MetodoPagamento) => MetodoPagamento,
): Instituicao[] {
  return instituicoes.map((inst) =>
    inst.metodos.some((m) => m.id === id)
      ? { ...inst, metodos: inst.metodos.map((m) => (m.id === id ? mudar(m) : m)) }
      : inst,
  );
}

/** Devolve a lista sem o método `id` — e sem a instituição, se ela ficasse
 *  vazia. Uma instituição sem métodos não é escolhível em lado nenhum: ficaria
 *  só a ocupar espaço na tela de Cartões. */
export function semMetodo(instituicoes: Instituicao[], id: string): Instituicao[] {
  return instituicoes
    .map((inst) => ({ ...inst, metodos: inst.metodos.filter((m) => m.id !== id) }))
    .filter((inst) => inst.metodos.length > 0);
}

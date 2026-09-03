// Configuração da conta (antigo S.cfg) em users/{uid}/fin_v5/cfg.

import { onValue, ref, remove, set, update } from "firebase/database";
import { db } from "./firebase";
import { snapshotHistorico } from "../stores/historicoStore";
import {
  useDespesasFixasStore,
  useDespesasStore,
  useReceitasStore,
  useTransferenciasStore,
} from "../stores/lancamentosStore";
import { useParcelasStore } from "../stores/parcelasStore";
import { useVeiculoStore } from "../stores/veiculoStore";
import { semIndefinidos } from "./lancamentosService";
import type {
  Cents,
  ConfigConta,
  ConfigContaBruta,
  Instituicao,
  MetodoPagamento,
  PreferenciasCopiloto,
  TokenCorApp,
  YearMonth,
} from "../types";
import type { TipoCartao } from "../types";
import { CONFIG_PADRAO } from "../constants/configPadrao";
import {
  brutoDasInstituicoes,
  camposLegadosDe,
  comMetodoAtualizado,
  idDisponivel,
  idsUsados,
  instituicoesDoBruto,
  localizarMetodo,
  semMetodo,
  sintetizarInstituicoes,
} from "../utils/instituicoes";
import {
  patchRenomearCategoria,
  patchRenomearFonte,
  patchRenomearLocal,
  validarNomeNovo,
  type DadosRenomear,
  type ListaCategoria,
} from "../utils/renomear";

const caminho = (uid: string, sufixo = "") => `users/${uid}/fin_v5/cfg${sufixo}`;

/** O RTDB omite objetos/arrays vazios — repõe os defaults campo a campo, e de
 *  caminho põe `instituicoes` e os quatro campos antigos de conta/cartão a
 *  dizer a mesma coisa, venha a conta de que lado vier da migração:
 *
 *  - já tem `instituicoes` gravadas: converte o mapa id→instituição do RTDB
 *    para lista e RECALCULA `contasCartoes`/`tipoCartao`/`diaVencimentoFatura`/
 *    `diaFechamentoFatura` a partir dela (viraram vistas derivadas, não campos
 *    guardados à parte — ver `utils/instituicoes.ts`);
 *  - só tem o formato antigo: sintetiza `instituicoes` EM MEMÓRIA, uma por
 *    conta/cartão, e deixa os campos antigos como estão. Não se grava nada
 *    aqui: a migração fica para a primeira escrita real, e assim duas abas
 *    abertas ao mesmo tempo não têm o que disputar. */
export function normalizarConfig(bruto: ConfigContaBruta | null): ConfigConta {
  const { instituicoes: brutasInstituicoes, ...resto } = bruto ?? {};
  const cfg: ConfigConta = { ...CONFIG_PADRAO, ...resto };

  const instituicoes = instituicoesDoBruto(brutasInstituicoes);
  if (instituicoes.length === 0) {
    return {
      ...cfg,
      instituicoes: sintetizarInstituicoes(cfg),
      instituicoesGravadas: false,
    };
  }
  return { ...cfg, instituicoes, instituicoesGravadas: true, ...camposLegadosDe(instituicoes) };
}

export function observarConfig(
  uid: string,
  cb: (cfg: ConfigConta) => void,
  aoErro: (erro: Error) => void,
): () => void {
  return onValue(
    ref(db, caminho(uid)),
    (snap) => {
      cb(normalizarConfig(snap.val()));
    },
    aoErro,
  );
}

export async function atualizarConfig(uid: string, mudancas: Partial<ConfigConta>) {
  await update(ref(db, caminho(uid)), mudancas);
}

/** A mudança a fazer em `instituicoes`, no formato que o estado da conta pede.
 *
 *  Conta já migrada leva só o ramo que mudou. Conta ainda por migrar leva a
 *  árvore INTEIRA — gravar um ramo só faria a leitura seguinte dar a conta por
 *  migrada (`normalizarConfig`) e todas as outras contas/cartões desapareciam
 *  da lista. É esta a "migração preguiçosa": acontece na primeira escrita real,
 *  seja ela qual for, e nunca a meio. */
function patchInstituicoes(
  cfg: ConfigConta,
  depois: Instituicao[],
  cirurgico: Record<string, unknown>,
): Record<string, unknown> {
  return cfg.instituicoesGravadas ? cirurgico : { instituicoes: brutoDasInstituicoes(depois) };
}

const tipoMetodo = (tipo: TipoCartao) => (tipo === "credit" ? "credito" : "debito");

/** Adiciona uma conta/cartão: nasce como uma instituição com um método só.
 *
 *  Continua a escrever também os campos antigos (`contasCartoes`/`tipoCartao`),
 *  que são vistas derivadas na LEITURA mas ainda o que sobra se `instituicoes`
 *  ficar vazia (o RTDB não guarda objetos vazios). Mantê-los coerentes é o que
 *  impede uma conta apagada de ressuscitar. */
export async function adicionarCartao(
  uid: string,
  cfg: ConfigConta,
  nome: string,
  tipo: TipoCartao,
) {
  const limpo = validarNomeNovo(
    cfg.instituicoes.map((i) => i.nome),
    "",
    nome,
  );
  // O id é o nome de hoje sempre que esse texto ainda esteja livre — igual à
  // migração 1:1. Mas o nome pode repetir um id já usado (uma conta antiga
  // apagada, ou uma que foi renomeada e deixou o id para trás), e aí o id tem
  // de ser outro: são dois lançamentos diferentes a apontar para o mesmo sítio.
  const id = idDisponivel(limpo, idsUsados(cfg.instituicoes));
  const nova: Instituicao = { id, nome: limpo, metodos: [{ id, tipo: tipoMetodo(tipo) }] };
  snapshotHistorico();
  await update(ref(db, caminho(uid)), {
    contasCartoes: [...cfg.contasCartoes, id],
    [`tipoCartao/${id}`]: tipo,
    ...patchInstituicoes(cfg, [...cfg.instituicoes, nova], {
      [`instituicoes/${id}`]: brutoDasInstituicoes([nova])[id],
    }),
  });
}

/** Adiciona um método de pagamento a uma instituição já existente (Fase C2) —
 *  o cartão de crédito que falta ao lado da conta de débito do mesmo banco,
 *  em vez de obrigar a criar uma instituição nova para ele. Ao contrário de
 *  `adicionarCartao`, não pede nome: o método novo usa o nome da instituição,
 *  que `nomeAtualDoMetodo` já desambigua pelo tipo assim que há mais de um
 *  método na mesma instituição. Os dias de fatura (se for crédito) não entram
 *  aqui — ficam para os mesmos campos inline que já existem por cartão, igual
 *  a `adicionarCartao`, que também não os pede na criação. */
export async function adicionarMetodo(
  uid: string,
  cfg: ConfigConta,
  instituicaoId: string,
  tipo: TipoCartao,
) {
  const instituicao = cfg.instituicoes.find((i) => i.id === instituicaoId);
  if (!instituicao) throw new Error("Essa conta ou cartão já não existe.");
  const tipoNovo = tipoMetodo(tipo);
  const rotulo = tipoNovo === "credito" ? "Crédito" : "Débito";
  // Mesma regra de id de `adicionarCartao`: tenta o texto óbvio primeiro, e só
  // desvia com um número se ele já estiver em uso (outro método já removido,
  // por exemplo).
  const id = idDisponivel(`${instituicao.nome} · ${rotulo}`, idsUsados(cfg.instituicoes));
  const novoMetodo: MetodoPagamento = { id, tipo: tipoNovo };
  const depois = cfg.instituicoes.map((i) =>
    i.id === instituicaoId ? { ...i, metodos: [...(i.metodos ?? []), novoMetodo] } : i,
  );
  snapshotHistorico();
  await update(ref(db, caminho(uid)), {
    contasCartoes: [...cfg.contasCartoes, id],
    [`tipoCartao/${id}`]: tipo,
    ...patchInstituicoes(cfg, depois, {
      [`instituicoes/${instituicaoId}/metodos/${id}`]: { tipo: tipoNovo },
    }),
  });
}

/** Um dia de fatura só vale se for um dia de mês (1-31); o resto — 0, negativo,
 *  acima de 31, `null` — quer dizer "apaga o dia". */
const diaDeFatura = (dia: number | null) => (dia && dia >= 1 && dia <= 31 ? dia : null);

/** Grava um dos dois dias de fatura no método, e no campo antigo com o mesmo
 *  nome. Recebe a `cfg` (e não um par instituição/método) porque quem chama é
 *  a lista de chips de Cartões, que só tem em mãos o id da conta — pedir-lhe o
 *  id da instituição obrigava a arrastar mais um dado por três componentes
 *  para chegar ao mesmo sítio a que se chega aqui com uma procura. */
async function definirDiaFatura(
  uid: string,
  cfg: ConfigConta,
  metodoId: string,
  campo: "diaVencimentoFatura" | "diaFechamentoFatura",
  dia: number | null,
) {
  const valor = diaDeFatura(dia);
  const achado = localizarMetodo(cfg, metodoId);
  snapshotHistorico();
  await update(ref(db, caminho(uid)), {
    [`${campo}/${metodoId}`]: valor,
    ...(achado
      ? patchInstituicoes(
          cfg,
          comMetodoAtualizado(cfg.instituicoes, metodoId, (m) => {
            const novo = { ...m };
            if (valor === null) delete novo[campo];
            else novo[campo] = valor;
            return novo;
          }),
          {
            [`instituicoes/${achado.instituicao.id}/metodos/${metodoId}/${campo}`]: valor,
          },
        )
      : {}),
  });
}

/** Dia em que a fatura deste cartão vence. `null`/0 apaga o dia — nem todo o
 *  cartão precisa de ter um, e sem ele nada muda em relação a antes. */
export async function definirDiaVencimentoFatura(
  uid: string,
  cfg: ConfigConta,
  cartao: string,
  dia: number | null,
) {
  await definirDiaFatura(uid, cfg, cartao, "diaVencimentoFatura", dia);
}

/** Dia em que a fatura deste cartão FECHA. `null`/0 apaga o dia — sem ele, o
 *  ciclo é o mês civil inteiro (comportamento de sempre). */
export async function definirDiaFechamentoFatura(
  uid: string,
  cfg: ConfigConta,
  cartao: string,
  dia: number | null,
) {
  await definirDiaFatura(uid, cfg, cartao, "diaFechamentoFatura", dia);
}

/** Raiz da conta — a renomeação com cascata escreve cfg e lançamentos de uma
 *  vez, então o `update()` sobe um nível em relação ao `caminho()` acima. */
const raiz = (uid: string) => `users/${uid}/fin_v5`;

/** Lê das stores as coleções que a cascata precisa varrer. São as mesmas que
 *  as telas já usam (espelho do RTDB alimentado pelo syncService). */
function dadosDasStores(): DadosRenomear {
  const veiculo = useVeiculoStore.getState().dados;
  return {
    receitas: useReceitasStore.getState().itens,
    despesas: useDespesasStore.getState().itens,
    despesasFixas: useDespesasFixasStore.getState().itens,
    transferencias: useTransferenciasStore.getState().itens,
    parcelas: useParcelasStore.getState().itens,
    cargas: veiculo.cargas,
    despesasVeiculo: veiculo.despesas,
    fixasVeiculo: veiculo.despesasFixas,
  };
}

/** Renomeia a conta/cartão. É uma escrita só, num campo só: o nome da
 *  instituição.
 *
 *  Já foi uma cascata que reescrevia o nome em nove coleções de lançamento e
 *  seis mapas de cfg, porque o nome ERA o identificador. Agora o identificador
 *  é o id do método, que não muda nunca — os lançamentos, o saldo inicial e as
 *  faturas continuam a apontar para o mesmo sítio, e quem mostra o nome resolve-o
 *  na hora (`nomeAtualDoMetodo`). */
export async function renomearCartao(uid: string, cfg: ConfigConta, de: string, para: string) {
  const achado = localizarMetodo(cfg, de);
  if (!achado) throw new Error("Essa conta ou cartão já não existe.");
  const { instituicao } = achado;
  // Compara com os nomes das OUTRAS instituições: a própria já se chama assim,
  // e "já existe um item com esse nome" a apontar para ela mesma não ajudava.
  const nome = validarNomeNovo(
    cfg.instituicoes.filter((i) => i.id !== instituicao.id).map((i) => i.nome),
    instituicao.nome,
    para,
  );
  const depois = cfg.instituicoes.map((i) => (i.id === instituicao.id ? { ...i, nome } : i));
  snapshotHistorico();
  await update(
    ref(db, caminho(uid)),
    patchInstituicoes(cfg, depois, { [`instituicoes/${instituicao.id}/nome`]: nome }),
  );
}

/** Renomeia a categoria na lista indicada, no visual (ícone/cor), no orçamento
 *  e em todo lançamento categorizado com o nome antigo. */
export async function renomearCategoria(
  uid: string,
  cfg: ConfigConta,
  lista: ListaCategoria,
  de: string,
  para: string,
) {
  const nome = validarNomeNovo(cfg[lista], de, para);
  snapshotHistorico();
  await update(ref(db, raiz(uid)), patchRenomearCategoria(cfg, dadosDasStores(), lista, de, nome));
}

/** Renomeia a fonte de receita na lista, no visual e nas receitas. */
export async function renomearFonte(uid: string, cfg: ConfigConta, de: string, para: string) {
  const nome = validarNomeNovo(cfg.fontesReceita, de, para);
  snapshotHistorico();
  await update(ref(db, raiz(uid)), patchRenomearFonte(cfg, dadosDasStores(), de, nome));
}

/** Renomeia o local de carregamento na lista e nas cargas. */
export async function renomearLocal(uid: string, cfg: ConfigConta, de: string, para: string) {
  const nome = validarNomeNovo(cfg.locaisCarregamento, de, para);
  snapshotHistorico();
  await update(ref(db, raiz(uid)), patchRenomearLocal(cfg, dadosDasStores(), de, nome));
}

/** Remove a conta/cartão: sai a instituição inteira, porque hoje ela tem um
 *  método só (quando houver vários — Fase C2 — sai só o método escolhido, e é
 *  isso que `semMetodo` já faz). Lançamentos que já a usam continuam com o nome
 *  com que foram feitos — mesma regra de `removerItemLista`.
 *
 *  Os campos antigos são limpos na mesma escrita: se `instituicoes` ficar vazia
 *  (removeu-se a última), o RTDB não guarda o objeto vazio e a leitura seguinte
 *  volta a sintetizar a partir deles — a conta apagada ressuscitava.
 *
 *  `saldosIniciais`/`faturaManual`/`faturasPagas` também são chaveados pelo
 *  id da conta/cartão, mas viviam fora dessa limpeza — uma conta criada e
 *  removida deixava esses três órfãos pra sempre (achado ao investigar um
 *  relato de "Banco Teste QA" sobrando em `faturaManual` de uma conta real,
 *  03/09/2026). Sem perigo pra quem já tem órfãos: o `null` só tem efeito se
 *  a chave existir, e uma conta nova nunca reusa um id já usado. */
export async function removerCartao(uid: string, cfg: ConfigConta, nome: string) {
  const achado = localizarMetodo(cfg, nome);
  const cirurgico: Record<string, unknown> = achado
    ? achado.instituicao.metodos.length <= 1
      ? { [`instituicoes/${achado.instituicao.id}`]: null }
      : { [`instituicoes/${achado.instituicao.id}/metodos/${nome}`]: null }
    : {};
  snapshotHistorico();
  await update(ref(db, caminho(uid)), {
    contasCartoes: cfg.contasCartoes.filter((c) => c !== nome),
    [`tipoCartao/${nome}`]: null,
    [`diaVencimentoFatura/${nome}`]: null,
    [`diaFechamentoFatura/${nome}`]: null,
    [`saldosIniciais/${nome}`]: null,
    [`faturaManual/${nome}`]: null,
    [`faturasPagas/${nome}`]: null,
    ...patchInstituicoes(cfg, semMetodo(cfg.instituicoes, nome), cirurgico),
  });
}

type ListaDeCategorias =
  "categoriasDespesa" | "fontesReceita" | "locaisCarregamento" | "intermediadoresParcelamento";

/** Adiciona um item a uma das listas configuráveis (categorias de despesa,
 *  fontes de receita) — usadas no Registro Rápido, Cartões e Parcelas. */
export async function adicionarItemLista(
  uid: string,
  cfg: ConfigConta,
  lista: ListaDeCategorias,
  item: string,
) {
  const nome = item.trim();
  if (!nome) throw new Error("Nome vazio.");
  if (cfg[lista].includes(nome)) throw new Error("Já existe um item com esse nome.");
  snapshotHistorico();
  await update(ref(db, caminho(uid)), { [lista]: [...cfg[lista], nome] });
}

/** Remove um item de uma das listas configuráveis. Não apaga lançamentos
 *  que já usam essa categoria — eles continuam mostrando o nome antigo. */
export async function removerItemLista(
  uid: string,
  cfg: ConfigConta,
  lista: ListaDeCategorias,
  item: string,
) {
  snapshotHistorico();
  await update(ref(db, caminho(uid)), { [lista]: cfg[lista].filter((x) => x !== item) });
}

/** Ícone da categoria (item 19) — guarda o id do ícone do `lucide-react`
 *  (ex. "utensils"); `null` volta ao círculo sem ícone. */
export async function definirIconeCategoria(uid: string, categoria: string, icone: string | null) {
  snapshotHistorico();
  const r = ref(db, caminho(uid, `/categoriaIcone/${categoria}`));
  if (icone === null || icone === "") await remove(r);
  else await set(r, icone);
}

/** Cor da categoria (item 19) — `null` volta à cor automática do nome. */
export async function definirCorCategoria(uid: string, categoria: string, cor: string | null) {
  snapshotHistorico();
  const r = ref(db, caminho(uid, `/categoriaCor/${categoria}`));
  if (cor === null || cor === "") await remove(r);
  else await set(r, cor);
}

/** Cor central do app (destaque/positivo/negativo/alerta/roxo), por tema —
 *  `null` volta ao valor de `tokens.css`. Mesmo padrão de
 *  `definirCorCategoria`, mas num namespace à parte: estas cinco valem para o
 *  app inteiro, não para uma categoria. */
export async function definirCorApp(
  uid: string,
  tema: "dark" | "light",
  token: TokenCorApp,
  cor: string | null,
) {
  snapshotHistorico();
  const r = ref(db, caminho(uid, `/coresApp/${tema}/${token}`));
  if (cor === null || cor === "") await remove(r);
  else await set(r, cor);
}

/** Personalização do Copiloto — `null` apaga o nó inteiro.
 *
 *  É guardada num nó só, e não campo a campo, para que "desligar a
 *  personalização" seja um `remove` e não a limpeza de vários campos soltos:
 *  o nome de alguém não pode ficar para trás porque uma das escritas falhou. */
export async function definirPreferenciasCopiloto(uid: string, prefs: PreferenciasCopiloto | null) {
  snapshotHistorico();
  const r = ref(db, caminho(uid, "/copiloto"));
  if (prefs === null) await remove(r);
  else await set(r, semIndefinidos(prefs));
}

/** Teto de orçamento mensal por categoria (seção 4.8) — `null`/0 remove o teto. */
export async function definirOrcamento(uid: string, categoria: string, valor: Cents | null) {
  snapshotHistorico();
  const r = ref(db, caminho(uid, `/orcamentos/${categoria}`));
  if (valor === null || valor === 0) await remove(r);
  else await set(r, valor);
}

/** Total que se planeia gastar por mês, somando tudo — o guarda-chuva por
 *  cima dos tetos por categoria. `null`/0 remove, mesma regra de
 *  `definirOrcamento`: um total de 0 € seria um planeamento sempre estourado,
 *  e "não definido" é o que se quer dizer. */
export async function definirOrcamentoTotal(uid: string, valor: Cents | null) {
  snapshotHistorico();
  const r = ref(db, caminho(uid, "/orcamentoTotalMensal"));
  if (valor === null || valor === 0) await remove(r);
  else await set(r, valor);
}

/** Saldo inicial da conta/cartão de débito — a base de onde o saldo atual soma
 *  e subtrai os movimentos. 0 remove a chave: é o mesmo efeito, já é o valor
 *  assumido quando não há nada guardado. */
export async function definirSaldoInicial(uid: string, conta: string, valor: Cents) {
  snapshotHistorico();
  const r = ref(db, caminho(uid, `/saldosIniciais/${conta}`));
  if (valor === 0) await remove(r);
  else await set(r, valor);
}

/** Override manual da fatura (seção 4.1) — `null` volta ao cálculo automático. */
export async function definirFaturaManual(
  uid: string,
  cartao: string,
  mes: YearMonth,
  valor: Cents | null,
) {
  snapshotHistorico();
  const r = ref(db, caminho(uid, `/faturaManual/${cartao}/${mes}`));
  if (valor === null) await remove(r);
  else await set(r, valor);
}

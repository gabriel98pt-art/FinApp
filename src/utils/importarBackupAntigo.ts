// Migração única do backup do app antigo (financas.html/AppFinanceiro,
// schema fin_v4) — funções puras de mapeamento por domínio. Nenhuma delas
// toca Firebase; o serviço (services/importarBackupAntigoService.ts) grava o
// resultado.
//
// Baseado na inspeção direta de um export real (não só na spec) — 3 achados
// que corrigem a descrição original do domínio:
//  1. df.paidMonths: algumas fixas antigas já têm um mapa {AAAA-MM: bool}
//     idêntico ao pagoPorMes novo (não só o `paid` booleano único). Usado
//     quando presente; o fallback via `paid` só serve pras fixas que nunca
//     tiveram esse mapa.
//  2. dc com `_src:'veh'` E `_vid` preenchido são o ESPELHO de um registro de
//     veh.cg/veh.lp que a lista geral do app antigo também mostrava — têm
//     domínio próprio (mapearCargasVeiculo/mapearDespesasVeiculo); importar
//     aqui TAMBÉM duplicaria o gasto (despesasCorrentes e veículo se somam,
//     não há dedup). Os 3 registros com `_src:'veh'` mas SEM `_vid` (sem
//     contraparte real em veh.cg) são despesas de verdade — importados como
//     despesa comum, sem origem.
//  3. tvde.cfg.metaHoras/metaHora existem no export real, mas ConfigTvde não
//     tem campo equivalente — não migrados (não dá pra inventar um destino).

import type {
  BackupFinV4,
  CargaEletrica,
  CargaVeiculoAntiga,
  Cents,
  ConfigConta,
  ConfigTvde,
  Currency,
  DespesaCorrente,
  DespesaCorrenteAntiga,
  DespesaFixa,
  DespesaFixaAntiga,
  DespesaTvde,
  DespesaTvdeAntiga,
  DespesaVeiculo,
  DespesaVeiculoAntiga,
  EventoAntigo,
  EventoCalendario,
  FundoAntigo,
  Fundo,
  Id,
  KmVeiculoAntiga,
  LancamentoTvdeAntigo,
  Parcela,
  ParcelaAntiga,
  PagamentosFatura,
  Receita,
  ReceitaAntiga,
  RegistroKm,
  SemanaTvde,
  SemanaTvdeAntiga,
  Theme,
  TipoCartao,
  TransferenciaAntiga,
  Transferencia,
  CfgAntiga,
  CfgTvdeAntigo,
  YearMonth,
} from "../types";
import { mesDe } from "./calculos";
import { pagamentosDaFatura } from "./fatura";
import { toCents } from "./money";

/** Primeiro valor não-vazio da lista, ou "" se nenhum estiver preenchido. */
function primeiroPreenchido(...valores: (string | undefined | null)[]): string {
  for (const v of valores) {
    if (v && v.trim() !== "") return v.trim();
  }
  return "";
}

/** "" do formulário antigo → undefined (mesma convenção do app novo pra
 *  campos opcionais tipo contaCartao). */
function semVazio(s: string | undefined | null): string | undefined {
  return s && s.trim() !== "" ? s : undefined;
}

export function validarSchemaFinV4(bruto: unknown): bruto is BackupFinV4 {
  return (
    !!bruto && typeof bruto === "object" && (bruto as { _schema?: unknown })._schema === "fin_v4"
  );
}

// ---- Receitas ----
export function mapearReceitas(rec: ReceitaAntiga[]): Record<string, Omit<Receita, "id">> {
  const resultado: Record<string, Omit<Receita, "id">> = {};
  for (const r of rec) {
    resultado[String(r.id)] = {
      descricao: primeiroPreenchido(r.notes, r.src) || "Receita",
      valor: toCents(r.val),
      data: r.date,
      fonte: r.src,
      conta: semVazio(r.card),
    };
  }
  return resultado;
}

// ---- Despesas fixas (domínio geral e, com o mesmo mapeamento, veh.df) ----
export function mapearDespesasFixas(
  df: DespesaFixaAntiga[],
  mesReferencia: YearMonth,
): Record<string, Omit<DespesaFixa, "id">> {
  const resultado: Record<string, Omit<DespesaFixa, "id">> = {};
  for (const f of df) {
    const pagoPorMes: Record<string, boolean> =
      f.paidMonths && Object.keys(f.paidMonths).length > 0
        ? { ...f.paidMonths }
        : f.paid
          ? { [mesReferencia]: true }
          : {};
    resultado[String(f.id)] = {
      descricao: f.name,
      valor: toCents(f.val),
      categoria: f.cat,
      contaCartao: semVazio(f.card),
      inicio: semVazio(f.activeFrom) as YearMonth | undefined,
      pagoPorMes,
    };
  }
  return resultado;
}

// ---- Despesas correntes ----
export function mapearDespesasCorrentes(
  dc: DespesaCorrenteAntiga[],
): Record<string, Omit<DespesaCorrente, "id">> {
  const resultado: Record<string, Omit<DespesaCorrente, "id">> = {};
  for (const d of dc) {
    // Achado 2: mirror de veh.cg/veh.lp — já entra pelo domínio do veículo.
    if (d._src === "veh" && d._vid != null) continue;
    const origem = d._src === "parc" || d._src === "fat" || d._src === "recon" ? d._src : undefined;
    resultado[String(d.id)] = {
      descricao: primeiroPreenchido(d.name, d.notes, d.cat) || "Despesa",
      valor: toCents(d.val),
      data: d.date,
      categoria: d.cat,
      contaCartao: semVazio(d.card),
      nota: semVazio(d.notes),
      origem,
      parcelaId: d._pid != null ? String(d._pid) : undefined,
      parcelaMes: semVazio(d._pm) as YearMonth | undefined,
      fatCartao: semVazio(d._fatCard),
      fatMes: semVazio(d._fatYm) as YearMonth | undefined,
    };
  }
  return resultado;
}

// ---- Parcelas ----
export function mapearParcelas(par: ParcelaAntiga[]): Record<string, Omit<Parcela, "id">> {
  const resultado: Record<string, Omit<Parcela, "id">> = {};
  for (const p of par) {
    const valorParcela = toCents(p.vp);
    const total = p.total != null ? toCents(p.total) : valorParcela * p.num;
    resultado[String(p.id)] = {
      descricao: p.name,
      total,
      numParcelas: p.num,
      primeiroMes: mesDe(p.fd),
      categoria: semVazio(p.cat),
      cartao: semVazio(p.card),
      autoDebit: p.autoDebit ?? false,
      pagoPorMes: { ...(p.py ?? {}) },
    };
  }
  return resultado;
}

// ---- Transferências ----
export function mapearTransferencias(
  trf: TransferenciaAntiga[],
): Record<string, Omit<Transferencia, "id">> {
  const resultado: Record<string, Omit<Transferencia, "id">> = {};
  for (const t of trf) {
    resultado[String(t.id)] = {
      data: t.date,
      de: t.from,
      para: t.to,
      valor: toCents(t.val),
      descricao: semVazio(t.notes),
    };
  }
  return resultado;
}

// ---- Veículo: carregamentos ----
export function mapearCargasVeiculo(
  cg: CargaVeiculoAntiga[],
): Record<string, Omit<CargaEletrica, "id">> {
  const resultado: Record<string, Omit<CargaEletrica, "id">> = {};
  for (const c of cg) {
    const custo = toCents(c.val);
    const kwh = c.kwh ?? 0;
    // `preco` (€/kWh) só existe nalgumas entradas; nas outras deriva de
    // custo/kwh — mesma fórmula do modo "custo total" do formulário novo.
    const precoKwh = c.preco != null ? toCents(c.preco) : kwh > 0 ? Math.round(custo / kwh) : 0;
    resultado[String(c.id)] = {
      data: c.date,
      kwh,
      precoKwh,
      custo,
      local: c.local ?? "",
      sessao: semVazio(c.notes),
    };
  }
  return resultado;
}

// ---- Veículo: quilometragem ----
export function mapearQuilometragem(km: KmVeiculoAntiga[]): Record<string, Omit<RegistroKm, "id">> {
  const resultado: Record<string, Omit<RegistroKm, "id">> = {};
  for (const k of km) {
    // Sem data direta no export antigo — deriva do fim da semana registrada.
    resultado[String(k.id)] = {
      data: k.weekTo ?? k.weekFrom ?? "",
      km: k.km,
      nota: semVazio(k.notes),
    };
  }
  return resultado;
}

// ---- Veículo: despesas variáveis (antigo veh.lp — não são "locais") ----
export function mapearDespesasVeiculo(
  lp: DespesaVeiculoAntiga[],
): Record<string, Omit<DespesaVeiculo, "id">> {
  const resultado: Record<string, Omit<DespesaVeiculo, "id">> = {};
  for (const d of lp) {
    resultado[String(d.id)] = {
      data: d.date,
      valor: toCents(d.val),
      categoria: d.tipo || "Outros",
      nota: semVazio(d.notes),
    };
  }
  return resultado;
}

// ---- Eventos / Fundos (vazios no export real, mapeados por consistência) ----
export function mapearEventos(evt: EventoAntigo[]): Record<string, Omit<EventoCalendario, "id">> {
  const resultado: Record<string, Omit<EventoCalendario, "id">> = {};
  for (const e of evt) {
    resultado[String(e.id)] = {
      titulo: primeiroPreenchido(e.title, e.name) || "Evento",
      data: e.date,
      descricao: semVazio(e.notes),
      valor: e.val != null ? toCents(e.val) : undefined,
    };
  }
  return resultado;
}

export function mapearFundos(fnds: FundoAntigo[]): Record<string, Omit<Fundo, "id">> {
  const resultado: Record<string, Omit<Fundo, "id">> = {};
  for (const f of fnds) {
    resultado[String(f.id)] = {
      nome: primeiroPreenchido(f.name, f.nome) || "Fundo",
      alvo: toCents(f.alvo ?? f.target ?? 0),
      atual: toCents(f.atual ?? f.current ?? 0),
      prazo: semVazio(f.prazo ?? f.deadline) as Fundo["prazo"],
    };
  }
  return resultado;
}

// ---- TVDE ----
export function mapearSemanasTvde(
  weeks: Record<string, SemanaTvdeAntiga>,
): Record<string, SemanaTvde> {
  const resultado: Record<string, SemanaTvde> = {};
  for (const [n, s] of Object.entries(weeks)) {
    resultado[n] = {
      fat: toCents(s.fat ?? 0),
      port: toCents(s.port ?? 0),
      alu: toCents(s.alu ?? 0),
      recF: toCents(s.recF ?? 0),
      extra: toCents(s.extra ?? 0),
      gorj: toCents(s.gorj ?? 0),
      recP: toCents(s.recP ?? 0),
      horas: s.horas ?? 0,
      viag: s.viag ?? 0,
      pct: s.pct ?? 0,
    };
  }
  return resultado;
}

const MESES_PT_COMPLETOS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** "Março 2026" → "2026-03". `null` se não reconhecer o formato — melhor
 *  perder 1 mês de Seg. Social do que gravar num mês errado. */
export function parseMesAnoPt(chave: string): YearMonth | null {
  const partes = chave.trim().split(/\s+/);
  if (partes.length < 2) return null;
  const ano = partes[partes.length - 1];
  const nomeMes = partes.slice(0, -1).join(" ").toLowerCase();
  if (!/^\d{4}$/.test(ano)) return null;
  const idx = MESES_PT_COMPLETOS.indexOf(nomeMes);
  if (idx === -1) return null;
  return `${ano}-${String(idx + 1).padStart(2, "0")}`;
}

/** Só segM (por MÊS DE PAGAMENTO) migra — tvde.seg (por período) é formato
 *  legado já superado pela própria migração do app antigo (achado 3 do
 *  header: `migSegMes:true` na cfg confirma que a origem já resolveu isso;
 *  importar os dois causaria conflito/duplicação). */
export function mapearSegPorMesTvde(segM: Record<string, number>): Record<string, Cents> {
  const resultado: Record<string, Cents> = {};
  for (const [chave, valor] of Object.entries(segM)) {
    const ym = parseMesAnoPt(chave);
    if (ym) resultado[ym] = toCents(valor);
  }
  return resultado;
}

/** Só migra a marcação "semana N já lançada" quando a receita referenciada
 *  (`rid`) realmente existe entre as receitas importadas — nunca recria a
 *  receita a partir do lançamento do TVDE. */
export function mapearLancamentosTvde(
  lanc: Record<string, LancamentoTvdeAntigo>,
  idsReceitasValidas: ReadonlySet<string>,
): Record<string, Id> {
  const resultado: Record<string, Id> = {};
  for (const [semana, l] of Object.entries(lanc)) {
    if (l.rid == null) continue;
    const rid = String(l.rid);
    if (!idsReceitasValidas.has(rid)) continue;
    resultado[semana.replace(/^w/, "")] = rid;
  }
  return resultado;
}

export function mapearDespesasTvde(
  desp: DespesaTvdeAntiga[],
): Record<string, Omit<DespesaTvde, "id">> {
  const resultado: Record<string, Omit<DespesaTvde, "id">> = {};
  for (const d of desp) {
    resultado[String(d.id)] = {
      data: d.date ?? "",
      descricao: d.name || "Despesa TVDE",
      valor: toCents(d.val ?? 0),
    };
  }
  return resultado;
}

/** Achado 3: metaHoras/metaHora existem na cfg antiga mas não em
 *  ConfigTvde — de propósito NÃO incluídos aqui. */
export function mapearCfgTvde(cfg: CfgTvdeAntigo | undefined): Partial<ConfigTvde> {
  if (!cfg) return {};
  const resultado: Partial<ConfigTvde> = {};
  if (cfg.pctFrota != null) resultado.pctFrota = cfg.pctFrota;
  if (cfg.aluguel != null) resultado.aluguel = toCents(cfg.aluguel);
  if (cfg.metaSem != null) resultado.metaSem = toCents(cfg.metaSem);
  if (cfg.metaMes != null) resultado.metaMes = toCents(cfg.metaMes);
  return resultado;
}

// ---- Config geral da conta ----
const MOEDAS_VALIDAS: Currency[] = ["EUR", "BRL", "USD", "GBP"];
const TEMAS_VALIDOS: Theme[] = ["dark", "light"];

export function mapearCfg(cfg: CfgAntiga | undefined): Partial<ConfigConta> {
  if (!cfg) return {};
  const resultado: Partial<ConfigConta> = {};
  if (cfg.currency && (MOEDAS_VALIDAS as string[]).includes(cfg.currency))
    resultado.currency = cfg.currency as Currency;
  if (cfg.theme && (TEMAS_VALIDOS as string[]).includes(cfg.theme))
    resultado.theme = cfg.theme as Theme;
  if (cfg.showTvde != null) resultado.showTvde = cfg.showTvde;
  if (cfg.src) resultado.fontesReceita = cfg.src;
  if (cfg.fcat) resultado.categoriasFixas = cfg.fcat;
  if (cfg.ccat) resultado.categoriasCorrentes = cfg.ccat;
  if (cfg.vcat) resultado.categoriasVeiculo = cfg.vcat;
  if (cfg.pay) resultado.contasCartoes = cfg.pay;
  if (cfg.cardType) {
    const tipoCartao: Record<string, TipoCartao> = {};
    for (const [nome, tipo] of Object.entries(cfg.cardType)) {
      tipoCartao[nome] = tipo === "credit" ? "credit" : "debit";
    }
    resultado.tipoCartao = tipoCartao;
  }
  if (cfg.sgoal != null) resultado.metaPoupanca = toCents(cfg.sgoal);
  if (cfg.bud) {
    const orcamentos: Record<string, Cents> = {};
    for (const [cat, valor] of Object.entries(cfg.bud)) {
      if (valor > 0) orcamentos[cat] = toCents(valor);
    }
    resultado.orcamentos = orcamentos;
  }
  if (cfg.bal) {
    const saldosIniciais: Record<string, Cents> = {};
    for (const [conta, valor] of Object.entries(cfg.bal)) saldosIniciais[conta] = toCents(valor);
    resultado.saldosIniciais = saldosIniciais;
  }
  if (cfg.locais) {
    resultado.locaisCarregamento = cfg.locais
      .map((l) => l.nome)
      .filter((n): n is string => !!n && n.trim() !== "");
  }
  if (cfg.fatManual) {
    const faturaManual: Record<string, Record<string, Cents>> = {};
    for (const [cartao, porMes] of Object.entries(cfg.fatManual)) {
      faturaManual[cartao] = {};
      for (const [mes, valor] of Object.entries(porMes)) faturaManual[cartao][mes] = toCents(valor);
    }
    resultado.faturaManual = faturaManual;
  }
  if (cfg.fatPaid) {
    const faturasPagas: Record<string, Record<string, PagamentosFatura>> = {};
    for (const [cartao, porMes] of Object.entries(cfg.fatPaid)) {
      faturasPagas[cartao] = {};
      for (const [mes, entrada] of Object.entries(porMes)) {
        faturasPagas[cartao][mes] = { pagamentos: pagamentosDaFatura(entrada) };
      }
    }
    resultado.faturasPagas = faturasPagas;
  }
  return resultado;
}

// ---- Orquestração (ainda pura: só combina os mapeadores acima) ----
export interface DominiosMapeados {
  receitas: Record<string, Omit<Receita, "id">>;
  despesasFixas: Record<string, Omit<DespesaFixa, "id">>;
  despesasCorrentes: Record<string, Omit<DespesaCorrente, "id">>;
  parcelas: Record<string, Omit<Parcela, "id">>;
  transferencias: Record<string, Omit<Transferencia, "id">>;
  eventos: Record<string, Omit<EventoCalendario, "id">>;
  fundos: Record<string, Omit<Fundo, "id">>;
  veiculoCargas: Record<string, Omit<CargaEletrica, "id">>;
  veiculoQuilometragem: Record<string, Omit<RegistroKm, "id">>;
  veiculoDespesas: Record<string, Omit<DespesaVeiculo, "id">>;
  veiculoDespesasFixas: Record<string, Omit<DespesaFixa, "id">>;
  tvdeSemanas: Record<string, SemanaTvde>;
  tvdeSegPorMes: Record<string, Cents>;
  tvdeLancamentos: Record<string, Id>;
  tvdeDespesas: Record<string, Omit<DespesaTvde, "id">>;
  tvdeCfg: Partial<ConfigTvde>;
  cfg: Partial<ConfigConta>;
}

/** Ponto único de entrada: aplica todos os mapeadores acima ao backup
 *  validado. `mesFallback` só é usado se o arquivo não tiver `_exportedAt`
 *  (nunca deveria acontecer num export real, mas mantém a função total). */
export function mapearBackupCompleto(bruto: BackupFinV4, mesFallback: YearMonth): DominiosMapeados {
  const mesReferencia = bruto._exportedAt ? mesDe(bruto._exportedAt.slice(0, 10)) : mesFallback;
  const receitas = mapearReceitas(bruto.rec ?? []);
  const idsReceitasValidas = new Set(Object.keys(receitas));
  return {
    receitas,
    despesasFixas: mapearDespesasFixas(bruto.df ?? [], mesReferencia),
    despesasCorrentes: mapearDespesasCorrentes(bruto.dc ?? []),
    parcelas: mapearParcelas(bruto.par ?? []),
    transferencias: mapearTransferencias(bruto.trf ?? []),
    eventos: mapearEventos(bruto.evt ?? []),
    fundos: mapearFundos(bruto.fnds ?? []),
    veiculoCargas: mapearCargasVeiculo(bruto.veh?.cg ?? []),
    veiculoQuilometragem: mapearQuilometragem(bruto.veh?.km ?? []),
    veiculoDespesas: mapearDespesasVeiculo(bruto.veh?.lp ?? []),
    veiculoDespesasFixas: mapearDespesasFixas(bruto.veh?.df ?? [], mesReferencia),
    tvdeSemanas: mapearSemanasTvde(bruto.tvde?.weeks ?? {}),
    tvdeSegPorMes: mapearSegPorMesTvde(bruto.tvde?.segM ?? {}),
    tvdeLancamentos: mapearLancamentosTvde(bruto.tvde?.lanc ?? {}, idsReceitasValidas),
    tvdeDespesas: mapearDespesasTvde(bruto.tvde?.desp ?? []),
    tvdeCfg: mapearCfgTvde(bruto.tvde?.cfg),
    cfg: mapearCfg(bruto.cfg),
  };
}

export interface LinhaResumoImportacao {
  chave: keyof DominiosMapeados;
  rotulo: string;
  quantidade: number;
}

const ROTULOS_DOMINIO: Record<string, string> = {
  receitas: "Receitas",
  despesasFixas: "Despesas fixas",
  despesasCorrentes: "Despesas correntes",
  parcelas: "Parcelas",
  transferencias: "Transferências",
  eventos: "Eventos",
  fundos: "Fundos",
  veiculoCargas: "Carregamentos do veículo",
  veiculoQuilometragem: "Quilometragem",
  veiculoDespesas: "Despesas do veículo",
  veiculoDespesasFixas: "Despesas fixas do veículo",
  tvdeSemanas: "Semanas de TVDE",
  tvdeSegPorMes: "Seg. Social por mês (TVDE)",
  tvdeLancamentos: "Receitas de TVDE já lançadas",
  tvdeDespesas: "Despesas do TVDE",
};

/** Linhas de resumo pra UI — contadas a partir do resultado JÁ mapeado
 *  (nunca recalcula separadamente), então nunca diverge do que será gravado. */
export function resumoPorDominio(m: DominiosMapeados): LinhaResumoImportacao[] {
  return Object.entries(ROTULOS_DOMINIO).map(([chave, rotulo]) => ({
    chave: chave as keyof DominiosMapeados,
    rotulo,
    quantidade: Object.keys(m[chave as keyof DominiosMapeados] as object).length,
  }));
}

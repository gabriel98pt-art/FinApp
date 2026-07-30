// Formato do export "Exportar" do app antigo (financas.html/AppFinanceiro,
// schema fin_v4) — usado só pela migração única em utils/importarBackupAntigo.ts.
// Campos soltos e opcionais de propósito: é dado real de anos de uso manual,
// não um schema desenhado — várias entradas têm campos ausentes.

export interface ContagensAntigas {
  rec?: number;
  df?: number;
  dc?: number;
  par?: number;
  evt?: number;
  fnds?: number;
  trf?: number;
  veh_cg?: number;
  veh_lp?: number;
}

export interface ReceitaAntiga {
  id: number;
  date: string;
  val: number;
  src: string;
  card?: string;
  notes?: string;
  /** Só assume 'recon': um ajuste de reconciliação bancária positivo. O app
   *  antigo grava-o em `rec` e exclui-o de todo total de receita — mesmo papel
   *  do `_src` em `DespesaCorrenteAntiga`, do lado da despesa. */
  _src?: string | null;
}

export interface DespesaFixaAntiga {
  id: number;
  name: string;
  val: number;
  cat: string;
  card?: string;
  activeFrom?: string;
  notes?: string;
  /** Dia do mês do vencimento (coluna "Dia Venc." do app antigo). */
  day?: number;
  paid?: boolean;
  /** Só existe nalgumas entradas — quando presente, já é {AAAA-MM: bool}
   *  igual ao pagoPorMes novo (achado inspecionando o export real). */
  paidMonths?: Record<string, boolean>;
}

export interface DespesaCorrenteAntiga {
  id: number;
  date: string;
  val: number;
  cat: string;
  card?: string;
  name?: string;
  notes?: string;
  /** 'veh' é um 4º valor real (mirror de veh.cg/veh.lp na lista geral do app
   *  antigo) sem equivalente no enum novo — tratado à parte, nunca vira
   *  origem de despesasCorrentes. */
  _src?: "parc" | "fat" | "recon" | "veh" | null;
  _pid?: number;
  _pm?: string;
  _fatCard?: string;
  _fatYm?: string;
  _vid?: number;
  _vtype?: "carga" | "limp" | null;
}

export interface ParcelaAntiga {
  id: number;
  name: string;
  vp: number;
  cat?: string;
  card?: string;
  num: number;
  py?: Record<string, boolean>;
  fd: string;
  total?: number;
  autoDebit?: boolean;
}

export interface TransferenciaAntiga {
  id: number;
  date: string;
  from: string;
  to: string;
  val: number;
  notes?: string;
}

export interface CargaVeiculoAntiga {
  id: number;
  date: string;
  val: number;
  local?: string;
  notes?: string;
  kwh?: number;
  /** Preço por kWh em euros — só presente nalgumas entradas; nas outras é
   *  derivado de val/kwh (mesma fórmula do formulário "custo total"). */
  preco?: number;
}

export interface KmVeiculoAntiga {
  id: number;
  km: number;
  notes?: string;
  weekFrom?: string;
  weekTo?: string;
}

export interface DespesaVeiculoAntiga {
  id: number;
  date: string;
  val: number;
  /** Chama-se `tipo`, não `cat`, ao contrário de todo o resto do arquivo. */
  tipo?: string;
  notes?: string;
}

export interface EventoAntigo {
  id: number;
  title?: string;
  name?: string;
  date: string;
  notes?: string;
  val?: number;
}

export interface FundoAntigo {
  id: number;
  name?: string;
  nome?: string;
  alvo?: number;
  target?: number;
  atual?: number;
  current?: number;
  prazo?: string;
  deadline?: string;
}

export interface SemanaTvdeAntiga {
  fat?: number;
  port?: number;
  alu?: number;
  recF?: number;
  extra?: number;
  gorj?: number;
  recP?: number;
  horas?: number;
  viag?: number;
  pct?: number;
}

export interface LancamentoTvdeAntigo {
  rid?: number;
  val?: number;
  at?: number;
  recP?: number;
}

export interface DespesaTvdeAntiga {
  id: number;
  date?: string;
  name?: string;
  val?: number;
}

export interface CfgTvdeAntigo {
  pctFrota?: number;
  aluguel?: number;
  metaSem?: number;
  metaMes?: number;
  // metaHoras/metaHora existem no export real mas não têm campo
  // correspondente em ConfigTvde — propositalmente NÃO mapeados.
}

export interface TvdeAntigo {
  weeks?: Record<string, SemanaTvdeAntiga>;
  /** Segurança Social por período — legado, superado por segM (migSegMes na
   *  cfg antiga confirma que a própria app antiga já migrou). NÃO importar. */
  seg?: Record<string, number>;
  /** "Mês Ano" em português → valor. Formato final, este sim migra. */
  segM?: Record<string, number>;
  lanc?: Record<string, LancamentoTvdeAntigo>;
  desp?: DespesaTvdeAntiga[];
  cfg?: CfgTvdeAntigo;
}

export interface LocalCarregamentoAntigo {
  nome?: string;
}

export interface PagamentoFaturaAntigo {
  paid?: boolean;
  val?: number;
  date?: string;
  from?: string;
  dcId?: number | string;
  payments?: { val: number; date: string; from?: string; dcId?: number | string }[];
}

export interface CfgAntiga {
  currency?: string;
  ccat?: string[];
  fcat?: string[];
  vcat?: string[];
  pay?: string[];
  cardType?: Record<string, string>;
  bud?: Record<string, number>;
  bal?: Record<string, number>;
  sgoal?: number;
  theme?: string;
  showTvde?: boolean;
  src?: string[];
  locais?: LocalCarregamentoAntigo[];
  fatManual?: Record<string, Record<string, number>>;
  fatPaid?: Record<string, Record<string, PagamentoFaturaAntigo>>;
}

export interface VeiculoAntigo {
  cg?: CargaVeiculoAntiga[];
  km?: KmVeiculoAntiga[];
  lp?: DespesaVeiculoAntiga[];
  df?: DespesaFixaAntiga[];
}

/** Envelope completo do export "Exportar" do app antigo. */
export interface BackupFinV4 {
  _schema: string;
  _v?: number;
  _exportedAt?: string;
  _id?: number;
  _savedAt?: number;
  _appVersion?: string;
  _counts?: ContagensAntigas;
  rec?: ReceitaAntiga[];
  df?: DespesaFixaAntiga[];
  dc?: DespesaCorrenteAntiga[];
  par?: ParcelaAntiga[];
  trf?: TransferenciaAntiga[];
  evt?: EventoAntigo[];
  fnds?: FundoAntigo[];
  veh?: VeiculoAntigo;
  tvde?: TvdeAntigo;
  cfg?: CfgAntiga;
}

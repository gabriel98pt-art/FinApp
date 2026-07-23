import type { Cents, Id, IsoDate, YearMonth } from "./common";

/** Semana de trabalho TVDE (seção 4.4) — a unidade central do módulo.
 *  Campos e fórmulas fixados a partir da planilha original do dono do produto
 *  (portados do financas.html, linhas ~10200-10470): NÃO alterar comportamento
 *  sem validação explícita. Valores monetários em centavos.
 *
 *  A semana N é derivada de cfg.inicioSemana1: começa em inicio+(N-1)*7 dias
 *  e vai até +6. Não guardamos datas na semana — só o número (chave do mapa). */
export interface SemanaTvde {
  /** Faturamento — a base das contas. */
  fat: Cents;
  /** Portagens. */
  port: Cents;
  /** Aluguel. */
  alu: Cents;
  /** Recarga frota (paga pela frota, descontada da receita). */
  recF: Cents;
  /** Extra (soma ao lucro). */
  extra: Cents;
  /** Gorjetas — SÓ anotação; NUNCA entram no lucro. */
  gorj: Cents;
  /** Recarga própria (sai do lucro; ver [[feedback_tvde_recargas]]). */
  recP: Cents;
  horas: number;
  viag: number;
  /** % frota GRAVADA na própria semana ao criar — histórico protegido:
   *  mudar a config depois não recalcula semanas antigas. */
  pct: number;
  /** Semana de teste: conta para DINHEIRO REAL (mês, período, Seg. Social,
   *  lançamento de receita) mas some de TODO indicador de performance. */
  teste?: boolean;
}

export interface ConfigTvde {
  /** Segunda-feira em que começa a semana 1 (no app de origem: 2026-03-02). */
  inicioSemana1: IsoDate;
  /** % frota padrão para semanas novas. */
  pctFrota: number;
  /** Aluguel semanal padrão. */
  aluguel: Cents;
  metaSem: Cents;
  metaMes: Cents;
}

export interface DespesaTvde {
  id: Id;
  data: IsoDate;
  descricao: string;
  valor: Cents;
}

/** Módulo TVDE, completamente autocontido (antigo `S.tvde`).
 *  Moeda SEMPRE EUR, independente da moeda da conta (seção 4.4). */
export interface DadosTvde {
  cfg: ConfigTvde;
  /** Semanas por número (chave string "1", "2", …). */
  semanas: Record<string, SemanaTvde>;
  /** Segurança Social por MÊS DE PAGAMENTO (quando saiu da conta) — há um
   *  desfasamento trimestral real (seção 4.4). */
  segPorMes: Record<YearMonth, Cents>;
  /** Semana → id da Receita lançada nas finanças (evita lançar 2x; o undo
   *  remove dos dois lados). */
  lancamentos: Record<string, Id>;
  /** Despesas próprias do módulo, separadas das Despesas gerais. */
  despesas: DespesaTvde[];
}

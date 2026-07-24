import type { Cents, Id, IsoDate } from "./common";

/** Evento do calendário (antigo `evt`). Também alimenta os alertas de
 *  "próximos 7 dias" do Copiloto. */
export interface EventoCalendario {
  id: Id;
  titulo: string;
  data: IsoDate;
  descricao?: string;
  valor?: Cents;
}

/** Fundo / sub-meta ("cofrinho", antigo `fnds`). */
export interface Fundo {
  id: Id;
  nome: string;
  alvo: Cents;
  atual: Cents;
  /** Prazo opcional — habilita a projeção "≈ X/mês necessários". */
  prazo?: IsoDate;
}

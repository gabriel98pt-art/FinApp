import {
  CalendarDays,
  Car,
  CarTaxiFront,
  CreditCard,
  House,
  Layers,
  Settings,
  Target,
  TrendingDown,
  TrendingUp,
  Upload,
  type LucideIcon,
} from "lucide-react";

export type AbaId =
  | "inicio"
  | "receitas"
  | "despesas"
  | "veiculo"
  | "cartoes"
  | "parcelas"
  | "calendario"
  | "metas"
  | "importar"
  | "tvde"
  | "definicoes";

export interface AbaDef {
  id: AbaId;
  rota: string;
  titulo: string;
  Icone: LucideIcon;
}

/** Todas as abas do app (seção 3), na ordem da barra desktop. */
export const ABAS: AbaDef[] = [
  { id: "inicio", rota: "/", titulo: "Início", Icone: House },
  { id: "receitas", rota: "/receitas", titulo: "Receitas", Icone: TrendingUp },
  { id: "despesas", rota: "/despesas", titulo: "Despesas", Icone: TrendingDown },
  { id: "veiculo", rota: "/veiculo", titulo: "Veículo", Icone: Car },
  { id: "cartoes", rota: "/cartoes", titulo: "Cartões", Icone: CreditCard },
  { id: "parcelas", rota: "/parcelas", titulo: "Parcelas", Icone: Layers },
  { id: "calendario", rota: "/calendario", titulo: "Calendário", Icone: CalendarDays },
  { id: "metas", rota: "/metas", titulo: "Metas", Icone: Target },
  { id: "importar", rota: "/importar", titulo: "Importar", Icone: Upload },
  { id: "tvde", rota: "/tvde", titulo: "TVDE", Icone: CarTaxiFront },
  { id: "definicoes", rota: "/definicoes", titulo: "Definições", Icone: Settings },
];

function aba(id: AbaId): AbaDef {
  return ABAS.find((a) => a.id === id)!;
}

/** Barra mobile (redesenho do Marco 2): Receitas | Despesas | [botão central]
 *  | Início | Mais. As duas primeiras ficam à esquerda do botão central. */
export const NAV_MOBILE_ESQUERDA: AbaDef[] = [aba("receitas"), aba("despesas")];
export const NAV_MOBILE_DIREITA: AbaDef[] = [aba("inicio")];

/** Tudo o que não tem posição fixa na barra vive no menu "Mais". */
export const ABAS_MENU_MAIS: AbaDef[] = [
  aba("cartoes"),
  aba("calendario"),
  aba("veiculo"),
  aba("parcelas"),
  aba("metas"),
  aba("importar"),
  aba("tvde"),
  aba("definicoes"),
];

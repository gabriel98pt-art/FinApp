import {
  CalendarDays,
  Car,
  CarTaxiFront,
  CreditCard,
  Layers,
  LayoutDashboard,
  Settings,
  Target,
  TrendingDown,
  TrendingUp,
  Upload,
  type LucideIcon,
} from "lucide-react";

export type AbaId =
  | "dashboard"
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
  { id: "dashboard", rota: "/", titulo: "Dashboard", Icone: LayoutDashboard },
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

/** Slots principais da nav mobile. O 5º alterna entre Calendário e TVDE
 *  conforme cfg.showTvde (seção 4.4) — a troca real chega com a store de
 *  configuração; por ora fica Calendário. As restantes vão para o menu "Mais". */
export function abasNavMobile(showTvde: boolean): AbaDef[] {
  const quintoSlot: AbaId = showTvde ? "tvde" : "calendario";
  const ids: AbaId[] = ["dashboard", "receitas", "despesas", "cartoes", quintoSlot];
  return ids.map((id) => ABAS.find((a) => a.id === id)!);
}

export function abasMenuMais(showTvde: boolean): AbaDef[] {
  const principais = new Set(abasNavMobile(showTvde).map((a) => a.id));
  return ABAS.filter((a) => !principais.has(a.id));
}

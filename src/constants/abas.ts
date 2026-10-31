import {
  Car,
  CarTaxiFront,
  ClipboardList,
  CreditCard,
  House,
  Settings,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type { ComponentType } from "react";
import IconeAnalise from "../components/IconeAnalise";

export type AbaId =
  | "inicio"
  | "receitas"
  | "despesas"
  | "veiculo"
  | "cartoes"
  | "planejamento"
  | "analise"
  | "tvde"
  | "definicoes";

export interface AbaDef {
  id: AbaId;
  rota: string;
  titulo: string;
  Icone: IconeAba;
}

/** O que as listas de abas precisam de um ícone: os Lucide e o da Análise
 *  encaixam todos aqui. */
export type IconeAba = ComponentType<{
  size?: number;
  className?: string;
  "aria-hidden"?: boolean;
}>;

/** Todas as abas do app (seção 3), na ordem da barra desktop. */
export const ABAS: AbaDef[] = [
  { id: "inicio", rota: "/", titulo: "Início", Icone: House },
  { id: "receitas", rota: "/receitas", titulo: "Receitas", Icone: TrendingUp },
  { id: "despesas", rota: "/despesas", titulo: "Despesas", Icone: TrendingDown },
  { id: "veiculo", rota: "/veiculo", titulo: "Veículo", Icone: Car },
  { id: "cartoes", rota: "/cartoes", titulo: "Cartões", Icone: CreditCard },
  // Uma entrada só para o plano inteiro: "Planejamento" e "Metas" eram dois
  // itens do menu a responder à mesma pergunta ("o meu plano está a
  // aguentar?"), e agora são duas abas dentro desta página.
  { id: "planejamento", rota: "/planejamento", titulo: "Planejamento", Icone: ClipboardList },
  { id: "analise", rota: "/analise", titulo: "Análise", Icone: IconeAnalise },
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
  aba("planejamento"),
  aba("analise"),
  aba("veiculo"),
  aba("tvde"),
];

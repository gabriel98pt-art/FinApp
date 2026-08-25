// Grades curadas do seletor de aparência da categoria (item 19): ícone e cor.
// Deliberadamente fechadas — o objetivo é uma grade rápida de tocar, não um
// teclado de emoji completo do sistema.

import {
  BookOpen,
  Bus,
  Car,
  CircleParking,
  Coffee,
  CreditCard,
  Dog,
  Dumbbell,
  Film,
  Footprints,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  Hospital,
  House,
  Landmark,
  Laptop,
  Lightbulb,
  Music,
  Package,
  Pill,
  Plane,
  Plug,
  Receipt,
  Sandwich,
  Scissors,
  Shield,
  Shirt,
  ShoppingCart,
  ShowerHead,
  Smartphone,
  Sofa,
  Sparkles,
  Stethoscope,
  TreePalm,
  TrendingUp,
  Utensils,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { PALETA_CATEGORIA } from "../utils/coresCategoria";

/** ~40 ícones de linha do `lucide-react` para finanças pessoais, agrupados por
 *  tema (a ordem da lista é a ordem da grade: comida, casa, carro, saúde,
 *  lazer, compras…). O que fica salvo em `cfg.categoriaIcone` é o `id` —
 *  string estável, nunca o componente. */
export const ICONES_CATEGORIA: { id: string; Icone: LucideIcon }[] = [
  // Comida
  { id: "utensils", Icone: Utensils },
  { id: "shopping-cart", Icone: ShoppingCart },
  { id: "sandwich", Icone: Sandwich },
  { id: "coffee", Icone: Coffee },
  // Casa
  { id: "home", Icone: House },
  { id: "sofa", Icone: Sofa },
  { id: "lightbulb", Icone: Lightbulb },
  { id: "shower-head", Icone: ShowerHead },
  // Carro / transporte
  { id: "car", Icone: Car },
  { id: "fuel", Icone: Fuel },
  { id: "plug", Icone: Plug },
  { id: "bus", Icone: Bus },
  { id: "parking", Icone: CircleParking },
  { id: "wrench", Icone: Wrench },
  // Saúde
  { id: "hospital", Icone: Hospital },
  { id: "pill", Icone: Pill },
  { id: "stethoscope", Icone: Stethoscope },
  { id: "dumbbell", Icone: Dumbbell },
  // Lazer
  { id: "film", Icone: Film },
  { id: "gamepad", Icone: Gamepad2 },
  { id: "music", Icone: Music },
  { id: "plane", Icone: Plane },
  { id: "palm-tree", Icone: TreePalm },
  { id: "gift", Icone: Gift },
  // Compras
  { id: "shirt", Icone: Shirt },
  { id: "footprints", Icone: Footprints },
  { id: "sparkles", Icone: Sparkles },
  { id: "scissors", Icone: Scissors },
  // Tecnologia / estudo
  { id: "smartphone", Icone: Smartphone },
  { id: "laptop", Icone: Laptop },
  { id: "book", Icone: BookOpen },
  { id: "graduation-cap", Icone: GraduationCap },
  // Dinheiro / obrigações
  { id: "credit-card", Icone: CreditCard },
  { id: "landmark", Icone: Landmark },
  { id: "wallet", Icone: Wallet },
  { id: "trending-up", Icone: TrendingUp },
  { id: "receipt", Icone: Receipt },
  { id: "shield", Icone: Shield },
  // Diversos
  { id: "dog", Icone: Dog },
  { id: "package", Icone: Package },
];

/** Busca o componente pelo id salvo. Id desconhecido (grade mudou, dado
 *  antigo) devolve `null` — a bolha fica só com o círculo, sem quebrar. */
export function iconePorId(id: string | undefined): LucideIcon | null {
  if (!id) return null;
  return ICONES_CATEGORIA.find((i) => i.id === id)?.Icone ?? null;
}

/** Paleta do seletor de cor — grade de 6 colunas × 4 linhas. As 3 primeiras
 *  linhas (18 matizes: vivas quente→fria, vivas que preenchem os intervalos
 *  da 1ª linha, tons profundos/terrosos) vêm de `PALETA_CATEGORIA`
 *  (`utils/coresCategoria.ts`) — a MESMA lista que a auto-atribuição usa,
 *  unificada pra acabar com a divergência que existia antes (duas paletas
 *  diferentes, uma pra cada caso). Só a 4ª linha, os neutros, é própria
 *  daqui: fazem sentido numa escolha deliberada no seletor manual, mas uma
 *  categoria automática sair cinza pareceria "sem cor escolhida", não uma
 *  cor de propósito — por isso ficam de fora do fallback por hash. */
export const CORES_CATEGORIA = [
  ...PALETA_CATEGORIA,
  // neutros — escuro ao claro
  "#0f172a",
  "#1e293b",
  "#334155",
  "#64748b",
  "#94a3b8",
  "#cbd5e1",
];

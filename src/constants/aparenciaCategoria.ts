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

/** Paleta do seletor de cor — uma grade de 6 colunas, tons legíveis nos dois
 *  temas (mesma família das cores de gráfico já usadas em `coresCategoria`). */
export const CORES_CATEGORIA = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#10b981",
  "#14b8a6",
  "#06b6d4",
  "#0ea5e9",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#d946ef",
  "#ec4899",
  "#f43f5e",
  "#fb7185",
  "#a78bfa",
  "#60a5fa",
  "#4ade80",
  "#fbbf24",
  "#94a3b8",
  "#64748b",
];

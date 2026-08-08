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

/** Paleta do seletor de cor — grade de 6 colunas × 4 linhas, cada uma com um
 *  papel próprio, para não repetir a mesma cor num tom quase igual como
 *  antes (violeta e roxo a 1° de distância um do outro, por exemplo — quase
 *  indistinguíveis lado a lado):
 *
 *  1) vivas quentes→frias, espaçadas ≥28° na roda de cor;
 *  2) vivas que preenchem os intervalos da linha 1, mesmo espaçamento;
 *  3) tons profundos/terrosos — mesma ideia de cor, mas claramente mais
 *     escuros e menos saturados, então mesmo repetindo uma matiz da linha 1/2
 *     não fica parecido lado a lado (nenhum se toca na grade);
 *  4) neutros, do quase-preto ao cinza-claro — antes eram só 2 cinzas soltos
 *     no meio de cores vivas; agora é a rampa inteira, de propósito. */
export const CORES_CATEGORIA = [
  // 1. vivas — quente a frio
  "#ef4444", // vermelho
  "#eab308", // amarelo-ouro
  "#22c55e", // verde
  "#06b6d4", // ciano
  "#3b82f6", // azul
  "#d946ef", // magenta
  // 2. vivas — preenchem os intervalos da linha 1
  "#f97316", // laranja
  "#84cc16", // verde-lima
  "#14b8a6", // esmeralda
  "#0ea5e9", // azul-celeste
  "#8b5cf6", // violeta
  "#ec4899", // rosa
  // 3. profundas / terrosas
  "#c2410c", // terracota
  "#a16207", // mostarda
  "#4d7c0f", // oliva
  "#0f766e", // petróleo
  "#1e40af", // marinho
  "#9f1239", // vinho
  // 4. neutros — escuro ao claro
  "#0f172a",
  "#1e293b",
  "#334155",
  "#64748b",
  "#94a3b8",
  "#cbd5e1",
];

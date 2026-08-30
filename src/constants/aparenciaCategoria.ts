// Grades curadas do seletor de aparência da categoria (item 19): ícone e cor.
// Deliberadamente fechadas — o objetivo é uma grade rápida de tocar, não um
// teclado de emoji completo do sistema.

import {
  Baby,
  Banknote,
  Bike,
  BookOpen,
  Briefcase,
  Building2,
  Bus,
  Cake,
  Camera,
  Car,
  CircleParking,
  Coffee,
  CreditCard,
  Dog,
  Droplet,
  Dumbbell,
  Film,
  Flame,
  Footprints,
  Fuel,
  Gamepad2,
  Gift,
  Glasses,
  GraduationCap,
  HandCoins,
  Heart,
  HeartPulse,
  Hospital,
  House,
  Key,
  Landmark,
  Laptop,
  Lightbulb,
  Music,
  Package,
  Palette,
  Percent,
  PiggyBank,
  Pill,
  Plane,
  Plug,
  Receipt,
  Recycle,
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
  Ticket,
  TrainFront,
  TreePalm,
  TrendingUp,
  Trophy,
  Tv,
  Umbrella,
  Users,
  Utensils,
  Wallet,
  Watch,
  Wifi,
  Wine,
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
  // Dinheiro extra (item 9 do lote de UX/nav — grade de +20 ícones)
  { id: "piggy-bank", Icone: PiggyBank },
  { id: "hand-coins", Icone: HandCoins },
  { id: "banknote", Icone: Banknote },
  { id: "percent", Icone: Percent },
  // Trabalho / imóveis
  { id: "briefcase", Icone: Briefcase },
  { id: "building", Icone: Building2 },
  { id: "key", Icone: Key },
  // Casa / contas de serviço
  { id: "droplet", Icone: Droplet },
  { id: "flame", Icone: Flame },
  { id: "wifi", Icone: Wifi },
  { id: "tv", Icone: Tv },
  // Família / social
  { id: "users", Icone: Users },
  { id: "baby", Icone: Baby },
  { id: "heart", Icone: Heart },
  { id: "heart-pulse", Icone: HeartPulse },
  // Lazer extra
  { id: "camera", Icone: Camera },
  { id: "palette", Icone: Palette },
  { id: "trophy", Icone: Trophy },
  { id: "ticket", Icone: Ticket },
  { id: "cake", Icone: Cake },
  { id: "wine", Icone: Wine },
  // Transporte extra
  { id: "bike", Icone: Bike },
  { id: "train", Icone: TrainFront },
  // Diversos extra
  { id: "umbrella", Icone: Umbrella },
  { id: "recycle", Icone: Recycle },
  { id: "glasses", Icone: Glasses },
  { id: "watch", Icone: Watch },
];

/** Busca o componente pelo id salvo. Id desconhecido (grade mudou, dado
 *  antigo) devolve `null` — a bolha fica só com o círculo, sem quebrar. */
export function iconePorId(id: string | undefined): LucideIcon | null {
  if (!id) return null;
  return ICONES_CATEGORIA.find((i) => i.id === id)?.Icone ?? null;
}

/** Paleta do seletor de cor — grade de 6 colunas, tantas linhas quantas
 *  couberem (a grade só embrulha, não precisa fechar retângulo). As 21
 *  matizes agrupadas por família (vermelhos → magenta/rosa) vêm de
 *  `PALETA_CATEGORIA` (`utils/coresCategoria.ts`) — a MESMA lista que a
 *  auto-atribuição usa, unificada pra acabar com a divergência que existia
 *  antes (duas paletas diferentes, uma pra cada caso). Só a última linha, os
 *  neutros, é própria daqui: fazem sentido numa escolha deliberada no
 *  seletor manual, mas uma categoria automática sair cinza pareceria "sem
 *  cor escolhida", não uma cor de propósito — por isso ficam de fora do
 *  fallback por hash. */
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

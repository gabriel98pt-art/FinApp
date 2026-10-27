import type { SVGProps } from "react";

/** O ícone da aba Análise: três barras a subir. Desenhado como os Lucide das
 *  outras abas (24px, traço de 2, pontas redondas) e com a mesma interface
 *  (`size`, `className`, `aria-hidden`), para entrar nas listas de abas. */
export default function IconeAnalise({
  size = 24,
  ...resto
}: { size?: number } & Omit<SVGProps<SVGSVGElement>, "width" | "height">) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...resto}
    >
      <path d="M5 20v-6M12 20V5M19 20v-10" />
    </svg>
  );
}

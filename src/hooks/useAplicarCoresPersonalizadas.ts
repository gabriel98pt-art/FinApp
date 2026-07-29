import { useEffect } from "react";
import { useCfgStore } from "../stores/cfgStore";
import { useThemeStore } from "../stores/themeStore";
import { hexParaRgb } from "../utils/categoriaVisual";
import type { TokenCorApp } from "../types";

/** Os cinco tokens editáveis em Definições. */
export const TOKENS_COR_APP: TokenCorApp[] = ["blu", "grn", "red", "ylw", "pur"];

/** Nome em português de cada um, para a interface. */
export const ROTULO_TOKEN: Record<TokenCorApp, string> = {
  blu: "Destaque",
  grn: "Positivo",
  red: "Negativo",
  ylw: "Alerta",
  pur: "Roxo",
};

/** Escreve as cores escolhidas direto no <html>, por cima de `tokens.css`.
 *  Como é uma variável CSS, o app inteiro reage na hora — não há nada a
 *  propagar componente a componente.
 *
 *  O par `--x-rgb` acompanha: brilhos e sombras com alpha (o pulso do FAB, por
 *  exemplo) leem esse, e sem atualizá-lo ficariam com a cor antiga. */
export function useAplicarCoresPersonalizadas() {
  const coresApp = useCfgStore((s) => s.cfg.coresApp);
  const tema = useThemeStore((s) => s.theme);

  useEffect(() => {
    const estilo = document.documentElement.style;
    const doTema = coresApp?.[tema];
    for (const token of TOKENS_COR_APP) {
      const cor = doTema?.[token];
      const rgb = cor ? hexParaRgb(cor) : null;
      // Hex inválido cai no mesmo caminho do "sem escolha": volta ao padrão,
      // em vez de escrever lixo na variável.
      if (cor && rgb) {
        estilo.setProperty(`--${token}`, cor);
        estilo.setProperty(`--${token}-rgb`, rgb.join(", "));
      } else {
        estilo.removeProperty(`--${token}`);
        estilo.removeProperty(`--${token}-rgb`);
      }
    }
  }, [coresApp, tema]);
}

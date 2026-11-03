import type { ComponentPropsWithRef } from "react";
import { Loader2 } from "lucide-react";
import styles from "./Botao.module.css";

/** Os cinco estilos de botão, iguais na FinApp e na TVDE Pro (padrão comum,
 *  docs/design/analise-tabbar-topo.md, parte 5). Tudo o que não caiba aqui é
 *  um controlo (segmento, chip, selo — esses têm componente próprio).
 *
 *  - primario: cor cheia, sem degradê. Só um por ecrã.
 *  - secundario: fundo suave na cor de acento.
 *  - neutro: cor da superfície.
 *  - fantasma: só texto ou só ícone, sem fundo.
 *  - perigo: vermelho, só para ações que apagam dados. */
export type VarianteBotao = "primario" | "secundario" | "neutro" | "fantasma" | "perigo";

/** pequeno 34px (área de toque de 44 por trás), normal 44px, grande 52px a
 *  ocupar a largura toda (o «Guardar» no fundo das folhas). */
export type TamanhoBotao = "pequeno" | "normal" | "grande";

type Props = ComponentPropsWithRef<"button"> & {
  variante: VarianteBotao;
  tamanho?: TamanhoBotao;
  /** Botão reduzido ao ícone, redondo. Quem o usa passa OBRIGATORIAMENTE um
   *  `aria-label` com a frase inteira — "Registar abastecimento", não
   *  "registar" — porque é o que sobra para quem não vê o ícone. */
  soIcone?: boolean;
  /** A meio de uma ação: fica desativado e troca o conteúdo por um indicador,
   *  sem mudar de largura. */
  carregando?: boolean;
};

/** Botão da app. `className` vem depois das classes do componente, para quem
 *  precisa de layout local (largura, alinhamento na grelha) sem redefinir o
 *  desenho. */
export default function Botao({
  variante,
  tamanho = "normal",
  soIcone,
  carregando,
  className,
  type,
  disabled,
  children,
  ...resto
}: Props) {
  const classes = [
    styles.base,
    styles[variante],
    styles[tamanho],
    soIcone && styles.soIcone,
    carregando && styles.carregando,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      // <button> sem type dentro de <form> submete por omissão, e quase nenhuma
      // das chamadas quer isso; quem quer passa type="submit".
      type={type ?? "button"}
      className={classes}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      {...resto}
    >
      {carregando ? (
        <>
          {/* O conteúdo fica, invisível, a segurar a largura do botão. */}
          <span className={styles.oculto}>{children}</span>
          <Loader2 className={styles.indicador} size={18} aria-hidden />
        </>
      ) : (
        children
      )}
    </button>
  );
}

import type { KeyboardEvent, ClipboardEvent } from "react";
import type { Cents } from "../types";
import { aplicarTecla } from "../utils/campoMoeda";
import { formatCents, parseMoney } from "../utils/money";

/** Campo de dinheiro do app. O valor é sempre CENTAVOS, nunca texto: cada
 *  dígito entra pela direita e empurra os outros — "1", "2", "3" mostra
 *  0,01 → 0,12 → 1,23 —, e o campo formata-se sozinho no padrão 1.234,56.
 *  É o comportamento de um campo de valor de multibanco.
 *
 *  Antes cada campo destes era texto livre, e a interpretação ("1234,56",
 *  "1234.56", "1.234,56") só acontecia ao submeter. Aqui não há como escrever
 *  um valor que o app não entenda: separadores nunca se digitam.
 *
 *  O estado de quem usa passa a ser `Cents | null` — pré-preencher na edição é
 *  só passar o valor do item, sem converter para texto e de volta. */
export default function CampoMoeda({
  valor,
  aoMudar,
  id,
  placeholder = "0,00",
  required,
  disabled,
  className,
  aoSairDoCampo,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedby,
}: {
  /** `null` = campo vazio. Só onde ficar por preencher significa algo (o
   *  ajuste manual da fatura, por exemplo); nos outros a validação do submit
   *  trata disso, como sempre tratou. */
  valor: Cents | null;
  aoMudar: (v: Cents | null) => void;
  id?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  /** Para quem grava ao sair do campo, em vez de num botão. */
  aoSairDoCampo?: () => void;
  "aria-label"?: string;
  "aria-describedby"?: string;
}) {
  function aoTeclar(e: KeyboardEvent<HTMLInputElement>) {
    // Deixa passar os atalhos do sistema (copiar, colar, selecionar tudo).
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const novo = aplicarTecla(valor, e.key);
    if (novo === undefined) return; // Tab, setas, Enter…
    e.preventDefault();
    aoMudar(novo);
  }

  // Colar um valor copiado de outro lado ainda funciona: aí sim vale a pena
  // interpretar o texto, com o mesmo parser de sempre.
  function aoColar(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const lido = parseMoney(e.clipboardData.getData("text"));
    if (lido !== null) aoMudar(Math.abs(lido));
  }

  return (
    <input
      id={id}
      // "numeric" e não "decimal": no telemóvel o teclado não precisa de
      // mostrar a vírgula, que aqui não faz nada.
      inputMode="numeric"
      value={valor === null ? "" : formatCents(valor)}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      className={className}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedby}
      onKeyDown={aoTeclar}
      onPaste={aoColar}
      onBlur={aoSairDoCampo}
      // O valor só muda por tecla; o React exige um onChange num campo
      // controlado, mesmo não havendo nada a fazer aqui.
      onChange={() => {}}
    />
  );
}

// Parte um valor já formatado ("€ 1.895,38", "−€ 507,00", "+12%", "42 km") nas
// peças que o número grande desenha em tamanhos diferentes.

export interface ValorPartido {
  /** Sinal e símbolo da moeda ("−€", "€", "+"). Pode ser vazio. */
  prefixo: string;
  inteiro: string;
  /** Vírgula e casas decimais (",38"). Vazio se não houver. */
  centavos: string;
  /** O que vem depois do número ("%", " km"). */
  sufixo: string;
}

const PADRAO = /^\s*([+−-]?\s*(?:R\$|[€$£])?\s*[+−-]?)\s*(\d[\d.]*)(,\d+)?(.*)$/;

/** `null` quando o texto não é um número (um nome como "Alimentação", ou "—"):
 *  quem desenha mostra-o inteiro, sem partir. */
export function partirValor(texto: string): ValorPartido | null {
  const m = PADRAO.exec(texto);
  if (!m) return null;
  return { prefixo: m[1].trim(), inteiro: m[2], centavos: m[3] ?? "", sufixo: m[4] };
}

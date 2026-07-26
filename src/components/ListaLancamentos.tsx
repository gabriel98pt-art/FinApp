import { useState } from "react";
import { Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import CategoriaBolha from "./CategoriaBolha";
import Paginador from "./Paginador";
import { EstadoVazio } from "./Pagina";
import type { Cents, Currency, Id, IsoDate } from "../types";
import { total as somar } from "../utils/calculos";
import { formatMoney } from "../utils/money";
import styles from "./ListaLancamentos.module.css";

/** Itens por página — mesmo valor do app de referência (DC_PGS = 15). */
export const ITENS_POR_PAGINA = 15;

export interface ItemLista {
  id: Id;
  descricao: string;
  valor: Cents;
  data: IsoDate;
  /** Fonte (receita) ou categoria (despesa), já com a nota quando existe. */
  etiqueta: string;
  /** Nome puro da categoria/fonte, só para a bolha colorida — sem a nota. */
  categoria?: string;
}

function dataCurta(data: IsoDate): string {
  return `${data.slice(8, 10)}/${data.slice(5, 7)}`;
}

/** Tabela de lançamentos (seção 7): linha clicável abre a edição. */
export default function ListaLancamentos({
  titulo,
  itens,
  carregado,
  tom,
  vazio,
  vazioSub,
  vazioIcone,
  moeda,
  aoAdicionar,
  aoEditar,
  rotuloTotal = "Total",
  total,
}: {
  titulo: string;
  itens: ItemLista[];
  carregado: boolean;
  tom: "verde" | "vermelho";
  vazio: string;
  vazioSub?: string;
  vazioIcone: LucideIcon;
  moeda: Currency;
  aoAdicionar: () => void;
  aoEditar: (id: Id) => void;
  /** Texto do rodapé de total (ex. "Total julho 2026"). */
  rotuloTotal?: string;
  /** Total do rodapé, quando ele não é a simples soma das linhas — o caso de
   *  Despesas, que MOSTRA pagamento de fatura e espelho de parcela na lista
   *  mas não os conta nos totais (ver `despesasNosTotais`). Sem isto o rodapé
   *  contradiz o KPI logo acima. */
  total?: Cents;
}) {
  const [pagina, setPagina] = useState(1);

  // O total é sempre de TODOS os itens recebidos (o mês inteiro), nunca só da
  // página visível — igual ao rodapé do app de referência.
  const totalGeral = total ?? somar(itens);
  const paginas = Math.ceil(itens.length / ITENS_POR_PAGINA) || 1;
  const paginaAtual = Math.min(pagina, paginas);
  const visiveis = itens.slice(
    (paginaAtual - 1) * ITENS_POR_PAGINA,
    paginaAtual * ITENS_POR_PAGINA,
  );

  return (
    <div className={styles.cartao}>
      <div className={styles.cabecalho}>
        <h3 className={styles.titulo}>{titulo}</h3>
        <button className={styles.adicionar} onClick={aoAdicionar}>
          <Plus size={15} aria-hidden /> Adicionar
        </button>
      </div>

      {!carregado ? (
        <p className={styles.vazio}>Carregando…</p>
      ) : itens.length === 0 ? (
        <EstadoVazio Icone={vazioIcone} mensagem={vazio} sub={vazioSub} />
      ) : (
        <>
          <ul className={styles.lista}>
            {visiveis.map((item) => (
              <li key={item.id}>
                <button className={styles.linha} onClick={() => aoEditar(item.id)}>
                  {item.categoria !== undefined && (
                    <CategoriaBolha categoria={item.categoria} tamanho={30} />
                  )}
                  <span className={styles.principal}>
                    <span className={styles.descricao}>{item.descricao}</span>
                    <span className={styles.detalhe}>
                      {item.etiqueta} · {dataCurta(item.data)}
                    </span>
                  </span>
                  <span
                    className={`${styles.valor} ${tom === "verde" ? styles.verde : styles.vermelho}`}
                  >
                    {tom === "verde" ? "+" : "−"} {formatMoney(item.valor, moeda)}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <Paginador pagina={paginaAtual} paginas={paginas} aoMudar={setPagina} />

          <div className={styles.rodape}>
            <span>{rotuloTotal}</span>
            <span
              className={`${styles.rodapeValor} ${tom === "verde" ? styles.verde : styles.vermelho}`}
            >
              {formatMoney(totalGeral, moeda)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

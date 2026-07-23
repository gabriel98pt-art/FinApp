import { Plus } from "lucide-react";
import type { Cents, Id, IsoDate } from "../types";
import { formatMoney } from "../utils/money";
import styles from "./ListaLancamentos.module.css";

export interface ItemLista {
  id: Id;
  descricao: string;
  valor: Cents;
  data: IsoDate;
  /** Fonte (receita) ou categoria (despesa). */
  etiqueta: string;
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
  aoAdicionar,
  aoEditar,
}: {
  titulo: string;
  itens: ItemLista[];
  carregado: boolean;
  tom: "verde" | "vermelho";
  vazio: string;
  aoAdicionar: () => void;
  aoEditar: (id: Id) => void;
}) {
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
        <p className={styles.vazio}>{vazio}</p>
      ) : (
        <ul className={styles.lista}>
          {itens.map((item) => (
            <li key={item.id}>
              <button className={styles.linha} onClick={() => aoEditar(item.id)}>
                <span className={styles.principal}>
                  <span className={styles.descricao}>{item.descricao}</span>
                  <span className={styles.detalhe}>
                    {item.etiqueta} · {dataCurta(item.data)}
                  </span>
                </span>
                <span
                  className={`${styles.valor} ${tom === "verde" ? styles.verde : styles.vermelho}`}
                >
                  {tom === "verde" ? "+" : "−"} {formatMoney(item.valor, "EUR")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

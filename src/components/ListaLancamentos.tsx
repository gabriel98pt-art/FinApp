import { useRef, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import CategoriaBolha from "./CategoriaBolha";
import ErroSincronizacao from "./ErroSincronizacao";
import MenuAcoesItem from "./MenuAcoesItem";
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
  /** Terceira linha, abaixo da etiqueta — hoje só a conta do líquido quando a
   *  despesa tem reembolso ("100,00 − 75,00 reembolsado = 25,00 líquido").
   *  Mesmo papel do "X de Y em Z" da linha de Parcelas: o número que interessa
   *  a seguir, sem obrigar a abrir a despesa para o calcular de cabeça. */
  sub?: string;
}

function dataCurta(data: IsoDate): string {
  return `${data.slice(8, 10)}/${data.slice(5, 7)}`;
}

/** Uma linha da lista — item 2 do lote de UX/nav (30/08): a linha inteira
 *  abre o menu único de ações (Editar/Excluir) em vez de ir direto pro
 *  formulário. Componente próprio porque `MenuAcoesItem` precisa de um
 *  `ancoraRef` — um por linha, não um só pra lista inteira. */
function LinhaLancamento({
  item,
  tom,
  moeda,
  aoEditar,
  aoExcluir,
}: {
  item: ItemLista;
  tom: "verde" | "vermelho";
  moeda: Currency;
  aoEditar: (id: Id) => void;
  aoExcluir: (id: Id) => void;
}) {
  const [menuAberto, setMenuAberto] = useState(false);
  const ancoraRef = useRef<HTMLButtonElement>(null);

  // O sinal e a cor são POR ITEM, não pelo `tom` da lista inteira. Um
  // reembolso é uma despesa de valor negativo e vive na lista de despesas,
  // que é `tom="vermelho"`: pela regra antiga saía "− €-75,00", com o sinal
  // duas vezes. Valor negativo numa lista de despesas é dinheiro que
  // VOLTOU, portanto verde e com "+", e o módulo no formatMoney para o
  // menos não aparecer outra vez.
  const entrada = item.valor < 0 ? true : tom === "verde";

  return (
    <li>
      <button
        ref={ancoraRef}
        className={styles.linha}
        onClick={() => setMenuAberto(true)}
        aria-haspopup="dialog"
      >
        {item.categoria !== undefined && <CategoriaBolha categoria={item.categoria} tamanho={30} />}
        <span className={styles.principal}>
          <span className={styles.descricao}>{item.descricao}</span>
          <span className={styles.detalhe}>
            {item.etiqueta} · {dataCurta(item.data)}
          </span>
          {item.sub !== undefined && <span className={styles.sub}>{item.sub}</span>}
        </span>
        <span className={`${styles.valor} ${entrada ? styles.verde : styles.vermelho}`}>
          {entrada ? "+" : "−"} {formatMoney(Math.abs(item.valor), moeda)}
        </span>
      </button>

      <MenuAcoesItem
        aberta={menuAberto}
        aoFechar={() => setMenuAberto(false)}
        titulo={item.descricao}
        ancoraRef={ancoraRef}
        acoes={[
          { rotulo: "Editar", Icone: Pencil, onClick: () => aoEditar(item.id) },
          {
            rotulo: "Excluir",
            Icone: Trash2,
            onClick: () => aoExcluir(item.id),
            tone: "perigo",
          },
        ]}
      />
    </li>
  );
}

/** Tabela de lançamentos (seção 7): linha clicável abre o menu de ações. */
export default function ListaLancamentos({
  titulo,
  itens,
  carregado,
  tom,
  vazio,
  vazioSub,
  vazioIcone,
  moeda,
  aoEditar,
  aoExcluir,
  rotuloTotal = "Total",
  total,
  erro = false,
}: {
  /** Sem título, o cartão nasce sem cabeçalho — quem chama já mostrou o
   *  contexto em cima (ex. a aba "Correntes" de Despesas). Adicionar não vive
   *  mais aqui: é o "+" do cabeçalho da página (hooks/useAcaoHeader.ts). */
  titulo?: string;
  itens: ItemLista[];
  carregado: boolean;
  tom: "verde" | "vermelho";
  vazio: string;
  vazioSub?: string;
  vazioIcone: LucideIcon;
  moeda: Currency;
  aoEditar: (id: Id) => void;
  /** Ação "Excluir" do menu único de ações (item 2 do lote de UX/nav). Quem
   *  chama decide se confirma antes — aqui só se propaga o id escolhido. */
  aoExcluir: (id: Id) => void;
  /** Sincronização caiu. Com itens em mão eles continuam a ser mostrados,
   *  com o aviso por cima; sem itens, o aviso ocupa o lugar do estado vazio,
   *  que aqui mentiria ("nenhuma despesa" quando na verdade não sabemos). */
  erro?: boolean;
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
      {titulo && (
        <div className={styles.cabecalho}>
          <h3 className={styles.titulo}>{titulo}</h3>
        </div>
      )}

      {erro && itens.length > 0 && <ErroSincronizacao compacto />}

      {erro && itens.length === 0 ? (
        <ErroSincronizacao />
      ) : !carregado ? (
        // role="status": sem isto, quem usa leitor de ecrã ficava sem saber
        // que a lista estava a carregar nem que tinha acabado — a troca de
        // "Carregando…" pelas linhas acontecia em silêncio.
        <p className={styles.vazio} role="status">
          Carregando…
        </p>
      ) : itens.length === 0 ? (
        <EstadoVazio Icone={vazioIcone} mensagem={vazio} sub={vazioSub} />
      ) : (
        <>
          <ul className={styles.lista}>
            {visiveis.map((item) => (
              <LinhaLancamento
                key={item.id}
                item={item}
                tom={tom}
                moeda={moeda}
                aoEditar={aoEditar}
                aoExcluir={aoExcluir}
              />
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

import { useRef, useState, type ReactNode } from "react";
import { Pencil, Trash2 } from "lucide-react";
import MenuAcoesItem, { type AcaoItem } from "./MenuAcoesItem";
import styles from "./ItemComMenu.module.css";

/** Item de lista com o menu único de ações (item 2 do lote de UX/nav de
 *  30/08): a linha inteira abre Editar/Excluir num popover, em vez de ir
 *  direto pro formulário — o mesmo padrão que Transações, Parcelas e as 5
 *  listas do Veículo já usavam.
 *
 *  Extraído de Veiculo.tsx (02/09/2026) pra Despesas Fixas também usar: a
 *  lista de fixas tinha ficado de fora dessa padronização, e o clique na
 *  linha ia direto pra edição — inconsistente com o resto do app (achado do
 *  Gabriel, que reportou como "o botão Pago abre a edição": não era bem
 *  isso, mas a linha inteira mesmo IA direto pra edição em vez de abrir o
 *  menu, então um clique perto do selo tinha essa chance real de acertar o
 *  corpo da linha por engano).
 *
 *  `extra` fica FORA do botão — é pro selo Pago/Pendente das fixas, um
 *  controlo já dedicado e único, não um dos "botões espalhados" que este
 *  item veio consolidar. */
export default function ItemComMenu({
  nome,
  detalhe,
  valor,
  aoEditar,
  aoExcluir,
  extra,
}: {
  nome: string;
  /** Quase sempre texto puro, mas aceita um ícone embutido (ex.: o selo de
   *  débito automático colado ao "dia N", em Despesas Fixas). */
  detalhe: ReactNode;
  valor?: string;
  aoEditar: () => void;
  aoExcluir: () => void;
  extra?: ReactNode;
}) {
  const [menuAberto, setMenuAberto] = useState(false);
  const ancoraRef = useRef<HTMLButtonElement>(null);

  const acoes: AcaoItem[] = [
    { rotulo: "Editar", Icone: Pencil, onClick: aoEditar },
    { rotulo: "Excluir", Icone: Trash2, onClick: aoExcluir, tone: "perigo" },
  ];

  return (
    <div className={styles.item}>
      <button
        ref={ancoraRef}
        className={styles.itemCorpo}
        onClick={() => setMenuAberto(true)}
        aria-haspopup="dialog"
      >
        <span className={styles.itemTexto}>
          <span className={styles.itemNome}>{nome}</span>
          <span className={styles.itemDetalhe}>{detalhe}</span>
        </span>
        {valor !== undefined && <span className={styles.itemValor}>{valor}</span>}
      </button>
      {extra}
      <MenuAcoesItem
        aberta={menuAberto}
        aoFechar={() => setMenuAberto(false)}
        titulo={nome}
        ancoraRef={ancoraRef}
        acoes={acoes}
      />
    </div>
  );
}

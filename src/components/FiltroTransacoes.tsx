import { useRef, useState } from "react";
import { Check, ListFilter } from "lucide-react";
import CategoriaBolha from "./CategoriaBolha";
import FolhaAncorada from "./FolhaAncorada";
import { useRadiogroupTeclado } from "../hooks/useRadiogroupTeclado";
import { FILTRO_DESPESA, FILTRO_RECEITA, FILTRO_TRANSFERENCIA } from "../utils/transacoes";
import styles from "./FiltroTransacoes.module.css";

/** Uma seção da folha: título + lista de opções de escolha única, "Todas"
 *  (valor "") sempre na frente pra limpar aquela seção. */
function Secao({
  titulo,
  opcoes,
  valor,
  aoMudar,
  comIcone,
}: {
  titulo: string;
  opcoes: string[];
  valor: string;
  aoMudar: (v: string) => void;
  /** Categoria/tipo tem a bolha colorida da seção 4.6; conta não. */
  comIcone?: boolean;
}) {
  const { ref, onKeyDown } = useRadiogroupTeclado<HTMLDivElement>();
  return (
    <div className={styles.secao}>
      <p className={styles.secaoTitulo}>{titulo}</p>
      <div
        className={styles.opcoes}
        role="radiogroup"
        aria-label={titulo}
        ref={ref}
        onKeyDown={onKeyDown}
      >
        <button
          type="button"
          role="radio"
          aria-checked={valor === ""}
          className={`${styles.opcao} ${valor === "" ? styles.ativa : ""}`}
          onClick={() => aoMudar("")}
        >
          <span>Todas</span>
          {valor === "" && <Check size={14} aria-hidden />}
        </button>
        {opcoes.map((o) => {
          const ativa = valor === o;
          return (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={ativa}
              className={`${styles.opcao} ${ativa ? styles.ativa : ""}`}
              onClick={() => aoMudar(o)}
            >
              <span className={styles.opcaoNome}>
                {comIcone && <CategoriaBolha categoria={o} tamanho={20} />}
                {o}
              </span>
              {ativa && <Check size={14} aria-hidden />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Filtro de transações (item novo): categoria — Receita, Despesa (e cada
 *  categoria de despesa, que vem direto de `cfg.categoriasDespesa` e por isso
 *  acompanha sozinha qualquer categoria nova criada em Definições — e
 *  Transferência interna — mais conta/cartão, numa folha só. Cada seção é de
 *  escolha única; as duas se combinam por E lógico (ver `filtrarTransacoes`).
 *
 *  Veículo (carga/despesa do veículo) fica fora do filtro de categoria: usa
 *  outra lista de categorias (`cfg.categoriasVeiculo`), item à parte. */
export default function FiltroTransacoes({
  categorias,
  contas,
  filtroCategoria,
  aoMudarCategoria,
  filtroConta,
  aoMudarConta,
}: {
  categorias: string[];
  contas: string[];
  filtroCategoria: string;
  aoMudarCategoria: (v: string) => void;
  filtroConta: string;
  aoMudarConta: (v: string) => void;
}) {
  const [aberta, setAberta] = useState(false);
  const gatilhoRef = useRef<HTMLButtonElement>(null);
  const ativos = (filtroCategoria ? 1 : 0) + (filtroConta ? 1 : 0);

  const opcoesCategoria = [FILTRO_RECEITA, FILTRO_DESPESA, FILTRO_TRANSFERENCIA, ...categorias];

  return (
    <>
      <button
        ref={gatilhoRef}
        type="button"
        className={`${styles.botao} ${ativos > 0 ? styles.botaoAtivo : ""}`}
        onClick={() => setAberta(!aberta)}
        aria-expanded={aberta}
        aria-label={ativos > 0 ? `Filtrar transações — ${ativos} ativo(s)` : "Filtrar transações"}
        title="Filtrar"
      >
        <ListFilter size={16} aria-hidden />
        {ativos > 0 && <span className={styles.badge}>{ativos}</span>}
      </button>

      <FolhaAncorada
        aberta={aberta}
        aoFechar={() => setAberta(false)}
        titulo="Filtrar transações"
        ancoraRef={gatilhoRef}
      >
        {/* As duas seções lado a lado, cada uma a rolar por si. Empilhadas, a
            folha somava as duas listas (só a de categoria tem ~12 linhas de
            40px) e ficava mais alta do que o ecrã: era preciso rolar tudo
            antes de alcançar o pegador para a fechar. Em paralelo, as listas
            competem pela mesma altura em vez de a somarem, e o cabeçalho da
            folha (e o "Limpar filtros" embaixo) ficam sempre à vista. */}
        <div className={styles.colunas}>
          <Secao
            titulo="Categoria"
            opcoes={opcoesCategoria}
            valor={filtroCategoria}
            aoMudar={aoMudarCategoria}
            comIcone
          />
          <Secao titulo="Conta/cartão" opcoes={contas} valor={filtroConta} aoMudar={aoMudarConta} />
        </div>
        {ativos > 0 && (
          <button
            type="button"
            className={styles.limpar}
            onClick={() => {
              aoMudarCategoria("");
              aoMudarConta("");
            }}
          >
            Limpar filtros
          </button>
        )}
      </FolhaAncorada>
    </>
  );
}

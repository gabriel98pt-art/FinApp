import { Car, ChevronRight, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import BottomSheet from "../components/BottomSheet";
import { useCfgStore } from "../stores/cfgStore";
import { useUiStore, type TipoRegistro } from "../stores/uiStore";
import { corDaCategoriaVisual } from "../utils/categoriaVisual";
import styles from "./MenuRegistroRapido.module.css";

const OPCOES: {
  categoria: "Despesa" | "Receita" | "Veículo";
  tipo: TipoRegistro;
  titulo: string;
  subtitulo: string;
  Icone: LucideIcon;
}[] = [
  {
    categoria: "Despesa",
    tipo: "despesa",
    titulo: "Nova despesa",
    subtitulo: "Compra, conta ou saída de dinheiro",
    Icone: TrendingDown,
  },
  {
    categoria: "Receita",
    tipo: "receita",
    titulo: "Nova receita",
    subtitulo: "Salário, TVDE ou outra entrada",
    Icone: TrendingUp,
  },
  {
    categoria: "Veículo",
    tipo: "carga",
    titulo: "Veículo",
    subtitulo: "Abastecimento ou despesa do carro",
    Icone: Car,
  },
];

/** Menu do "+" (item 1 do lote de UX/nav de 30/08): a primeira escolha antes
 *  de entrar no Registro Rápido — Nova despesa / Nova receita / Veículo (só
 *  com o módulo ligado em Definições). Cada linha usa a MESMA cor de
 *  categoria que já pinta o botão flutuante e o donut
 *  (`corDaCategoriaVisual`), então a cor aqui já é a prévia do que a folha
 *  seguinte vai vestir — sem inventar uma paleta nova só para este menu. */
export default function MenuRegistroRapido() {
  const aberta = useUiStore((s) => s.menuRegistroAberto);
  const fechar = useUiStore((s) => s.fecharMenuRegistro);
  const abrirRegistro = useUiStore((s) => s.abrirRegistro);
  const cfg = useCfgStore((s) => s.cfg);

  const opcoes = OPCOES.filter((o) => o.categoria !== "Veículo" || cfg.showVeiculo);

  function escolher(tipo: TipoRegistro) {
    fechar();
    abrirRegistro(tipo);
  }

  return (
    <BottomSheet aberta={aberta} aoFechar={fechar} titulo="Novo lançamento">
      <div className={styles.lista}>
        {opcoes.map(({ categoria, tipo, titulo, subtitulo, Icone }) => {
          const cor = corDaCategoriaVisual(cfg, categoria);
          return (
            <button
              key={tipo}
              type="button"
              className={styles.linha}
              onClick={() => escolher(tipo)}
            >
              <span
                className={styles.badge}
                style={{ background: `color-mix(in srgb, ${cor} 16%, transparent)`, color: cor }}
                aria-hidden
              >
                <Icone size={20} />
              </span>
              <span className={styles.textos}>
                <span className={styles.titulo}>{titulo}</span>
                <span className={styles.subtitulo}>{subtitulo}</span>
              </span>
              <ChevronRight size={18} className={styles.chevron} aria-hidden />
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}

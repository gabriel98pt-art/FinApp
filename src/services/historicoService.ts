// Captura/restauração de estado pro undo/redo (seção 4.7).
//
// A captura NÃO vai à rede: lê as stores zustand já sincronizadas em memória
// pelo syncService — exatamente como a origem fazia JSON.stringify(S) sobre
// o objeto global em memória, sem custo de leitura no Firebase a cada ação.
//
// A restauração é um `update()` por domínio (receitas, despesasCorrentes,
// veiculo, cfg...), NÃO um `set()` na raiz — achado da auditoria de
// Arquitetura + Testes/QA: `iaUsoService.ts` grava a cota diária de IA em
// `fin_v5/iaUso/{dia}`, um domínio que não tem store própria e por isso
// NUNCA entra em `capturarEstadoAtual()` (não há de onde lê-lo sem ir à
// rede). Um `set()` na raiz apaga qualquer domínio ausente do objeto
// capturado — a cota de IA zerava a cada desfazer/refazer, em silêncio. Com
// `update()`, cada chave de `arvore` é um filho direto de `fin_v5` que é
// substituído inteiro; qualquer OUTRO filho (iaUso hoje, o que vier depois)
// fica intocado — a mesma proteção vale para qualquer domínio futuro que
// também não tenha store, sem precisar prever qual.
import { ref, update } from "firebase/database";
import { db } from "./firebase";
import { useCfgStore } from "../stores/cfgStore";
import { useEventosStore } from "../stores/eventosStore";
import { useFundosStore } from "../stores/fundosStore";
import {
  useDespesasFixasStore,
  useDespesasStore,
  useReceitasStore,
  useTransferenciasStore,
} from "../stores/lancamentosStore";
import { useParcelasStore } from "../stores/parcelasStore";
import { useTvdeStore } from "../stores/tvdeStore";
import { useVeiculoStore } from "../stores/veiculoStore";
import { brutoDasInstituicoes } from "../utils/instituicoes";

const raiz = (uid: string) => `users/${uid}/fin_v5`;

/** Lista normalizada [{id,...}] → mapa {id: {...sem id}} — formato que o
 *  RTDB (e o resto dos domínios) espera ao escrever a árvore de volta. */
function paraMapa<T extends { id: string }>(itens: T[]): Record<string, Omit<T, "id">> {
  const mapa: Record<string, Omit<T, "id">> = {};
  for (const { id, ...resto } of itens) mapa[id] = resto;
  return mapa;
}

/** Serializa o estado atual da conta — equivalente ao JSON.stringify(S) da
 *  origem, mas lendo das stores em memória em vez de um objeto global único. */
export function capturarEstadoAtual(): string {
  const veiculo = useVeiculoStore.getState().dados;
  const cfg = useCfgStore.getState().cfg;
  const arvore = {
    receitas: paraMapa(useReceitasStore.getState().itens),
    despesasCorrentes: paraMapa(useDespesasStore.getState().itens),
    parcelas: paraMapa(useParcelasStore.getState().itens),
    veiculo: {
      cargas: paraMapa(veiculo.cargas),
      despesas: paraMapa(veiculo.despesas),
      despesasFixas: paraMapa(veiculo.despesasFixas),
      quilometragem: paraMapa(veiculo.quilometragem),
    },
    eventos: paraMapa(useEventosStore.getState().itens),
    fundos: paraMapa(useFundosStore.getState().itens),
    despesasFixas: paraMapa(useDespesasFixasStore.getState().itens),
    transferencias: paraMapa(useTransferenciasStore.getState().itens),
    // `cfg.instituicoes` é uma LISTA em memória (normalizarConfig já a
    // converteu do mapa por id que o RTDB guarda). Gravar a lista de volta
    // tal e qual faria o RTDB reindexar por posição (0, 1...) em vez dos ids
    // reais — dois cartões com 1 método cada colidiam no id "0" e a tela de
    // Cartões mostrava duas contas iguais e zeradas. `brutoDasInstituicoes`
    // devolve ao formato de mapa que o RTDB espera, como cfgService já faz
    // em toda escrita normal.
    cfg: { ...cfg, instituicoes: brutoDasInstituicoes(cfg.instituicoes) },
    tvde: useTvdeStore.getState().dados,
  };
  return JSON.stringify(arvore);
}

/** Restaura os domínios capturados por `capturarEstadoAtual` — substitui
 *  cada um por inteiro, mas nunca toca em nada fora dessa lista. */
export async function restaurarEstado(uid: string, estadoSerializado: string): Promise<void> {
  const arvore = JSON.parse(estadoSerializado);
  await update(ref(db, raiz(uid)), arvore);
}

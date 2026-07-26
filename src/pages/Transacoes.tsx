import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ListTree } from "lucide-react";
import Pagina, { EstadoVazio, Kpis } from "../components/Pagina";
import KpiCard from "../components/KpiCard";
import BottomSheet from "../components/BottomSheet";
import CategoriaBolha from "../components/CategoriaBolha";
import { useCfgStore } from "../stores/cfgStore";
import {
  useDespesasFixasStore,
  useDespesasStore,
  useReceitasStore,
  useTransferenciasStore,
} from "../stores/lancamentosStore";
import { useMesVisivelStore } from "../stores/mesVisivelStore";
import { useParcelasStore } from "../stores/parcelasStore";
import { useUiStore } from "../stores/uiStore";
import { useVeiculoStore } from "../stores/veiculoStore";
import { rotuloMes } from "../utils/calculos";
import { formatMoney } from "../utils/money";
import { transacoesDoMes, type DadosTransacoes, type Transacao } from "../utils/transacoes";
import styles from "./Transacoes.module.css";

/** Onde cada tipo é gerenciado — usado pelo botão da folha de detalhe. */
const TELA_DO_TIPO: Record<Transacao["origem"], { rota: string; nome: string }> = {
  receita: { rota: "/receitas", nome: "Receitas" },
  despesa: { rota: "/despesas", nome: "Despesas" },
  fixa: { rota: "/despesas", nome: "Despesas → Fixas" },
  parcela: { rota: "/parcelas", nome: "Parcelas" },
  transferencia: { rota: "/despesas", nome: "Despesas → Transferências" },
  carga: { rota: "/veiculo", nome: "Veículo → Carregamentos" },
  despesaVeiculo: { rota: "/veiculo", nome: "Veículo → Despesas" },
};

/** Extrato geral do mês (item 22): tudo que movimentou dinheiro, num feed só.
 *  Clicar numa linha abre a folha de edição do tipo quando ela é global
 *  (receita/despesa, pelo Registro rápido) e, nos demais, uma folha de
 *  detalhe com atalho pra tela que gerencia aquele tipo. */
export default function Transacoes() {
  const cfg = useCfgStore((s) => s.cfg);
  const mes = useMesVisivelStore((s) => s.mes);
  const navegar = useNavigate();
  const abrirRegistro = useUiStore((s) => s.abrirRegistro);
  const [detalhe, setDetalhe] = useState<Transacao | null>(null);

  const dados: DadosTransacoes = {
    receitas: useReceitasStore((s) => s.itens),
    despesasCorrentes: useDespesasStore((s) => s.itens),
    despesasFixas: useDespesasFixasStore((s) => s.itens),
    parcelas: useParcelasStore((s) => s.itens),
    transferencias: useTransferenciasStore((s) => s.itens),
    veiculo: useVeiculoStore((s) => s.dados),
  };

  // O extrato junta seis domínios: só é "vazio" quando todos já carregaram —
  // senão a tela afirma "nada movimentado" enquanto o Firebase ainda responde.
  // Um hook por store, sem curto-circuito: `&&` entre chamadas de hook mudaria
  // a ordem delas entre renders.
  const receitasOk = useReceitasStore((s) => s.carregado);
  const despesasOk = useDespesasStore((s) => s.carregado);
  const fixasOk = useDespesasFixasStore((s) => s.carregado);
  const parcelasOk = useParcelasStore((s) => s.carregado);
  const transferenciasOk = useTransferenciasStore((s) => s.carregado);
  const veiculoOk = useVeiculoStore((s) => s.carregado);
  const carregado =
    receitasOk && despesasOk && fixasOk && parcelasOk && transferenciasOk && veiculoOk;

  const itens = transacoesDoMes(dados, mes);
  const entradas = itens.filter((t) => t.entrada).reduce((s, t) => s + t.valor, 0);
  const saidas = itens.filter((t) => !t.entrada).reduce((s, t) => s + t.valor, 0);

  function abrir(t: Transacao) {
    if (t.origem === "receita" || t.origem === "despesa") {
      abrirRegistro(t.origem, t.refId);
      return;
    }
    setDetalhe(t);
  }

  return (
    <Pagina titulo="Transações">
      <Kpis>
        <KpiCard rotulo="Entradas" valor={formatMoney(entradas, cfg.currency)} tom="verde" />
        <KpiCard rotulo="Saídas" valor={formatMoney(saidas, cfg.currency)} tom="vermelho" />
        <KpiCard
          rotulo="Movimentações"
          valor={String(itens.length)}
          tom={entradas - saidas >= 0 ? "acento" : "amarelo"}
        />
      </Kpis>

      {carregado && itens.length === 0 ? (
        <EstadoVazio
          Icone={ListTree}
          mensagem={`Nada movimentado em ${rotuloMes(mes)}`}
          sub="Receitas, despesas, parcelas, transferências e o veículo aparecem aqui juntos."
        />
      ) : (
        <div className={styles.lista}>
          {itens.map((t) => (
            <button key={t.chave} className={styles.linha} onClick={() => abrir(t)}>
              <CategoriaBolha categoria={t.categoria ?? ""} tamanho={32} />
              <span className={styles.texto}>
                <span className={styles.titulo}>{t.titulo}</span>
                <span className={styles.detalhe}>
                  {t.data.slice(8, 10)}/{t.data.slice(5, 7)}
                  {t.categoria ? ` · ${t.categoria}` : ""}
                  {t.conta ? ` · ${t.conta}` : ""}
                </span>
              </span>
              <span className={`${styles.valor} ${t.entrada ? styles.entrada : styles.saida}`}>
                {t.entrada ? "+" : "−"}
                {formatMoney(t.valor, cfg.currency)}
              </span>
            </button>
          ))}
        </div>
      )}

      <BottomSheet
        aberta={detalhe !== null}
        aoFechar={() => setDetalhe(null)}
        titulo={detalhe?.titulo ?? ""}
      >
        {detalhe && (
          <div className={styles.detalhes}>
            <div className={styles.linhaDetalhe}>
              <span>Valor</span>
              <strong className={detalhe.entrada ? styles.entrada : styles.saida}>
                {detalhe.entrada ? "+" : "−"}
                {formatMoney(detalhe.valor, cfg.currency)}
              </strong>
            </div>
            <div className={styles.linhaDetalhe}>
              <span>Data</span>
              <strong>
                {detalhe.data.slice(8, 10)}/{detalhe.data.slice(5, 7)}/{detalhe.data.slice(0, 4)}
              </strong>
            </div>
            {detalhe.categoria && (
              <div className={styles.linhaDetalhe}>
                <span>Categoria</span>
                <strong>{detalhe.categoria}</strong>
              </div>
            )}
            {detalhe.conta && (
              <div className={styles.linhaDetalhe}>
                <span>Conta/cartão</span>
                <strong>{detalhe.conta}</strong>
              </div>
            )}
            <button
              className={styles.irPara}
              onClick={() => {
                const destino = TELA_DO_TIPO[detalhe.origem];
                setDetalhe(null);
                navegar(destino.rota);
              }}
            >
              Abrir em {TELA_DO_TIPO[detalhe.origem].nome}
            </button>
          </div>
        )}
      </BottomSheet>
    </Pagina>
  );
}

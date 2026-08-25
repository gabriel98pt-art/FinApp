import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ListTree } from "lucide-react";
import Pagina, { EstadoVazio, Kpis } from "../components/Pagina";
import KpiCard from "../components/KpiCard";
import BottomSheet from "../components/BottomSheet";
import CategoriaBolha from "../components/CategoriaBolha";
import ErroSincronizacao from "../components/ErroSincronizacao";
import FiltroTransacoes from "../components/FiltroTransacoes";
import SeletorCategoria from "../components/SeletorCategoria";
import { useConfirmar } from "../hooks/useConfirmar";
import { criarDespesa } from "../services/lancamentosService";
import { removerCarga } from "../services/veiculoService";
import { useAuthStore } from "../stores/authStore";
import { useCfgStore } from "../stores/cfgStore";
import {
  useDespesasFixasStore,
  useDespesasStore,
  useReceitasStore,
  useTransferenciasStore,
} from "../stores/lancamentosStore";
import { useMesVisivelStore } from "../stores/mesVisivelStore";
import { useParcelasStore } from "../stores/parcelasStore";
import { mostrarToast } from "../stores/toastStore";
import { useUiStore } from "../stores/uiStore";
import { useVeiculoStore } from "../stores/veiculoStore";
import { hojeIso, mesAtual, rotuloMes } from "../utils/calculos";
import { formatMoney } from "../utils/money";
import { nomeAtualDoMetodo } from "../utils/instituicoes";
import { dadosDespesaDaCarga } from "../utils/veiculo";
import {
  entraDinheiro,
  filtrarTransacoes,
  transacoesDoMes,
  type DadosTransacoes,
  type Transacao,
} from "../utils/transacoes";
import styles from "./Transacoes.module.css";

/** Onde cada tipo é gerenciado — usado pelo botão da folha de detalhe.
 *  `aba`, quando presente, é passada como state da navegação para a página
 *  de destino abrir direto na aba certa (item 4.6) — sem isto, "aba" é
 *  estado local da página de destino e ela cai sempre na primeira. */
const TELA_DO_TIPO: Record<Transacao["origem"], { rota: string; nome: string; aba?: string }> = {
  receita: { rota: "/receitas", nome: "Receitas" },
  despesa: { rota: "/despesas", nome: "Despesas" },
  fixa: { rota: "/despesas", nome: "Despesas → Fixas", aba: "fixas" },
  parcela: { rota: "/parcelas", nome: "Parcelas" },
  transferencia: { rota: "/cartoes", nome: "Cartões → Transferências" },
  carga: { rota: "/veiculo", nome: "Veículo → Carregamentos", aba: "cargas" },
  despesaVeiculo: { rota: "/veiculo", nome: "Veículo → Despesas", aba: "despesas" },
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
  const uid = useAuthStore((s) => s.sessao?.uid);
  const confirmar = useConfirmar();
  const [detalhe, setDetalhe] = useState<Transacao | null>(null);
  // Correção de recarga: `null` = a folha ainda não abriu o formulário; string
  // = está aberto, com a categoria escolhida até agora. Começa em "Outros", o
  // mesmo destino que a importação dá ao que não sabe classificar — e nunca em
  // vazio, senão a lista mostrava dois "Outros" (o de limpar e o de verdade).
  const [categoriaMover, setCategoriaMover] = useState<string | null>(null);
  const [movendo, setMovendo] = useState(false);
  // Filtro de categoria/conta (item novo) — "" em cada um é "sem filtro".
  // A categoria pode vir pronta pelo state da navegação: é assim que clicar
  // numa fatia do donut do Início cai aqui já filtrado (mesmo padrão do `aba`
  // que Despesas.tsx recebe). Lido UMA vez, só para semear o estado local —
  // depois o filtro é do usuário. Não valida contra lista nenhuma porque
  // categoria é lista aberta (`cfg.categoriasDespesa`); nome desconhecido dá
  // lista vazia, que é resultado legível.
  const location = useLocation();
  const categoriaPedida = (location.state as { categoria?: string } | null)?.categoria;
  const [filtroCategoria, setFiltroCategoria] = useState(categoriaPedida ?? "");
  const [filtroConta, setFiltroConta] = useState("");

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

  // Em queda de subscrição o syncService marca `carregado: true` junto com
  // `erro: true` — de propósito, para a tela sair do "Carregando…" em vez de
  // esperar para sempre. O efeito colateral era este ecrã afirmar "Nada
  // movimentado em <mês>" quando o que houve foi falha de rede: uma frase
  // categórica sobre dados que não chegámos a ver.
  const erro = [
    useReceitasStore((s) => s.erro),
    useDespesasStore((s) => s.erro),
    useDespesasFixasStore((s) => s.erro),
    useParcelasStore((s) => s.erro),
    useTransferenciasStore((s) => s.erro),
    useVeiculoStore((s) => s.erro),
  ].some(Boolean);

  const itens = transacoesDoMes(dados, mes, mesAtual(), hojeIso());
  // KPIs e lista seguem o filtro — os dois cartões de cima e a contagem
  // refletem só o que está visível, não o mês inteiro por baixo dele.
  const itensFiltrados = filtrarTransacoes(itens, filtroCategoria, filtroConta);
  // `entraDinheiro`, não `t.entrada`: um reembolso é despesa de valor negativo
  // (ver utils/transacoes.ts) — sem isto ficava a somar ao lado errado, com o
  // sinal ao contrário (ex.: reembolso de € 75 entrava em "Saídas: -€ 75,00").
  const entradas = itensFiltrados
    .filter((t) => entraDinheiro(t))
    .reduce((s, t) => s + Math.abs(t.valor), 0);
  const saidas = itensFiltrados
    .filter((t) => !entraDinheiro(t))
    .reduce((s, t) => s + Math.abs(t.valor), 0);
  // O número que faltava: sobrou ou faltou dinheiro no que está a ser visto.
  // Derivado das mesmas duas somas acima, portanto segue o filtro tal como
  // elas. Ficava no lugar dele uma contagem de linhas — que a lista já mostra
  // logo abaixo, em "N transações".
  const saldo = entradas - saidas;
  const filtroAtivo = filtroCategoria !== "" || filtroConta !== "";

  function abrir(t: Transacao) {
    if (t.origem === "receita" || t.origem === "despesa") {
      abrirRegistro(t.origem, t.refId);
      return;
    }
    setCategoriaMover(null);
    setDetalhe(t);
  }

  function fecharDetalhe() {
    setDetalhe(null);
    setCategoriaMover(null);
  }

  /** Recarga que afinal não era recarga: o reconhecimento do extrato bate pelo
   *  texto, e um supermercado que também tem posto de carregamento (o
   *  Continente) aparece igual nos dois casos. Como o palpite não tem como
   *  acertar sempre, a saída é aqui, depois de gravado. */
  async function moverParaDespesas() {
    if (!detalhe || !uid || categoriaMover === null) return;
    const carga = dados.veiculo.cargas.find((c) => c.id === detalhe.refId);
    if (!carga) {
      mostrarToast("Este carregamento já não existe.");
      fecharDetalhe();
      return;
    }
    if (!(await confirmar(`Mover "${detalhe.titulo}" para despesas comuns?`))) return;

    setMovendo(true);
    try {
      // Cria primeiro, apaga depois: se o apagar falhar fica um registo a mais,
      // que dá para corrigir à mão — na ordem inversa, o dinheiro sumia.
      await criarDespesa(uid, dadosDespesaDaCarga(carga, categoriaMover));
      await removerCarga(uid, carga.id);
      mostrarToast("✓ Movida para despesas");
      fecharDetalhe();
    } catch {
      mostrarToast("Não foi possível concluir. Tente de novo.");
    } finally {
      setMovendo(false);
    }
  }

  return (
    <Pagina titulo="Transações">
      {/* Com `pagina`, o mobile — que só cabe 2 dos 3 — deixa de ficar preso a
          Entradas/Saídas: quem quiser pode trocar um deles pelo Saldo em
          Definições. Sem isto o cartão novo só existiria no desktop. */}
      <Kpis pagina="transacoes">
        <KpiCard rotulo="Entradas" valor={formatMoney(entradas, cfg.currency)} tom="verde" />
        <KpiCard rotulo="Saídas" valor={formatMoney(saidas, cfg.currency)} tom="vermelho" />
        <KpiCard
          rotulo="Saldo"
          valor={formatMoney(saldo, cfg.currency)}
          sub={filtroAtivo ? "no filtro ativo" : undefined}
          // "amarelo" era inconsistente com todo o resto do app (Início,
          // Resumo Anual, Despesas, Receitas, Planejamento): saldo/variação
          // negativos são sempre "vermelho" (achado da auditoria de Design).
          tom={saldo >= 0 ? "acento" : "vermelho"}
        />
      </Kpis>

      {itens.length > 0 && (
        <div className={styles.cabecalho}>
          <span className={styles.contagem}>
            {filtroAtivo
              ? `${itensFiltrados.length} de ${itens.length} transações`
              : `${itens.length} transações`}
          </span>
          <FiltroTransacoes
            categorias={cfg.categoriasDespesa}
            contas={cfg.contasCartoes}
            filtroCategoria={filtroCategoria}
            aoMudarCategoria={setFiltroCategoria}
            filtroConta={filtroConta}
            aoMudarConta={setFiltroConta}
            rotuloConta={(c) => nomeAtualDoMetodo(cfg, c)}
          />
        </div>
      )}

      {/* Há linhas na tela: faixa fina por cima, elas continuam a valer. */}
      {erro && itensFiltrados.length > 0 && <ErroSincronizacao compacto />}

      {erro && itens.length === 0 ? (
        // Sem nada para mostrar E com a sincronização caída, o vazio seria uma
        // afirmação errada ("não movimentaste nada") sobre dados que não
        // chegaram. Aqui a caixa cheia substitui mesmo o vazio.
        <ErroSincronizacao sub="Não deu para carregar o extrato deste mês." />
      ) : carregado && itens.length === 0 ? (
        <EstadoVazio
          Icone={ListTree}
          mensagem={`Nada movimentado em ${rotuloMes(mes)}`}
          sub="Receitas, despesas, parcelas, transferências e o veículo aparecem aqui juntos."
        />
      ) : carregado && itensFiltrados.length === 0 ? (
        <EstadoVazio
          Icone={ListTree}
          mensagem="Nenhuma transação com esse filtro"
          sub="Tente outra categoria ou conta, ou limpe o filtro no ícone acima."
        />
      ) : (
        <div className={styles.lista}>
          {itensFiltrados.map((t) => {
            const entrada = entraDinheiro(t);
            return (
              <button key={t.chave} className={styles.linha} onClick={() => abrir(t)}>
                <CategoriaBolha categoria={t.categoria ?? ""} tamanho={32} />
                <span className={styles.texto}>
                  <span className={styles.titulo}>{t.titulo}</span>
                  <span className={styles.detalhe}>
                    {t.data.slice(8, 10)}/{t.data.slice(5, 7)}
                    {t.categoria ? ` · ${t.categoria}` : ""}
                    {t.nota ? ` · ${t.nota}` : ""}
                    {t.conta ? ` · ${nomeAtualDoMetodo(cfg, t.conta)}` : ""}
                  </span>
                </span>
                <span className={`${styles.valor} ${entrada ? styles.entrada : styles.saida}`}>
                  {entrada ? "+" : "−"}
                  {formatMoney(Math.abs(t.valor), cfg.currency)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <BottomSheet
        aberta={detalhe !== null}
        aoFechar={fecharDetalhe}
        titulo={detalhe?.titulo ?? ""}
      >
        {detalhe && (
          <div className={styles.detalhes}>
            <div className={styles.linhaDetalhe}>
              <span>Valor</span>
              <strong className={entraDinheiro(detalhe) ? styles.entrada : styles.saida}>
                {entraDinheiro(detalhe) ? "+" : "−"}
                {formatMoney(Math.abs(detalhe.valor), cfg.currency)}
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
                <strong>{nomeAtualDoMetodo(cfg, detalhe.conta)}</strong>
              </div>
            )}
            {detalhe.nota && (
              <div className={styles.linhaDetalhe}>
                <span>Nota</span>
                <strong>{detalhe.nota}</strong>
              </div>
            )}
            <button
              className={styles.irPara}
              onClick={() => {
                const destino = TELA_DO_TIPO[detalhe.origem];
                fecharDetalhe();
                navegar(destino.rota, destino.aba ? { state: { aba: destino.aba } } : undefined);
              }}
            >
              Abrir em {TELA_DO_TIPO[detalhe.origem].nome}
            </button>
            {detalhe.origem === "carga" &&
              (categoriaMover === null ? (
                <button className={styles.mover} onClick={() => setCategoriaMover("Outros")}>
                  Não foi uma recarga — mover para despesas
                </button>
              ) : (
                // Inline, na mesma folha: a escolha da categoria é o único
                // passo que falta, não vale abrir outra folha por cima.
                <div className={styles.formMover}>
                  <SeletorCategoria
                    valor={categoriaMover}
                    opcoes={cfg.categoriasDespesa}
                    aoMudar={setCategoriaMover}
                    nivel={2}
                  />
                  <button
                    className={styles.confirmarMover}
                    onClick={moverParaDespesas}
                    disabled={movendo}
                  >
                    {/* A operação são duas escritas seguidas (criar a despesa,
                        apagar a carga) e pode demorar. Só o botão apagado não
                        diz se está a andar ou se o toque falhou — mesmo padrão
                        de "Importando…" em Definições e "Lendo…" em Importar. */}
                    {movendo ? "Movendo…" : "Mover para despesas"}
                  </button>
                </div>
              ))}
          </div>
        )}
      </BottomSheet>
    </Pagina>
  );
}

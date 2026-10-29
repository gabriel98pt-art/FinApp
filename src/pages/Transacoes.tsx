import { useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ListTree, Pencil, Search, Trash2 } from "lucide-react";
import { EstadoVazio } from "../components/Pagina";
import BottomSheet from "../components/BottomSheet";
import ErroSincronizacao from "../components/ErroSincronizacao";
import IconeLinha from "../components/IconeLinha";
import FiltroTransacoes from "../components/FiltroTransacoes";
import MenuAcoesItem, { type AcaoItem } from "../components/MenuAcoesItem";
import Paginador from "../components/Paginador";
import SeletorCategoria from "../components/SeletorCategoria";
import { ITENS_POR_PAGINA } from "../components/ListaLancamentos";
import { useConfirmar } from "../hooks/useConfirmar";
import { criarDespesa, removerDespesa, removerReceita } from "../services/lancamentosService";
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
import type { Currency, IsoDate } from "../types";
import { hojeIso, mesAtual, rotuloMes } from "../utils/calculos";
import { formatMoney } from "../utils/money";
import { nomeAtualDoMetodo } from "../utils/instituicoes";
import { agruparPorDia, rotuloDoDia } from "../utils/agruparPorDia";
import { dadosDespesaDaCarga } from "../utils/veiculo";
import {
  entraDinheiro,
  filtrarTransacoes,
  TELA_DO_TIPO,
  transacoesDoMes,
  type DadosTransacoes,
  type Transacao,
} from "../utils/transacoes";
import styles from "./Transacoes.module.css";

/** Uma linha do extrato — item 2 do lote de UX/nav (30/08). Receita/despesa
 *  (os dois tipos que o Registro Rápido já edita em qualquer tela do app)
 *  ganham o mesmo menu único (Editar/Excluir) que Despesas e Receitas já
 *  têm. Os outros cinco tipos (fixa, parcela, transferência, carga, despesa
 *  do veículo) continuam a abrir a folha de detalhe com "Abrir em X" — não
 *  têm um editor próprio aqui dentro, e criar cinco seria escopo novo, não
 *  deste item (ver o commit de TVDE, mesma decisão para as despesas do
 *  TVDE). */
function LinhaTransacao({
  t,
  moeda,
  nomeDaConta,
  aoEditar,
  aoExcluir,
  aoAbrirDetalhe,
}: {
  t: Transacao;
  moeda: Currency;
  nomeDaConta: (id: string) => string;
  aoEditar: (t: Transacao) => void;
  aoExcluir: (t: Transacao) => void;
  aoAbrirDetalhe: (t: Transacao) => void;
}) {
  const [menuAberto, setMenuAberto] = useState(false);
  const ancoraRef = useRef<HTMLButtonElement>(null);
  const entrada = entraDinheiro(t);
  const editavel = t.origem === "receita" || t.origem === "despesa";

  const acoes: AcaoItem[] = [
    { rotulo: "Editar", Icone: Pencil, onClick: () => aoEditar(t) },
    { rotulo: "Excluir", Icone: Trash2, onClick: () => aoExcluir(t), tone: "perigo" },
  ];

  return (
    <li>
      <button
        ref={ancoraRef}
        className={styles.linha}
        onClick={() => (editavel ? setMenuAberto(true) : aoAbrirDetalhe(t))}
        aria-haspopup={editavel ? "dialog" : undefined}
      >
        <IconeLinha categoria={t.categoria} entrada={entrada} />
        {/* A data já está no cabeçalho do dia, por isso não se repete aqui. */}
        <span className={styles.texto}>
          <span className={styles.titulo}>{t.titulo}</span>
          <span className={styles.detalhe}>
            {[t.categoria, t.nota, t.conta ? nomeDaConta(t.conta) : ""].filter(Boolean).join(" · ")}
          </span>
        </span>
        {/* Aqui entram e saem coisas na mesma lista, por isso o sinal fica nos
              dois lados; só o que entra leva verde. */}
        <span className={`${styles.valor} ${entrada ? styles.entrada : ""}`}>
          {entrada ? "+" : "−"}
          {formatMoney(Math.abs(t.valor), moeda)}
        </span>
      </button>
      {editavel && (
        <MenuAcoesItem
          aberta={menuAberto}
          aoFechar={() => setMenuAberto(false)}
          titulo={t.titulo}
          ancoraRef={ancoraRef}
          acoes={acoes}
        />
      )}
    </li>
  );
}

/** O extrato em páginas de 15 (01/09). Era a única lista grande do app que
 *  ainda desenhava tudo de uma vez: junta seis domínios do mês (receitas,
 *  despesas, fixas, parcelas, transferências e veículo), então num mês normal
 *  passa fácil das cem linhas — e a pessoa tinha de rolar por todas para
 *  chegar ao fim, com o telemóvel a montar cem linhas de cada vez que
 *  qualquer coisa mudava.
 *
 *  Componente à parte, e não estado da página, por causa da `key`: quem o usa
 *  troca a chave quando a lista muda de identidade (outro mês, outro filtro)
 *  e isso reinicia a página em 1 — o mesmo truque que Despesas já faz com o
 *  ListaLancamentos. Sem isso, filtrar estando na página 5 deixava à vista
 *  uma fatia do meio de uma lista que a pessoa nunca viu começar. */
function ExtratoPaginado({
  itens,
  moeda,
  nomeDaConta,
  aoEditar,
  aoExcluir,
  aoAbrirDetalhe,
}: {
  itens: Transacao[];
  moeda: Currency;
  nomeDaConta: (id: string) => string;
  aoEditar: (t: Transacao) => void;
  aoExcluir: (t: Transacao) => void;
  aoAbrirDetalhe: (t: Transacao) => void;
}) {
  const [pagina, setPagina] = useState(1);

  // Mesmo cálculo do ListaLancamentos, incluindo o `Math.min`: apagar linhas
  // até a última página deixar de existir não pode deixar a tela em branco.
  const paginas = Math.ceil(itens.length / ITENS_POR_PAGINA) || 1;
  const paginaAtual = Math.min(pagina, paginas);
  const visiveis = itens.slice(
    (paginaAtual - 1) * ITENS_POR_PAGINA,
    paginaAtual * ITENS_POR_PAGINA,
  );

  return (
    <>
      {agruparPorDia(visiveis).map((g) => {
        // O total do dia é o líquido: o que entrou menos o que saiu. Só com 2 ou
        // mais movimentos — com um, repetiria o valor da linha.
        const liquido = g.itens.reduce(
          (soma, t) => soma + (entraDinheiro(t) ? 1 : -1) * Math.abs(t.valor),
          0,
        );
        return (
          <div key={g.dia} className={styles.dia}>
            <div className={styles.diaCabecalho}>
              <h4 className={styles.diaRotulo}>{rotuloDoDia(g.dia)}</h4>
              {g.itens.length >= 2 && (
                <span className={styles.diaTotal}>
                  {liquido < 0 ? "−" : liquido > 0 ? "+" : ""}
                  {formatMoney(Math.abs(liquido), moeda)}
                </span>
              )}
            </div>
            <ul className={styles.lista}>
              {g.itens.map((t) => (
                <LinhaTransacao
                  key={t.chave}
                  t={t}
                  moeda={moeda}
                  nomeDaConta={nomeDaConta}
                  aoEditar={aoEditar}
                  aoExcluir={aoExcluir}
                  aoAbrirDetalhe={aoAbrirDetalhe}
                />
              ))}
            </ul>
          </div>
        );
      })}

      <Paginador pagina={paginaAtual} paginas={paginas} aoMudar={setPagina} />
    </>
  );
}

/** Extrato geral do mês (item 22): tudo que movimentou dinheiro, num feed só.
 *  Clicar numa linha abre a folha de edição do tipo quando ela é global
 *  (receita/despesa, pelo Registro rápido) e, nos demais, uma folha de
 *  detalhe com atalho pra tela que gerencia aquele tipo. */
export default function SecaoTransacoes() {
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
  const [busca, setBusca] = useState("");
  const [deEscolhido, setDe] = useState<IsoDate | "">("");
  const [ateEscolhido, setAte] = useState<IsoDate | "">("");

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

  const itens = transacoesDoMes(dados, mes, mesAtual(), hojeIso(), (id) =>
    nomeAtualDoMetodo(cfg, id),
  );
  // KPIs e lista seguem o filtro — os dois cartões de cima e a contagem
  // refletem só o que está visível, não o mês inteiro por baixo dele.
  // O período só vale dentro do mês exibido: ao mudar de mês, datas do mês
  // anterior deixam de contar em vez de esvaziarem a lista sem explicação.
  const de = deEscolhido.slice(0, 7) === mes ? deEscolhido : "";
  const ate = ateEscolhido.slice(0, 7) === mes ? ateEscolhido : "";
  const itensFiltrados = filtrarTransacoes(itens, filtroCategoria, filtroConta, { busca, de, ate });
  const filtroAtivo =
    filtroCategoria !== "" || filtroConta !== "" || busca.trim() !== "" || de !== "" || ate !== "";

  function limparTudo() {
    setFiltroCategoria("");
    setFiltroConta("");
    setBusca("");
    setDe("");
    setAte("");
  }

  // Item 2 do lote de UX/nav: receita/despesa ganham o menu único
  // (Editar/Excluir) — os outros cinco tipos continuam na folha de detalhe
  // de sempre, aberta por `abrirDetalhe`.
  function editar(t: Transacao) {
    if (t.origem === "receita" || t.origem === "despesa") abrirRegistro(t.origem, t.refId);
  }

  function abrirDetalhe(t: Transacao) {
    setCategoriaMover(null);
    setDetalhe(t);
  }

  async function excluirTransacao(t: Transacao) {
    if (!uid) return;
    if (!(await confirmar(`Excluir "${t.titulo}"?`))) return;
    try {
      if (t.origem === "receita") await removerReceita(uid, t.refId);
      else if (t.origem === "despesa") await removerDespesa(uid, t.refId);
      mostrarToast(t.origem === "receita" ? "Receita excluída" : "Despesa excluída");
    } catch {
      mostrarToast("Não foi possível excluir. Tente de novo.");
    }
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
    <>
      <section className={styles.secao} aria-label="Extrato">
        {itens.length > 0 && (
          <div className={styles.cabecalhoSecao}>
            <div className={styles.tituloLinha}>
              <h3 className={styles.contagem}>
                {filtroAtivo
                  ? `${itensFiltrados.length} de ${itens.length} transações`
                  : `${itens.length} transações`}
              </h3>
              {filtroAtivo && (
                <button type="button" className={styles.limparTudo} onClick={limparTudo}>
                  Limpar tudo
                </button>
              )}
            </div>
            <FiltroTransacoes
              categorias={cfg.categoriasDespesa}
              contas={cfg.contasCartoes}
              filtroCategoria={filtroCategoria}
              aoMudarCategoria={setFiltroCategoria}
              filtroConta={filtroConta}
              aoMudarConta={setFiltroConta}
              rotuloConta={(c) => nomeAtualDoMetodo(cfg, c)}
              mes={mes}
              de={de}
              ate={ate}
              aoMudarPeriodo={(novoDe, novoAte) => {
                setDe(novoDe);
                setAte(novoAte);
              }}
            />
          </div>
        )}
        {itens.length > 0 && (
          <label className={styles.busca}>
            <Search size={16} aria-hidden />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Pesquisar por descrição"
              aria-label="Pesquisar transações"
            />
          </label>
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
            sub="Tente outra pesquisa ou filtro, ou use Limpar tudo."
          />
        ) : (
          <ExtratoPaginado
            /* key: trocar de mês ou de filtro é outra lista — volta pra página 1 */
            key={`${mes}-${filtroCategoria}-${filtroConta}-${busca}-${de}-${ate}`}
            itens={itensFiltrados}
            moeda={cfg.currency}
            nomeDaConta={(id) => nomeAtualDoMetodo(cfg, id)}
            aoEditar={editar}
            aoExcluir={(item) => void excluirTransacao(item)}
            aoAbrirDetalhe={abrirDetalhe}
          />
        )}
      </section>

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
    </>
  );
}

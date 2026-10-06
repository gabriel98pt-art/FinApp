import { useCallback, useEffect, useMemo, useState } from "react";
import {
  apagarExistentes,
  construirExistentes,
  confirmarImportacao,
  dadosDaCarga,
  dadosDaTransferencia,
  pagamentoDaLinha,
} from "../../services/importacaoService";
import { useConfirmar } from "../../hooks/useConfirmar";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useAuthStore } from "../../stores/authStore";
import { comHistoricoSuprimido, useHistoricoStore } from "../../stores/historicoStore";
import { useCfgStore } from "../../stores/cfgStore";
import {
  useDespesasFixasStore,
  useDespesasStore,
  useReceitasStore,
  useTransferenciasStore,
} from "../../stores/lancamentosStore";
import { useImportacaoStore } from "../../stores/importacaoStore";
import { useParcelasStore } from "../../stores/parcelasStore";
import { useVeiculoStore } from "../../stores/veiculoStore";
import { mostrarToast } from "../../stores/toastStore";
import { analisarLinha, aplicarContaATodas } from "../../utils/importacao";
import { parseExtratoCsv } from "../../utils/importacaoParser";
import { extrairExtratoPdf, LeitorPdfIndisponivel } from "../../utils/extrairExtratoPdf";
import { montarDadosFatura } from "../../utils/fatura";
import type { ExistenteParaDedup, LinhaAnalisada, LinhaExtrato } from "../../types";
import type { FiltroImportacao } from "./constantes";

/** Toda a lógica da página Importar num só sítio: é o único ponto que fala com
 *  as stores (rascunho persistido + dados de domínio para análise/dedup). Os
 *  componentes de `pages/importar/` só recebem dados e callbacks por props. */
export function useImportacao() {
  const uid = useAuthStore((s) => s.sessao?.uid);
  const pedirConfirmacao = useConfirmar();
  const cfg = useCfgStore((s) => s.cfg);
  const receitas = useReceitasStore((s) => s.itens);
  const despesas = useDespesasStore((s) => s.itens);
  const parcelas = useParcelasStore((s) => s.itens);
  // Carga elétrica, despesa do veículo e transferência também são dinheiro que
  // pode vir repetido no extrato — entram na comparação de duplicatas.
  const veiculo = useVeiculoStore((s) => s.dados);
  const transferencias = useTransferenciasStore((s) => s.itens);
  const despesasFixas = useDespesasFixasStore((s) => s.itens);

  // O rascunho (texto colado + linhas analisadas) vive numa store persistida:
  // trocar de página e voltar, ou até dar refresh, mantém o extrato que ainda
  // não foi confirmado — antes desaparecia ao desmontar a página.
  const texto = useImportacaoStore((s) => s.texto);
  const setTexto = useImportacaoStore((s) => s.setTexto);
  const linhas = useImportacaoStore((s) => s.linhas);
  const setLinhas = useImportacaoStore((s) => s.setLinhas);
  const importadoEm = useImportacaoStore((s) => s.importadoEm);
  const setImportadoEm = useImportacaoStore((s) => s.setImportadoEm);
  const marcarImportado = useImportacaoStore((s) => s.marcarImportado);
  const totalImportado = useImportacaoStore((s) => s.totalImportado);
  const resetarRascunho = useImportacaoStore((s) => s.resetar);

  // Quanto tempo a revisão fica visível (marcada "importado") depois de
  // confirmar, antes de limpar sozinha — dá tempo de notar um engano e
  // desfazer (↩) sem apagar as marcações, sem ficar presa na tela pra sempre.
  const ATRASO_LIMPEZA_MS = 2 * 60 * 1000;
  /** Posição da pilha de undo no momento em que esta importação foi
   *  confirmada — comparado ao índice atual (abaixo) pra saber se um
   *  "Desfazer" já passou por cima dela. Derivado no render, não num efeito:
   *  não há nada pra sincronizar com um sistema externo aqui, só uma conta a
   *  partir de dois números que já estão disponíveis. Vive na store
   *  persistida, junto de `importadoEm`: num useState perdia-se ao sair da
   *  aba e voltar, e um "Desfazer" feito entretanto deixava de ser detectado. */
  const indiceAoImportar = useImportacaoStore((s) => s.indiceAoImportar);
  const indiceHistoricoAtual = useHistoricoStore((s) => s.pilha.indice);
  const tamanhoPilha = useHistoricoStore((s) => s.pilha.pilha.length);
  // A pilha de undo só existe em memória: um refresh (ou novo login) começa-a
  // vazia, e aí o índice guardado já não se refere a ela — comparar daria
  // "desfeito" sem ninguém ter desfeito nada, e reabria uma revisão já
  // gravada. Só conta enquanto a pilha ainda contém o ponto da importação.
  const foiDesfeito =
    Boolean(importadoEm) &&
    indiceAoImportar !== null &&
    indiceAoImportar < tamanhoPilha &&
    indiceHistoricoAtual < indiceAoImportar;
  // Alguém desfez (↩ no menu "Mais") depois desta importação: os dados já voltaram no
  // Firebase, então a revisão volta a ficar editável — mesmo sem `importadoEm`
  // ainda ter sido limpo, é como se não tivesse sido confirmada.
  const mostrandoImportado = Boolean(importadoEm) && !foiDesfeito;

  // Identidade estável (setters do zustand não mudam entre renders) — pode
  // entrar nas deps do efeito abaixo sem reiniciar o timer a cada render.
  const limparRevisao = useCallback(() => {
    setLinhas(null);
    setTexto("");
    // Limpa também `totalImportado`/`indiceAoImportar` (ver a store).
    setImportadoEm(null);
  }, [setLinhas, setTexto, setImportadoEm]);

  // Limpeza automática: se ninguém desfez nem limpou à mão, a revisão some
  // sozinha depois de ATRASO_LIMPEZA_MS. Calculado a partir do timestamp (não
  // de uma duração fixa) pra funcionar certo mesmo depois de um refresh a
  // meio da espera — `importadoEm` é persistido. Não dispara se já foi
  // desfeito: aí a revisão está ativa de novo, não é lixo pra apagar. O delay
  // nunca é negativo — mesmo "já devia ter limpado" dispara no próximo tick
  // em vez de chamar setState direto no corpo do efeito.
  useEffect(() => {
    if (!importadoEm || foiDesfeito) return;
    const restante = Math.max(0, ATRASO_LIMPEZA_MS - (Date.now() - importadoEm));
    const id = setTimeout(limparRevisao, restante);
    return () => clearTimeout(id);
  }, [importadoEm, foiDesfeito, ATRASO_LIMPEZA_MS, limparRevisao]);

  const [filtro, setFiltro] = useState<FiltroImportacao>("todas");
  const [enviando, setEnviando] = useState(false);
  const [lendoPdf, setLendoPdf] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  // Decide o peso visual do botão "Colar" (ver comentário em
  // `colarDoClipboard`) — quem não tem mouse/trackpad (hover:none) nem
  // ponteiro fino (pointer:coarse) é quem de fato precisa dele em destaque.
  const semMouse = useMediaQuery("(hover: none) and (pointer: coarse)");
  /** Conta escolhida para o extrato todo de uma vez. O extrato costuma ser de
   *  uma conta só, e escolher a mesma linha a linha era o trabalho repetido
   *  desta página. Só guarda o que foi escolhido em massa — a fonte da verdade
   *  continua a ser o campo de cada linha, que fica livre para ser mudado
   *  depois individualmente. */
  const [contaEmMassa, setContaEmMassa] = useState<string>("");
  /** Linhas que vão entrar e que se parecem com algo já registado — quando há,
   *  passam pela folha de revisão antes de qualquer gravação. */
  const [revisaoDup, setRevisaoDup] = useState<LinhaAnalisada[] | null>(null);
  /** Ids das linhas cujo registo antigo o usuário mandou apagar. Desligado por
   *  omissão: apagar é sempre escolha dele, nunca automático — e só entra
   *  aqui depois do passo de confirmação próprio da folha de duplicatas. */
  const [marcadasParaApagar, setMarcadasParaApagar] = useState<Set<number>>(new Set());
  /** As duplicatas desta tentativa de importar já passaram pela folha delas.
   *  Garante que nada é gravado sem a folha ter sido vista — mesmo que
   *  `confirmar` seja chamado por outro caminho. */
  const [duplicatasRevistas, setDuplicatasRevistas] = useState(false);
  /** Folha de confirmação ("N entram · M ficam de fora"), o último passo
   *  antes de gravar. */
  const [resumoAberto, setResumoAberto] = useState(false);
  /** Linhas cujo aviso "outra ponta da transferência" está expandido, mostrando
   *  data/valor/onde está do registo que bateu — fechado por omissão, pra não
   *  poluir a lista quando não interessa. */
  const [outraPontaAberta, setOutraPontaAberta] = useState<Set<number>>(new Set());

  const categoriasConfiguradas = cfg.categoriasDespesa;
  // As três listas abaixo (e os dois handlers `atualizarLinha`/
  // `alternarOutraPonta`, mais abaixo) vão como props para cada
  // `LinhaImportacao`, que é `memo`: precisam de manter a mesma identidade
  // entre renders, senão editar uma linha re-renderizava a lista inteira.
  // "Outros" só aparece se for mesmo uma categoria da conta: antes era
  // acrescentado aqui à força, e servia de "ainda não escolhida". Categoria
  // por escolher agora é vazia e mostra-se "Sem categoria" (ver `analisarLinha`).
  const opcoesCategoria = useMemo(
    () => [...new Set([...categoriasConfiguradas, "Cartão de Crédito", "Transferência"])],
    [categoriasConfiguradas],
  );
  // Receita não tem categoria, tem FONTE — outro conceito e outro campo. A
  // lista de despesas ("Alimentação", "Saúde") não dizia nada a quem estava a
  // classificar um salário.
  const fontesReceita = cfg.fontesReceita;
  const opcoesFonte = useMemo(
    () => [...new Set([...fontesReceita, "Transferência"])],
    [fontesReceita],
  );
  // Só cartões de crédito têm fatura para pagar.
  const contasCartoes = cfg.contasCartoes;
  const tipoCartao = cfg.tipoCartao;
  const cartoesCredito = useMemo(
    () => contasCartoes.filter((c) => tipoCartao[c] === "credit"),
    [contasCartoes, tipoCartao],
  );

  function analisar(brutas: LinhaExtrato[]) {
    if (brutas.length === 0) {
      mostrarToast("Nenhuma linha reconhecida — confira o formato do extrato.");
      return;
    }
    const existentes = construirExistentes(
      receitas,
      despesas,
      veiculo.cargas,
      veiculo.despesas,
      transferencias,
      despesasFixas,
    );
    const analisadas = brutas.map((tx, i) =>
      analisarLinha(tx, i, {
        parcelas,
        categoriasConfiguradas,
        // A memória do app é o próprio histórico do usuário: o que ele já
        // categorizou antes vale mais do que qualquer regra genérica.
        despesasHistorico: despesas,
        receitasHistorico: receitas,
        transferenciasHistorico: transferencias,
        existentes,
        locaisCarregamento: cfg.locaisCarregamento,
        cargasHistorico: veiculo.cargas,
      }),
    );
    setLinhas(analisadas);
    setFiltro("todas");
    // Os ids das linhas são o índice no extrato (0..n): um "aberto" que
    // ficasse do extrato anterior abriria a linha errada neste.
    setOutraPontaAberta(new Set());
    mostrarToast(`${analisadas.length} linha(s) analisada(s)`);
  }

  /** Botão "Analisar": o texto colado/escrito na caixa vai pelo parser de CSV. */
  function analisarTexto() {
    analisar(parseExtratoCsv(texto));
  }

  /** O ficheiro pode chegar de três sítios — o botão de sempre, arrastado para
   *  a caixa, ou colado — e daqui para a frente o caminho é o mesmo. */
  function processarArquivo(arquivo: File) {
    // PDF vai por outro caminho: lê-se em binário e a extração é assíncrona
    // (carrega o PDF.js sob demanda e percorre as páginas), daí o aviso de
    // espera — um extrato de vários meses leva um instante.
    if (/\.pdf$/i.test(arquivo.name) || arquivo.type === "application/pdf") {
      setLendoPdf(true);
      mostrarToast("Lendo o PDF…");
      void (async () => {
        try {
          analisar(await extrairExtratoPdf(await arquivo.arrayBuffer()));
        } catch (erro) {
          // O toast não pode despejar o erro em cima do usuário, mas sem ele
          // ficar registado em lado nenhum um relato de "não abriu" não dá
          // para investigar — foi o que aconteceu da última vez.
          console.error("Falha ao ler extrato em PDF:", erro);
          mostrarToast(
            erro instanceof LeitorPdfIndisponivel
              ? "O leitor de PDF não carregou. Verifique a ligação e tente de novo."
              : "Não foi possível processar este PDF.",
          );
        } finally {
          setLendoPdf(false);
        }
      })();
      return;
    }

    const leitor = new FileReader();
    const falhouCsv = (erro: unknown) => {
      // Mesmo motivo do PDF acima: o toast fica curto, o erro fica registado.
      console.error("Falha ao ler extrato em CSV:", erro);
      mostrarToast("Não foi possível ler este arquivo CSV.");
    };
    leitor.onload = () => {
      let brutas: LinhaExtrato[];
      try {
        brutas = parseExtratoCsv(String(leitor.result ?? ""));
      } catch (erro) {
        falhouCsv(erro);
        return;
      }
      analisar(brutas);
    };
    leitor.onerror = () => falhouCsv(leitor.error);
    leitor.readAsText(arquivo);
  }

  function aoCarregarArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    // Limpar antes de processar: sem isto, escolher o mesmo ficheiro outra vez
    // não dispara `change` nenhum.
    e.target.value = "";
    if (arquivo) processarArquivo(arquivo);
  }

  /** Só se acende para ficheiros: arrastar texto ou uma seleção dentro da
   *  página não é o gesto que nos interessa. */
  function temFicheiro(dt: DataTransfer | null) {
    return !!dt && Array.from(dt.types).includes("Files");
  }

  function aoArrastarPorCima(e: React.DragEvent) {
    if (!temFicheiro(e.dataTransfer)) return;
    // Sem este preventDefault o navegador abre o ficheiro na aba ao soltar,
    // deitando o app fora.
    e.preventDefault();
    setArrastando(true);
  }

  function aoSairDoArrasto(e: React.DragEvent) {
    // `dragleave` dispara também ao passar de um filho para o outro dentro da
    // caixa: só conta quando o ponteiro sai mesmo dela.
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setArrastando(false);
  }

  function aoSoltar(e: React.DragEvent) {
    if (!temFicheiro(e.dataTransfer)) return;
    e.preventDefault();
    setArrastando(false);
    const arquivo = e.dataTransfer.files[0];
    if (arquivo) processarArquivo(arquivo);
  }

  function aoColar(e: React.ClipboardEvent) {
    const arquivo = e.clipboardData?.files?.[0];
    // Sem ficheiro é texto a ser colado: sair do caminho e deixar o textarea
    // fazer o que sempre fez (colar um CSV de uma folha de cálculo).
    if (!arquivo) return;
    e.preventDefault();
    processarArquivo(arquivo);
  }

  /** Botão "Colar", que existe por causa do iPhone. O ⌘V/onPaste acima só
   *  funciona com teclado: no telemóvel não há ⌘V, e o menu "Colar" do iOS só
   *  aparece se o que está copiado for TEXTO — quem copiou o PDF do extrato
   *  toca na caixa e não lhe aparece opção nenhuma. Este botão lê a área de
   *  transferência por API, que é o único caminho que o iOS dá a uma página
   *  web (mostra o seu próprio pedido de permissão ao primeiro toque).
   *
   *  No desktop esse pop-up de permissão é só ruído: o Ctrl+V nativo já cai
   *  direto no textarea (onPaste acima) sem pedir nada. Por isso o botão
   *  continua a existir também aí (pode ser útil fora do textarea), mas em
   *  peso visual reduzido — ver `semMouse` em `ImportacaoEntrada`. */
  async function colarDoClipboard() {
    if (!navigator.clipboard?.readText) {
      mostrarToast("Este navegador não deixa colar por botão — usa Carregar arquivo.");
      return;
    }
    try {
      const lido = await navigator.clipboard.readText();
      if (!lido.trim()) {
        // Caso típico no iPhone: o que está copiado é o ficheiro em si (PDF),
        // não texto. A área de transferência existe, mas vem vazia de texto.
        mostrarToast("Nada de texto copiado. Se for um PDF, usa Carregar arquivo.");
        return;
      }
      setTexto(lido);
      mostrarToast("Texto colado — confere e toca em Analisar.");
    } catch {
      // Permissão negada, ou fora de HTTPS.
      mostrarToast("Não deu para ler o que está copiado — usa Carregar arquivo.");
    }
  }

  /** "Resetar importação": apaga o rascunho persistido inteiro, depois de
   *  confirmar. */
  function resetarImportacao() {
    void (async () => {
      if (!(await pedirConfirmacao("Limpar o rascunho da importação e recomeçar?"))) return;
      resetarRascunho();
      setFiltro("todas");
      setContaEmMassa("");
      setOutraPontaAberta(new Set());
    })();
  }

  /** "Novo extrato": descarta só as linhas analisadas, depois de confirmar. */
  function descartarLinhas() {
    void (async () => {
      if (!(await pedirConfirmacao("Descartar as linhas analisadas e recomeçar?"))) return;
      setLinhas(null);
      setContaEmMassa("");
      setOutraPontaAberta(new Set());
    })();
  }

  const atualizarLinha = useCallback(
    (id: number, mudancas: Partial<LinhaAnalisada>) => {
      setLinhas((atual) => atual?.map((l) => (l.id === id ? { ...l, ...mudancas } : l)) ?? null);
    },
    [setLinhas],
  );

  function aceitarAutoClassificadas() {
    setLinhas(
      (atual) =>
        atual?.map((l) => (l.decisao === "auto_classificada" ? { ...l, acao: "import" } : l)) ??
        null,
    );
    mostrarToast("Auto-classificadas marcadas para importar");
  }

  function marcarTodas(acao: "import" | "skip") {
    setLinhas((atual) => atual?.map((l) => ({ ...l, acao })) ?? null);
  }

  function marcarContaParaTodas(conta: string) {
    setContaEmMassa(conta);
    setLinhas((atual) => (atual ? aplicarContaATodas(atual, conta) : null));
  }

  const alternarOutraPonta = useCallback((id: number) => {
    setOutraPontaAberta((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }, []);

  function marcarParaApagar(id: number, marcar: boolean) {
    setMarcadasParaApagar((atual) => {
      const novo = new Set(atual);
      if (marcar) novo.add(id);
      else novo.delete(id);
      return novo;
    });
  }

  function fecharRevisaoDup() {
    setRevisaoDup(null);
  }

  /** Grava tudo o que está marcado para importar — sempre tudo, sem exceção —
   *  e só depois apaga os registos antigos que o usuário tenha mandado apagar
   *  na revisão. Por esta ordem: se apagar falhar, ficou um repetido, que se
   *  resolve à mão; ao contrário, teria desaparecido dinheiro. */
  async function gravar(aImportar: LinhaAnalisada[], apagar: ExistenteParaDedup[]) {
    if (!uid) return;
    setEnviando(true);
    try {
      const n = await confirmarImportacao(uid, aImportar, {
        // O serviço não vai buscar dados a lado nenhum: o que ele precisa para
        // registar um pagamento de fatura sai daqui, onde já está carregado.
        faturasPagas: cfg.faturasPagas,
        diaFechamentoFatura: cfg.diaFechamentoFatura,
        parcelas,
        dados: montarDadosFatura({
          despesas,
          despesasFixas,
          transferencias,
          parcelas,
          veiculo,
          receitas,
        }),
      });
      // Apagar as duplicatas é parte da MESMA ação de "confirmar importação"
      // aos olhos do usuário — o snapshot único já foi tirado dentro de
      // confirmarImportacao, então isto também roda suprimido, senão cada
      // duplicata apagada empilhava o seu próprio passo de "Desfazer".
      if (apagar.length) {
        await comHistoricoSuprimido(() => apagarExistentes(uid, apagar, despesasFixas, despesas));
      }
      mostrarToast(`✓ ${n} lançamento(s) importado(s)`);
      // Não limpa `linhas`/`texto` aqui: se o usuário confirmou sem querer e
      // for desfazer (↩) no menu "Mais", a revisão volta exatamente como estava —
      // sem reanalisar o extrato do zero e perder as marcações. `importadoEm`
      // troca a tela pra um estado "importado" (ver useEffect mais acima,
      // que limpa sozinho depois de um tempo, e o que detecta um desfazer).
      // `n` (o que de facto foi gravado) fica guardado para a tela
      // "importado" — antes ela mostrava `linhas.length`, puladas incluídas.
      marcarImportado(n, useHistoricoStore.getState().pilha.indice);
      setRevisaoDup(null);
      setResumoAberto(false);
      setDuplicatasRevistas(false);
      setMarcadasParaApagar(new Set());
    } catch {
      mostrarToast("Não foi possível importar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  /** As linhas que vão entrar e se parecem com algo já registado — as mesmas
   *  que sempre passaram pela folha de duplicatas antes de gravar. */
  function suspeitasDe(aImportar: LinhaAnalisada[]) {
    return aImportar.filter(
      (l) =>
        (l.decisao === "duplicata_provavel" || l.decisao === "revisao") &&
        l.duplicata.correspondencia,
    );
  }

  /** As mesmas verificações de sempre antes de gravar. `null` quando não há
   *  nada a fazer (o motivo já foi dito em toast). */
  function verificarAntesDeGravar(): LinhaAnalisada[] | null {
    if (!linhas) return null;
    if (!uid) {
      // Sem sessão não há onde gravar — antes saía calado e o botão parecia
      // não fazer nada.
      mostrarToast("Sessão não carregada. Tente de novo.");
      return null;
    }
    const aImportar = linhas.filter((l) => l.acao === "import");
    if (aImportar.length === 0) {
      mostrarToast("Nenhuma linha marcada para importar.");
      return null;
    }
    if (incompletas.length > 0) {
      mostrarToast(`${incompletas.length} linha(s) por completar.`);
      return null;
    }
    return aImportar;
  }

  /** Abre a folha de duplicatas para estas suspeitas. Cada vez começa sem
   *  nada marcado para apagar: apagar é sempre uma escolha feita ali, à
   *  vista da comparação, com confirmação própria. */
  function abrirRevisaoDup(suspeitas: LinhaAnalisada[]) {
    setResumoAberto(false);
    setMarcadasParaApagar(new Set());
    setDuplicatasRevistas(false);
    setRevisaoDup(suspeitas);
  }

  /** Botão principal do rodapé ("Importar N"). Alguma das que vão entrar já
   *  se parece com algo que existe? Então passa primeiro pela folha de
   *  duplicatas e só depois pela confirmação — é aí que se mostra também
   *  quantos registos antigos vão ser apagados. A maioria das importações não
   *  tem duplicatas e vai direta à confirmação. */
  function abrirConfirmacao() {
    const aImportar = verificarAntesDeGravar();
    if (!aImportar) return;
    const suspeitas = suspeitasDe(aImportar);
    if (suspeitas.length > 0) {
      abrirRevisaoDup(suspeitas);
      return;
    }
    setResumoAberto(true);
  }

  /** "Importar mesmo assim", na folha de duplicatas: mantém os dois
   *  registos (salvo os que foram confirmados para apagar) e segue para a
   *  confirmação. Ainda não grava nada. */
  function importarMesmoAssim() {
    setRevisaoDup(null);
    setDuplicatasRevistas(true);
    setResumoAberto(true);
  }

  /** "Voltar à revisão": fecha a confirmação sem gravar. Da próxima vez as
   *  duplicatas passam outra vez pela folha delas. */
  function fecharResumo() {
    setResumoAberto(false);
    setDuplicatasRevistas(false);
  }

  /** Os registos já existentes que vão ser apagados ao gravar: só os que o
   *  usuário confirmou na folha de duplicatas, e só de linhas que continuam
   *  marcadas para importar. */
  const existentesAApagar: ExistenteParaDedup[] =
    linhas
      ?.filter(
        (l) => l.acao === "import" && marcadasParaApagar.has(l.id) && l.duplicata.correspondencia,
      )
      .map((l) => l.duplicata.correspondencia!) ?? [];

  /** O botão final da confirmação: grava. Se houver duplicatas que ainda não
   *  passaram pela folha delas, abre-a em vez de gravar — nada entra sem essa
   *  folha ter sido vista, como sempre foi. */
  async function confirmar() {
    const aImportar = verificarAntesDeGravar();
    if (!aImportar) return;
    const suspeitas = suspeitasDe(aImportar);
    if (!duplicatasRevistas && suspeitas.length > 0) {
      abrirRevisaoDup(suspeitas);
      return;
    }
    await gravar(aImportar, existentesAApagar);
  }

  /** Desfazer direto da faixa de sucesso. Só aparece enquanto o passo da
   *  importação for o último da pilha de undo: o "Desfazer" do app desfaz
   *  sempre o passo mais recente, e se houve outra ação depois era ela que
   *  voltava atrás, não a importação. */
  //
  // "Último da pilha" = o índice ainda aponta para o snapshot da importação e
  // nada foi empilhado depois dele (o estado ao vivo é o pós-importação).
  const podeDesfazer =
    mostrandoImportado &&
    indiceAoImportar !== null &&
    indiceAoImportar >= 0 &&
    indiceAoImportar === tamanhoPilha - 1 &&
    indiceHistoricoAtual === indiceAoImportar;

  async function desfazerImportacao() {
    const antes = useHistoricoStore.getState().pilha;
    await useHistoricoStore.getState().desfazer();
    // Desfez mesmo (a pilha andou): a revisão volta a ficar editável, com as
    // marcações de antes. É explícito aqui porque, logo a seguir a UM
    // desfazer, o índice da pilha volta a ser igual a `indiceAoImportar`
    // (o desfazer empilha o estado ao vivo antes de descer) e `foiDesfeito`
    // não o apanha sozinho (o caso do "Desfazer" do menu Mais fica como está).
    if (useHistoricoStore.getState().pilha !== antes) setImportadoEm(null);
  }

  // Quantas linhas entram ao gravar: `confirmarImportacao` grava todas as
  // marcadas "import", sem exceção (as recargas/transferências/faturas
  // incompletas não são descartadas, travam a gravação inteira — e por isso
  // `incompletas`, abaixo, trava o botão antes). Este número é portanto
  // exatamente o que entra, sempre que o botão está ativo.
  const totalImportar = linhas?.filter((l) => l.acao === "import").length ?? 0;
  // Recarga marcada para importar a que ainda falta o que só o usuário sabe:
  // trava a confirmação e fica assinalada na própria linha. Despesa/receita
  // ("lancamento") entra na mesma trava quando há conta cadastrada e nenhuma
  // foi escolhida — achado do Gabriel (06/10/2026): a tela deixava confirmar
  // dezenas de linhas sem cartão nenhum, em silêncio (só o `aviso` abaixo da
  // própria confirmarImportacao avisava, tarde demais). Sem conta nenhuma
  // cadastrada ainda, não há o que escolher — não trava.
  const incompletas =
    linhas?.filter(
      (l) =>
        l.acao === "import" &&
        ((l.destino === "carga" && dadosDaCarga(l) === null) ||
          (l.destino === "transferencia_cartao" && dadosDaTransferencia(l) === null) ||
          (l.destino === "pagamento_fatura" && pagamentoDaLinha(l) === null) ||
          (l.destino === "lancamento" && cfg.contasCartoes.length > 0 && !l.contaEscolhida.trim())),
    ) ?? [];

  return {
    cfg,
    cargasVeiculo: veiculo.cargas,
    // Rascunho
    texto,
    setTexto,
    linhas,
    mostrandoImportado,
    totalImportado,
    limparRevisao,
    resetarImportacao,
    descartarLinhas,
    // Entrada
    arrastando,
    lendoPdf,
    semMouse,
    analisarTexto,
    aoCarregarArquivo,
    aoArrastarPorCima,
    aoSairDoArrasto,
    aoSoltar,
    aoColar,
    colarDoClipboard,
    // Filtros
    filtro,
    setFiltro,
    // Ações em massa
    contaEmMassa,
    aceitarAutoClassificadas,
    marcarTodas,
    marcarContaParaTodas,
    // Linhas
    totalImportar,
    incompletas,
    opcoesCategoria,
    opcoesFonte,
    cartoesCredito,
    outraPontaAberta,
    atualizarLinha,
    alternarOutraPonta,
    // Confirmação e revisão de duplicatas
    enviando,
    abrirConfirmacao,
    resumoAberto,
    fecharResumo,
    confirmar,
    revisaoDup,
    marcadasParaApagar,
    marcarParaApagar,
    existentesAApagar,
    fecharRevisaoDup,
    importarMesmoAssim,
    // Sucesso
    podeDesfazer,
    desfazerImportacao: () => void desfazerImportacao(),
  };
}

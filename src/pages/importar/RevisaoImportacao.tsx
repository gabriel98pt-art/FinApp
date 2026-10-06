import { useCallback, useId, useState } from "react";
import type { Abastecimento, ConfigConta, LinhaAnalisada } from "../../types";
import { GRUPOS, grupoDoStatus, statusDaLinha, type StatusLinha } from "./agrupamento";
import type { FiltroImportacao } from "./constantes";
import ListaLinhasImportacao from "./ListaLinhasImportacao";
import EditorLinha from "./EditorLinha";
import styles from "../Importar.module.css";

/** A revisão: a lista agrupada por estado e o editor da linha escolhida.
 *
 *  Duas composições, a mesma lista por baixo:
 *  - "detalhe" (desktop largo): lista compacta à esquerda, editor da linha
 *    selecionada à direita, a ocupar o resto da largura;
 *  - "inline" (telemóvel/tablet): a linha tocada abre por baixo dela, uma de
 *    cada vez.
 *
 *  Uma linha mexida fica no grupo onde estava enquanto se continuar a
 *  trabalhar nela: escolher a conta de uma linha de "Atenção" não a faz
 *  saltar logo para "Prontos" (recolhido) a meio da edição. Reagrupa quando
 *  se escolhe outra linha. */
export default function RevisaoImportacao({
  linhas,
  modo,
  filtro,
  cfg,
  cargasVeiculo,
  opcoesCategoria,
  opcoesFonte,
  cartoesCredito,
  outraPontaAberta,
  atualizarLinha,
  alternarOutraPonta,
}: {
  linhas: LinhaAnalisada[];
  modo: "detalhe" | "inline";
  filtro: FiltroImportacao;
  cfg: ConfigConta;
  cargasVeiculo: Abastecimento[];
  opcoesCategoria: string[];
  opcoesFonte: string[];
  cartoesCredito: string[];
  outraPontaAberta: Set<number>;
  atualizarLinha: (id: number, mudancas: Partial<LinhaAnalisada>) => void;
  alternarOutraPonta: (id: number) => void;
}) {
  const temContas = cfg.contasCartoes.length > 0;
  const idEditor = useId();
  const [selecionada, setSelecionada] = useState<number | null>(null);
  /** Grupo "congelado" das linhas mexidas desde a última troca de seleção. */
  const [congelados, setCongelados] = useState<Map<number, StatusLinha>>(() => new Map());

  const statusDe = (l: LinhaAnalisada): StatusLinha =>
    congelados.get(l.id) ?? statusDaLinha(l, temContas);

  const visiveis = linhas.filter((l) => filtro === "todas" || statusDe(l) === filtro);
  const grupos = GRUPOS.map((g) => ({
    id: g.id,
    rotulo: g.rotulo,
    abertoPorPadrao: g.abertoPorPadrao,
    linhas: visiveis.filter((l) => grupoDoStatus(statusDe(l)) === g.id),
  })).filter((g) => g.linhas.length > 0);

  // No desktop o editor não fica vazio à toa: sem escolha feita, abre a
  // primeira linha do primeiro grupo aberto (Atenção, por omissão).
  const existeSelecionada = selecionada !== null && linhas.some((l) => l.id === selecionada);
  const idAtivo = existeSelecionada
    ? selecionada
    : modo === "detalhe"
      ? (grupos.find((g) => filtro !== "todas" || g.abertoPorPadrao)?.linhas[0]?.id ?? null)
      : null;
  const ativa = linhas.find((l) => l.id === idAtivo) ?? null;

  const aoSelecionar = useCallback(
    (id: number) => {
      // Trocar de linha é o momento de reagrupar o que foi mexido.
      setCongelados(new Map());
      // No telemóvel tocar outra vez na linha aberta fecha-a; no desktop a
      // seleção fica (o painel não fica vazio).
      setSelecionada((atual) => (atual === id && modo === "inline" ? null : id));
    },
    [modo],
  );

  const aoMudar = useCallback(
    (id: number, mudancas: Partial<LinhaAnalisada>, status: StatusLinha) => {
      setCongelados((atual) => (atual.has(id) ? atual : new Map(atual).set(id, status)));
      atualizarLinha(id, mudancas);
    },
    [atualizarLinha],
  );

  function editar(id: number, mudancas: Partial<LinhaAnalisada>) {
    const l = linhas.find((x) => x.id === id);
    if (l) aoMudar(id, mudancas, statusDe(l));
    // A linha aberta por omissão (desktop) passa a ser a escolhida: mexer nela
    // não a pode trocar por outra debaixo do cursor.
    setSelecionada((atual) => atual ?? id);
  }

  const editor = (l: LinhaAnalisada) => (
    <EditorLinha
      key={l.id}
      id={idEditor}
      l={l}
      cfg={cfg}
      cargasVeiculo={cargasVeiculo}
      opcoesCategoria={opcoesCategoria}
      opcoesFonte={opcoesFonte}
      cartoesCredito={cartoesCredito}
      outraPontaAberta={outraPontaAberta.has(l.id)}
      atualizarLinha={editar}
      alternarOutraPonta={alternarOutraPonta}
    />
  );

  const lista = (
    <ListaLinhasImportacao
      grupos={grupos}
      forcarAbertos={filtro !== "todas"}
      currency={cfg.currency}
      temContas={temContas}
      modo={modo}
      idEditor={idEditor}
      idAtivo={idAtivo}
      statusDe={statusDe}
      aoSelecionar={aoSelecionar}
      aoMudar={aoMudar}
      editorInline={editor}
    />
  );

  if (modo === "inline") return lista;

  return (
    <div className={styles.mestreDetalhe}>
      {lista}
      <div className={styles.painelEditor}>
        {ativa ? (
          editor(ativa)
        ) : (
          <p className={styles.painelVazio}>Escolha uma linha na lista para a editar.</p>
        )}
      </div>
    </div>
  );
}

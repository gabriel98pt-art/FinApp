import { CircleCheck, Upload } from "lucide-react";
import { EstadoVazio } from "../components/Pagina";
import type { useImportacao } from "./importar/useImportacao";
import ImportacaoEntrada from "./importar/ImportacaoEntrada";
import ImportacaoResumo from "./importar/ImportacaoResumo";
import ImportacaoToolbar from "./importar/ImportacaoToolbar";
import RevisaoImportacao from "./importar/RevisaoImportacao";
import ModalDuplicatas from "./importar/ModalDuplicatas";
import ConfirmacaoImportacao from "./importar/ConfirmacaoImportacao";
import { plural } from "./importar/agrupamento";
import styles from "./Importar.module.css";

/** O fluxo de importar, hoje dentro da folha aberta a partir de Cartões (era a
 *  página /importar). Só monta os pedaços: toda a lógica e a ligação às stores
 *  vivem em `useImportacao`, que quem abre a folha chama UMA vez — o quadro de
 *  arrastar de Cartões e esta folha partilham o mesmo estado. A revisão é
 *  sempre em linha: a folha não tem largura para lista + editor lado a lado.
 *
 *  Fluxo único: escolher o extrato → revisão → confirmação → sucesso (com
 *  desfazer). */
export default function FluxoImportar({ imp }: { imp: ReturnType<typeof useImportacao> }) {
  const { linhas } = imp;

  return (
    <>
      {/* Escape hatch sempre visível: o rascunho fica guardado entre trocas de
          aba e até um refresh (ver `importacaoStore`), então precisa de uma
          saída igualmente sempre à mão — sem isto, um extrato que ficasse num
          estado estranho prendia a tela para sempre. Some sozinho quando não
          há nada por limpar. */}
      {(imp.texto.trim() || linhas !== null) && (
        <div className={styles.resetLinha}>
          <button className={styles.linkBotao} onClick={imp.resetarImportacao}>
            Resetar importação
          </button>
        </div>
      )}

      {linhas === null ? (
        <ImportacaoEntrada
          texto={imp.texto}
          setTexto={imp.setTexto}
          arrastando={imp.arrastando}
          lendoPdf={imp.lendoPdf}
          semMouse={imp.semMouse}
          aoArrastarPorCima={imp.aoArrastarPorCima}
          aoSairDoArrasto={imp.aoSairDoArrasto}
          aoSoltar={imp.aoSoltar}
          aoColar={imp.aoColar}
          aoCarregarArquivo={imp.aoCarregarArquivo}
          onColarClipboard={imp.colarDoClipboard}
          onAnalisar={imp.analisarTexto}
        />
      ) : linhas.length === 0 ? (
        <EstadoVazio Icone={Upload} mensagem="Nenhuma linha reconhecida" />
      ) : imp.mostrandoImportado ? (
        // Não é um toast: fica no lugar da lista até limpar sozinho.
        // `role="status"` para o leitor de tela anunciar a troca — a lista
        // que estava em foco acabou de desaparecer.
        <div className={styles.importado} role="status">
          <div className={styles.importadoFaixa}>
            <p className={styles.importadoTitulo}>
              <CircleCheck size={20} aria-hidden className={styles.importadoIcone} />
              {plural(
                imp.totalImportado ?? linhas.filter((l) => l.acao === "import").length,
                "lançamento importado",
                "lançamentos importados",
              )}
            </p>
            {imp.podeDesfazer && (
              <button className={styles.botao} onClick={imp.desfazerImportacao}>
                Desfazer
              </button>
            )}
          </div>
          {!imp.podeDesfazer && (
            <p>
              Se foi engano, clica em <strong>Desfazer</strong> (↩) no menu <strong>Mais</strong> —
              a revisão volta exatamente como estava.
            </p>
          )}
          <p className={styles.importadoAviso}>
            Esta lista limpa sozinha em alguns minutos, ou{" "}
            <button className={styles.linkBotao} onClick={imp.limparRevisao}>
              limpa agora
            </button>
            .
          </p>
        </div>
      ) : (
        <>
          <ImportacaoResumo
            linhas={linhas}
            temContas={imp.cfg.contasCartoes.length > 0}
            filtro={imp.filtro}
            setFiltro={imp.setFiltro}
            onNovoExtrato={imp.descartarLinhas}
          />

          <ImportacaoToolbar
            cfg={imp.cfg}
            contaEmMassa={imp.contaEmMassa}
            onAceitarAutoClassificadas={imp.aceitarAutoClassificadas}
            onMarcarTodas={imp.marcarTodas}
            onMarcarContaParaTodas={imp.marcarContaParaTodas}
          />

          <RevisaoImportacao
            linhas={linhas}
            modo="inline"
            filtro={imp.filtro}
            cfg={imp.cfg}
            cargasVeiculo={imp.cargasVeiculo}
            opcoesCategoria={imp.opcoesCategoria}
            opcoesFonte={imp.opcoesFonte}
            cartoesCredito={imp.cartoesCredito}
            outraPontaAberta={imp.outraPontaAberta}
            atualizarLinha={imp.atualizarLinha}
            alternarOutraPonta={imp.alternarOutraPonta}
          />

          <ConfirmacaoImportacao
            linhas={linhas}
            totalImportar={imp.totalImportar}
            porCompletar={imp.incompletas.length}
            existentesAApagar={imp.existentesAApagar}
            enviando={imp.enviando}
            aberta={imp.resumoAberto}
            onAbrir={imp.abrirConfirmacao}
            onFechar={imp.fecharResumo}
            onImportar={imp.confirmar}
          />
        </>
      )}

      <ModalDuplicatas
        revisaoDup={imp.revisaoDup}
        marcadasParaApagar={imp.marcadasParaApagar}
        currency={imp.cfg.currency}
        enviando={imp.enviando}
        onFechar={imp.fecharRevisaoDup}
        onMarcarParaApagar={imp.marcarParaApagar}
        onImportarMesmoAssim={imp.importarMesmoAssim}
      />
    </>
  );
}

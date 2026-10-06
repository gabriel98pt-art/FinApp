import { CircleCheck, Upload } from "lucide-react";
import Pagina, { EstadoVazio } from "../components/Pagina";
import { useImportacao } from "./importar/useImportacao";
import ImportacaoEntrada from "./importar/ImportacaoEntrada";
import ImportacaoResumo from "./importar/ImportacaoResumo";
import ImportacaoToolbar from "./importar/ImportacaoToolbar";
import ImportacaoFiltros from "./importar/ImportacaoFiltros";
import ListaLinhasImportacao from "./importar/ListaLinhasImportacao";
import ModalDuplicatas from "./importar/ModalDuplicatas";
import ConfirmacaoImportacao from "./importar/ConfirmacaoImportacao";
import styles from "./Importar.module.css";

/** Página Importar: só monta os pedaços. Toda a lógica e a ligação às stores
 *  vivem em `useImportacao`; os componentes de `./importar/` só recebem props. */
export default function Importar() {
  const imp = useImportacao();
  const { linhas } = imp;

  return (
    <Pagina titulo="Importar">
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
        // Não é um toast: fica no lugar da lista, com o mesmo peso dela, até
        // limpar sozinho. `role="status"` para o leitor de tela anunciar a
        // troca — a lista que estava em foco acabou de desaparecer.
        <div className={styles.importado} role="status">
          <p className={styles.importadoTitulo}>
            <CircleCheck size={20} aria-hidden className={styles.importadoIcone} />
            {imp.totalImportado ?? linhas.filter((l) => l.acao === "import").length} lançamento(s)
            importado(s).
          </p>
          <p>
            Se foi engano, clica em <strong>Desfazer</strong> (↩) no menu <strong>Mais</strong> — a
            revisão volta exatamente como estava.
          </p>
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
            totalLinhas={linhas.length}
            totalImportar={imp.totalImportar}
            onNovoExtrato={imp.descartarLinhas}
          />

          <ImportacaoToolbar
            cfg={imp.cfg}
            contaEmMassa={imp.contaEmMassa}
            onAceitarAutoClassificadas={imp.aceitarAutoClassificadas}
            onMarcarTodas={imp.marcarTodas}
            onMarcarContaParaTodas={imp.marcarContaParaTodas}
          />

          <ImportacaoFiltros linhas={linhas} filtro={imp.filtro} setFiltro={imp.setFiltro} />

          <ListaLinhasImportacao
            visiveis={imp.visiveis}
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
            bloqueado={imp.incompletas.length > 0}
            enviando={imp.enviando}
            onConfirmar={imp.confirmar}
          />
        </>
      )}

      <ModalDuplicatas
        revisaoDup={imp.revisaoDup}
        marcadasParaApagar={imp.marcadasParaApagar}
        currency={imp.cfg.currency}
        enviando={imp.enviando}
        totalImportar={imp.totalImportar}
        onFechar={imp.fecharRevisaoDup}
        onMarcarParaApagar={imp.marcarParaApagar}
        onImportarMesmoAssim={imp.importarMesmoAssim}
      />
    </Pagina>
  );
}

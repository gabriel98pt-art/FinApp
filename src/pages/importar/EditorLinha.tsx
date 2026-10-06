import { useId, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import Seletor from "../../components/Seletor";
import { estimarKwh } from "../../utils/importacao";
import { formatMoney } from "../../utils/money";
import { nomeAtualDoMetodo } from "../../utils/instituicoes";
import { rotuloMes } from "../../utils/calculos";
import type { Abastecimento, ConfigConta, LinhaAnalisada } from "../../types";
import { pendenciasDaLinha, type CampoPendente, type Pendencia } from "./agrupamento";
import {
  corDecisao,
  descricaoExistente,
  ICONE_DECISAO,
  mesesDaFatura,
  ROTULO_CONFIANCA,
  ROTULO_DECISAO,
  ROTULO_ORIGEM,
  rotuloTipoLinha,
  tipoDaLinha,
  tiposPossiveis,
  type TipoLinha,
} from "./constantes";
import styles from "../Importar.module.css";

/** Um campo do editor: rótulo fixo em cima, o controlo, e — quando há — o
 *  erro ou aviso logo por baixo, ligado ao controlo por `aria-describedby`.
 *  A borda do próprio controlo acende na cor da pendência. */
function Campo({
  rotulo,
  idMensagem,
  pendencia,
  largo = false,
  children,
}: {
  rotulo: string;
  idMensagem: string;
  pendencia?: Pendencia;
  largo?: boolean;
  children: ReactNode;
}) {
  const tom = pendencia ? (pendencia.bloqueia ? styles.campoErro : styles.campoAviso) : "";
  return (
    <div className={`${styles.campo} ${tom} ${largo ? styles.campoLargo : ""}`}>
      <span className={styles.campoRotulo} aria-hidden>
        {rotulo}
      </span>
      {children}
      {pendencia?.mensagem && (
        <p
          id={idMensagem}
          className={pendencia.bloqueia ? styles.campoMsgErro : styles.campoMsgAviso}
        >
          {pendencia.mensagem}
        </p>
      )}
    </div>
  );
}

/** O editor de UMA linha do extrato: no desktop ocupa o painel à direita da
 *  lista; no telemóvel abre por baixo da linha tocada. Campos com nome fixo
 *  ("Tipo", "Conta ou cartão", "Categoria"/"Fonte") e os erros no próprio
 *  campo. Sendo duplicata, mostra o que vem no extrato ao lado do que já está
 *  registado. Só apresentação: muda a linha por `atualizarLinha`, como antes. */
export default function EditorLinha({
  l,
  id,
  cfg,
  cargasVeiculo,
  opcoesCategoria,
  opcoesFonte,
  cartoesCredito,
  outraPontaAberta,
  atualizarLinha,
  alternarOutraPonta,
}: {
  l: LinhaAnalisada;
  /** Id do painel — o botão da linha aponta para ele (`aria-controls`). */
  id: string;
  cfg: ConfigConta;
  cargasVeiculo: Abastecimento[];
  opcoesCategoria: string[];
  opcoesFonte: string[];
  cartoesCredito: string[];
  outraPontaAberta: boolean;
  atualizarLinha: (id: number, mudancas: Partial<LinhaAnalisada>) => void;
  alternarOutraPonta: (id: number) => void;
}) {
  const base = useId();
  const pendencias = pendenciasDaLinha(l, cfg.contasCartoes.length > 0);
  const de = (campo: CampoPendente) => pendencias.find((p) => p.campo === campo);
  const msg = (campo: CampoPendente) => `${base}-${campo}`;
  /** Props comuns de erro de cada Seletor: inválido só quando trava. */
  const erroDe = (campo: CampoPendente) => {
    const p = de(campo);
    return { invalido: Boolean(p?.bloqueia), descritoPor: p?.mensagem ? msg(campo) : undefined };
  };
  const atualizar = (m: Partial<LinhaAnalisada>) => atualizarLinha(l.id, m);
  const IconeDecisao = ICONE_DECISAO[l.decisao];
  const ehReceita = l.tipoEscolhido === "receita";
  const nomeConta = (c: string) => nomeAtualDoMetodo(cfg, c);
  const avisoContas = "Nenhuma conta guardada — as contas vêm de Definições.";

  function mudarTipo(t: TipoLinha) {
    if (t === "despesa" || t === "receita") {
      // Trocar de lado troca a lista ao lado. Um valor da lista antiga não
      // pode ficar para trás — "Extra" é fonte de receita, e ficaria gravado
      // como se fosse categoria de despesa. Volta a "Sem categoria".
      const lista = t === "receita" ? opcoesFonte : opcoesCategoria;
      atualizar({
        destino: "lancamento",
        tipoEscolhido: t,
        categoriaEscolhida: lista.includes(l.categoriaEscolhida) ? l.categoriaEscolhida : "",
      });
    } else {
      atualizar({ destino: t });
    }
  }

  const dup = l.duplicata.status !== "new" ? l.duplicata.correspondencia : null;

  return (
    <div id={id} className={styles.editor} role="group" aria-label={`Editar ${l.descricao}`}>
      <div className={styles.editorCabecalho}>
        <span className={styles.editorMeta}>
          {l.data.slice(8, 10)}/{l.data.slice(5, 7)}/{l.data.slice(0, 4)}
          <span className={`${styles.badge} ${corDecisao(l.decisao)}`}>
            <IconeDecisao size={12} strokeWidth={2.5} aria-hidden />
            {ROTULO_DECISAO[l.decisao]}
            <span className={styles.soLeitor}>, {ROTULO_CONFIANCA[l.classificacao.confianca]}</span>
          </span>
        </span>
        <span className={l.valor >= 0 ? styles.valorPositivo : styles.valorNegativo}>
          {formatMoney(l.valor, cfg.currency)}
        </span>
      </div>

      {/* Duplicata: o que vem no extrato ao lado do que já está registado,
          aqui mesmo — o porquê por cima, que é o que diz onde olhar. */}
      {dup && (
        <div className={styles.revisaoItem}>
          {l.duplicata.motivos.length > 0 && (
            <p className={styles.revisaoMotivo}>
              <TriangleAlert size={13} strokeWidth={2.5} aria-hidden />
              {l.duplicata.motivos.join(", ")}
            </p>
          )}
          <div className={styles.revisaoLado}>
            <span className={styles.revisaoRotulo}>Novo no extrato</span>
            <span className={styles.revisaoDesc}>{l.descricao}</span>
            <span className={styles.revisaoMeta}>
              {l.data.slice(8, 10)}/{l.data.slice(5, 7)} ·{" "}
              <span className={styles.revisaoValor}>{formatMoney(l.valor, cfg.currency)}</span>
            </span>
          </div>
          <div className={`${styles.revisaoLado} ${styles.revisaoLadoExistente}`}>
            <span className={styles.revisaoRotulo}>Já registado</span>
            <span className={styles.revisaoDesc}>{descricaoExistente(dup, cfg.currency)}</span>
            <span className={styles.revisaoMeta}>
              {dup.data.slice(8, 10)}/{dup.data.slice(5, 7)} ·{" "}
              <span className={styles.revisaoValor}>
                {formatMoney(Math.abs(dup.valor), cfg.currency)}
              </span>{" "}
              · {ROTULO_ORIGEM[dup.origem]}
            </span>
          </div>
        </div>
      )}

      <div className={styles.editorCampos}>
        {/* O extrato traz nomes cifrados ("COMPRA 1234 PT"): dá para corrigir
            aqui, antes de gravar. */}
        <label className={`${styles.campo} ${styles.campoLargo}`}>
          <span className={styles.campoRotulo}>Descrição</span>
          <input
            className={styles.campoTexto}
            value={l.descricao}
            onChange={(e) => atualizar({ descricao: e.target.value })}
          />
        </label>

        <Campo rotulo="Tipo" idMensagem={`${base}-tipo`}>
          <Seletor
            variante="inline"
            rotulo="Tipo"
            nivel={0}
            valor={tipoDaLinha(l)}
            opcoes={tiposPossiveis(l.valor)}
            rotuloOpcao={(t) => rotuloTipoLinha(t as TipoLinha)}
            aoMudar={(t) => mudarTipo(t as TipoLinha)}
          />
        </Campo>

        {l.destino === "pagamento_fatura" ? (
          <>
            {/* Qual fatura foi paga: cartão e mês. O mês começa no da própria
                linha e corrige-se aqui — quem paga a 2 de agosto a fatura de
                julho. */}
            <Campo
              rotulo="Cartão da fatura"
              idMensagem={msg("cartaoFatura")}
              pendencia={de("cartaoFatura")}
            >
              <Seletor
                variante="inline"
                rotulo="Cartão da fatura"
                nivel={0}
                valor={l.fatCartaoEscolhido}
                opcoes={cartoesCredito}
                rotuloOpcao={nomeConta}
                rotuloVazio="Escolher cartão"
                aviso="Nenhum cartão de crédito guardado — os cartões vêm de Definições."
                aoMudar={(v) => atualizar({ fatCartaoEscolhido: v })}
                {...erroDe("cartaoFatura")}
              />
            </Campo>
            <Campo rotulo="Mês da fatura" idMensagem={`${base}-mes`}>
              <Seletor
                variante="inline"
                rotulo="Mês da fatura"
                nivel={0}
                valor={l.fatMesEscolhido}
                opcoes={mesesDaFatura(l.data)}
                rotuloOpcao={rotuloMes}
                aoMudar={(v) => atualizar({ fatMesEscolhido: v })}
              />
            </Campo>
            <Campo
              rotulo="Conta que pagou"
              idMensagem={msg("contaPagou")}
              pendencia={de("contaPagou")}
            >
              <Seletor
                variante="inline"
                rotulo="Conta que pagou"
                nivel={0}
                valor={l.contaOrigem}
                opcoes={cfg.contasCartoes}
                rotuloOpcao={nomeConta}
                rotuloVazio="Escolher conta"
                aviso={avisoContas}
                aoMudar={(v) => atualizar({ contaOrigem: v })}
                {...erroDe("contaPagou")}
              />
            </Campo>
          </>
        ) : l.destino === "transferencia_cartao" ? (
          <>
            {/* De onde saiu: qualquer conta ou cartão do usuário. Sendo cartão
                de crédito, o valor vai parar à fatura dele. */}
            <Campo
              rotulo="De onde veio"
              idMensagem={msg("contaOrigem")}
              pendencia={de("contaOrigem")}
            >
              <Seletor
                variante="inline"
                rotulo="De onde veio"
                nivel={0}
                valor={l.contaOrigem}
                opcoes={cfg.contasCartoes}
                rotuloOpcao={nomeConta}
                rotuloVazio="Escolher conta ou cartão"
                aviso={avisoContas}
                aoMudar={(v) => atualizar({ contaOrigem: v })}
                {...erroDe("contaOrigem")}
              />
            </Campo>
            {/* E para onde foi: o extrato não diz de que conta é, e sem isto o
                saldo dela ficava sem este dinheiro. */}
            <Campo
              rotulo="Conta que recebeu"
              idMensagem={msg("contaDestino")}
              pendencia={de("contaDestino")}
            >
              <Seletor
                variante="inline"
                rotulo="Conta que recebeu"
                nivel={0}
                valor={l.contaDestino}
                opcoes={cfg.contasCartoes}
                rotuloOpcao={nomeConta}
                rotuloVazio="Escolher conta"
                aviso={avisoContas}
                aoMudar={(v) => atualizar({ contaDestino: v })}
                {...erroDe("contaDestino")}
              />
            </Campo>
          </>
        ) : l.destino === "carga" ? (
          <>
            <Campo rotulo="Local" idMensagem={msg("local")} pendencia={de("local")}>
              <Seletor
                variante="inline"
                rotulo="Local"
                nivel={0}
                valor={l.localCarga}
                opcoes={cfg.locaisCarregamento}
                rotuloVazio="Escolher local"
                aviso="Nenhum local de carregamento guardado — os locais vêm da aba Veículo."
                aoMudar={(v) =>
                  atualizar({
                    localCarga: v,
                    // Outro posto, outro preço por kWh: a estimativa é refeita
                    // na hora, com o mesmo histórico que a sugestão automática.
                    kwhCarga: estimarKwh(Math.abs(l.valor), v, cargasVeiculo),
                  })
                }
                {...erroDe("local")}
              />
            </Campo>
            {/* O extrato não traz os kWh e o app não os pode deduzir: é o
                único campo digitado aqui. */}
            <Campo rotulo="Energia (kWh)" idMensagem={msg("kwh")} pendencia={de("kwh")}>
              <span className={styles.campoKwh}>
                <input
                  className={styles.kwh}
                  type="text"
                  inputMode="decimal"
                  placeholder="0,0"
                  aria-label="kWh"
                  aria-describedby={de("kwh") ? msg("kwh") : undefined}
                  value={l.kwhCarga}
                  onChange={(e) => atualizar({ kwhCarga: e.target.value })}
                />
                kWh
              </span>
            </Campo>
          </>
        ) : (
          <>
            {/* De que conta ou cartão saiu/entrou este dinheiro. Sendo cartão
                de crédito, é isto que faz o lançamento contar pra fatura dele.
                Havendo conta cadastrada, deixar em branco trava a confirmação
                (ver `incompletas` em useImportacao). */}
            <Campo rotulo="Conta ou cartão" idMensagem={msg("conta")} pendencia={de("conta")}>
              <Seletor
                variante="inline"
                rotulo="Conta ou cartão"
                nivel={0}
                valor={l.contaEscolhida}
                opcoes={cfg.contasCartoes}
                rotuloOpcao={nomeConta}
                rotuloVazio="Escolher conta ou cartão"
                aviso={avisoContas}
                aoMudar={(v) => atualizar({ contaEscolhida: v })}
                {...erroDe("conta")}
              />
            </Campo>
            {/* Receita não tem categoria, tem FONTE — outro conceito e outra
                lista. */}
            <Campo
              rotulo={ehReceita ? "Fonte" : "Categoria"}
              idMensagem={msg("categoria")}
              pendencia={de("categoria")}
            >
              <Seletor
                variante="inline"
                rotulo={ehReceita ? "Fonte" : "Categoria"}
                nivel={0}
                valor={l.categoriaEscolhida}
                opcoes={ehReceita ? opcoesFonte : opcoesCategoria}
                rotuloVazio="Sem categoria"
                aoMudar={(c) => atualizar({ categoriaEscolhida: c })}
                {...erroDe("categoria")}
              />
            </Campo>
          </>
        )}

        <label className={`${styles.campo} ${styles.campoLargo}`}>
          <span className={styles.campoRotulo}>Nota</span>
          <input
            className={styles.campoTexto}
            placeholder="Opcional"
            value={l.notaEscolhida}
            onChange={(e) => atualizar({ notaEscolhida: e.target.value })}
          />
        </label>
      </div>

      {/* A outra ponta da mesma transferência, já lançada do lado contrário.
          Tom próprio: não é "isto já foi importado", é "este dinheiro já está
          no app pelo outro lado". */}
      {l.outraPonta?.correspondencia && (
        <div className={styles.outraPonta}>
          <p>
            O outro lado desta transferência já pode estar registado como "
            {descricaoExistente(l.outraPonta.correspondencia, cfg.currency)}" —{" "}
            {l.outraPonta.motivos.join(", ")}. Se for a mesma, desmarque esta linha para não contar
            o dinheiro duas vezes.
          </p>
          <button
            type="button"
            className={styles.outraPontaAcao}
            onClick={() => alternarOutraPonta(l.id)}
          >
            {outraPontaAberta ? "Ocultar detalhes" : "Ver detalhes"}
          </button>
          {outraPontaAberta && (
            <dl className={styles.outraPontaDetalhes}>
              <dt>Data</dt>
              <dd>
                {l.outraPonta.correspondencia.data.slice(8, 10)}/
                {l.outraPonta.correspondencia.data.slice(5, 7)}/
                {l.outraPonta.correspondencia.data.slice(0, 4)}
              </dd>
              <dt>Valor</dt>
              <dd>{formatMoney(Math.abs(l.outraPonta.correspondencia.valor), cfg.currency)}</dd>
              <dt>Onde está</dt>
              <dd>{ROTULO_ORIGEM[l.outraPonta.correspondencia.origem]}</dd>
            </dl>
          )}
        </div>
      )}
    </div>
  );
}

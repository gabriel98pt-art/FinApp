import { memo } from "react";
import Seletor from "../../components/Seletor";
import { dadosDaTransferencia, pagamentoDaLinha } from "../../services/importacaoService";
import { estimarKwh } from "../../utils/importacao";
import { formatMoney } from "../../utils/money";
import { nomeAtualDoMetodo } from "../../utils/instituicoes";
import { rotuloMes } from "../../utils/calculos";
import type { Abastecimento, ConfigConta, DestinoLinha, LinhaAnalisada } from "../../types";
import {
  corDecisao,
  descricaoExistente,
  DESTINOS_ENTRADA,
  DESTINOS_SAIDA,
  ICONE_DECISAO,
  mesesDaFatura,
  ROTULO_CONFIANCA,
  ROTULO_DECISAO,
  ROTULO_ORIGEM,
  ROTULO_TIPO,
  rotuloDestino,
  TIPOS,
} from "./constantes";
import styles from "../Importar.module.css";

/** Uma linha do extrato na revisão: checkbox, descrição e nota editáveis,
 *  valor, data, badge de decisão e os seletores que mudam conforme o destino
 *  (lançamento, recarga, transferência interna ou fatura paga), mais os avisos
 *  do que falta completar e de possíveis cruzamentos com o que já existe. */
function LinhaImportacao({
  l,
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
  cfg: ConfigConta;
  cargasVeiculo: Abastecimento[];
  opcoesCategoria: string[];
  opcoesFonte: string[];
  cartoesCredito: string[];
  /** Se o aviso "outra ponta da transferência" desta linha está expandido. */
  outraPontaAberta: boolean;
  atualizarLinha: (id: number, mudancas: Partial<LinhaAnalisada>) => void;
  alternarOutraPonta: (id: number) => void;
}) {
  const IconeDecisao = ICONE_DECISAO[l.decisao];
  return (
    <div className={styles.linha}>
      <label className={styles.linhaAcao}>
        <input
          type="checkbox"
          // Sem texto ao lado, a caixa não tinha nome: o leitor de tela dizia
          // só "caixa de seleção, marcada", sem dizer de que linha.
          aria-label={`Importar ${l.descricao}`}
          checked={l.acao === "import"}
          onChange={(e) => atualizarLinha(l.id, { acao: e.target.checked ? "import" : "skip" })}
        />
      </label>
      <div className={styles.linhaCorpo}>
        <div className={styles.linhaTopo}>
          {/* O extrato traz nomes cifrados ("COMPRA 1234 PT"): dá para
              corrigir aqui, antes de gravar. Os rótulos dos seletores
              da linha acompanham sozinhos, são interpolação. */}
          <input
            className={styles.linhaDesc}
            aria-label={`Nome de ${l.descricao}`}
            value={l.descricao}
            onChange={(e) => atualizarLinha(l.id, { descricao: e.target.value })}
          />
          <span className={l.valor >= 0 ? styles.valorPositivo : styles.valorNegativo}>
            {formatMoney(l.valor, cfg.currency)}
          </span>
        </div>
        {/* Segundo degrau, miúdo: quando e como foi reconhecida. */}
        <div className={styles.linhaMeta}>
          <span className={styles.linhaData}>
            {l.data.slice(8, 10)}/{l.data.slice(5, 7)}
          </span>
          <span className={`${styles.badge} ${corDecisao(l.decisao)}`}>
            <IconeDecisao size={12} strokeWidth={2.5} aria-hidden />
            {ROTULO_DECISAO[l.decisao]}
            <span className={styles.soLeitor}>, {ROTULO_CONFIANCA[l.classificacao.confianca]}</span>
          </span>
        </div>
        {/* Terceiro degrau: o que se pode corrigir. Agrupado à parte da data e
            do selo, para os seletores não competirem com o nome e o valor. */}
        <div className={styles.linhaCampos}>
          <Seletor
            variante="inline"
            rotulo={`Tipo do registro de ${l.descricao}`}
            nivel={0}
            valor={l.destino}
            opcoes={l.valor < 0 ? DESTINOS_SAIDA : DESTINOS_ENTRADA}
            rotuloOpcao={(d) => rotuloDestino(d as DestinoLinha)}
            aoMudar={(d) => atualizarLinha(l.id, { destino: d as DestinoLinha })}
          />
          {l.destino === "pagamento_fatura" ? (
            <>
              {/* Qual fatura foi paga: cartão e mês. O mês começa
                  no da própria linha e corrige-se aqui — quem
                  paga a 2 de agosto a fatura de julho. */}
              <Seletor
                variante="inline"
                rotulo={`Cartão de ${l.descricao}`}
                nivel={0}
                valor={l.fatCartaoEscolhido}
                opcoes={cartoesCredito}
                rotuloOpcao={(c) => nomeAtualDoMetodo(cfg, c)}
                rotuloVazio="Qual cartão…"
                aviso="Nenhum cartão de crédito guardado — os cartões vêm de Definições."
                aoMudar={(v) => atualizarLinha(l.id, { fatCartaoEscolhido: v })}
              />
              <Seletor
                variante="inline"
                rotulo={`Mês da fatura de ${l.descricao}`}
                nivel={0}
                valor={l.fatMesEscolhido}
                opcoes={mesesDaFatura(l.data)}
                rotuloOpcao={rotuloMes}
                aoMudar={(v) => atualizarLinha(l.id, { fatMesEscolhido: v })}
              />
              <Seletor
                variante="inline"
                rotulo={`Conta que pagou ${l.descricao}`}
                nivel={0}
                valor={l.contaOrigem}
                opcoes={cfg.contasCartoes}
                rotuloOpcao={(c) => nomeAtualDoMetodo(cfg, c)}
                rotuloVazio="Pago de…"
                aviso="Nenhuma conta guardada — as contas vêm de Definições."
                aoMudar={(v) => atualizarLinha(l.id, { contaOrigem: v })}
              />
            </>
          ) : l.destino === "transferencia_cartao" ? (
            <>
              {/* De onde saiu: qualquer conta ou cartão do
                  usuário. Sendo cartão de crédito, o valor vai
                  parar à fatura dele; sendo conta comum, não vai
                  a fatura nenhuma — e é isso mesmo. */}
              <Seletor
                variante="inline"
                rotulo={`Conta de origem de ${l.descricao}`}
                nivel={0}
                valor={l.contaOrigem}
                opcoes={cfg.contasCartoes}
                rotuloOpcao={(c) => nomeAtualDoMetodo(cfg, c)}
                rotuloVazio="De onde veio…"
                aviso="Nenhuma conta guardada — as contas vêm de Definições."
                aoMudar={(v) => atualizarLinha(l.id, { contaOrigem: v })}
              />
              {/* E para onde foi: o extrato não diz de que conta
                  é, e sem isto o saldo dela ficava sem este
                  dinheiro. */}
              <Seletor
                variante="inline"
                rotulo={`Conta que recebeu ${l.descricao}`}
                nivel={0}
                valor={l.contaDestino}
                opcoes={cfg.contasCartoes}
                rotuloOpcao={(c) => nomeAtualDoMetodo(cfg, c)}
                rotuloVazio="Conta que recebeu…"
                aviso="Nenhuma conta guardada — as contas vêm de Definições."
                aoMudar={(v) => atualizarLinha(l.id, { contaDestino: v })}
              />
            </>
          ) : l.destino === "carga" ? (
            <>
              <Seletor
                variante="inline"
                rotulo={`Local de ${l.descricao}`}
                nivel={0}
                valor={l.localCarga}
                opcoes={cfg.locaisCarregamento}
                rotuloVazio="Escolher local…"
                aviso="Nenhum local de carregamento guardado — os locais vêm da aba Veículo."
                aoMudar={(v) =>
                  atualizarLinha(l.id, {
                    localCarga: v,
                    // Outro posto, outro preço por kWh: a
                    // estimativa é refeita na hora, com o mesmo
                    // histórico que a sugestão automática usa.
                    kwhCarga: estimarKwh(Math.abs(l.valor), v, cargasVeiculo),
                  })
                }
              />
              {/* O extrato não traz os kWh e o app não os pode
                  deduzir: é o único campo digitado aqui. A
                  unidade fica ao lado — o placeholder desaparece
                  assim que se escreve, e um número solto no meio
                  dos seletores não diz o que é. */}
              <span className={styles.campoKwh}>
                <input
                  className={styles.kwh}
                  type="text"
                  inputMode="decimal"
                  placeholder="0,0"
                  aria-label={`kWh de ${l.descricao}`}
                  value={l.kwhCarga}
                  onChange={(e) => atualizarLinha(l.id, { kwhCarga: e.target.value })}
                />
                kWh
              </span>
            </>
          ) : (
            <>
              <Seletor
                variante="inline"
                rotulo={`Receita ou despesa — ${l.descricao}`}
                nivel={0}
                valor={l.tipoEscolhido}
                opcoes={TIPOS}
                rotuloOpcao={(t) => ROTULO_TIPO[t as LinhaAnalisada["tipoEscolhido"]]}
                aoMudar={(t) => {
                  const tipo = t as LinhaAnalisada["tipoEscolhido"];
                  // Trocar de lado troca a lista ao lado. Um
                  // valor da lista antiga não pode ficar para
                  // trás — "Extra" é fonte de receita, e ficaria
                  // gravado como se fosse categoria de despesa.
                  const lista = tipo === "receita" ? opcoesFonte : opcoesCategoria;
                  atualizarLinha(l.id, {
                    tipoEscolhido: tipo,
                    categoriaEscolhida: lista.includes(l.categoriaEscolhida)
                      ? l.categoriaEscolhida
                      : "Outros",
                  });
                }}
              />
              <Seletor
                variante="inline"
                rotulo={
                  l.tipoEscolhido === "receita"
                    ? `Fonte de ${l.descricao}`
                    : `Categoria de ${l.descricao}`
                }
                nivel={0}
                valor={l.categoriaEscolhida}
                opcoes={l.tipoEscolhido === "receita" ? opcoesFonte : opcoesCategoria}
                aoMudar={(c) => atualizarLinha(l.id, { categoriaEscolhida: c })}
              />
              {/* De que conta ou cartão saiu/entrou este
                  dinheiro. Sendo cartão de crédito, é isto que
                  faz o lançamento contar pra fatura dele. Havendo
                  conta cadastrada, deixar em branco trava a
                  confirmação (ver `incompletas` em useImportacao) — antes
                  passava calado e a linha ficava para sempre sem
                  cartão nenhum. */}
              <Seletor
                variante="inline"
                rotulo={`Conta ou cartão de ${l.descricao}`}
                nivel={0}
                valor={l.contaEscolhida}
                opcoes={cfg.contasCartoes}
                rotuloOpcao={(c) => nomeAtualDoMetodo(cfg, c)}
                rotuloVazio="Nenhuma conta…"
                aviso="Nenhuma conta guardada — as contas vêm de Definições."
                aoMudar={(v) => atualizarLinha(l.id, { contaEscolhida: v })}
              />
            </>
          )}
        </div>
        {/* Nota livre, em qualquer destino que tenha campo para ela. */}
        <input
          className={styles.linhaNota}
          aria-label={`Nota de ${l.descricao}`}
          placeholder="Nota (opcional)"
          value={l.notaEscolhida}
          onChange={(e) => atualizarLinha(l.id, { notaEscolhida: e.target.value })}
        />
        {l.acao === "import" && l.destino === "carga" && !l.localCarga.trim() && (
          <p className={styles.faltaCarga}>Escolha o local desta recarga.</p>
        )}
        {/* Sem kWh a linha entra na mesma — só fica por
            completar. Aviso, não bloqueio. */}
        {l.acao === "import" &&
          l.destino === "carga" &&
          l.localCarga.trim() &&
          !l.kwhCarga.trim() && (
            <p className={styles.notaCarga}>
              Sem kWh — entra assim e completa-se depois no Veículo.
            </p>
          )}
        {l.acao === "import" &&
          l.destino === "lancamento" &&
          cfg.contasCartoes.length > 0 &&
          !l.contaEscolhida.trim() && (
            <p className={styles.faltaCarga}>Escolha a conta ou cartão desta linha.</p>
          )}
        {l.acao === "import" &&
          l.destino === "pagamento_fatura" &&
          pagamentoDaLinha(l) === null && (
            <p className={styles.faltaCarga}>
              {!l.fatCartaoEscolhido.trim()
                ? "Escolha de que cartão é esta fatura."
                : "Escolha a conta que pagou."}
            </p>
          )}
        {l.acao === "import" &&
          l.destino === "transferencia_cartao" &&
          dadosDaTransferencia(l) === null && (
            <p className={styles.faltaCarga}>
              {!l.contaOrigem.trim()
                ? "Escolha a conta ou cartão de onde veio."
                : !l.contaDestino.trim()
                  ? "Escolha a conta que recebeu."
                  : "A conta que recebeu tem de ser diferente da de origem."}
            </p>
          )}
        {/* A outra ponta da mesma transferência, já lançada do
            lado contrário. Fica em tom próprio: não é "isto já
            foi importado", é "este dinheiro já está no app pelo
            outro lado". Mesmo formato do aviso de duplicata
            logo abaixo (descrição + motivos), pra não faltar
            justamente a pista mais concreta — a proximidade de
            data —, e com "ver detalhes" pra conferir sem sair
            da lista. */}
        {l.outraPonta?.correspondencia && (
          <div className={styles.outraPonta}>
            <p>
              O outro lado desta transferência já pode estar registado como "
              {descricaoExistente(l.outraPonta.correspondencia, cfg.currency)}" —{" "}
              {l.outraPonta.motivos.join(", ")}. Se for a mesma, desmarque esta linha para não
              contar o dinheiro duas vezes.
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
        {l.duplicata.status !== "new" && l.duplicata.correspondencia && (
          <p className={styles.motivoDup}>
            Parece com "{descricaoExistente(l.duplicata.correspondencia, cfg.currency)}" —{" "}
            {l.duplicata.motivos.join(", ")}
          </p>
        )}
      </div>
    </div>
  );
}

/** `memo`: editar uma linha só re-renderiza essa linha. Funciona porque as
 *  outras linhas mantêm a mesma identidade (`atualizarLinha` só recria o
 *  objeto alterado) e todos os outros props são estáveis entre renders —
 *  `cfg`/`cargasVeiculo` vêm direto das stores, as listas e os handlers são
 *  `useMemo`/`useCallback` em `useImportacao`. */
export default memo(LinhaImportacao);

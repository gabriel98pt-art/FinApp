import { useState, type FormEvent } from "react";
import { Pencil, Wallet, X } from "lucide-react";
import BottomSheet from "../../components/BottomSheet";
import Botao from "../../components/Botao";
import RenomearFolha from "../../components/RenomearFolha";
import Seletor from "../../components/Seletor";
import {
  adicionarCartao,
  adicionarMetodo,
  definirDiaFechamentoFatura,
  definirDiaVencimentoFatura,
  removerCartao,
  renomearCartao,
} from "../../services/cfgService";
import { useConfirmar } from "../../hooks/useConfirmar";
import { mostrarToast } from "../../stores/toastStore";
import { mensagemDeErroDados } from "../../utils/erroDados";
import { localizarMetodo, nomeAtualDoMetodo } from "../../utils/instituicoes";
import type { ConfigConta, TipoCartao } from "../../types";
import styles from "../Definicoes.module.css";

/** Contas e cartões: criar, renomear, remover, juntar um 2.º método à mesma
 *  instituição e acertar os dias da fatura — tudo num sítio só.
 *
 *  Em 31/08/2026 só o CRIAR se mudou da tela de Cartões para cá; a lista do
 *  que já existe ficou lá, em pílulas com um menu "⋯". Em 01/09/2026 o Gabriel
 *  reconsiderou e pediu a gestão inteira aqui — Cartões perde a seção "Cartões
 *  e contas" e passa a ser só leitura (KPIs, quadros, faturas, transferências).
 *
 *  Isto quebra de propósito a consistência com o "⋯" (`MenuAcoesItem`) que
 *  Transações/Parcelas/Veículo usam para editar um item de lista: decisão
 *  consciente dele. Aqui o desenho é o mesmo de `FolhaCategorias` — uma linha
 *  por item, com os botões de ação à direita —, que é o padrão de Definições.
 *
 *  As funções de serviço são exatamente as mesmas que Cartões chamava
 *  (`adicionarCartao`, `adicionarMetodo`, `renomearCartao`, `removerCartao`,
 *  `definirDiaFechamentoFatura`, `definirDiaVencimentoFatura`), com os mesmos
 *  avisos e as mesmas confirmações: mudou o sítio e o desenho, não o
 *  comportamento. */
export default function FolhaContasCartoes({
  cfg,
  uid,
  aberta,
  aoFechar,
}: {
  cfg: ConfigConta;
  uid: string;
  aberta: boolean;
  aoFechar: () => void;
}) {
  const confirmar = useConfirmar();
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoCartao>("credit");
  const [renomeando, setRenomeando] = useState<string | null>(null);
  // Adicionar um 2.º (ou 3.º...) método à MESMA instituição (Fase C2) — guarda
  // o id da instituição, não do método: não há método nenhum ainda até
  // submeter. `null` fechado.
  const [adicionandoMetodoA, setAdicionandoMetodoA] = useState<string | null>(null);
  const [tipoNovoMetodo, setTipoNovoMetodo] = useState<TipoCartao>("credit");

  // O que se guarda na lista é o ID do método, que não muda quando se
  // renomeia; quem MOSTRA tem de resolver o nome de hoje.
  const nomeDe = (id: string) => nomeAtualDoMetodo(cfg, id);

  async function adicionar(e: FormEvent) {
    e.preventDefault();
    const nomeFinal = nome.trim();
    if (!nomeFinal) return mostrarToast("Escreva um nome primeiro.");
    try {
      await adicionarCartao(uid, cfg, nomeFinal, tipo);
      mostrarToast(`✓ ${tipo === "credit" ? "Cartão de crédito" : "Conta de débito"} adicionado`);
      setNome("");
    } catch (err) {
      mostrarToast(mensagemDeErroDados(err, "Não foi possível adicionar."));
    }
  }

  function abrirAdicionarMetodo(id: string) {
    const achado = localizarMetodo(cfg, id);
    if (!achado) return;
    setTipoNovoMetodo("credit");
    setAdicionandoMetodoA(achado.instituicao.id);
  }

  async function submeterNovoMetodo(e: FormEvent) {
    e.preventDefault();
    if (!adicionandoMetodoA) return;
    try {
      await adicionarMetodo(uid, cfg, adicionandoMetodoA, tipoNovoMetodo);
      mostrarToast(
        `✓ ${tipoNovoMetodo === "credit" ? "Cartão de crédito" : "Conta de débito"} adicionado`,
      );
      setAdicionandoMetodoA(null);
    } catch (err) {
      mostrarToast(mensagemDeErroDados(err, "Não foi possível adicionar."));
    }
  }

  async function renomear(nomeNovo: string) {
    if (!renomeando) return;
    const alvo = renomeando;
    try {
      await renomearCartao(uid, cfg, alvo, nomeNovo);
      setRenomeando(null);
      mostrarToast(`✓ Agora chama-se "${nomeNovo.trim()}"`);
    } catch (err) {
      mostrarToast(mensagemDeErroDados(err, "Não foi possível renomear."));
    }
  }

  async function remover(id: string) {
    if (
      !(await confirmar(
        `Remover "${nomeDe(id)}"? Os lançamentos que já a usam não mudam — para trocar o nome, use Renomear.`,
      ))
    )
      return;
    try {
      await removerCartao(uid, cfg, id);
      mostrarToast(`"${nomeDe(id)}" removido`);
    } catch {
      mostrarToast("Não foi possível remover.");
    }
  }

  /** Os dois campos de dia da fatura escrevem direto ao teclar, tal como
   *  escreviam dentro da pílula em Cartões: um campo vazio (ou com lixo) volta
   *  a `null`, que é como se apaga o dia. */
  function guardarDia(
    valor: string,
    guardar: typeof definirDiaFechamentoFatura,
    id: string,
    rotulo: string,
  ) {
    const n = parseInt(valor.replace(/\D/g, ""), 10);
    void guardar(uid, cfg, id, Number.isFinite(n) ? n : null)
      .then(() => mostrarToast(`Dia de ${rotulo} guardado`))
      .catch(() => mostrarToast("Não foi possível guardar."));
  }

  return (
    <BottomSheet aberta={aberta} aoFechar={aoFechar} titulo="Contas e cartões">
      <p className={styles.nota}>
        Cada conta ou cartão fica disponível em Transações, Registro Rápido e nos filtros por conta.
        A tela de Cartões passou a mostrar só os saldos e as faturas.
      </p>

      {cfg.contasCartoes.length > 0 && (
        <ul className={styles.listaCategorias}>
          {cfg.contasCartoes.map((c) => {
            const credito = cfg.tipoCartao[c] === "credit";
            return (
              <li key={c} className={styles.itemConta}>
                <div className={styles.linhaCategoria}>
                  <span className={styles.nomeCategoria}>{nomeDe(c)}</span>
                  <span className={styles.tipoConta}>{credito ? "crédito" : "débito"}</span>
                  <button
                    className={styles.acaoCategoria}
                    onClick={() => abrirAdicionarMetodo(c)}
                    aria-label={`Adicionar método em ${nomeDe(c)}`}
                    title="Adicionar método"
                  >
                    <Wallet size={16} aria-hidden />
                  </button>
                  <button
                    className={styles.acaoCategoria}
                    onClick={() => setRenomeando(c)}
                    aria-label={`Renomear ${nomeDe(c)}`}
                    title="Renomear"
                  >
                    <Pencil size={16} aria-hidden />
                  </button>
                  <button
                    className={`${styles.acaoCategoria} ${styles.acaoRemover}`}
                    onClick={() => void remover(c)}
                    aria-label={`Remover ${nomeDe(c)}`}
                    title="Remover"
                  >
                    <X size={16} aria-hidden />
                  </button>
                </div>
                {/* Só o cartão de crédito tem fatura, e é o dia dela que manda
                    também nas parcelas em débito automático. */}
                {credito && (
                  <div className={styles.diasFatura}>
                    <label className={styles.campoDia}>
                      fecha dia
                      <input
                        type="text"
                        inputMode="numeric"
                        value={cfg.diaFechamentoFatura?.[c] ?? ""}
                        placeholder="fim do mês"
                        aria-label={`Dia de fechamento da fatura de ${nomeDe(c)} — vazio é o último dia do mês`}
                        onChange={(e) =>
                          guardarDia(e.target.value, definirDiaFechamentoFatura, c, "fechamento")
                        }
                      />
                    </label>
                    <label className={styles.campoDia}>
                      vence dia
                      <input
                        type="text"
                        inputMode="numeric"
                        value={cfg.diaVencimentoFatura?.[c] ?? ""}
                        placeholder="—"
                        aria-label={`Dia de vencimento da fatura de ${nomeDe(c)}`}
                        onChange={(e) =>
                          guardarDia(e.target.value, definirDiaVencimentoFatura, c, "vencimento")
                        }
                      />
                    </label>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={(e) => void adicionar(e)}>
        <div className={styles.linhaAdicionar}>
          <input
            className={styles.inputPequeno}
            placeholder="Nome (ex. AB Gold)"
            aria-label="Nome da conta ou cartão"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <Seletor
            variante="inline"
            rotulo="Tipo"
            nivel={1}
            valor={tipo}
            opcoes={["credit", "debit"]}
            rotuloOpcao={(t) => (t === "credit" ? "Crédito" : "Débito")}
            aoMudar={(t) => setTipo(t as TipoCartao)}
          />
          <button type="submit" className={styles.botaoPequeno}>
            <Wallet size={14} aria-hidden /> Adicionar conta ou cartão
          </button>
        </div>
      </form>

      {/* O aviso não fala em cascata nenhuma de propósito: o que liga os
          lançamentos à conta é um identificador que não muda, por isso o nome
          novo vale de imediato em toda a parte. */}
      <RenomearFolha
        aberta={renomeando !== null}
        nomeAtual={renomeando ? nomeDe(renomeando) : null}
        aoFechar={() => setRenomeando(null)}
        aoConfirmar={(n) => void renomear(n)}
        nivel={1}
        aviso="O nome novo aparece em tudo — no que já está lançado também."
      />

      {/* Adicionar um 2.º método à mesma instituição (Fase C2) — não pede nome,
          só o tipo: o nome é o da instituição, que `nomeAtualDoMetodo` já
          desambigua pelo tipo assim que ela tem mais de um método. */}
      <BottomSheet
        aberta={adicionandoMetodoA !== null}
        aoFechar={() => setAdicionandoMetodoA(null)}
        nivel={1}
        titulo={
          adicionandoMetodoA
            ? `Adicionar método — ${cfg.instituicoes.find((i) => i.id === adicionandoMetodoA)?.nome ?? ""}`
            : ""
        }
      >
        {adicionandoMetodoA && (
          <form className={styles.formMetodo} onSubmit={(e) => void submeterNovoMetodo(e)}>
            <Seletor
              variante="inline"
              rotulo="Tipo"
              nivel={2}
              valor={tipoNovoMetodo}
              opcoes={["credit", "debit"]}
              rotuloOpcao={(t) => (t === "credit" ? "Crédito" : "Débito")}
              aoMudar={(t) => setTipoNovoMetodo(t as TipoCartao)}
            />
            <Botao type="submit" variante="submeter">
              Adicionar método
            </Botao>
          </form>
        )}
      </BottomSheet>
    </BottomSheet>
  );
}

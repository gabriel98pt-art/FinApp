import { useState, type FormEvent } from "react";
import { Wallet } from "lucide-react";
import BottomSheet from "../../components/BottomSheet";
import Seletor from "../../components/Seletor";
import { adicionarCartao } from "../../services/cfgService";
import { mostrarToast } from "../../stores/toastStore";
import { mensagemDeErroDados } from "../../utils/erroDados";
import type { ConfigConta, TipoCartao } from "../../types";
import styles from "../Definicoes.module.css";

/** Criar uma conta ou cartão novo. Morava na própria tela de Cartões, dentro
 *  da seção "Cartões e contas" — o Gabriel pediu pra tirar de lá (31/08/2026)
 *  e trazer pra Definições. Cartões continua com a lista e a gestão do que já
 *  existe (renomear, remover, dia de fatura); só o "criar" é que se move.
 *
 *  Mesma função de serviço (`adicionarCartao`) e mesmos dois campos de
 *  sempre — nome e tipo — sem mudar comportamento nenhum, só o lugar. */
export default function FolhaContaCartao({
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
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoCartao>("credit");

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

  return (
    <BottomSheet aberta={aberta} aoFechar={aoFechar} titulo="Nova conta ou cartão">
      <p className={styles.nota}>
        Fica disponível em Transações, Registro Rápido e nos filtros por conta. Renomear, remover e
        ajustar o dia da fatura continua na tela de Cartões.
      </p>
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
            <Wallet size={14} aria-hidden /> Adicionar
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}

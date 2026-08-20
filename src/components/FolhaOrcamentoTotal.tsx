import { useState, type FormEvent } from "react";
import BottomSheet from "./BottomSheet";
import CampoMoeda from "./CampoMoeda";
import CategoriaBolha from "./CategoriaBolha";
import { definirOrcamentoTotal } from "../services/cfgService";
import { useCfgStore } from "../stores/cfgStore";
import { mostrarToast } from "../stores/toastStore";
import { formatMoney } from "../utils/money";
import type { StatusOrcamento } from "../utils/orcamento";
import type { Cents } from "../types";
import styles from "./FolhaOrcamentoTotal.module.css";
import Botao from "./Botao";

/** O plano do mês inteiro: define-se aqui o total, e vê-se quanto dele já foi
 *  repartido pelos tetos por categoria.
 *
 *  Só o total se edita nesta folha. O teto de cada categoria continua a
 *  editar-se onde já se editava — tocando na linha dela, logo abaixo na tela —
 *  e repetir esse formulário aqui dentro daria dois sítios para fazer a mesma
 *  coisa, que é como os dois passam a discordar. Aqui a lista é só leitura: ela
 *  existe para responder "já reparti tudo?", não para mexer.
 *
 *  "Restante para alocar" NÃO é o "Restam" da tela: aquele é quanto do plano
 *  ainda não foi GASTO, este é quanto do plano ainda não foi DISTRIBUÍDO entre
 *  categorias. Dá para ter os tetos todos por alocar e já ter gasto metade do
 *  mês, ou o contrário. */
export default function FolhaOrcamentoTotal({
  aberta,
  aoFechar,
  totalAtual,
  status,
  uid,
}: {
  aberta: boolean;
  aoFechar: () => void;
  totalAtual: Cents | undefined;
  status: StatusOrcamento[];
  uid: string;
}) {
  const moeda = useCfgStore((s) => s.cfg.currency);
  const [valor, setValor] = useState<Cents | null>(totalAtual ?? null);
  const [salvando, setSalvando] = useState(false);

  // Cada abertura recomeça do que está guardado — mesmo padrão do FormTeto.
  const [semeado, setSemeado] = useState(false);
  if (aberta && !semeado) {
    setSemeado(true);
    setValor(totalAtual ?? null);
  }

  function fechar() {
    setSemeado(false);
    aoFechar();
  }

  const somaTetos = status.reduce((s, c) => s + c.teto, 0);
  const porAlocar = (valor ?? 0) - somaTetos;

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (valor !== null && valor < 0) return mostrarToast("O total não pode ser negativo.");
    setSalvando(true);
    try {
      await definirOrcamentoTotal(uid, valor);
      mostrarToast(valor === null || valor === 0 ? "Total removido" : "✓ Total definido");
      fechar();
    } catch {
      mostrarToast("Não foi possível salvar o total.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <BottomSheet aberta={aberta} aoFechar={fechar} titulo="Total planeado por mês" tamanho="grande">
      <form className={styles.form} onSubmit={salvar}>
        <label className={styles.campo}>
          Quanto pretende gastar por mês
          <CampoMoeda valor={valor} aoMudar={setValor} disabled={salvando} />
        </label>
        <Botao type="submit" variante="submeter" disabled={salvando}>
          {salvando ? "Aguarde…" : "Salvar"}
        </Botao>
      </form>

      <div className={styles.resumo}>
        <p className={styles.resumoTitulo}>Já repartido por categoria</p>

        {status.length === 0 ? (
          <p className={styles.vazio}>
            Nenhuma categoria com teto ainda — o total fica todo por alocar.
          </p>
        ) : (
          <ul className={styles.lista}>
            {status.map((s) => (
              <li key={s.categoria} className={styles.linha}>
                <span className={styles.nome}>
                  <CategoriaBolha categoria={s.categoria} tamanho={22} />
                  {s.categoria}
                </span>
                <span className={styles.teto}>{formatMoney(s.teto, moeda)}</span>
              </li>
            ))}
          </ul>
        )}

        <div className={styles.totais}>
          <p className={styles.linhaTotal}>
            <span>Soma dos tetos</span>
            <span className={styles.teto}>{formatMoney(somaTetos, moeda)}</span>
          </p>
          {/* Negativo mostra-se: os tetos somados passarem do total é uma
              contradição do próprio plano, e escondê-la deixava a pessoa a
              repartir dinheiro que já não existe. */}
          <p className={`${styles.linhaTotal} ${porAlocar < 0 ? styles.estourado : ""}`}>
            <span>{porAlocar < 0 ? "Passou do total em" : "Restante para alocar"}</span>
            <span className={styles.teto}>{formatMoney(Math.abs(porAlocar), moeda)}</span>
          </p>
        </div>
      </div>
    </BottomSheet>
  );
}

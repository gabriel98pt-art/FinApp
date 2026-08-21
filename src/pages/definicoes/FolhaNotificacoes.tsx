import { CreditCard, Layers, PiggyBank, Repeat, type LucideIcon } from "lucide-react";
import BottomSheet from "../../components/BottomSheet";
import SettingsSwitchRow from "../../components/settings/SettingsSwitchRow";
import { atualizarConfig } from "../../services/cfgService";
import { TIPOS_NOTIFICACAO, type TipoNotificacao } from "../../utils/notificacoes";
import { mostrarToast } from "../../stores/toastStore";
import type { ConfigConta } from "../../types";
import styles from "../Definicoes.module.css";

/** Mesmo ícone por tipo que o sino do header já usa (`NotificacoesSino.tsx`,
 *  `POR_TIPO`) — não é decoração nova, é o mesmo mapa. */
const ITENS: { tipo: TipoNotificacao; titulo: string; Icone: LucideIcon }[] = [
  { tipo: "parcela", titulo: "Parcelas vencidas", Icone: Layers },
  { tipo: "fixa", titulo: "Despesas fixas vencidas", Icone: Repeat },
  { tipo: "fatura", titulo: "Faturas vencidas", Icone: CreditCard },
  { tipo: "orcamento", titulo: "Orçamento estourado", Icone: PiggyBank },
];

/** Preferência de quais tipos aparecem no sino do header — filtra o mesmo
 *  `todasNotificacoes()` que o sino já usa (`utils/notificacoes.ts`), sem
 *  mudar nenhuma regra de quando uma notificação é gerada. Ausente em cfg =
 *  todos ativos, para não mudar nada de quem já usa o app hoje. */
export default function FolhaNotificacoes({
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
  const ativos = cfg.notificacoesAtivas ?? TIPOS_NOTIFICACAO;

  async function alternar(tipo: TipoNotificacao) {
    const novos = ativos.includes(tipo) ? ativos.filter((t) => t !== tipo) : [...ativos, tipo];
    try {
      await atualizarConfig(uid, { notificacoesAtivas: novos });
    } catch {
      mostrarToast("Não foi possível salvar.");
    }
  }

  return (
    <BottomSheet aberta={aberta} aoFechar={aoFechar} titulo="Notificações">
      <p className={styles.nota}>Escolha o que deve aparecer no sino, no topo do app.</p>
      {ITENS.map(({ tipo, titulo, Icone }) => (
        <SettingsSwitchRow
          key={tipo}
          titulo={titulo}
          Icone={Icone}
          checked={ativos.includes(tipo)}
          onChange={() => void alternar(tipo)}
        />
      ))}
    </BottomSheet>
  );
}

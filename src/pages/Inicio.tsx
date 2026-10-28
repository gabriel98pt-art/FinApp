import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Sparkles } from "lucide-react";
import Pagina from "../components/Pagina";
import APagarEsteMes from "../components/APagarEsteMes";
import AvisoOrcamento from "../components/AvisoOrcamento";
import BottomSheet from "../components/BottomSheet";
import CopilotoCard from "../components/CopilotoCard";
import ErroSincronizacao from "../components/ErroSincronizacao";
import OndeFoiODinheiro from "../components/OndeFoiODinheiro";
import ResultadoDoMes from "../components/ResultadoDoMes";
import UltimosMovimentos from "../components/UltimosMovimentos";
import { useCfgStore } from "../stores/cfgStore";
import { useMesVisivelStore } from "../stores/mesVisivelStore";
import {
  useDespesasFixasStore,
  useDespesasStore,
  useReceitasStore,
} from "../stores/lancamentosStore";
import { useParcelasStore } from "../stores/parcelasStore";
import { useVeiculoStore } from "../stores/veiculoStore";
import { hojeIso, mesAtual } from "../utils/calculos";
import { resultadoDoMes } from "../utils/resumoMensal";
import styles from "../components/InicioSecoes.module.css";
import g from "../styles/grelha.module.css";
import grade from "./Inicio.module.css";

export default function Inicio() {
  const navegar = useNavigate();
  const [copilotoAberto, setCopilotoAberto] = useState(false);
  const moeda = useCfgStore((s) => s.cfg.currency);
  const receitas = useReceitasStore((s) => s.itens);
  const despesas = useDespesasStore((s) => s.itens);
  const despesasFixas = useDespesasFixasStore((s) => s.itens);
  const veiculo = useVeiculoStore((s) => s.dados);

  // Início não tem lista própria: mostra só totais, somados a partir de cinco
  // domínios. Se um deles não sincronizou, o quadro continua a desenhar um
  // número — e um total incompleto é indistinguível de um total certo. Pior,
  // com a subscrição caída logo no arranque o número é "€ 0,00", que se lê
  // como "não tens nada", não como "não conseguimos saber".
  //
  // A FaixaErroSync global só cobre a `cfg` (moeda, categorias, tetos), que é
  // transversal; cada domínio avisa na sua própria tela. Esta era a tela que
  // faltava — e é a primeira que se abre.
  const erroDados = [
    useReceitasStore((s) => s.erro),
    useDespesasStore((s) => s.erro),
    useDespesasFixasStore((s) => s.erro),
    useParcelasStore((s) => s.erro),
    useVeiculoStore((s) => s.erro),
  ].some(Boolean);

  // Mês exibido vem do seletor do header; `mesReal` é o de hoje e NÃO segue a
  // navegação — é ele que decide se uma fixa/parcela do mês corrente só conta
  // depois de marcada como paga (ver resumoMensal.ts).
  const mes = useMesVisivelStore((s) => s.mes);
  const mesReal = mesAtual();
  const hoje = hojeIso();
  // "Despesas" e "Receitas" aqui são FLUXO DE CAIXA (01/09/2026, pedido do
  // Gabriel) — soma do que foi de fato registrado/pago no mês, pela data real
  // de cada lançamento, não pelo mês de vencimento do cronograma. Pagar uma
  // parcela ou fixa atrasada, já no mês seguinte, agora conta no mês em que o
  // dinheiro saiu — antes ficava preso ao mês a que a dívida se referia, e
  // parecia que o pagamento "sumia" (o total do mês em que se pagou de
  // verdade não se mexia nada).
  //
  // Receita não precisa de função própria: `totalDoMes` já soma por data
  // desde sempre. Despesa tem `despesaRegistradaMes` (utils/resumoMensal.ts)
  // porque combina 3 fontes (correntes+parcelas, fixas, veículo) e trata o
  // caso de fixas pagas antes de 01/09/2026, sem o lançamento-espelho que
  // passou a existir a partir de agora (contam pelo mês de vencimento, como
  // sempre contaram — não é aproximação nova, é o de sempre preservado).
  //
  // Só o quadro do Início muda de significado: Despesas/Metas/Resumo Anual/
  // Copiloto continuam com `despesaRealizadaMes` (cronograma), de propósito
  // — não é o mesmo número, e não deveria ser.
  //
  // useMemo (achado da auditoria de Performance): Início não tem lista
  // própria, mas soma 5 domínios inteiros a cada render — inclusive um
  // toggle sem relação nenhuma com dinheiro, como o modo discreto. As
  // referências dos arrays das stores só mudam quando os dados de fato
  // mudam (todo service do app substitui o array, nunca muta em lugar), então
  // a lista de dependências já é o sinal certo de "recalcular ou não".
  const resumo = useMemo(
    () => resultadoDoMes(receitas, despesas, despesasFixas, veiculo, mes, mesReal, hoje),
    [receitas, despesas, despesasFixas, veiculo, mes, mesReal, hoje],
  );
  return (
    <Pagina titulo="Início" tituloVisivel={false}>
      {/* Compacta, e acima dos números: a faixa cheia substituiria o quadro, e
          os números continuam a valer — o que caiu foi a atualização, não os
          dados que já lá estavam. */}
      {erroDados && <ErroSincronizacao compacto mensagem="Alguns dados não sincronizaram" />}
      {/* A grelha alinhada (styles/grelha.module.css). A ordem do DOM é a do
          telemóvel; nas telas largas `order` põe o aviso numa faixa por cima e
          os Últimos movimentos antes das Categorias. */}
      <div className={g.grelha}>
        <div className={`${g.celula} ${g.s12} ${grade.aviso}`}>
          <AvisoOrcamento />
        </div>
        <div className={`${g.celula} ${g.s6} ${grade.resultado}`}>
          <ResultadoDoMes
            receitas={resumo.receitas}
            despesas={resumo.despesas}
            moeda={moeda}
            aoAbrirReceitas={() => navegar("/receitas")}
            aoAbrirDespesas={() => navegar("/despesas")}
          />
        </div>
        <div className={`${g.celula} ${g.s6} ${grade.pagar}`}>
          <APagarEsteMes />
        </div>
        <div className={`${g.celula} ${g.s4} ${grade.categorias}`}>
          <OndeFoiODinheiro />
        </div>
        <div className={`${g.celula} ${g.s8} ${grade.ultimos}`}>
          <UltimosMovimentos />
        </div>
        <div className={`${g.celula} ${g.s12} ${grade.copiloto}`}>
          <button type="button" className={styles.copiloto} onClick={() => setCopilotoAberto(true)}>
            <Sparkles className={styles.copilotoIcone} size={18} strokeWidth={1.75} aria-hidden />
            <span>Perguntar ao Copiloto</span>
            <ChevronRight className={styles.chevron} size={15} strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>
      <BottomSheet
        aberta={copilotoAberto}
        aoFechar={() => setCopilotoAberto(false)}
        titulo="Copiloto"
      >
        <CopilotoCard />
      </BottomSheet>
    </Pagina>
  );
}

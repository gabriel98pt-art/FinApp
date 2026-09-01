import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Pagina, { Kpis } from "../components/Pagina";
import AvisoOrcamento from "../components/AvisoOrcamento";
import ErroSincronizacao from "../components/ErroSincronizacao";
import KpiCard from "../components/KpiCard";
import CopilotoCard from "../components/CopilotoCard";
import DonutCategoriaCard from "../components/DonutCategoriaCard";
import ResumoAnual from "../components/ResumoAnual";
import { useCfgStore } from "../stores/cfgStore";
import { useMesVisivelStore } from "../stores/mesVisivelStore";
import {
  useDespesasFixasStore,
  useDespesasStore,
  useReceitasStore,
} from "../stores/lancamentosStore";
import { useParcelasStore } from "../stores/parcelasStore";
import { useVeiculoStore } from "../stores/veiculoStore";
import {
  despesasNosTotais,
  hojeIso,
  mesAtual,
  receitasNosTotais,
  saldoTotal,
  totalDoMes,
} from "../utils/calculos";
import { totalFixasGeral } from "../utils/despesasFixas";
import { totalParcelasGeral } from "../utils/parcelas";
import { despesaRegistradaMes } from "../utils/resumoMensal";
import { totalVeiculoGeral } from "../utils/veiculo";
import { formatMoney } from "../utils/money";

export default function Inicio() {
  const navegar = useNavigate();
  const moeda = useCfgStore((s) => s.cfg.currency);
  const modoDiscreto = useCfgStore((s) => s.cfg.modoDiscreto);
  const receitas = useReceitasStore((s) => s.itens);
  const despesas = useDespesasStore((s) => s.itens);
  const despesasFixas = useDespesasFixasStore((s) => s.itens);
  const parcelas = useParcelasStore((s) => s.itens);
  const veiculo = useVeiculoStore((s) => s.dados);

  // Início não tem lista própria: mostra só totais, somados a partir de cinco
  // domínios. Se um deles não sincronizou, os KPIs continuam a desenhar um
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
  // Só o KPI do Início muda de significado: Despesas/Metas/Resumo Anual/
  // Copiloto continuam com `despesaRealizadaMes` (cronograma), de propósito
  // — não é o mesmo número, e não deveria ser.
  //
  // useMemo (achado da auditoria de Performance): Início não tem lista
  // própria, mas soma 5 domínios inteiros a cada render — inclusive um
  // toggle sem relação nenhuma com dinheiro, como o modo discreto. As
  // referências dos arrays das stores só mudam quando os dados de fato
  // mudam (todo service do app substitui o array, nunca muta em lugar), então
  // a lista de dependências já é o sinal certo de "recalcular ou não".
  const resumo = useMemo(() => {
    const r = totalDoMes(receitasNosTotais(receitas), mes);
    const d = despesaRegistradaMes(despesas, despesasFixas, veiculo, mes, mesReal, hoje);
    return { receitas: r, despesas: d, saldo: r - d };
  }, [receitas, despesas, despesasFixas, veiculo, mes, mesReal, hoje]);
  // Poupança acumulada: mesmas exclusões e os mesmos quatro termos do "Total
  // geral" da tela Despesas (Despesas.tsx). Sem `despesasNosTotais` aqui, o
  // pagamento de fatura contava como despesa por cima da compra original e a
  // parcela contava pelo espelho em vez do plano — dois números diferentes
  // para a mesma ideia, em duas telas.
  const acumulado = useMemo(
    () =>
      saldoTotal(receitasNosTotais(receitas), despesasNosTotais(despesas)) -
      totalFixasGeral(despesasFixas, mesReal, hoje) -
      totalParcelasGeral(parcelas, mesReal, hoje) -
      totalVeiculoGeral(veiculo, mesReal, hoje),
    [receitas, despesas, despesasFixas, parcelas, veiculo, mesReal, hoje],
  );

  return (
    <Pagina titulo="Início">
      {/* Compacta, e acima dos números: a faixa cheia substituiria os KPIs, e
          eles continuam a valer — o que caiu foi a atualização, não os dados
          que já lá estavam. */}
      {erroDados && <ErroSincronizacao compacto mensagem="Alguns dados não sincronizaram" />}
      <Kpis pagina="inicio">
        <KpiCard
          rotulo="Receitas"
          valor={formatMoney(resumo.receitas, moeda)}
          tom="verde"
          aoClicar={() => navegar("/receitas")}
        />
        <KpiCard
          rotulo="Despesas"
          valor={formatMoney(resumo.despesas, moeda)}
          tom="vermelho"
          aoClicar={() => navegar("/despesas")}
        />
        <KpiCard
          rotulo="Saldo do mês"
          valor={formatMoney(resumo.saldo, moeda)}
          tom={resumo.saldo >= 0 ? "acento" : "vermelho"}
        />
        <KpiCard
          rotulo="Poupança"
          valor={formatMoney(acumulado, moeda)}
          // "amarelo" no positivo destoava de "Taxa de Poupança" (sempre
          // verde, em Planejamento → Metas) — poupança positiva é um bom
          // sinal, não um alerta (achado da auditoria de Design).
          tom={acumulado >= 0 ? "verde" : "vermelho"}
          discreto={modoDiscreto}
        />
      </Kpis>
      <AvisoOrcamento />
      <DonutCategoriaCard />
      {/* "Últimos 6 meses", e não "Resumo Anual": Planejamento → Metas mostra o
          MESMO quadro com uma janela de 12 meses. Os dois chamavam-se "Resumo
          Anual" e somavam períodos diferentes — quem comparava as duas telas
          via dois totais a discordar sem nada que explicasse porquê. O título
          passa a dizer a janela que cada um soma. (Aqui a janela ainda termina
          no mês do seletor, ao contrário da de 12 meses, que fica em hoje.) */}
      <ResumoAnual meses={6} titulo="Últimos 6 meses" ate={mes} />
      <CopilotoCard />
    </Pagina>
  );
}

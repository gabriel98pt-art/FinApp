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
} from "../utils/calculos";
import { totalFixasGeral } from "../utils/despesasFixas";
import { totalParcelasGeral } from "../utils/parcelas";
import { resumoMesCompleto } from "../utils/resumoMensal";
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
  // despesa do mês inclui fixas gerais + parcelas + veículo (Parte A) — fonte
  // única em utils/resumoMensal.ts
  const resumo = resumoMesCompleto(
    receitas,
    despesas,
    despesasFixas,
    parcelas,
    veiculo,
    mes,
    mesReal,
    hojeIso(),
  );
  // Poupança acumulada: mesmas exclusões e os mesmos quatro termos do "Total
  // geral" da tela Despesas (Despesas.tsx). Sem `despesasNosTotais` aqui, o
  // pagamento de fatura contava como despesa por cima da compra original e a
  // parcela contava pelo espelho em vez do plano — dois números diferentes
  // para a mesma ideia, em duas telas.
  const acumulado =
    saldoTotal(receitasNosTotais(receitas), despesasNosTotais(despesas)) -
    totalFixasGeral(despesasFixas, mesReal) -
    totalParcelasGeral(parcelas, mesReal) -
    totalVeiculoGeral(veiculo, mesReal);

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
          tom={acumulado >= 0 ? "amarelo" : "vermelho"}
          discreto={modoDiscreto}
        />
      </Kpis>
      <AvisoOrcamento />
      <DonutCategoriaCard />
      <ResumoAnual meses={6} titulo="Resumo Anual" ate={mes} />
      <CopilotoCard />
    </Pagina>
  );
}

import { useState } from "react";
import Pagina, { Kpis } from "../components/Pagina";
import KpiCard from "../components/KpiCard";
import OrcamentoCard from "../components/OrcamentoCard";
import FolhaOrcamentoTotal from "../components/FolhaOrcamentoTotal";
import { useAuthStore } from "../stores/authStore";
import { useCfgStore } from "../stores/cfgStore";
import { useDespesasStore } from "../stores/lancamentosStore";
import { useMesVisivelStore } from "../stores/mesVisivelStore";
import { useParcelasStore } from "../stores/parcelasStore";
import { diasDoMes, hojeIso, mesAtual } from "../utils/calculos";
import { formatMoney } from "../utils/money";
import { statusOrcamentoMes } from "../utils/orcamento";

/** Aba Planejamento (item 20). Em cima, o plano do mês inteiro — quanto se
 *  pretende gastar, quanto sobra, a que ritmo dá por dia. Em baixo, o mesmo
 *  por categoria, no OrcamentoCard, onde o teto de cada uma se define e edita.
 *
 *  O que os quatro cartões medem é o gasto das categorias QUE TÊM TETO, e não
 *  o gasto do mês todo. É a leitura que responde à pergunta desta tela — "o
 *  meu plano está a aguentar?" — e a única que fecha com o que se vê logo
 *  abaixo: um gasto numa categoria sem teto não tem plano contra o qual ser
 *  medido, e somá-lo aqui faria os cartões contradizerem a lista. */
export default function Planejamento() {
  const uid = useAuthStore((s) => s.sessao?.uid);
  const cfg = useCfgStore((s) => s.cfg);
  const despesas = useDespesasStore((s) => s.itens);
  const parcelas = useParcelasStore((s) => s.itens);
  const mes = useMesVisivelStore((s) => s.mes);
  const [folhaTotal, setFolhaTotal] = useState(false);

  const moeda = cfg.currency;
  const status = statusOrcamentoMes(despesas, parcelas, cfg.orcamentos, mes, mesAtual(), hojeIso());
  const gastoTotal = status.reduce((s, c) => s + c.gasto, 0);
  const totalPlanejado = cfg.orcamentoTotalMensal;

  // Enquanto não houver total definido, os três cartões de cálculo não têm
  // como responder — e "0" seria uma resposta errada, não uma ausência. Ficam
  // no travessão, e o primeiro cartão convida a definir. Não é estado de erro:
  // é a primeira vez que a pessoa abre a tela.
  const definido = totalPlanejado !== undefined && totalPlanejado > 0;
  const restam = definido ? totalPlanejado - gastoTotal : 0;
  const pctUsado = definido ? Math.round((gastoTotal / totalPlanejado) * 100) : 0;

  return (
    <Pagina titulo="Planejamento">
      <Kpis pagina="planejamento">
        <KpiCard
          rotulo="Total"
          valor={definido ? formatMoney(totalPlanejado, moeda) : "Definir"}
          sub={definido ? "planeado por mês" : "quanto pretende gastar por mês"}
          tom="acento"
          aoClicar={() => setFolhaTotal(true)}
        />
        <KpiCard
          rotulo="Restam"
          valor={definido ? formatMoney(restam, moeda) : "—"}
          sub={definido && restam < 0 ? "passou do plano" : undefined}
          tom={definido && restam < 0 ? "vermelho" : "verde"}
        />
        <KpiCard
          rotulo="% usado"
          valor={definido ? `${pctUsado}%` : "—"}
          tom={definido && pctUsado > 100 ? "vermelho" : "neutro"}
        />
        <KpiCard
          rotulo="Valor/dia"
          valor={definido ? formatMoney(Math.round(totalPlanejado / diasDoMes(mes)), moeda) : "—"}
          sub={definido ? `${diasDoMes(mes)} dias no mês` : undefined}
          tom="laranja"
        />
      </Kpis>

      <OrcamentoCard />

      {uid && (
        <FolhaOrcamentoTotal
          aberta={folhaTotal}
          aoFechar={() => setFolhaTotal(false)}
          totalAtual={totalPlanejado}
          status={status}
          uid={uid}
        />
      )}
    </Pagina>
  );
}

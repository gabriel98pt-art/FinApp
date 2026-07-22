import { saldo, resumoMes, agruparDespesasPorCategoria } from "../calc.js";
import { escapeHtml } from "../util.js";

function anoMesAtual() {
  return new Date().toISOString().slice(0, 7);
}

export function renderDashboard(container, lancamentos) {
  const resumo = resumoMes(lancamentos, anoMesAtual());
  const porCategoria = agruparDespesasPorCategoria(lancamentos);

  container.innerHTML = `
    <section class="kpis">
      <div class="kpi"><span class="kpi-label">Saldo total</span><span class="kpi-valor">${formatar(saldo(lancamentos))}</span></div>
      <div class="kpi"><span class="kpi-label">Receitas (mês)</span><span class="kpi-valor kpi-pos">${formatar(resumo.receitas)}</span></div>
      <div class="kpi"><span class="kpi-label">Despesas (mês)</span><span class="kpi-valor kpi-neg">${formatar(resumo.despesas)}</span></div>
      <div class="kpi"><span class="kpi-label">Saldo (mês)</span><span class="kpi-valor">${formatar(resumo.saldo)}</span></div>
    </section>
    <section class="categorias">
      <h3>Despesas por categoria</h3>
      <ul>
        ${Object.entries(porCategoria)
          .sort((a, b) => b[1] - a[1])
          .map(([cat, total]) => `<li><span>${escapeHtml(cat)}</span><span>${formatar(total)}</span></li>`)
          .join("") || "<li>Sem despesas ainda.</li>"}
      </ul>
    </section>
  `;
}

function formatar(valor) {
  return valor.toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}

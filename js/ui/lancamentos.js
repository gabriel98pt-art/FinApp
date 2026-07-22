import { escapeHtml } from "../util.js";

function formatar(valor) {
  return valor.toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}

export function renderLancamentos(container, lancamentos, { onAdd, onRemove }) {
  const ordenados = [...lancamentos].sort((a, b) => (a.data < b.data ? 1 : -1));

  container.innerHTML = `
    <form id="form-lancamento" class="form-lancamento">
      <input name="descricao" placeholder="Descrição" required maxlength="80" />
      <input name="valor" type="number" step="0.01" min="0.01" placeholder="Valor" required />
      <select name="tipo">
        <option value="despesa">Despesa</option>
        <option value="receita">Receita</option>
      </select>
      <input name="categoria" placeholder="Categoria" maxlength="40" />
      <input name="data" type="date" required value="${new Date().toISOString().slice(0, 10)}" />
      <button type="submit">Adicionar</button>
    </form>
    <ul class="lista-lancamentos">
      ${
        ordenados
          .map(
            (l) => `
        <li data-id="${escapeHtml(l.id)}" class="lanc ${l.tipo === "receita" ? "receita" : "despesa"}">
          <span class="lanc-desc">${escapeHtml(l.descricao)}</span>
          <span class="lanc-cat">${escapeHtml(l.categoria || "")}</span>
          <span class="lanc-data">${escapeHtml(l.data)}</span>
          <span class="lanc-valor">${l.tipo === "receita" ? "+" : "-"}${formatar(l.valor)}</span>
          <button class="lanc-remover" data-id="${l.id}" aria-label="Remover">✕</button>
        </li>`
          )
          .join("") || "<li>Nenhum lançamento ainda.</li>"
      }
    </ul>
  `;

  container.querySelector("#form-lancamento").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target;
    const dados = Object.fromEntries(new FormData(form).entries());
    onAdd({
      descricao: dados.descricao.trim(),
      valor: Number.parseFloat(dados.valor),
      tipo: dados.tipo,
      categoria: dados.categoria.trim() || "Sem categoria",
      data: dados.data,
    });
    form.reset();
  });

  container.querySelectorAll(".lanc-remover").forEach((btn) => {
    btn.addEventListener("click", () => onRemove(btn.dataset.id));
  });
}

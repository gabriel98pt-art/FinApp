import { useState, type FormEvent } from "react";
import { ArrowLeftRight, TrendingDown } from "lucide-react";
import Pagina, { Kpis } from "../components/Pagina";
import KpiCard from "../components/KpiCard";
import ListaLancamentos from "../components/ListaLancamentos";
import SeletorMes from "../components/SeletorMes";
import {
  alternarPagoDespesaFixa,
  atualizarDespesaFixa,
  criarDespesaFixa,
  criarTransferencia,
  removerDespesaFixa,
  removerTransferencia,
} from "../services/lancamentosService";
import { useAuthStore } from "../stores/authStore";
import { useCfgStore } from "../stores/cfgStore";
import { useMesVisivelStore } from "../stores/mesVisivelStore";
import {
  useDespesasFixasStore,
  useDespesasStore,
  useTransferenciasStore,
} from "../stores/lancamentosStore";
import { mostrarToast } from "../stores/toastStore";
import { useUiStore } from "../stores/uiStore";
import { useVeiculoStore } from "../stores/veiculoStore";
import {
  despesasNosTotais,
  doMes,
  mesAtual,
  ordenarPorDataDesc,
  rotuloMes,
  total,
} from "../utils/calculos";
import { totalFixasGeral } from "../utils/despesasFixas";
import { fixaAtivaNoMes } from "../utils/fatura";
import { despesaRealizadaMes } from "../utils/resumoMensal";
import { totalVeiculoGeral } from "../utils/veiculo";
import { formatMoney, parseMoney } from "../utils/money";
import type { DespesaFixa, Id } from "../types";
import styles from "./Despesas.module.css";

type Aba = "correntes" | "fixas" | "transferencias";

function agir(acao: () => Promise<unknown>, ok: string) {
  return acao()
    .then(() => mostrarToast(ok))
    .catch(() => mostrarToast("Não foi possível concluir. Tente de novo."));
}

export default function Despesas() {
  const uid = useAuthStore((s) => s.sessao?.uid);
  const moeda = useCfgStore((s) => s.cfg.currency);
  const cfg = useCfgStore((s) => s.cfg);
  const itens = useDespesasStore((s) => s.itens);
  const carregado = useDespesasStore((s) => s.carregado);
  const despesasFixas = useDespesasFixasStore((s) => s.itens);
  const transferencias = useTransferenciasStore((s) => s.itens);
  const abrirRegistro = useUiStore((s) => s.abrirRegistro);
  const veiculo = useVeiculoStore((s) => s.dados);

  const [aba, setAba] = useState<Aba>("correntes");

  // Mês exibido é compartilhado entre as telas (stores/mesVisivelStore.ts) e
  // entre as abas desta — Despesas e Fixas andam sempre no mesmo mês.
  const mes = useMesVisivelStore((s) => s.mes);
  const setMes = useMesVisivelStore((s) => s.setMes);
  const mesReal = mesAtual();
  // KPIs excluem pagamentos de fatura (a compra já contou — seção 4.1);
  // a LISTA mostra tudo, com a nota indicando a origem.
  const contadas = despesasNosTotais(itens);
  // total do mês/geral inclui fixas gerais + veículo (Parte A) — fonte única em utils/
  const totalDoMesComVeiculo = despesaRealizadaMes(itens, despesasFixas, veiculo, mes, mesReal);
  const totalGeralComVeiculo =
    total(contadas) + totalFixasGeral(despesasFixas) + totalVeiculoGeral(veiculo);

  function editar(id: string) {
    const item = itens.find((d) => d.id === id);
    if (item?.origem === "fat") {
      mostrarToast("Pagamento de fatura — gerencie na tela Cartões.");
      return;
    }
    if (item?.origem === "parc") {
      mostrarToast("Lançamento de parcela — gerencie na tela Parcelas.");
      return;
    }
    abrirRegistro("despesa", id);
  }

  // ---- formulário de despesa fixa (criar/editar) ----
  const [dfEditandoId, setDfEditandoId] = useState<Id | null>(null);
  const [dfDescricao, setDfDescricao] = useState("");
  const [dfValor, setDfValor] = useState("");
  const [dfCategoria, setDfCategoria] = useState("");
  const [dfContaCartao, setDfContaCartao] = useState("");
  const [dfInicio, setDfInicio] = useState("");
  const [dfFim, setDfFim] = useState("");

  function iniciarEdicaoFixa(f: DespesaFixa) {
    setDfEditandoId(f.id);
    setDfDescricao(f.descricao);
    setDfValor((f.valor / 100).toFixed(2).replace(".", ","));
    setDfCategoria(f.categoria);
    setDfContaCartao(f.contaCartao ?? "");
    setDfInicio(f.inicio ?? "");
    setDfFim(f.fim ?? "");
  }

  function limparFormFixa() {
    setDfEditandoId(null);
    setDfDescricao("");
    setDfValor("");
    setDfContaCartao("");
    setDfInicio("");
    setDfFim("");
  }

  async function salvarFixa(e: FormEvent) {
    e.preventDefault();
    const valor = parseMoney(dfValor);
    if (valor === null || valor <= 0) return mostrarToast("Valor inválido.");
    if (!dfDescricao.trim()) return mostrarToast("Descrição obrigatória.");
    const dados = {
      descricao: dfDescricao,
      valor,
      categoria: dfCategoria || cfg.categoriasFixas[0] || "Outros",
      contaCartao: dfContaCartao || undefined,
      inicio: dfInicio || undefined,
      fim: dfFim || undefined,
    };
    if (dfEditandoId) {
      const atual = despesasFixas.find((f) => f.id === dfEditandoId);
      if (!atual) return;
      await agir(
        () => atualizarDespesaFixa(uid!, { ...atual, ...dados }),
        "✓ Despesa fixa atualizada",
      );
    } else {
      await agir(
        () => criarDespesaFixa(uid!, { ...dados, pagoPorMes: {} }),
        "✓ Despesa fixa criada",
      );
    }
    limparFormFixa();
  }

  // ---- formulário de transferência (criar) ----
  const [tfData, setTfData] = useState(mes + "-01");
  const [tfDe, setTfDe] = useState("");
  const [tfPara, setTfPara] = useState("");
  const [tfValor, setTfValor] = useState("");
  const [tfDescricao, setTfDescricao] = useState("");

  async function salvarTransferencia(e: FormEvent) {
    e.preventDefault();
    const valor = parseMoney(tfValor);
    if (valor === null || valor <= 0) return mostrarToast("Valor inválido.");
    if (!tfDe || !tfPara) return mostrarToast("Escolha origem e destino.");
    if (tfDe === tfPara) return mostrarToast("Origem e destino não podem ser iguais.");
    await agir(
      () =>
        criarTransferencia(uid!, {
          data: tfData,
          de: tfDe,
          para: tfPara,
          valor,
          descricao: tfDescricao || undefined,
        }),
      "✓ Transferência registrada",
    );
    setTfValor("");
    setTfDescricao("");
  }

  return (
    <Pagina titulo="Despesas">
      <div className={styles.abas} role="tablist">
        {(
          [
            ["correntes", "Despesas"],
            ["fixas", "Fixas"],
            ["transferencias", "Transferências"],
          ] as const
        ).map(([id, nome]) => (
          <button
            key={id}
            role="tab"
            aria-selected={aba === id}
            className={`${styles.abaBotao} ${aba === id ? styles.abaAtiva : ""}`}
            onClick={() => setAba(id)}
          >
            {nome}
          </button>
        ))}
      </div>

      {aba === "correntes" && (
        <>
          <div className={styles.linhaMes}>
            <SeletorMes mes={mes} aoMudar={setMes} />
          </div>

          <Kpis>
            <KpiCard
              rotulo="Total do mês"
              valor={formatMoney(totalDoMesComVeiculo, moeda)}
              tom="vermelho"
            />
            <KpiCard rotulo="Lançamentos (mês)" valor={String(doMes(contadas, mes).length)} />
            <KpiCard rotulo="Total geral" valor={formatMoney(totalGeralComVeiculo, moeda)} />
          </Kpis>

          <ListaLancamentos
            /* key: trocar de mês remonta a lista e volta pra página 1 */
            key={mes}
            titulo="Lançamentos"
            itens={ordenarPorDataDesc(doMes(itens, mes)).map((d) => ({
              id: d.id,
              descricao: d.descricao,
              valor: d.valor,
              data: d.data,
              etiqueta: d.nota ? `${d.categoria} · ${d.nota}` : d.categoria,
            }))}
            carregado={carregado}
            tom="vermelho"
            moeda={moeda}
            rotuloTotal={`Total ${rotuloMes(mes)}`}
            vazio={`Nenhuma despesa em ${rotuloMes(mes)}`}
            vazioSub="Toque em Adicionar para lançar a primeira."
            vazioIcone={TrendingDown}
            aoAdicionar={() => abrirRegistro("despesa")}
            aoEditar={editar}
          />
        </>
      )}

      {aba === "fixas" && (
        <>
          <div className={styles.linhaMes}>
            <SeletorMes mes={mes} aoMudar={setMes} />
          </div>

          <form className={styles.form} onSubmit={salvarFixa}>
            <p className={styles.formTitulo}>
              {dfEditandoId ? "Editar despesa fixa" : "Nova despesa fixa"}
            </p>
            <label className={styles.campo}>
              Descrição
              <input
                value={dfDescricao}
                onChange={(e) => setDfDescricao(e.target.value)}
                required
              />
            </label>
            <div className={styles.linhaDupla}>
              <label className={styles.campo}>
                Valor mensal
                <input
                  inputMode="decimal"
                  placeholder="0,00"
                  value={dfValor}
                  onChange={(e) => setDfValor(e.target.value)}
                  required
                />
              </label>
              <label className={styles.campo}>
                Categoria
                <select value={dfCategoria} onChange={(e) => setDfCategoria(e.target.value)}>
                  {cfg.categoriasFixas.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className={styles.campo}>
              Conta/cartão (opcional — se for crédito, entra na fatura)
              <select value={dfContaCartao} onChange={(e) => setDfContaCartao(e.target.value)}>
                <option value="">Sem conta</option>
                {cfg.contasCartoes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                    {cfg.tipoCartao[c] === "credit" ? " · crédito" : ""}
                  </option>
                ))}
              </select>
            </label>
            <div className={styles.linhaDupla}>
              <label className={styles.campo}>
                Início (opcional)
                <input
                  type="month"
                  value={dfInicio}
                  onChange={(e) => setDfInicio(e.target.value)}
                />
              </label>
              <label className={styles.campo}>
                Fim (opcional)
                <input type="month" value={dfFim} onChange={(e) => setDfFim(e.target.value)} />
              </label>
            </div>
            <button type="submit" className={styles.salvar}>
              {dfEditandoId ? "Salvar alterações" : "Criar fixa"}
            </button>
            {dfEditandoId && (
              <button type="button" className={styles.cancelar} onClick={limparFormFixa}>
                Cancelar edição
              </button>
            )}
          </form>

          <div className={styles.lista}>
            {despesasFixas.length === 0 ? (
              <p className={styles.vazio}>Nenhuma despesa fixa ainda.</p>
            ) : (
              despesasFixas
                .filter((f) => fixaAtivaNoMes(f, mes))
                .map((f) => {
                  const paga = !!f.pagoPorMes[mes];
                  return (
                    <div key={f.id} className={styles.item}>
                      <div>
                        <p className={styles.itemNome}>{f.descricao}</p>
                        <p className={styles.itemDetalhe}>
                          {f.categoria}
                          {f.contaCartao ? ` · ${f.contaCartao}` : ""}
                        </p>
                      </div>
                      <div className={styles.itemLado}>
                        <span className={styles.itemValor}>{formatMoney(f.valor, moeda)}</span>
                        <button
                          className={`${styles.badgeToggle} ${paga ? styles.badgePago : styles.badgePendente}`}
                          onClick={() =>
                            void agir(
                              () => alternarPagoDespesaFixa(uid!, f.id, mes, !paga),
                              paga ? "Marcado como pendente" : "✓ Pago",
                            )
                          }
                        >
                          {paga ? "Pago" : "Pendente"}
                        </button>
                        <button
                          className={styles.editar}
                          onClick={() => iniciarEdicaoFixa(f)}
                          aria-label="Editar fixa"
                        >
                          Editar
                        </button>
                        <button
                          className={styles.remover}
                          onClick={() => {
                            if (!window.confirm(`Excluir "${f.descricao}"?`)) return;
                            void agir(() => removerDespesaFixa(uid!, f.id), "Excluída");
                          }}
                          aria-label="Excluir fixa"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </>
      )}

      {aba === "transferencias" && (
        <>
          <form className={styles.form} onSubmit={salvarTransferencia}>
            <p className={styles.formTitulo}>Nova transferência</p>
            <div className={styles.linhaDupla}>
              <label className={styles.campo}>
                Valor
                <input
                  inputMode="decimal"
                  placeholder="0,00"
                  value={tfValor}
                  onChange={(e) => setTfValor(e.target.value)}
                  required
                />
              </label>
              <label className={styles.campo}>
                Data
                <input
                  type="date"
                  value={tfData}
                  onChange={(e) => setTfData(e.target.value)}
                  required
                />
              </label>
            </div>
            <div className={styles.linhaDupla}>
              <label className={styles.campo}>
                De
                <select value={tfDe} onChange={(e) => setTfDe(e.target.value)} required>
                  <option value="">Escolher…</option>
                  {cfg.contasCartoes.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.campo}>
                Para
                <select value={tfPara} onChange={(e) => setTfPara(e.target.value)} required>
                  <option value="">Escolher…</option>
                  {cfg.contasCartoes.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className={styles.campo}>
              Descrição (opcional)
              <input value={tfDescricao} onChange={(e) => setTfDescricao(e.target.value)} />
            </label>
            <button type="submit" className={styles.salvar}>
              Registrar transferência
            </button>
          </form>

          <div className={styles.lista}>
            {transferencias.length === 0 ? (
              <p className={styles.vazio}>Nenhuma transferência ainda.</p>
            ) : (
              ordenarPorDataDesc(transferencias).map((t) => (
                <div key={t.id} className={styles.item}>
                  <div>
                    <p className={styles.itemNome}>
                      {t.de} <ArrowLeftRight size={12} aria-hidden style={{ display: "inline" }} />{" "}
                      {t.para}
                    </p>
                    <p className={styles.itemDetalhe}>
                      {t.descricao ? `${t.descricao} · ` : ""}
                      {t.data.slice(8, 10)}/{t.data.slice(5, 7)}
                    </p>
                  </div>
                  <div className={styles.itemLado}>
                    <span className={styles.itemValor}>{formatMoney(t.valor, moeda)}</span>
                    <button
                      className={styles.remover}
                      onClick={() => void agir(() => removerTransferencia(uid!, t.id), "Removida")}
                      aria-label="Remover transferência"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </Pagina>
  );
}

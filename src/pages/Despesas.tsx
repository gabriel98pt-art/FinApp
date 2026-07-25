import { useState, type FormEvent } from "react";
import { ArrowLeftRight, TrendingDown } from "lucide-react";
import Pagina, { Kpis } from "../components/Pagina";
import BottomSheet from "../components/BottomSheet";
import KpiCard from "../components/KpiCard";
import ListaLancamentos from "../components/ListaLancamentos";
import SeletorCategoria from "../components/SeletorCategoria";
import SeletorData from "../components/SeletorData";
import SeletorMes from "../components/SeletorMes";
import {
  alternarPagoDespesaFixa,
  atualizarDespesaFixa,
  atualizarTransferencia,
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
  hojeIso,
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
import type { DespesaFixa, Id, Transferencia } from "../types";
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

  // ---- caixa de despesa fixa (criar/editar na mesma folha — itens 2 e 7) ----
  const [dfAberta, setDfAberta] = useState(false);
  const [dfEditandoId, setDfEditandoId] = useState<Id | null>(null);
  const [dfDescricao, setDfDescricao] = useState("");
  const [dfNota, setDfNota] = useState("");
  const [dfValor, setDfValor] = useState("");
  const [dfCategoria, setDfCategoria] = useState("");
  const [dfContaCartao, setDfContaCartao] = useState("");
  const [dfDia, setDfDia] = useState("");
  const [dfInicio, setDfInicio] = useState("");
  const [dfFim, setDfFim] = useState("");

  function abrirNovaFixa() {
    setDfEditandoId(null);
    setDfDescricao("");
    setDfNota("");
    setDfValor("");
    setDfCategoria(cfg.categoriasFixas[0] ?? "");
    setDfContaCartao("");
    setDfDia("");
    setDfInicio("");
    setDfFim("");
    setDfAberta(true);
  }

  function abrirEdicaoFixa(f: DespesaFixa) {
    setDfEditandoId(f.id);
    setDfDescricao(f.descricao);
    setDfNota(f.nota ?? "");
    setDfValor((f.valor / 100).toFixed(2).replace(".", ","));
    setDfCategoria(f.categoria);
    setDfContaCartao(f.contaCartao ?? "");
    setDfDia(f.diaVencimento ? String(f.diaVencimento) : "");
    setDfInicio(f.inicio ?? "");
    setDfFim(f.fim ?? "");
    setDfAberta(true);
  }

  async function salvarFixa(e: FormEvent) {
    e.preventDefault();
    const valor = parseMoney(dfValor);
    if (valor === null || valor <= 0) return mostrarToast("Valor inválido.");
    if (!dfDescricao.trim()) return mostrarToast("Nome obrigatório.");
    const dia = dfDia.trim() === "" ? undefined : Number(dfDia);
    if (dia !== undefined && (!Number.isInteger(dia) || dia < 1 || dia > 31))
      return mostrarToast("Dia do vencimento deve ser entre 1 e 31.");
    const dados = {
      descricao: dfDescricao,
      nota: dfNota.trim() || undefined,
      valor,
      categoria: dfCategoria || cfg.categoriasFixas[0] || "Outros",
      contaCartao: dfContaCartao || undefined,
      diaVencimento: dia,
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
    setDfAberta(false);
  }

  async function excluirFixa() {
    const atual = despesasFixas.find((f) => f.id === dfEditandoId);
    if (!atual) return;
    if (!window.confirm(`Excluir "${atual.descricao}"?`)) return;
    setDfAberta(false);
    await agir(() => removerDespesaFixa(uid!, atual.id), "Despesa fixa excluída");
  }

  // ---- caixa de transferência (criar/editar) ----
  const [tfAberta, setTfAberta] = useState(false);
  const [tfEditandoId, setTfEditandoId] = useState<Id | null>(null);
  const [tfData, setTfData] = useState(hojeIso());
  const [tfDe, setTfDe] = useState("");
  const [tfPara, setTfPara] = useState("");
  const [tfValor, setTfValor] = useState("");
  const [tfDescricao, setTfDescricao] = useState("");
  const [tfNota, setTfNota] = useState("");

  function abrirNovaTransferencia() {
    setTfEditandoId(null);
    setTfData(hojeIso());
    setTfDe("");
    setTfPara("");
    setTfValor("");
    setTfDescricao("");
    setTfNota("");
    setTfAberta(true);
  }

  function abrirEdicaoTransferencia(t: Transferencia) {
    setTfEditandoId(t.id);
    setTfData(t.data);
    setTfDe(t.de);
    setTfPara(t.para);
    setTfValor((t.valor / 100).toFixed(2).replace(".", ","));
    setTfDescricao(t.descricao ?? "");
    setTfNota(t.nota ?? "");
    setTfAberta(true);
  }

  async function salvarTransferencia(e: FormEvent) {
    e.preventDefault();
    const valor = parseMoney(tfValor);
    if (valor === null || valor <= 0) return mostrarToast("Valor inválido.");
    if (!tfDe || !tfPara) return mostrarToast("Escolha origem e destino.");
    if (tfDe === tfPara) return mostrarToast("Origem e destino não podem ser iguais.");
    const dados = {
      data: tfData,
      de: tfDe,
      para: tfPara,
      valor,
      descricao: tfDescricao || undefined,
      nota: tfNota.trim() || undefined,
    };
    if (tfEditandoId) {
      await agir(
        () => atualizarTransferencia(uid!, { ...dados, id: tfEditandoId }),
        "✓ Transferência atualizada",
      );
    } else {
      await agir(() => criarTransferencia(uid!, dados), "✓ Transferência registrada");
    }
    setTfAberta(false);
  }

  async function excluirTransferencia() {
    if (!tfEditandoId) return;
    if (!window.confirm("Excluir esta transferência?")) return;
    const id = tfEditandoId;
    setTfAberta(false);
    await agir(() => removerTransferencia(uid!, id), "Transferência excluída");
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

          <div className={styles.cabecalhoLista}>
            <p className={styles.tituloSecao}>Despesas fixas</p>
            <button className={styles.botaoAdicionar} onClick={abrirNovaFixa}>
              + Adicionar despesa fixa
            </button>
          </div>

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
                      {/* Linha inteira abre a caixa de edição (item 7); só o
                          selo Pago/Pendente continua com ação própria. */}
                      <button className={styles.itemCorpo} onClick={() => abrirEdicaoFixa(f)}>
                        <span className={styles.itemTexto}>
                          <span className={styles.itemNome}>{f.descricao}</span>
                          <span className={styles.itemDetalhe}>
                            {f.categoria}
                            {f.contaCartao ? ` · ${f.contaCartao}` : ""}
                            {f.diaVencimento ? ` · dia ${f.diaVencimento}` : ""}
                          </span>
                        </span>
                        <span className={styles.itemValor}>{formatMoney(f.valor, moeda)}</span>
                      </button>
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
                    </div>
                  );
                })
            )}
          </div>
        </>
      )}

      {aba === "transferencias" && (
        <>
          <div className={styles.cabecalhoLista}>
            <p className={styles.tituloSecao}>Transferências entre contas</p>
            <button className={styles.botaoAdicionar} onClick={abrirNovaTransferencia}>
              + Adicionar transferência
            </button>
          </div>

          <div className={styles.lista}>
            {transferencias.length === 0 ? (
              <p className={styles.vazio}>Nenhuma transferência ainda.</p>
            ) : (
              ordenarPorDataDesc(transferencias).map((t) => (
                <div key={t.id} className={styles.item}>
                  <button className={styles.itemCorpo} onClick={() => abrirEdicaoTransferencia(t)}>
                    <span className={styles.itemTexto}>
                      <span className={styles.itemNome}>
                        {t.de}{" "}
                        <ArrowLeftRight size={12} aria-hidden style={{ display: "inline" }} />{" "}
                        {t.para}
                      </span>
                      <span className={styles.itemDetalhe}>
                        {t.descricao ? `${t.descricao} · ` : ""}
                        {t.data.slice(8, 10)}/{t.data.slice(5, 7)}
                      </span>
                    </span>
                    <span className={styles.itemValor}>{formatMoney(t.valor, moeda)}</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* Caixa única de despesa fixa: cria e edita (itens 2, 7, 11, 16, 17, 19) */}
      <BottomSheet
        aberta={dfAberta}
        aoFechar={() => setDfAberta(false)}
        titulo={dfEditandoId ? "Editar despesa fixa" : "Nova despesa fixa"}
      >
        <form className={styles.formFolha} onSubmit={salvarFixa}>
          <label className={styles.campo}>
            Nome
            <input value={dfDescricao} onChange={(e) => setDfDescricao(e.target.value)} required />
          </label>
          <label className={styles.campo}>
            Descrição (opcional)
            <input value={dfNota} onChange={(e) => setDfNota(e.target.value)} />
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
              Dia do vencimento
              <input
                inputMode="numeric"
                placeholder="1-31"
                value={dfDia}
                onChange={(e) => setDfDia(e.target.value)}
              />
            </label>
          </div>
          <SeletorCategoria
            valor={dfCategoria}
            opcoes={cfg.categoriasFixas}
            aoMudar={setDfCategoria}
          />
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
              <input type="month" value={dfInicio} onChange={(e) => setDfInicio(e.target.value)} />
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
            <button type="button" className={styles.excluir} onClick={() => void excluirFixa()}>
              Excluir despesa fixa
            </button>
          )}
        </form>
      </BottomSheet>

      {/* Caixa única de transferência: cria e edita */}
      <BottomSheet
        aberta={tfAberta}
        aoFechar={() => setTfAberta(false)}
        titulo={tfEditandoId ? "Editar transferência" : "Nova transferência"}
      >
        <form className={styles.formFolha} onSubmit={salvarTransferencia}>
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
          <SeletorData valor={tfData} aoMudar={setTfData} />
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
            Nome (opcional)
            <input value={tfDescricao} onChange={(e) => setTfDescricao(e.target.value)} />
          </label>
          <label className={styles.campo}>
            Descrição (opcional)
            <input value={tfNota} onChange={(e) => setTfNota(e.target.value)} />
          </label>
          <button type="submit" className={styles.salvar}>
            {tfEditandoId ? "Salvar alterações" : "Registrar transferência"}
          </button>
          {tfEditandoId && (
            <button
              type="button"
              className={styles.excluir}
              onClick={() => void excluirTransferencia()}
            >
              Excluir transferência
            </button>
          )}
        </form>
      </BottomSheet>
    </Pagina>
  );
}

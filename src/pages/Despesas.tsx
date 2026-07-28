import { useState, type FormEvent } from "react";
import { ArrowLeftRight, Plus, TrendingDown } from "lucide-react";
import Pagina, { Kpis } from "../components/Pagina";
import AbaTransicao from "../components/AbaTransicao";
import BottomSheet from "../components/BottomSheet";
import KpiCard from "../components/KpiCard";
import ErroSincronizacao from "../components/ErroSincronizacao";
import ListaLancamentos from "../components/ListaLancamentos";
import Seletor from "../components/Seletor";
import SeletorCategoria from "../components/SeletorCategoria";
import SeletorData from "../components/SeletorData";
import SeletorOrdem from "../components/SeletorOrdem";
import SeletorSemana from "../components/SeletorSemana";
import { compararPorOrdem, type Ordem } from "../utils/ordem";
import { indiceDaSemana, naSemana, rotuloDaSemana, semanasDoMes } from "../utils/semanas";
import {
  alternarPagoDespesaFixa,
  atualizarDespesaFixa,
  atualizarTransferencia,
  criarDespesaFixa,
  criarTransferencia,
  removerDespesaFixa,
  removerTransferencia,
} from "../services/lancamentosService";
import { useConfirmar } from "../hooks/useConfirmar";
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
import { useParcelasStore } from "../stores/parcelasStore";
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
import { totalParcelasGeral } from "../utils/parcelas";
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
  const confirmar = useConfirmar();
  const moeda = useCfgStore((s) => s.cfg.currency);
  const cfg = useCfgStore((s) => s.cfg);
  const itens = useDespesasStore((s) => s.itens);
  const carregado = useDespesasStore((s) => s.carregado);
  const erroDespesas = useDespesasStore((s) => s.erro);
  const erroFixas = useDespesasFixasStore((s) => s.erro);
  const erroTransferencias = useTransferenciasStore((s) => s.erro);
  const despesasFixas = useDespesasFixasStore((s) => s.itens);
  const transferencias = useTransferenciasStore((s) => s.itens);
  const abrirRegistro = useUiStore((s) => s.abrirRegistro);
  const parcelas = useParcelasStore((s) => s.itens);
  const veiculo = useVeiculoStore((s) => s.dados);

  const [aba, setAba] = useState<Aba>("correntes");
  // Ordem da lista de correntes (item 14) — não persiste entre visitas.
  const [ordem, setOrdem] = useState<Ordem>("recentes");
  // Visão Mês / Semana da lista de correntes (item 10).
  const [visao, setVisao] = useState<"mes" | "semana">("mes");
  const [semanaIdx, setSemanaIdx] = useState(0);

  // Mês exibido é compartilhado entre as telas (stores/mesVisivelStore.ts) e
  // entre as abas desta — Despesas e Fixas andam sempre no mesmo mês.
  const mes = useMesVisivelStore((s) => s.mes);
  const mesReal = mesAtual();
  // KPIs excluem pagamentos de fatura (a compra já contou — seção 4.1);
  // a LISTA mostra tudo, com a nota indicando a origem.
  const contadas = despesasNosTotais(itens);
  // total do mês/geral inclui fixas gerais + parcelas + veículo (Parte A) —
  // fonte única em utils/resumoMensal.ts
  const totalDoMesComVeiculo = despesaRealizadaMes(
    itens,
    despesasFixas,
    parcelas,
    veiculo,
    mes,
    mesReal,
  );
  const totalGeralComVeiculo =
    total(contadas) +
    totalFixasGeral(despesasFixas) +
    totalParcelasGeral(parcelas) +
    totalVeiculoGeral(veiculo);

  // Semanas do mês exibido; trocar de mês reposiciona na semana de hoje
  // (ou na primeira, quando hoje está fora do mês).
  const semanas = semanasDoMes(mes);
  const idxPadrao = indiceDaSemana(semanas, hojeIso());
  const [mesDaSemana, setMesDaSemana] = useState(mes);
  if (mesDaSemana !== mes) {
    setMesDaSemana(mes);
    setSemanaIdx(idxPadrao);
  }
  const semanaAtual = semanas[Math.min(semanaIdx, semanas.length - 1)];
  const fixasVisiveis = despesasFixas.filter((f) => fixaAtivaNoMes(f, mes));
  const doPeriodo =
    visao === "semana" && semanaAtual ? naSemana(itens, semanaAtual) : doMes(itens, mes);

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
    if (!(await confirmar(`Excluir "${atual.descricao}"?`))) return;
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
    if (!(await confirmar("Excluir esta transferência?"))) return;
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

      <AbaTransicao aba={aba}>
        {aba === "correntes" && (
          <>
            <Kpis pagina="despesas">
              <KpiCard
                rotulo="Total do mês"
                valor={formatMoney(totalDoMesComVeiculo, moeda)}
                tom="vermelho"
              />
              <KpiCard rotulo="Lançamentos (mês)" valor={String(doMes(contadas, mes).length)} />
              <KpiCard rotulo="Total geral" valor={formatMoney(totalGeralComVeiculo, moeda)} />
            </Kpis>

            <div className={styles.linhaVisao}>
              <div className={styles.alternadorVisao} role="radiogroup" aria-label="Período">
                {(
                  [
                    ["mes", "Mês"],
                    ["semana", "Semana"],
                  ] as const
                ).map(([id, nome]) => (
                  <button
                    key={id}
                    role="radio"
                    aria-checked={visao === id}
                    className={`${styles.visaoBotao} ${visao === id ? styles.visaoAtiva : ""}`}
                    onClick={() => setVisao(id)}
                  >
                    {nome}
                  </button>
                ))}
              </div>
              {visao === "semana" && (
                <SeletorSemana semanas={semanas} indice={semanaIdx} aoMudar={setSemanaIdx} />
              )}
            </div>

            <SeletorOrdem valor={ordem} aoMudar={setOrdem} />

            <ListaLancamentos
              /* key: trocar de mês ou de ordem remonta a lista e volta pra página 1 */
              key={`${mes}-${ordem}-${visao}-${semanaIdx}`}
              titulo="Despesas correntes"
              itens={[...doPeriodo].sort(compararPorOrdem(ordem)).map((d) => ({
                id: d.id,
                descricao: d.descricao,
                valor: d.valor,
                data: d.data,
                etiqueta: d.nota ? `${d.categoria} · ${d.nota}` : d.categoria,
                categoria: d.categoria,
              }))}
              carregado={carregado}
              erro={erroDespesas}
              tom="vermelho"
              moeda={moeda}
              rotuloTotal={
                visao === "semana" && semanaAtual
                  ? `Total ${rotuloDaSemana(semanaAtual)}`
                  : `Total ${rotuloMes(mes)}`
              }
              /* A lista mostra pagamento de fatura e espelho de parcela, mas o
                 rodapé soma só o que conta nos totais — igual aos KPIs acima. */
              total={total(despesasNosTotais(doPeriodo))}
              vazio={
                visao === "semana" && semanaAtual
                  ? `Nenhuma despesa em ${rotuloDaSemana(semanaAtual)}`
                  : `Nenhuma despesa em ${rotuloMes(mes)}`
              }
              vazioSub="Toque em Adicionar para lançar a primeira."
              vazioIcone={TrendingDown}
              aoAdicionar={() => abrirRegistro("despesa")}
              aoEditar={editar}
            />
          </>
        )}

        {aba === "fixas" && (
          <>
            <div className={styles.cabecalhoLista}>
              <h3 className={styles.tituloSecao}>Despesas fixas</h3>
              <button className={styles.botaoAdicionar} onClick={abrirNovaFixa}>
                <Plus size={15} aria-hidden /> Adicionar despesa fixa
              </button>
            </div>

            <div className={styles.lista}>
              {erroFixas && fixasVisiveis.length > 0 && <ErroSincronizacao compacto />}
              {erroFixas && fixasVisiveis.length === 0 ? (
                <ErroSincronizacao />
              ) : fixasVisiveis.length === 0 ? (
                <p className={styles.vazio}>
                  {despesasFixas.length === 0
                    ? "Nenhuma despesa fixa ainda."
                    : `Nenhuma despesa fixa em ${rotuloMes(mes)}.`}
                </p>
              ) : (
                fixasVisiveis.map((f) => {
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
              <h3 className={styles.tituloSecao}>Transferências entre contas</h3>
              <button className={styles.botaoAdicionar} onClick={abrirNovaTransferencia}>
                <Plus size={15} aria-hidden /> Adicionar transferência
              </button>
            </div>

            <div className={styles.lista}>
              {erroTransferencias && doMes(transferencias, mes).length > 0 && (
                <ErroSincronizacao compacto />
              )}
              {erroTransferencias && doMes(transferencias, mes).length === 0 ? (
                <ErroSincronizacao />
              ) : doMes(transferencias, mes).length === 0 ? (
                <p className={styles.vazio}>Nenhuma transferência em {rotuloMes(mes)}.</p>
              ) : (
                ordenarPorDataDesc(doMes(transferencias, mes)).map((t) => (
                  <div key={t.id} className={styles.item}>
                    <button
                      className={styles.itemCorpo}
                      onClick={() => abrirEdicaoTransferencia(t)}
                    >
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
      </AbaTransicao>
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
          <Seletor
            rotulo="Conta/cartão (opcional — se for crédito, entra na fatura)"
            valor={dfContaCartao}
            opcoes={cfg.contasCartoes}
            aoMudar={setDfContaCartao}
            rotuloOpcao={(c) => (cfg.tipoCartao[c] === "credit" ? `${c} · crédito` : c)}
            rotuloVazio="Sem conta"
          />
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
            <Seletor rotulo="De" valor={tfDe} opcoes={cfg.contasCartoes} aoMudar={setTfDe} />
            <Seletor rotulo="Para" valor={tfPara} opcoes={cfg.contasCartoes} aoMudar={setTfPara} />
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

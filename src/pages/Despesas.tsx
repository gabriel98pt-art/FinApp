import { useState, type FormEvent } from "react";
import { Plus, Square, SquareCheck, TrendingDown } from "lucide-react";
import Pagina, { Kpis } from "../components/Pagina";
import AbaTransicao from "../components/AbaTransicao";
import BottomSheet from "../components/BottomSheet";
import KpiCard from "../components/KpiCard";
import ErroSincronizacao from "../components/ErroSincronizacao";
import CampoMoeda from "../components/CampoMoeda";
import ListaLancamentos from "../components/ListaLancamentos";
import Seletor from "../components/Seletor";
import SeletorCategoria from "../components/SeletorCategoria";
import SeletorOrdem from "../components/SeletorOrdem";
import SeletorSemana from "../components/SeletorSemana";
import { compararPorOrdem, type Ordem } from "../utils/ordem";
import { indiceDaSemana, naSemana, rotuloDaSemana, semanasDoMes } from "../utils/semanas";
import {
  alternarPagoDespesaFixa,
  atualizarDespesaFixa,
  criarDespesaFixa,
  removerDespesaFixa,
} from "../services/lancamentosService";
import { useConfirmar } from "../hooks/useConfirmar";
import { useAuthStore } from "../stores/authStore";
import { useCfgStore } from "../stores/cfgStore";
import { useMesVisivelStore } from "../stores/mesVisivelStore";
import { useDespesasFixasStore, useDespesasStore } from "../stores/lancamentosStore";
import { mostrarToast } from "../stores/toastStore";
import { useUiStore } from "../stores/uiStore";
import { useParcelasStore } from "../stores/parcelasStore";
import { useVeiculoStore } from "../stores/veiculoStore";
import { despesasNosTotais, doMes, hojeIso, mesAtual, rotuloMes, total } from "../utils/calculos";
import { totalFixasGeral } from "../utils/despesasFixas";
import { fixaAtivaNoMes } from "../utils/fatura";
import { LIMIAR_PERTO_ORCAMENTO, statusOrcamentoMes } from "../utils/orcamento";
import { totalParcelasGeral } from "../utils/parcelas";
import { despesaRealizadaMes } from "../utils/resumoMensal";
import { totalVeiculoGeral } from "../utils/veiculo";
import { despesaPorCategoriaMes, maiorCategoriaRelevante } from "../utils/despesaPorCategoria";
import { formatMoney } from "../utils/money";
import type { Cents, DespesaFixa, Id } from "../types";
import styles from "./Despesas.module.css";

type Aba = "correntes" | "fixas";

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
  const despesasFixas = useDespesasFixasStore((s) => s.itens);
  const abrirRegistro = useUiStore((s) => s.abrirRegistro);
  const parcelas = useParcelasStore((s) => s.itens);
  const veiculo = useVeiculoStore((s) => s.dados);

  const [aba, setAba] = useState<Aba>("correntes");
  // Ordem da lista de correntes (item 14) — não persiste entre visitas.
  const [ordem, setOrdem] = useState<Ordem>("recentes");
  // Visão Mês / Semana da lista de correntes (item 10).
  const [visao, setVisao] = useState<"mes" | "semana">("mes");

  // Mês exibido é compartilhado entre as telas (stores/mesVisivelStore.ts) e
  // entre as abas desta — Despesas e Fixas andam sempre no mesmo mês.
  const mes = useMesVisivelStore((s) => s.mes);
  const mesReal = mesAtual();
  // Já nasce na semana de hoje, igual ao mês — sem isto, a primeira vez que
  // se troca para "Semana" abria sempre na primeira do mês em vez da atual.
  const [semanaIdx, setSemanaIdx] = useState(() =>
    indiceDaSemana(semanasDoMes(mes, cfg.diaInicioSemana), hojeIso()),
  );
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
    hojeIso(),
  );
  // Card "Maior categoria": a maior fatia do mês fora veículo e aluguel — as
  // duas lideram quase sempre e não dizem nada de novo (ver o util).
  const maiorCategoria = maiorCategoriaRelevante(
    despesaPorCategoriaMes(itens, despesasFixas, parcelas, veiculo, mes, mesReal),
  );
  // Teto da maior categoria (seção 4.8), se houver um configurado — mesma
  // base de cálculo do orçamento (correntes + parcelas, sem fixas/veículo:
  // ver orcamento.ts), por isso só o estado (perto/estourou) entra no cartão,
  // nunca a % — o valor já mostrado no cartão é o total mais amplo do resumo
  // por categoria, os dois números não são a mesma coisa.
  const statusMaiorCategoria = maiorCategoria
    ? statusOrcamentoMes(itens, parcelas, cfg.orcamentos, mes, mesReal).find(
        (s) => s.categoria === maiorCategoria.categoria,
      )
    : undefined;
  const pertoMaiorCategoria =
    !!statusMaiorCategoria &&
    !statusMaiorCategoria.estourado &&
    statusMaiorCategoria.pct >= LIMIAR_PERTO_ORCAMENTO;
  // "Total geral": mesmas quatro parcelas do "Total do mês" (correntes + fixas
  // + parcelas + veículo), só que sem filtro de mês — histórico completo. É a
  // mesma soma que a Poupança do Início subtrai das receitas (ver Inicio.tsx).
  const totalGeral =
    total(despesasNosTotais(itens)) +
    totalFixasGeral(despesasFixas, mesReal) +
    totalParcelasGeral(parcelas, mesReal) +
    totalVeiculoGeral(veiculo, mesReal);

  // Semanas do mês exibido; trocar de mês reposiciona na semana de hoje (ou
  // na ponta mais perto dela, quando hoje está fora do mês — ver `indiceDaSemana`).
  const semanas = semanasDoMes(mes, cfg.diaInicioSemana);
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

  // Com "Semana" escolhida, os dois primeiros KPIs passam a falar da semana —
  // o mesmo total que o rodapé da lista já mostrava lá em baixo. Só na aba
  // Correntes: é lá que vive o alternador Mês/Semana, e os KPIs agora ficam
  // fora das abas. "Maior categoria" continua sempre mensal — uma semana é
  // amostra pequena demais para essa pergunta.
  const porSemana = aba === "correntes" && visao === "semana" && semanaAtual !== undefined;
  const contadasDoPeriodo = despesasNosTotais(doPeriodo);
  const totalKpi = porSemana ? total(contadasDoPeriodo) : totalDoMesComVeiculo;
  const contagemKpi = porSemana ? contadasDoPeriodo.length : doMes(contadas, mes).length;

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
  const [dfValor, setDfValor] = useState<Cents | null>(null);
  const [dfCategoria, setDfCategoria] = useState("");
  const [dfContaCartao, setDfContaCartao] = useState("");
  const [dfDia, setDfDia] = useState("");
  const [dfInicio, setDfInicio] = useState("");
  const [dfFim, setDfFim] = useState("");
  const [dfAutoDebit, setDfAutoDebit] = useState(false);

  function abrirNovaFixa() {
    setDfEditandoId(null);
    setDfDescricao("");
    setDfNota("");
    setDfValor(null);
    setDfCategoria(cfg.categoriasDespesa[0] ?? "");
    setDfContaCartao("");
    setDfDia("");
    setDfInicio("");
    setDfFim("");
    setDfAutoDebit(false);
    setDfAberta(true);
  }

  function abrirEdicaoFixa(f: DespesaFixa) {
    setDfEditandoId(f.id);
    setDfDescricao(f.descricao);
    setDfNota(f.nota ?? "");
    setDfValor(f.valor);
    setDfCategoria(f.categoria);
    setDfContaCartao(f.contaCartao ?? "");
    setDfDia(f.diaVencimento ? String(f.diaVencimento) : "");
    setDfInicio(f.inicio ?? "");
    setDfFim(f.fim ?? "");
    setDfAutoDebit(!!f.autoDebit);
    setDfAberta(true);
  }

  async function salvarFixa(e: FormEvent) {
    e.preventDefault();
    const valor = dfValor;
    if (valor === null || valor <= 0) return mostrarToast("Valor inválido.");
    if (!dfDescricao.trim()) return mostrarToast("Nome obrigatório.");
    const dia = dfDia.trim() === "" ? undefined : Number(dfDia);
    if (dia !== undefined && (!Number.isInteger(dia) || dia < 1 || dia > 31))
      return mostrarToast("Dia do vencimento deve ser entre 1 e 31.");
    const dados = {
      descricao: dfDescricao,
      nota: dfNota.trim() || undefined,
      valor,
      categoria: dfCategoria || cfg.categoriasDespesa[0] || "Outros",
      contaCartao: dfContaCartao || undefined,
      diaVencimento: dia,
      inicio: dfInicio || undefined,
      fim: dfFim || undefined,
      // Só anotação: nenhum total olha para isto (ver o tipo `DespesaFixa`).
      // `undefined` quando desligado porque `atualizar` grava com `set` — a
      // chave sai do registo em vez de ficar um `false` pendurado.
      autoDebit: dfAutoDebit || undefined,
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

  return (
    <Pagina titulo="Despesas">
      {/* Fora das abas: os três já contam fixas, parcelas e veículo (ver o
          cálculo de `totalDoMesComVeiculo`), portanto valem tanto numa aba
          como na outra — e desapareciam ao passar para "Fixas". Mesma ordem
          de Veiculo e Tvde: KPIs primeiro, abas depois. */}
      <Kpis pagina="despesas">
        <KpiCard
          rotulo={porSemana ? "Total da semana" : "Total do mês"}
          chave="Total do mês"
          valor={formatMoney(totalKpi, moeda)}
          sub={porSemana && semanaAtual ? rotuloDaSemana(semanaAtual) : undefined}
          tom="vermelho"
        />
        <KpiCard
          rotulo={porSemana ? "Lançamentos (semana)" : "Lançamentos (mês)"}
          chave="Lançamentos (mês)"
          valor={String(contagemKpi)}
        />
        <KpiCard
          rotulo="Maior categoria"
          valor={maiorCategoria ? maiorCategoria.categoria : "—"}
          sub={
            maiorCategoria
              ? `${formatMoney(maiorCategoria.valor, moeda)}${
                  statusMaiorCategoria?.estourado
                    ? " — estourou o teto"
                    : pertoMaiorCategoria
                      ? " — perto do teto"
                      : ""
                }`
              : undefined
          }
          tom={
            statusMaiorCategoria?.estourado
              ? "vermelho"
              : pertoMaiorCategoria
                ? "amarelo"
                : "neutro"
          }
        />
        <KpiCard rotulo="Total geral" valor={formatMoney(totalGeral, moeda)} tom="laranja" />
      </Kpis>

      <div className={styles.abas} role="tablist">
        {(
          [
            ["correntes", "Correntes"],
            ["fixas", "Fixas"],
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
              {/* Já se está na aba "Correntes" — o título "Despesas correntes"
                  do cartão de baixo era redundante. O botão sobe pra cá. */}
              <button
                className={styles.botaoAdicionarTopo}
                onClick={() => abrirRegistro("despesa")}
              >
                <Plus size={15} aria-hidden /> Adicionar
              </button>
            </div>

            <SeletorOrdem valor={ordem} aoMudar={setOrdem} />

            <ListaLancamentos
              /* key: trocar de mês ou de ordem remonta a lista e volta pra página 1 */
              key={`${mes}-${ordem}-${visao}-${semanaIdx}`}
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
                            {f.nota ? ` · ${f.nota}` : ""}
                            {f.contaCartao ? ` · ${f.contaCartao}` : ""}
                            {f.diaVencimento ? ` · dia ${f.diaVencimento}` : ""}
                            {f.autoDebit && (
                              <>
                                {" · "}
                                <span className={styles.marcaAutoDebit}>débito automático</span>
                              </>
                            )}
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
              <CampoMoeda valor={dfValor} aoMudar={setDfValor} required />
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
            opcoes={cfg.categoriasDespesa}
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
          {/* Mesmo botão-marcação do parcelamento no Registro Rápido. Aqui é só
              uma anotação: a fixa já entra na fatura por ser de cartão de
              crédito, ligar ou desligar isto não move nenhum total. */}
          <button
            type="button"
            role="checkbox"
            aria-checked={dfAutoDebit}
            className={`${styles.marcacao} ${dfAutoDebit ? styles.marcacaoAtiva : ""}`}
            onClick={() => setDfAutoDebit(!dfAutoDebit)}
          >
            {dfAutoDebit ? <SquareCheck size={18} aria-hidden /> : <Square size={18} aria-hidden />}
            Débito automático
          </button>
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
    </Pagina>
  );
}

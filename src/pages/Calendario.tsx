import { useState, type FormEvent } from "react";
import { CalendarDays, Plus, X } from "lucide-react";
import Pagina, { EstadoVazio, Kpis } from "../components/Pagina";
import KpiCard from "../components/KpiCard";
import ErroSincronizacao from "../components/ErroSincronizacao";
import BottomSheet from "../components/BottomSheet";
import CampoMoeda from "../components/CampoMoeda";
import { criarEvento, removerEvento } from "../services/eventosService";
import { useConfirmar } from "../hooks/useConfirmar";
import { useAuthStore } from "../stores/authStore";
import { useCfgStore } from "../stores/cfgStore";
import { useEventosStore } from "../stores/eventosStore";
import {
  useDespesasFixasStore,
  useDespesasStore,
  useTransferenciasStore,
} from "../stores/lancamentosStore";
import { useMesVisivelStore } from "../stores/mesVisivelStore";
import { useParcelasStore } from "../stores/parcelasStore";
import { useVeiculoStore } from "../stores/veiculoStore";
import { mostrarToast } from "../stores/toastStore";
import { calcularFatura, type DadosFatura } from "../utils/fatura";
import {
  porDia,
  vencimentosDeFaturas,
  vencimentosDeFixas,
  vencimentosDeParcelas,
  type Vencimento,
} from "../utils/vencimentos";
import {
  diasComEventoNoMes,
  diasDoGrid,
  eventosDoDia,
  eventosDoMes,
  proximosEventos,
  rotulosDiasSemana,
} from "../utils/calendario";
import { hojeIso, rotuloMes } from "../utils/calculos";
import { formatMoney } from "../utils/money";
import type { Cents } from "../types";
import styles from "./Calendario.module.css";

export default function Calendario() {
  const uid = useAuthStore((s) => s.sessao?.uid);
  const confirmar = useConfirmar();
  const moeda = useCfgStore((s) => s.cfg.currency);
  const eventos = useEventosStore((s) => s.itens);
  const carregado = useEventosStore((s) => s.carregado);
  const erro = useEventosStore((s) => s.erro);
  const cfg = useCfgStore((s) => s.cfg);
  const despesas = useDespesasStore((s) => s.itens);
  const despesasFixas = useDespesasFixasStore((s) => s.itens);
  const transferencias = useTransferenciasStore((s) => s.itens);
  const parcelas = useParcelasStore((s) => s.itens);
  const veiculo = useVeiculoStore((s) => s.dados);

  const mes = useMesVisivelStore((s) => s.mes);
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);
  const [novoAberto, setNovoAberto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [dataNovo, setDataNovo] = useState(hojeIso());
  const [nota, setNota] = useState("");
  const [valorTexto, setValorTexto] = useState<Cents | null>(null);

  // Trocar de mês no topo fecha o detalhe do dia — senão a folha continua
  // aberta mostrando um dia que já não está no mês exibido.
  const [mesDoDia, setMesDoDia] = useState(mes);
  if (mesDoDia !== mes) {
    setMesDoDia(mes);
    if (diaSelecionado) setDiaSelecionado(null);
  }

  const hoje = hojeIso();
  const grid = diasDoGrid(mes, cfg.diaInicioSemana);
  const diasComEvento = diasComEventoNoMes(eventos, mes);
  const doMesAtual = eventosDoMes(eventos, mes);
  const proximos7 = proximosEventos(eventos, hoje, 7);
  const eventosDoDiaSel = diaSelecionado ? eventosDoDia(eventos, diaSelecionado) : [];

  // Compromissos do mês que não são evento manual (item 11): fixas gerais e
  // do veículo, parcelas e faturas dos cartões de crédito.
  const dadosFatura: DadosFatura = {
    despesasFixas,
    despesasFixasVeiculo: veiculo.despesasFixas,
    despesasCorrentes: despesas,
    parcelas,
    transferencias,
    cargas: veiculo.cargas,
    despesasVeiculo: veiculo.despesas,
  };
  const devidoPorCartao = cfg.contasCartoes
    .filter((c) => cfg.tipoCartao[c] === "credit")
    .map((c) => ({ cartao: c, devido: calcularFatura(c, mes, dadosFatura, cfg).devido }));

  const vencimentos: Vencimento[] = [
    ...vencimentosDeFixas([...despesasFixas, ...veiculo.despesasFixas], mes),
    ...vencimentosDeParcelas(parcelas, mes, cfg.diaVencimentoFatura),
    ...vencimentosDeFaturas(devidoPorCartao, mes),
  ];
  const vencimentosPorDia = porDia(vencimentos);
  const vencimentosDoDiaSel = diaSelecionado ? (vencimentosPorDia.get(diaSelecionado) ?? []) : [];

  async function salvarEvento(e: FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) return mostrarToast("Título obrigatório.");
    // Campo opcional: vazio grava sem valor, como sempre.
    const valor = valorTexto ?? undefined;
    try {
      await criarEvento(uid!, { titulo, data: dataNovo, descricao: nota || undefined, valor });
      mostrarToast("✓ Evento adicionado");
      setNovoAberto(false);
      setTitulo("");
      setNota("");
      setValorTexto(null);
    } catch {
      mostrarToast("Não foi possível salvar.");
    }
  }

  return (
    <Pagina titulo="Calendário">
      <Kpis>
        <KpiCard rotulo={`Eventos em ${rotuloMes(mes)}`} valor={String(doMesAtual.length)} />
        <KpiCard rotulo="Próximos 7 dias" valor={String(proximos7.length)} tom="amarelo" />
      </Kpis>

      <div className={styles.linhaMes}>
        <button className={styles.novoBotao} onClick={() => setNovoAberto(true)}>
          <Plus size={15} aria-hidden /> Evento
        </button>
      </div>

      <div className={styles.grid}>
        <div className={styles.cabecalhoSemana}>
          {rotulosDiasSemana(cfg.diaInicioSemana).map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className={styles.diasGrid}>
          {grid.map(({ data, foraDoMes }) => {
            const temEvento = diasComEvento.has(data);
            const doDia = vencimentosPorDia.get(data) ?? [];
            const tipos = [...new Set(doDia.map((v) => v.tipo))];
            const ehHoje = data === hoje;
            return (
              <button
                key={data}
                className={`${styles.dia} ${foraDoMes ? styles.diaForaDoMes : ""} ${ehHoje ? styles.diaHoje : ""}`}
                onClick={() => setDiaSelecionado(data)}
                // Os pontos que marcam o dia são aria-hidden (são desenho), e o
                // conteúdo do botão é só o número — ou seja, quem usa leitor de
                // ecrã ouvia "1, 2, 3…" e não ficava a saber nada do que este
                // ecrã existe para mostrar: em que dias há algo. "Hoje" e "fora
                // do mês" também só se viam pela cor.
                aria-label={[
                  `Dia ${parseInt(data.slice(8, 10), 10)}`,
                  foraDoMes ? "de outro mês" : null,
                  ehHoje ? "hoje" : null,
                  doDia.length > 0
                    ? `${doDia.length} vencimento${doDia.length > 1 ? "s" : ""}`
                    : null,
                  temEvento ? "com evento" : null,
                ]
                  .filter(Boolean)
                  .join(", ")}
              >
                {parseInt(data.slice(8, 10), 10)}
                <span className={styles.marcadores} aria-hidden>
                  {temEvento && <span className={styles.pontoEvento} />}
                  {tipos.map((t) => (
                    <span key={t} className={`${styles.ponto} ${styles[`ponto_${t}`]}`} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.secao}>
        {/* h3, como "Despesas fixas", "Carregamentos" e as outras secções do
            app. O .secaoTitulo já fixa tamanho e peso, então nada muda à vista. */}
        <h3 className={styles.secaoTitulo}>Próximos 7 dias</h3>
        {proximos7.length === 0 ? (
          <p className={styles.vazio}>Nada agendado nos próximos 7 dias.</p>
        ) : (
          <div className={styles.lista}>
            {proximos7.map((e) => (
              <div key={e.id} className={styles.item}>
                <div>
                  <p className={styles.itemNome}>{e.titulo}</p>
                  <p className={styles.itemDetalhe}>
                    {e.data.slice(8, 10)}/{e.data.slice(5, 7)}
                    {e.descricao ? ` · ${e.descricao}` : ""}
                  </p>
                </div>
                {e.valor !== undefined && (
                  <span className={styles.itemValor}>{formatMoney(e.valor, moeda)}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {erro ? (
        <ErroSincronizacao sub="O calendário pode estar incompleto — compromissos e eventos podem faltar." />
      ) : (
        carregado &&
        eventos.length === 0 && (
          <EstadoVazio
            Icone={CalendarDays}
            mensagem="Nenhum evento ainda"
            sub="Toque em + Evento pra agendar o primeiro."
          />
        )
      )}

      <BottomSheet
        aberta={diaSelecionado !== null}
        aoFechar={() => setDiaSelecionado(null)}
        titulo={
          diaSelecionado ? `${diaSelecionado.slice(8, 10)}/${diaSelecionado.slice(5, 7)}` : ""
        }
      >
        {vencimentosDoDiaSel.length > 0 && (
          <div className={styles.lista}>
            {vencimentosDoDiaSel.map((v, i) => (
              <div key={`${v.tipo}-${i}`} className={styles.item}>
                <div>
                  <p className={styles.itemNome}>
                    <span className={`${styles.ponto} ${styles[`ponto_${v.tipo}`]}`} aria-hidden />{" "}
                    {v.titulo}
                  </p>
                  <p className={styles.itemDetalhe}>{v.detalhe}</p>
                </div>
                <span className={styles.itemValor}>{formatMoney(v.valor, moeda)}</span>
              </div>
            ))}
          </div>
        )}
        {eventosDoDiaSel.length === 0 ? (
          <p className={styles.vazio}>
            {vencimentosDoDiaSel.length > 0
              ? "Nenhum evento manual neste dia."
              : "Nenhum evento neste dia."}
          </p>
        ) : (
          <div className={styles.lista}>
            {eventosDoDiaSel.map((e) => (
              <div key={e.id} className={styles.item}>
                <div>
                  <p className={styles.itemNome}>{e.titulo}</p>
                  {e.descricao && <p className={styles.itemDetalhe}>{e.descricao}</p>}
                </div>
                <div className={styles.itemLado}>
                  {e.valor !== undefined && (
                    <span className={styles.itemValor}>{formatMoney(e.valor, moeda)}</span>
                  )}
                  <button
                    className={styles.remover}
                    onClick={() => {
                      void (async () => {
                        if (!(await confirmar(`Excluir "${e.titulo}"?`))) return;
                        await removerEvento(uid!, e.id)
                          .then(() => mostrarToast("Evento excluído"))
                          .catch(() => mostrarToast("Não foi possível excluir."));
                      })();
                    }}
                    aria-label="Excluir evento"
                  >
                    <X size={16} aria-hidden />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <button
          className={styles.novoNoDiaBotao}
          onClick={() => {
            setDataNovo(diaSelecionado ?? hoje);
            setDiaSelecionado(null);
            setNovoAberto(true);
          }}
        >
          <Plus size={15} aria-hidden /> Novo evento neste dia
        </button>
      </BottomSheet>

      <BottomSheet aberta={novoAberto} aoFechar={() => setNovoAberto(false)} titulo="Novo evento">
        <form className={styles.form} onSubmit={salvarEvento}>
          <label className={styles.campo}>
            Título
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
          </label>
          <label className={styles.campo}>
            Data
            <input
              type="date"
              value={dataNovo}
              onChange={(e) => setDataNovo(e.target.value)}
              required
            />
          </label>
          <label className={styles.campo}>
            Valor (opcional)
            <CampoMoeda valor={valorTexto} aoMudar={setValorTexto} />
          </label>
          <label className={styles.campo}>
            Nota (opcional)
            <input value={nota} onChange={(e) => setNota(e.target.value)} />
          </label>
          <button type="submit" className={styles.salvar}>
            Adicionar evento
          </button>
        </form>
      </BottomSheet>
    </Pagina>
  );
}

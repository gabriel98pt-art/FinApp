import { useState, type FormEvent } from "react";
import { CalendarDays } from "lucide-react";
import Pagina, { EstadoVazio, Kpis } from "../components/Pagina";
import KpiCard from "../components/KpiCard";
import BottomSheet from "../components/BottomSheet";
import SeletorMes from "../components/SeletorMes";
import { criarEvento, removerEvento } from "../services/eventosService";
import { useAuthStore } from "../stores/authStore";
import { useCfgStore } from "../stores/cfgStore";
import { useEventosStore } from "../stores/eventosStore";
import { mostrarToast } from "../stores/toastStore";
import {
  diasComEventoNoMes,
  eventosDoDia,
  eventosDoMes,
  proximosEventos,
} from "../utils/calendario";
import { hojeIso, mesAtual } from "../utils/calculos";
import { formatMoney, parseMoney } from "../utils/money";
import type { YearMonth } from "../types";
import styles from "./Calendario.module.css";

const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

function diasDoGrid(ym: YearMonth): { data: string; foraDoMes: boolean }[] {
  const [y, m] = ym.split("-").map(Number);
  const primeiroDia = new Date(y, m - 1, 1);
  const offset = primeiroDia.getDay(); // 0=domingo
  const ultimoDiaMes = new Date(y, m, 0).getDate();

  const celulas: { data: string; foraDoMes: boolean }[] = [];
  // dias do mês anterior pra preencher a primeira semana
  for (let i = offset; i > 0; i--) {
    const d = new Date(y, m - 1, 1 - i);
    celulas.push({ data: isoDeDate(d), foraDoMes: true });
  }
  for (let dia = 1; dia <= ultimoDiaMes; dia++) {
    celulas.push({ data: `${ym}-${String(dia).padStart(2, "0")}`, foraDoMes: false });
  }
  while (celulas.length % 7 !== 0) {
    const ultima = celulas[celulas.length - 1].data;
    const d = new Date(ultima);
    d.setDate(d.getDate() + 1);
    celulas.push({ data: isoDeDate(d), foraDoMes: true });
  }
  return celulas;
}

function isoDeDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function Calendario() {
  const uid = useAuthStore((s) => s.sessao?.uid);
  const moeda = useCfgStore((s) => s.cfg.currency);
  const eventos = useEventosStore((s) => s.itens);
  const carregado = useEventosStore((s) => s.carregado);

  const [mes, setMes] = useState(mesAtual());
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);
  const [novoAberto, setNovoAberto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [dataNovo, setDataNovo] = useState(hojeIso());
  const [nota, setNota] = useState("");
  const [valorTexto, setValorTexto] = useState("");

  const hoje = hojeIso();
  const grid = diasDoGrid(mes);
  const diasComEvento = diasComEventoNoMes(eventos, mes);
  const doMesAtual = eventosDoMes(eventos, mes);
  const proximos7 = proximosEventos(eventos, hoje, 7);
  const eventosDoDiaSel = diaSelecionado ? eventosDoDia(eventos, diaSelecionado) : [];

  async function salvarEvento(e: FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) return mostrarToast("Título obrigatório.");
    let valor: number | undefined;
    if (valorTexto.trim()) {
      const v = parseMoney(valorTexto);
      if (v === null) return mostrarToast("Valor inválido.");
      valor = v;
    }
    try {
      await criarEvento(uid!, { titulo, data: dataNovo, descricao: nota || undefined, valor });
      mostrarToast("✓ Evento adicionado");
      setNovoAberto(false);
      setTitulo("");
      setNota("");
      setValorTexto("");
    } catch {
      mostrarToast("Não foi possível salvar.");
    }
  }

  return (
    <Pagina titulo="Calendário">
      <Kpis>
        <KpiCard rotulo="Eventos este mês" valor={String(doMesAtual.length)} />
        <KpiCard rotulo="Próximos 7 dias" valor={String(proximos7.length)} tom="amarelo" />
      </Kpis>

      <div className={styles.linhaMes}>
        <SeletorMes mes={mes} aoMudar={setMes} />
        <button className={styles.novoBotao} onClick={() => setNovoAberto(true)}>
          + Evento
        </button>
      </div>

      <div className={styles.grid}>
        <div className={styles.cabecalhoSemana}>
          {DIAS_SEMANA.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className={styles.diasGrid}>
          {grid.map(({ data, foraDoMes }) => {
            const temEvento = diasComEvento.has(data);
            const ehHoje = data === hoje;
            return (
              <button
                key={data}
                className={`${styles.dia} ${foraDoMes ? styles.diaForaDoMes : ""} ${ehHoje ? styles.diaHoje : ""}`}
                onClick={() => setDiaSelecionado(data)}
              >
                {parseInt(data.slice(8, 10), 10)}
                {temEvento && <span className={styles.pontoEvento} aria-hidden />}
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.secao}>
        <p className={styles.secaoTitulo}>Próximos 7 dias</p>
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

      {carregado && eventos.length === 0 && (
        <EstadoVazio
          Icone={CalendarDays}
          mensagem="Nenhum evento ainda"
          sub="Toque em + Evento pra agendar o primeiro."
        />
      )}

      <BottomSheet
        aberta={diaSelecionado !== null}
        aoFechar={() => setDiaSelecionado(null)}
        titulo={
          diaSelecionado ? `${diaSelecionado.slice(8, 10)}/${diaSelecionado.slice(5, 7)}` : ""
        }
      >
        {eventosDoDiaSel.length === 0 ? (
          <p className={styles.vazio}>Nenhum evento neste dia.</p>
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
                      if (!window.confirm(`Excluir "${e.titulo}"?`)) return;
                      void removerEvento(uid!, e.id)
                        .then(() => mostrarToast("Evento excluído"))
                        .catch(() => mostrarToast("Não foi possível excluir."));
                    }}
                    aria-label="Excluir evento"
                  >
                    ×
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
          + Novo evento neste dia
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
            <input
              inputMode="decimal"
              placeholder="0,00"
              value={valorTexto}
              onChange={(e) => setValorTexto(e.target.value)}
            />
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

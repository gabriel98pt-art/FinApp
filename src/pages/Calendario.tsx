import { useState, type FormEvent } from "react";
import { CalendarDays, Plus, X } from "lucide-react";
import Pagina, { EstadoVazio, Kpis } from "../components/Pagina";
import KpiCard from "../components/KpiCard";
import ErroSincronizacao from "../components/ErroSincronizacao";
import BottomSheet from "../components/BottomSheet";
import CampoValorDestaque from "../components/CampoValorDestaque";
import { criarEvento, removerEvento } from "../services/eventosService";
import { useConfirmar } from "../hooks/useConfirmar";
import { useUidSessao } from "../hooks/useUidSessao";
import { useCfgStore } from "../stores/cfgStore";
import { useEventosStore } from "../stores/eventosStore";
import {
  useDespesasFixasStore,
  useDespesasStore,
  useReceitasStore,
  useTransferenciasStore,
} from "../stores/lancamentosStore";
import { useMesVisivelStore } from "../stores/mesVisivelStore";
import { useParcelasStore } from "../stores/parcelasStore";
import { useVeiculoStore } from "../stores/veiculoStore";
import { mostrarToast } from "../stores/toastStore";
import { calcularFatura, montarDadosFatura } from "../utils/fatura";
import {
  naJanela,
  porDia,
  totalAVencer,
  vencimentosDeFaturas,
  vencimentosDeFixas,
  vencimentosDeParcelas,
  type TipoVencimento,
  type Vencimento,
} from "../utils/vencimentos";
import {
  diasComEventoNoMes,
  diasDoGrid,
  eventosComValor,
  eventosDoDia,
  eventosDoMes,
  proximosEventos,
  rotulosDiasSemana,
  totalEventos,
} from "../utils/calendario";
import { hojeIso, mesAtual, rotuloMes, somarDias, somarMeses } from "../utils/calculos";
import { formatMoney } from "../utils/money";
import { nomeAtualDoMetodo } from "../utils/instituicoes";
import type { Cents, YearMonth } from "../types";
import styles from "./Calendario.module.css";
import Botao from "../components/Botao";

export default function Calendario() {
  const uid = useUidSessao();
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
  const receitas = useReceitasStore((s) => s.itens);

  const mes = useMesVisivelStore((s) => s.mes);
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);
  const [novoAberto, setNovoAberto] = useState(false);
  // Um só campo de texto livre (01/09/2026): a folha tinha "Título" e "Nota
  // (opcional)", dois campos para a mesma coisa — e ninguém sabia em qual
  // escrever "Dentista às 15h". Segue o Registro Rápido, Cartões e Despesas,
  // que já unificaram Nome + Nota num "Descrição" único (item 4 do lote de
  // UX/nav, 30/08). O que se escreve aqui é o título do evento.
  const [titulo, setTitulo] = useState("");
  const [dataNovo, setDataNovo] = useState(hojeIso());
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
  const dadosFatura = montarDadosFatura({
    despesas,
    despesasFixas,
    transferencias,
    parcelas,
    veiculo,
    receitas,
  });
  // `mesAtual()`/`hoje` dão a mesma precisão de dia que Transações e o
  // Orçamento já usam — sem eles, um compromisso já pago continuava a
  // aparecer no Calendário como se estivesse por fazer.
  const mesReal = mesAtual();
  function vencimentosDoMes(ym: YearMonth): Vencimento[] {
    const restantePorCartao = cfg.contasCartoes
      .filter((c) => cfg.tipoCartao[c] === "credit")
      .map((c) => ({
        cartao: c,
        nome: nomeAtualDoMetodo(cfg, c),
        restante: calcularFatura(c, ym, dadosFatura, cfg).restante,
      }));
    return [
      ...vencimentosDeFixas([...despesasFixas, ...veiculo.despesasFixas], ym, mesReal, hoje),
      ...vencimentosDeParcelas(parcelas, ym, cfg.diaVencimentoFatura, mesReal, hoje),
      ...vencimentosDeFaturas(restantePorCartao, ym, cfg.diaVencimentoFatura),
    ];
  }
  const vencimentos = vencimentosDoMes(mes);
  const vencimentosPorDia = porDia(vencimentos);
  const vencimentosDoDiaSel = diaSelecionado ? (vencimentosPorDia.get(diaSelecionado) ?? []) : [];

  // Os dois KPIs somam DINHEIRO a vencer, não contam eventos. Antes contavam só
  // os eventos manuais e por isso diziam "0" num mês cheio de fixas, parcelas e
  // faturas — que a própria grelha aqui em baixo já marcava com pontos. Mesma
  // fonte dos marcadores (`vencimentosDoMes`), mais os eventos manuais que
  // tenham valor, que também são dinheiro a sair.
  const eventosComValorNoMes = eventosComValor(doMesAtual);
  const aPagarNoMes = totalAVencer(vencimentos) + totalEventos(eventosComValorNoMes);
  const qtdNoMes = vencimentos.length + eventosComValorNoMes.length;

  // A janela de 7 dias parte de HOJE e não do mês que está a ser visto: pode
  // atravessar a virada do mês, por isso junta os vencimentos do mês real e do
  // seguinte (reaproveitando os já calculados quando calham ser os mesmos).
  const proximoMesReal = somarMeses(mesReal, 1);
  const limite7 = somarDias(hoje, 7);
  const vencimentos7 = naJanela(
    [
      ...(mes === mesReal ? vencimentos : vencimentosDoMes(mesReal)),
      ...(mes === proximoMesReal ? vencimentos : vencimentosDoMes(proximoMesReal)),
    ],
    hoje,
    limite7,
  );
  const eventosComValor7 = eventosComValor(proximos7);
  const aPagar7 = totalAVencer(vencimentos7) + totalEventos(eventosComValor7);
  const qtd7 = vencimentos7.length + eventosComValor7.length;

  // A secção "Próximos 7 dias" listava SÓ os eventos manuais, enquanto o KPI
  // logo acima (e os pontos da grelha) já contavam também fixas, parcelas e
  // faturas: a mesma tela dizia "6 compromissos até 01/09" e, dois dedos
  // abaixo, "Nada agendado nos próximos 7 dias". Aqui a lista passa a usar
  // exatamente as mesmas duas fontes do KPI, ordenadas por dia.
  const itens7: {
    chave: string;
    data: string;
    titulo: string;
    detalhe?: string;
    valor?: Cents;
    tipo?: TipoVencimento;
  }[] = [
    ...vencimentos7.map((v, i) => ({
      chave: `v-${v.tipo}-${v.dia}-${i}`,
      data: v.dia,
      titulo: v.titulo,
      detalhe: v.detalhe,
      valor: v.valor,
      tipo: v.tipo,
    })),
    ...proximos7.map((e) => ({
      chave: `e-${e.id}`,
      data: e.data,
      titulo: e.titulo,
      detalhe: e.descricao,
      valor: e.valor,
    })),
  ].sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));

  /** Cada abertura recomeça em branco, no dia pedido (o da grelha) ou em hoje.
   *  Sem isto os campos só eram limpos depois de um `criarEvento` bem sucedido:
   *  escrever "Dentista", fechar a folha sem gravar e tocar outra vez em
   *  "+ Evento" reabria com "Dentista" já escrito — e a data ficava presa no
   *  último dia aberto pela grelha, portanto o "+ Evento" do topo propunha 5 de
   *  agosto muito depois de se ter saído desse dia. */
  function abrirNovoEvento(data: string = hoje) {
    setTitulo("");
    setValorTexto(null);
    setDataNovo(data);
    setNovoAberto(true);
  }

  async function salvarEvento(e: FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) return mostrarToast("Descrição obrigatória.");
    // Campo opcional: vazio grava sem valor, como sempre.
    const valor = valorTexto ?? undefined;
    try {
      await criarEvento(uid, { titulo, data: dataNovo, valor });
      mostrarToast("✓ Evento adicionado");
      setNovoAberto(false);
      setTitulo("");
      setValorTexto(null);
    } catch {
      mostrarToast("Não foi possível salvar.");
    }
  }

  return (
    <Pagina titulo="Calendário">
      <Kpis>
        <KpiCard
          rotulo={`A pagar em ${rotuloMes(mes)}`}
          valor={formatMoney(aPagarNoMes, moeda)}
          sub={
            qtdNoMes === 0
              ? "nada por vencer neste mês"
              : `${qtdNoMes} compromisso${qtdNoMes > 1 ? "s" : ""} em aberto`
          }
          // Era "laranja" (cor exclusiva do TVDE, sem relação com o
          // Calendário) — "amarelo" alinha com "Vence em 7 dias" logo ao
          // lado: mesmo tipo de aviso (dinheiro por pagar), só que numa
          // janela mais larga (achado da auditoria de Design).
          tom="amarelo"
        />
        <KpiCard
          rotulo="Vence em 7 dias"
          valor={formatMoney(aPagar7, moeda)}
          sub={
            qtd7 === 0
              ? "nada vence até lá"
              : `${qtd7} compromisso${qtd7 > 1 ? "s" : ""} até ${limite7.slice(8, 10)}/${limite7.slice(5, 7)}`
          }
          tom="amarelo"
        />
      </Kpis>

      <div className={styles.linhaMes}>
        <Botao variante="primaria" onClick={() => abrirNovoEvento()}>
          <Plus size={15} aria-hidden /> Evento
        </Botao>
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
        {itens7.length === 0 ? (
          <p className={styles.vazio}>Nada agendado nos próximos 7 dias.</p>
        ) : (
          <div className={styles.lista}>
            {itens7.map((it) => (
              <div key={it.chave} className={styles.item}>
                <div>
                  <p className={styles.itemNome}>
                    {it.tipo && (
                      <>
                        <span
                          className={`${styles.ponto} ${styles[`ponto_${it.tipo}`]}`}
                          aria-hidden
                        />{" "}
                      </>
                    )}
                    {it.titulo}
                  </p>
                  <p className={styles.itemDetalhe}>
                    {it.data.slice(8, 10)}/{it.data.slice(5, 7)}
                    {it.detalhe ? ` · ${it.detalhe}` : ""}
                  </p>
                </div>
                {it.valor !== undefined && (
                  <span className={styles.itemValor}>{formatMoney(it.valor, moeda)}</span>
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
                        await removerEvento(uid, e.id)
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
            setDiaSelecionado(null);
            abrirNovoEvento(diaSelecionado ?? hoje);
          }}
        >
          <Plus size={15} aria-hidden /> Novo evento neste dia
        </button>
      </BottomSheet>

      <BottomSheet aberta={novoAberto} aoFechar={() => setNovoAberto(false)} titulo="Novo evento">
        <form className={styles.form} onSubmit={salvarEvento}>
          {/* Valor em destaque e em primeiro, como no Registro Rápido e nas
              outras folhas do app (CampoValorDestaque). Aqui é opcional — um
              evento pode ser só um lembrete —, e o rótulo diz isso. */}
          <CampoValorDestaque
            rotulo="Quanto? (opcional)"
            valor={valorTexto}
            aoMudar={setValorTexto}
          />
          <label className={styles.campo}>
            Descrição
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
              maxLength={120}
            />
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
          <Botao type="submit" variante="submeter">
            Adicionar evento
          </Botao>
        </form>
      </BottomSheet>
    </Pagina>
  );
}

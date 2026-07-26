import { useState, type FormEvent } from "react";
import { Car } from "lucide-react";
import Pagina, { EstadoVazio, Kpis } from "../components/Pagina";
import ErroSincronizacao from "../components/ErroSincronizacao";
import BottomSheet from "../components/BottomSheet";
import KpiCard from "../components/KpiCard";
import SeletorCategoria from "../components/SeletorCategoria";
import SeletorData from "../components/SeletorData";
import SeletorSemana from "../components/SeletorSemana";
import {
  alternarPagoFixaVeiculo,
  atualizarCarga,
  atualizarDespesaVeiculo,
  atualizarFixaVeiculo,
  atualizarKm,
  criarCarga,
  criarDespesaVeiculo,
  criarFixaVeiculo,
  criarKm,
  removerCarga,
  removerDespesaVeiculo,
  removerFixaVeiculo,
  removerKm,
} from "../services/veiculoService";
import { adicionarItemLista } from "../services/cfgService";
import { useAuthStore } from "../stores/authStore";
import { useCfgStore } from "../stores/cfgStore";
import { useMesVisivelStore } from "../stores/mesVisivelStore";
import { mostrarToast } from "../stores/toastStore";
import { useVeiculoStore } from "../stores/veiculoStore";
import { hojeIso, mesAtual, mesDe, rotuloMes } from "../utils/calculos";
import { formatMoney, parseMoney } from "../utils/money";
import { fixaAtivaNoMes } from "../utils/fatura";
import { indiceDaSemana, naSemana, rotuloDaSemana, semanasDoMes } from "../utils/semanas";
import { totalCargasMes, totalDespesasVeiculoMes, totalVeiculoMes } from "../utils/veiculo";
import type { CargaEletrica, DespesaFixa, DespesaVeiculo, Id, RegistroKm } from "../types";
import styles from "./Veiculo.module.css";

type Aba = "resumo" | "cargas" | "despesas" | "fixas" | "km";

function agir(acao: () => Promise<unknown>, ok: string) {
  return acao()
    .then(() => mostrarToast(ok))
    .catch(() => mostrarToast("Não foi possível concluir. Tente de novo."));
}

/** Centavos → texto editável ("1234" → "12,34"). */
function paraTexto(centavos: number): string {
  return (centavos / 100).toFixed(2).replace(".", ",");
}

export default function Veiculo() {
  const uid = useAuthStore((s) => s.sessao?.uid);
  const cfg = useCfgStore((s) => s.cfg);
  const dados = useVeiculoStore((s) => s.dados);
  const carregado = useVeiculoStore((s) => s.carregado);
  const erro = useVeiculoStore((s) => s.erro);

  const [aba, setAba] = useState<Aba>("resumo");
  const mes = useMesVisivelStore((s) => s.mes);
  const real = mesAtual();

  const gastoDoMes = totalVeiculoMes(dados, mes, real);
  const cargasDoMes = totalCargasMes(dados, mes);
  const despesasDoMes = totalDespesasVeiculoMes(dados, mes);
  const kmDoMes = dados.quilometragem
    .filter((k) => mesDe(k.data) === mes)
    .reduce((s, k) => s + k.km, 0);

  // Visão Mês / Semana da aba Carregamentos (item 10).
  const [visaoCargas, setVisaoCargas] = useState<"mes" | "semana">("mes");
  const [semanaIdx, setSemanaIdx] = useState(0);
  const semanas = semanasDoMes(mes);
  const [mesDaSemana, setMesDaSemana] = useState(mes);
  if (mesDaSemana !== mes) {
    setMesDaSemana(mes);
    setSemanaIdx(indiceDaSemana(semanas, hojeIso()));
  }
  const semanaAtual = semanas[Math.min(semanaIdx, semanas.length - 1)];
  const cargasVisiveis =
    visaoCargas === "semana" && semanaAtual
      ? naSemana(dados.cargas, semanaAtual)
      : dados.cargas.filter((c) => mesDe(c.data) === mes);

  // Todas as abas mostram só o mês do seletor no topo — inclusive Km: o
  // registo de km é incremental (o KPI "Km no mês" SOMA os do mês), não uma
  // leitura de odômetro acumulada, então é uma entrada do mês como qualquer
  // outra. Ver o histórico completo = trocar de mês no topo.
  const cargasDoMesLista = dados.cargas.filter((c) => mesDe(c.data) === mes);
  const despesasVisiveis = dados.despesas.filter((d) => mesDe(d.data) === mes);
  const kmVisiveis = dados.quilometragem.filter((k) => mesDe(k.data) === mes);
  const fixasVisiveis = dados.despesasFixas.filter((f) => fixaAtivaNoMes(f, mes));

  // ---- caixa de quilometragem (criar/editar — itens 2, 5, 7) ----
  const [kmAberta, setKmAberta] = useState(false);
  const [kmEditandoId, setKmEditandoId] = useState<Id | null>(null);
  const [kmValor, setKmValor] = useState("");
  const [kmData, setKmData] = useState(hojeIso());
  const [kmNota, setKmNota] = useState("");

  function abrirNovoKm() {
    setKmEditandoId(null);
    setKmValor("");
    setKmData(hojeIso());
    setKmNota("");
    setKmAberta(true);
  }

  function abrirEdicaoKm(k: RegistroKm) {
    setKmEditandoId(k.id);
    setKmValor(String(k.km).replace(".", ","));
    setKmData(k.data);
    setKmNota(k.nota ?? "");
    setKmAberta(true);
  }

  async function salvarKm(e: FormEvent) {
    e.preventDefault();
    const km = parseFloat(kmValor.replace(",", "."));
    if (!Number.isFinite(km) || km <= 0) return mostrarToast("Km inválido.");
    const dados_ = { km, data: kmData || hojeIso(), nota: kmNota.trim() || undefined };
    if (kmEditandoId) {
      await agir(() => atualizarKm(uid!, { ...dados_, id: kmEditandoId }), "✓ Registo atualizado");
    } else {
      await agir(() => criarKm(uid!, dados_), "✓ Quilometragem registada");
    }
    setKmAberta(false);
  }

  async function excluirKm() {
    if (!kmEditandoId) return;
    if (!window.confirm("Excluir este registo de km?")) return;
    const id = kmEditandoId;
    setKmAberta(false);
    await agir(() => removerKm(uid!, id), "Registo excluído");
  }

  // ---- caixa de carga elétrica (criar/editar) ----
  const [cgAberta, setCgAberta] = useState(false);
  const [cgEditandoId, setCgEditandoId] = useState<Id | null>(null);
  const [modoCusto, setModoCusto] = useState<"total" | "kwh">("total");
  const [cgKwh, setCgKwh] = useState("");
  const [cgCustoTotal, setCgCustoTotal] = useState("");
  const [cgPrecoKwh, setCgPrecoKwh] = useState("");
  const [cgLocal, setCgLocal] = useState("");
  const [cgSessao, setCgSessao] = useState("");
  const [cgNota, setCgNota] = useState("");
  const [cgData, setCgData] = useState(hojeIso());

  function abrirNovaCarga() {
    setCgEditandoId(null);
    setModoCusto("total");
    setCgKwh("");
    setCgCustoTotal("");
    setCgPrecoKwh("");
    setCgLocal("");
    setCgSessao("");
    setCgNota("");
    setCgData(hojeIso());
    setCgAberta(true);
  }

  function abrirEdicaoCarga(c: CargaEletrica) {
    setCgEditandoId(c.id);
    setModoCusto("total");
    setCgKwh(String(c.kwh).replace(".", ","));
    setCgCustoTotal(paraTexto(c.custo));
    setCgPrecoKwh(paraTexto(c.precoKwh));
    setCgLocal(c.local);
    setCgSessao(c.sessao ?? "");
    setCgNota(c.nota ?? "");
    setCgData(c.data);
    setCgAberta(true);
  }

  async function salvarCarga(e: FormEvent) {
    e.preventDefault();
    const kwh = parseFloat(cgKwh.replace(",", "."));
    if (!Number.isFinite(kwh) || kwh <= 0) return mostrarToast("kWh inválido.");
    let custo: number;
    let precoKwh: number;
    if (modoCusto === "total") {
      const c = parseMoney(cgCustoTotal);
      if (c === null || c <= 0) return mostrarToast("Custo total inválido.");
      custo = c;
      precoKwh = Math.round(c / kwh);
    } else {
      const p = parseMoney(cgPrecoKwh);
      if (p === null || p <= 0) return mostrarToast("Preço/kWh inválido.");
      precoKwh = p;
      custo = Math.round(kwh * p);
    }
    const local = cgLocal.trim();
    if (!local) return mostrarToast("Informe o local.");
    const dados_ = {
      data: cgData,
      kwh,
      precoKwh,
      custo,
      local,
      sessao: cgSessao.trim() || undefined,
      nota: cgNota.trim() || undefined,
    };
    try {
      if (cgEditandoId) {
        await atualizarCarga(uid!, { ...dados_, id: cgEditandoId });
        mostrarToast("✓ Carregamento atualizado");
      } else {
        await criarCarga(uid!, dados_);
        mostrarToast("✓ Carregamento registado");
      }
      if (!cfg.locaisCarregamento.includes(local)) {
        await adicionarItemLista(uid!, cfg, "locaisCarregamento", local).catch(() => null);
      }
      setCgAberta(false);
    } catch {
      mostrarToast("Não foi possível salvar.");
    }
  }

  async function excluirCarga() {
    if (!cgEditandoId) return;
    if (!window.confirm("Excluir este carregamento?")) return;
    const id = cgEditandoId;
    setCgAberta(false);
    await agir(() => removerCarga(uid!, id), "Carregamento excluído");
  }

  // ---- caixa de despesa variável do veículo (criar/editar) ----
  const [dvAberta, setDvAberta] = useState(false);
  const [dvEditandoId, setDvEditandoId] = useState<Id | null>(null);
  const [dvValor, setDvValor] = useState("");
  const [dvCategoria, setDvCategoria] = useState("");
  const [dvData, setDvData] = useState(hojeIso());
  const [dvNota, setDvNota] = useState("");

  function abrirNovaDespesa() {
    setDvEditandoId(null);
    setDvValor("");
    setDvCategoria(cfg.categoriasVeiculo[0] ?? "");
    setDvData(hojeIso());
    setDvNota("");
    setDvAberta(true);
  }

  function abrirEdicaoDespesa(d: DespesaVeiculo) {
    setDvEditandoId(d.id);
    setDvValor(paraTexto(d.valor));
    setDvCategoria(d.categoria);
    setDvData(d.data);
    setDvNota(d.nota ?? "");
    setDvAberta(true);
  }

  async function salvarDespesa(e: FormEvent) {
    e.preventDefault();
    const valor = parseMoney(dvValor);
    if (valor === null || valor <= 0) return mostrarToast("Valor inválido.");
    const dados_ = {
      data: dvData,
      valor,
      categoria: dvCategoria || cfg.categoriasVeiculo[0] || "Outros",
      nota: dvNota.trim() || undefined,
    };
    if (dvEditandoId) {
      await agir(
        () => atualizarDespesaVeiculo(uid!, { ...dados_, id: dvEditandoId }),
        "✓ Despesa atualizada",
      );
    } else {
      await agir(() => criarDespesaVeiculo(uid!, dados_), "✓ Despesa do veículo adicionada");
    }
    setDvAberta(false);
  }

  async function excluirDespesa() {
    if (!dvEditandoId) return;
    if (!window.confirm("Excluir esta despesa do veículo?")) return;
    const id = dvEditandoId;
    setDvAberta(false);
    await agir(() => removerDespesaVeiculo(uid!, id), "Despesa excluída");
  }

  // ---- caixa de despesa fixa do veículo (criar/editar) ----
  const [dfAberta, setDfAberta] = useState(false);
  const [dfEditandoId, setDfEditandoId] = useState<Id | null>(null);
  const [dfDescricao, setDfDescricao] = useState("");
  const [dfNota, setDfNota] = useState("");
  const [dfValor, setDfValor] = useState("");
  const [dfCategoria, setDfCategoria] = useState("");
  const [dfDia, setDfDia] = useState("");

  function abrirNovaFixa() {
    setDfEditandoId(null);
    setDfDescricao("");
    setDfNota("");
    setDfValor("");
    setDfCategoria(cfg.categoriasVeiculo[0] ?? "");
    setDfDia("");
    setDfAberta(true);
  }

  function abrirEdicaoFixa(f: DespesaFixa) {
    setDfEditandoId(f.id);
    setDfDescricao(f.descricao);
    setDfNota(f.nota ?? "");
    setDfValor(paraTexto(f.valor));
    setDfCategoria(f.categoria);
    setDfDia(f.diaVencimento ? String(f.diaVencimento) : "");
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
    const base = {
      descricao: dfDescricao,
      nota: dfNota.trim() || undefined,
      valor,
      categoria: dfCategoria || cfg.categoriasVeiculo[0] || "Outros",
      diaVencimento: dia,
    };
    if (dfEditandoId) {
      const atual = dados.despesasFixas.find((f) => f.id === dfEditandoId);
      if (!atual) return;
      await agir(
        () => atualizarFixaVeiculo(uid!, { ...atual, ...base }),
        "✓ Despesa fixa atualizada",
      );
    } else {
      await agir(
        () => criarFixaVeiculo(uid!, { ...base, pagoPorMes: {} }),
        "✓ Despesa fixa criada",
      );
    }
    setDfAberta(false);
  }

  async function excluirFixa() {
    const atual = dados.despesasFixas.find((f) => f.id === dfEditandoId);
    if (!atual) return;
    if (!window.confirm(`Excluir "${atual.descricao}"?`)) return;
    setDfAberta(false);
    await agir(() => removerFixaVeiculo(uid!, atual.id), "Despesa fixa excluída");
  }

  return (
    <Pagina titulo="Veículo">
      <Kpis pagina="veiculo">
        <KpiCard
          rotulo="Gasto do mês"
          valor={formatMoney(gastoDoMes, cfg.currency)}
          tom="vermelho"
        />
        <KpiCard rotulo="Carregamentos" valor={formatMoney(cargasDoMes, cfg.currency)} />
        <KpiCard rotulo="Despesas" valor={formatMoney(despesasDoMes, cfg.currency)} />
        <KpiCard rotulo="Km no mês" valor={kmDoMes ? kmDoMes.toLocaleString("pt-PT") : "0"} />
      </Kpis>

      <div className={styles.abas} role="tablist">
        {(
          [
            ["resumo", "Resumo"],
            ["cargas", "Carregamentos"],
            ["despesas", "Despesas"],
            ["fixas", "Fixas"],
            ["km", "Km"],
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

      {/* As 5 abas vêm da mesma store, então o aviso é um só, acima delas. Fica
          na versão compacta mesmo sem dados: os botões de adicionar continuam
          a fazer sentido, e o estado vazio de cada aba deixa de enganar com a
          tira logo acima a dizer que a sincronização caiu. */}
      {erro && <ErroSincronizacao compacto />}

      {aba === "resumo" && (
        <div className={styles.lista}>
          {cargasDoMesLista.length === 0 && despesasVisiveis.length === 0 && carregado ? (
            <EstadoVazio
              Icone={Car}
              mensagem={
                dados.cargas.length === 0 && dados.despesas.length === 0
                  ? "Nenhum registo do veículo ainda"
                  : `Nenhum registo do veículo em ${rotuloMes(mes)}`
              }
              sub="Use as abas acima para registar km, carregamentos e despesas."
            />
          ) : (
            <>
              {[...cargasDoMesLista]
                .sort((a, b) => (a.data < b.data ? 1 : -1))
                .map((c) => (
                  <div key={c.id} className={styles.item}>
                    <button className={styles.itemCorpo} onClick={() => abrirEdicaoCarga(c)}>
                      <span className={styles.itemTexto}>
                        <span className={styles.itemNome}>Carga · {c.local}</span>
                        <span className={styles.itemDetalhe}>
                          {c.kwh} kWh · {c.data.slice(8, 10)}/{c.data.slice(5, 7)}
                        </span>
                      </span>
                      <span className={styles.itemValor}>{formatMoney(c.custo, cfg.currency)}</span>
                    </button>
                  </div>
                ))}
              {[...despesasVisiveis]
                .sort((a, b) => (a.data < b.data ? 1 : -1))
                .map((d) => (
                  <div key={d.id} className={styles.item}>
                    <button className={styles.itemCorpo} onClick={() => abrirEdicaoDespesa(d)}>
                      <span className={styles.itemTexto}>
                        <span className={styles.itemNome}>{d.categoria}</span>
                        <span className={styles.itemDetalhe}>
                          {d.nota ? `${d.nota} · ` : ""}
                          {d.data.slice(8, 10)}/{d.data.slice(5, 7)}
                        </span>
                      </span>
                      <span className={styles.itemValor}>{formatMoney(d.valor, cfg.currency)}</span>
                    </button>
                  </div>
                ))}
            </>
          )}
        </div>
      )}

      {aba === "cargas" && (
        <>
          <div className={styles.cabecalhoLista}>
            <p className={styles.tituloSecao}>Carregamentos</p>
            <button className={styles.botaoAdicionar} onClick={abrirNovaCarga}>
              + Adicionar carregamento
            </button>
          </div>

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
                  aria-checked={visaoCargas === id}
                  className={`${styles.visaoBotao} ${visaoCargas === id ? styles.visaoAtiva : ""}`}
                  onClick={() => setVisaoCargas(id)}
                >
                  {nome}
                </button>
              ))}
            </div>
            {visaoCargas === "semana" && (
              <SeletorSemana semanas={semanas} indice={semanaIdx} aoMudar={setSemanaIdx} />
            )}
          </div>

          <div className={styles.lista}>
            {cargasVisiveis.length === 0 ? (
              <p className={styles.vazio}>
                {visaoCargas === "semana" && semanaAtual
                  ? `Nenhum carregamento em ${rotuloDaSemana(semanaAtual)}.`
                  : `Nenhum carregamento em ${rotuloMes(mes)}.`}
              </p>
            ) : (
              [...cargasVisiveis]
                .sort((a, b) => (a.data < b.data ? 1 : -1))
                .map((c) => (
                  <div key={c.id} className={styles.item}>
                    <button className={styles.itemCorpo} onClick={() => abrirEdicaoCarga(c)}>
                      <span className={styles.itemTexto}>
                        <span className={styles.itemNome}>{c.local}</span>
                        <span className={styles.itemDetalhe}>
                          {c.kwh} kWh · {formatMoney(c.precoKwh, cfg.currency)}/kWh ·{" "}
                          {c.data.slice(8, 10)}/{c.data.slice(5, 7)}
                          {c.sessao ? ` · ${c.sessao}` : ""}
                        </span>
                      </span>
                      <span className={styles.itemValor}>{formatMoney(c.custo, cfg.currency)}</span>
                    </button>
                  </div>
                ))
            )}
          </div>
        </>
      )}

      {aba === "despesas" && (
        <>
          <div className={styles.cabecalhoLista}>
            <p className={styles.tituloSecao}>Despesas do veículo</p>
            <button className={styles.botaoAdicionar} onClick={abrirNovaDespesa}>
              + Adicionar despesa
            </button>
          </div>

          <div className={styles.lista}>
            {despesasVisiveis.length === 0 ? (
              <p className={styles.vazio}>Nenhuma despesa do veículo em {rotuloMes(mes)}.</p>
            ) : (
              [...despesasVisiveis]
                .sort((a, b) => (a.data < b.data ? 1 : -1))
                .map((d) => (
                  <div key={d.id} className={styles.item}>
                    <button className={styles.itemCorpo} onClick={() => abrirEdicaoDespesa(d)}>
                      <span className={styles.itemTexto}>
                        <span className={styles.itemNome}>{d.categoria}</span>
                        <span className={styles.itemDetalhe}>
                          {d.nota ? `${d.nota} · ` : ""}
                          {d.data.slice(8, 10)}/{d.data.slice(5, 7)}
                        </span>
                      </span>
                      <span className={styles.itemValor}>{formatMoney(d.valor, cfg.currency)}</span>
                    </button>
                  </div>
                ))
            )}
          </div>
        </>
      )}

      {aba === "fixas" && (
        <>
          <div className={styles.cabecalhoLista}>
            <p className={styles.tituloSecao}>Despesas fixas do veículo</p>
            <button className={styles.botaoAdicionar} onClick={abrirNovaFixa}>
              + Adicionar despesa fixa
            </button>
          </div>

          <div className={styles.lista}>
            {fixasVisiveis.length === 0 ? (
              <p className={styles.vazio}>Nenhuma despesa fixa do veículo em {rotuloMes(mes)}.</p>
            ) : (
              fixasVisiveis.map((f) => {
                const paga = !!f.pagoPorMes[mes];
                return (
                  <div key={f.id} className={styles.item}>
                    <button className={styles.itemCorpo} onClick={() => abrirEdicaoFixa(f)}>
                      <span className={styles.itemTexto}>
                        <span className={styles.itemNome}>{f.descricao}</span>
                        <span className={styles.itemDetalhe}>
                          {f.categoria}
                          {f.diaVencimento ? ` · dia ${f.diaVencimento}` : ""}
                        </span>
                      </span>
                      <span className={styles.itemValor}>{formatMoney(f.valor, cfg.currency)}</span>
                    </button>
                    <button
                      className={`${styles.badgeToggle} ${paga ? styles.badgePago : styles.badgePendente}`}
                      onClick={() =>
                        void agir(
                          () => alternarPagoFixaVeiculo(uid!, f.id, mes, !paga),
                          paga ? "Marcado como pendente" : "✓ Pago em " + rotuloMes(mes),
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

      {aba === "km" && (
        <>
          <div className={styles.cabecalhoLista}>
            <p className={styles.tituloSecao}>Quilometragem</p>
            <button className={styles.botaoAdicionar} onClick={abrirNovoKm}>
              + Adicionar quilometragem
            </button>
          </div>

          <div className={styles.lista}>
            {kmVisiveis.length === 0 ? (
              <p className={styles.vazio}>Nenhum registo de km em {rotuloMes(mes)}.</p>
            ) : (
              [...kmVisiveis]
                .sort((a, b) => (a.data < b.data ? 1 : -1))
                .map((k) => (
                  <div key={k.id} className={styles.item}>
                    <button className={styles.itemCorpo} onClick={() => abrirEdicaoKm(k)}>
                      <span className={styles.itemTexto}>
                        <span className={styles.itemNome}>{k.km.toLocaleString("pt-PT")} km</span>
                        <span className={styles.itemDetalhe}>
                          {k.nota ? `${k.nota} · ` : ""}
                          {k.data.slice(8, 10)}/{k.data.slice(5, 7)}
                        </span>
                      </span>
                    </button>
                  </div>
                ))
            )}
          </div>
        </>
      )}

      {/* Caixa de carregamento: cria e edita (itens 2, 5, 7, 16, 17) */}
      <BottomSheet
        aberta={cgAberta}
        aoFechar={() => setCgAberta(false)}
        titulo={cgEditandoId ? "Editar carregamento" : "Novo carregamento"}
      >
        <form className={styles.formFolha} onSubmit={salvarCarga}>
          <label className={styles.campo}>
            kWh
            <input
              inputMode="decimal"
              value={cgKwh}
              onChange={(e) => setCgKwh(e.target.value)}
              required
            />
          </label>
          <SeletorData valor={cgData} aoMudar={setCgData} />
          <div className={styles.seletorTipo} role="radiogroup">
            <button
              type="button"
              className={`${styles.tipoBotao} ${modoCusto === "total" ? styles.tipoAtivo : ""}`}
              onClick={() => setModoCusto("total")}
            >
              Custo total
            </button>
            <button
              type="button"
              className={`${styles.tipoBotao} ${modoCusto === "kwh" ? styles.tipoAtivo : ""}`}
              onClick={() => setModoCusto("kwh")}
            >
              €/kWh
            </button>
          </div>
          {modoCusto === "total" ? (
            <label className={styles.campo}>
              Custo total
              <input
                inputMode="decimal"
                placeholder="0,00"
                value={cgCustoTotal}
                onChange={(e) => setCgCustoTotal(e.target.value)}
                required
              />
            </label>
          ) : (
            <label className={styles.campo}>
              Preço por kWh
              <input
                inputMode="decimal"
                placeholder="0,00"
                value={cgPrecoKwh}
                onChange={(e) => setCgPrecoKwh(e.target.value)}
                required
              />
            </label>
          )}
          <div className={styles.linhaDupla}>
            <label className={styles.campo}>
              Local
              <input
                list="locais-carregamento"
                value={cgLocal}
                onChange={(e) => setCgLocal(e.target.value)}
                required
              />
              <datalist id="locais-carregamento">
                {cfg.locaisCarregamento.map((l) => (
                  <option key={l} value={l} />
                ))}
              </datalist>
            </label>
            <label className={styles.campo}>
              Sessão (opcional)
              <input value={cgSessao} onChange={(e) => setCgSessao(e.target.value)} />
            </label>
          </div>
          <label className={styles.campo}>
            Descrição (opcional)
            <input value={cgNota} onChange={(e) => setCgNota(e.target.value)} />
          </label>
          <button type="submit" className={styles.salvar}>
            {cgEditandoId ? "Salvar alterações" : "Registar carregamento"}
          </button>
          {cgEditandoId && (
            <button type="button" className={styles.excluir} onClick={() => void excluirCarga()}>
              Excluir carregamento
            </button>
          )}
        </form>
      </BottomSheet>

      {/* Caixa de despesa do veículo: cria e edita */}
      <BottomSheet
        aberta={dvAberta}
        aoFechar={() => setDvAberta(false)}
        titulo={dvEditandoId ? "Editar despesa" : "Nova despesa"}
      >
        <form className={styles.formFolha} onSubmit={salvarDespesa}>
          <label className={styles.campo}>
            Valor
            <input
              inputMode="decimal"
              placeholder="0,00"
              value={dvValor}
              onChange={(e) => setDvValor(e.target.value)}
              required
            />
          </label>
          <SeletorData valor={dvData} aoMudar={setDvData} />
          <SeletorCategoria
            valor={dvCategoria}
            opcoes={cfg.categoriasVeiculo}
            aoMudar={setDvCategoria}
          />
          <label className={styles.campo}>
            Descrição (opcional)
            <input value={dvNota} onChange={(e) => setDvNota(e.target.value)} />
          </label>
          <button type="submit" className={styles.salvar}>
            {dvEditandoId ? "Salvar alterações" : "Adicionar despesa"}
          </button>
          {dvEditandoId && (
            <button type="button" className={styles.excluir} onClick={() => void excluirDespesa()}>
              Excluir despesa
            </button>
          )}
        </form>
      </BottomSheet>

      {/* Caixa de despesa fixa do veículo: cria e edita */}
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
            opcoes={cfg.categoriasVeiculo}
            aoMudar={setDfCategoria}
          />
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

      {/* Caixa de quilometragem: cria e edita */}
      <BottomSheet
        aberta={kmAberta}
        aoFechar={() => setKmAberta(false)}
        titulo={kmEditandoId ? "Editar quilometragem" : "Registar quilometragem"}
      >
        <form className={styles.formFolha} onSubmit={salvarKm}>
          <label className={styles.campo}>
            Km
            <input
              inputMode="decimal"
              value={kmValor}
              onChange={(e) => setKmValor(e.target.value)}
              required
            />
          </label>
          <SeletorData valor={kmData} aoMudar={setKmData} />
          <label className={styles.campo}>
            Descrição (opcional)
            <input value={kmNota} onChange={(e) => setKmNota(e.target.value)} />
          </label>
          <button type="submit" className={styles.salvar}>
            {kmEditandoId ? "Salvar alterações" : "Registar"}
          </button>
          {kmEditandoId && (
            <button type="button" className={styles.excluir} onClick={() => void excluirKm()}>
              Excluir registo
            </button>
          )}
        </form>
      </BottomSheet>
    </Pagina>
  );
}

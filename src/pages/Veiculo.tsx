import { useState, type FormEvent } from "react";
import { Car } from "lucide-react";
import Pagina, { EstadoVazio, Kpis } from "../components/Pagina";
import KpiCard from "../components/KpiCard";
import SeletorMes from "../components/SeletorMes";
import {
  alternarPagoFixaVeiculo,
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
import { mostrarToast } from "../stores/toastStore";
import { useVeiculoStore } from "../stores/veiculoStore";
import { mesAtual, mesDe, rotuloMes } from "../utils/calculos";
import { formatMoney, parseMoney } from "../utils/money";
import { fixaAtivaNoMes } from "../utils/fatura";
import { totalCargasMes, totalDespesasVeiculoMes, totalVeiculoMes } from "../utils/veiculo";
import styles from "./Veiculo.module.css";

type Aba = "resumo" | "cargas" | "despesas" | "fixas" | "km";

function agir(acao: () => Promise<unknown>, ok: string) {
  return acao()
    .then(() => mostrarToast(ok))
    .catch(() => mostrarToast("Não foi possível concluir. Tente de novo."));
}

export default function Veiculo() {
  const uid = useAuthStore((s) => s.sessao?.uid);
  const cfg = useCfgStore((s) => s.cfg);
  const dados = useVeiculoStore((s) => s.dados);
  const carregado = useVeiculoStore((s) => s.carregado);

  const [aba, setAba] = useState<Aba>("resumo");
  const [mes, setMes] = useState(mesAtual());
  const real = mesAtual();

  const gastoDoMes = totalVeiculoMes(dados, mes, real);
  const cargasDoMes = totalCargasMes(dados, mes);
  const despesasDoMes = totalDespesasVeiculoMes(dados, mes);
  const kmDoMes = dados.quilometragem
    .filter((k) => mesDe(k.data) === mes)
    .reduce((s, k) => s + k.km, 0);

  // ---- formulário de km ----
  const [kmValor, setKmValor] = useState("");
  const [kmData, setKmData] = useState(mesAtual());
  const [kmNota, setKmNota] = useState("");
  async function salvarKm(e: FormEvent) {
    e.preventDefault();
    const km = parseFloat(kmValor.replace(",", "."));
    if (!Number.isFinite(km) || km <= 0) return mostrarToast("Km inválido.");
    await agir(
      () => criarKm(uid!, { km, data: kmData || real + "-01", nota: kmNota || undefined }),
      "✓ Quilometragem registada",
    );
    setKmValor("");
    setKmNota("");
  }

  // ---- formulário de carga elétrica ----
  const [modoCusto, setModoCusto] = useState<"total" | "kwh">("total");
  const [cgKwh, setCgKwh] = useState("");
  const [cgCustoTotal, setCgCustoTotal] = useState("");
  const [cgPrecoKwh, setCgPrecoKwh] = useState("");
  const [cgLocal, setCgLocal] = useState("");
  const [cgSessao, setCgSessao] = useState("");
  const [cgData, setCgData] = useState(real);

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
    try {
      await criarCarga(uid!, {
        data: cgData,
        kwh,
        precoKwh,
        custo,
        local,
        sessao: cgSessao || undefined,
      });
      if (!cfg.locaisCarregamento.includes(local)) {
        await adicionarItemLista(uid!, cfg, "locaisCarregamento", local).catch(() => null);
      }
      mostrarToast("✓ Carregamento registado");
      setCgKwh("");
      setCgCustoTotal("");
      setCgPrecoKwh("");
      setCgSessao("");
    } catch {
      mostrarToast("Não foi possível salvar.");
    }
  }

  // ---- formulário de despesa variável ----
  const [dvValor, setDvValor] = useState("");
  const [dvCategoria, setDvCategoria] = useState("");
  const [dvData, setDvData] = useState(real);
  const [dvNota, setDvNota] = useState("");
  async function salvarDespesa(e: FormEvent) {
    e.preventDefault();
    const valor = parseMoney(dvValor);
    if (valor === null || valor <= 0) return mostrarToast("Valor inválido.");
    await agir(
      () =>
        criarDespesaVeiculo(uid!, {
          data: dvData,
          valor,
          categoria: dvCategoria || cfg.categoriasVeiculo[0] || "Outros",
          nota: dvNota || undefined,
        }),
      "✓ Despesa do veículo adicionada",
    );
    setDvValor("");
    setDvNota("");
  }

  // ---- formulário de despesa fixa ----
  const [dfDescricao, setDfDescricao] = useState("");
  const [dfValor, setDfValor] = useState("");
  const [dfCategoria, setDfCategoria] = useState("");
  async function salvarFixa(e: FormEvent) {
    e.preventDefault();
    const valor = parseMoney(dfValor);
    if (valor === null || valor <= 0) return mostrarToast("Valor inválido.");
    if (!dfDescricao.trim()) return mostrarToast("Descrição obrigatória.");
    await agir(
      () =>
        criarFixaVeiculo(uid!, {
          descricao: dfDescricao,
          valor,
          categoria: dfCategoria || cfg.categoriasVeiculo[0] || "Outros",
          pagoPorMes: {},
        }),
      "✓ Despesa fixa criada",
    );
    setDfDescricao("");
    setDfValor("");
  }

  return (
    <Pagina titulo="Veículo">
      <div className={styles.linhaMes}>
        <SeletorMes mes={mes} aoMudar={setMes} />
      </div>

      <Kpis>
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

      {aba === "resumo" && (
        <div className={styles.lista}>
          {dados.cargas.length === 0 && dados.despesas.length === 0 && carregado ? (
            <EstadoVazio
              Icone={Car}
              mensagem="Nenhum registo do veículo ainda"
              sub="Use as abas acima para registar km, carregamentos e despesas."
            />
          ) : (
            <>
              {[...dados.cargas]
                .filter((c) => mesDe(c.data) === mes)
                .sort((a, b) => (a.data < b.data ? 1 : -1))
                .map((c) => (
                  <div key={c.id} className={styles.item}>
                    <div>
                      <p className={styles.itemNome}>Carga · {c.local}</p>
                      <p className={styles.itemDetalhe}>
                        {c.kwh} kWh · {c.data.slice(8, 10)}/{c.data.slice(5, 7)}
                      </p>
                    </div>
                    <span className={styles.itemValor}>{formatMoney(c.custo, cfg.currency)}</span>
                  </div>
                ))}
              {[...dados.despesas]
                .filter((d) => mesDe(d.data) === mes)
                .sort((a, b) => (a.data < b.data ? 1 : -1))
                .map((d) => (
                  <div key={d.id} className={styles.item}>
                    <div>
                      <p className={styles.itemNome}>{d.categoria}</p>
                      <p className={styles.itemDetalhe}>
                        {d.nota ? `${d.nota} · ` : ""}
                        {d.data.slice(8, 10)}/{d.data.slice(5, 7)}
                      </p>
                    </div>
                    <span className={styles.itemValor}>{formatMoney(d.valor, cfg.currency)}</span>
                  </div>
                ))}
            </>
          )}
        </div>
      )}

      {aba === "cargas" && (
        <>
          <form className={styles.form} onSubmit={salvarCarga}>
            <p className={styles.formTitulo}>Novo carregamento</p>
            <div className={styles.linhaDupla}>
              <label className={styles.campo}>
                kWh
                <input
                  inputMode="decimal"
                  value={cgKwh}
                  onChange={(e) => setCgKwh(e.target.value)}
                  required
                />
              </label>
              <label className={styles.campo}>
                Data
                <input
                  type="date"
                  value={cgData}
                  onChange={(e) => setCgData(e.target.value)}
                  required
                />
              </label>
            </div>
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
            <button type="submit" className={styles.salvar}>
              Registar carregamento
            </button>
          </form>

          <div className={styles.lista}>
            {[...dados.cargas]
              .sort((a, b) => (a.data < b.data ? 1 : -1))
              .map((c) => (
                <div key={c.id} className={styles.item}>
                  <div>
                    <p className={styles.itemNome}>{c.local}</p>
                    <p className={styles.itemDetalhe}>
                      {c.kwh} kWh · {formatMoney(c.precoKwh, cfg.currency)}/kWh ·{" "}
                      {c.data.slice(8, 10)}/{c.data.slice(5, 7)}
                      {c.sessao ? ` · ${c.sessao}` : ""}
                    </p>
                  </div>
                  <div className={styles.itemLado}>
                    <span className={styles.itemValor}>{formatMoney(c.custo, cfg.currency)}</span>
                    <button
                      className={styles.remover}
                      onClick={() => void agir(() => removerCarga(uid!, c.id), "Removido")}
                      aria-label="Remover carregamento"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </>
      )}

      {aba === "despesas" && (
        <>
          <form className={styles.form} onSubmit={salvarDespesa}>
            <p className={styles.formTitulo}>Nova despesa</p>
            <div className={styles.linhaDupla}>
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
              <label className={styles.campo}>
                Data
                <input
                  type="date"
                  value={dvData}
                  onChange={(e) => setDvData(e.target.value)}
                  required
                />
              </label>
            </div>
            <div className={styles.linhaDupla}>
              <label className={styles.campo}>
                Categoria
                <select value={dvCategoria} onChange={(e) => setDvCategoria(e.target.value)}>
                  {cfg.categoriasVeiculo.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className={styles.campo}>
                Nota (opcional)
                <input value={dvNota} onChange={(e) => setDvNota(e.target.value)} />
              </label>
            </div>
            <button type="submit" className={styles.salvar}>
              Adicionar despesa
            </button>
          </form>

          <div className={styles.lista}>
            {[...dados.despesas]
              .sort((a, b) => (a.data < b.data ? 1 : -1))
              .map((d) => (
                <div key={d.id} className={styles.item}>
                  <div>
                    <p className={styles.itemNome}>{d.categoria}</p>
                    <p className={styles.itemDetalhe}>
                      {d.nota ? `${d.nota} · ` : ""}
                      {d.data.slice(8, 10)}/{d.data.slice(5, 7)}
                    </p>
                  </div>
                  <div className={styles.itemLado}>
                    <span className={styles.itemValor}>{formatMoney(d.valor, cfg.currency)}</span>
                    <button
                      className={styles.remover}
                      onClick={() => void agir(() => removerDespesaVeiculo(uid!, d.id), "Removida")}
                      aria-label="Remover despesa"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </>
      )}

      {aba === "fixas" && (
        <>
          <form className={styles.form} onSubmit={salvarFixa}>
            <p className={styles.formTitulo}>Nova despesa fixa</p>
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
                  {cfg.categoriasVeiculo.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
            </div>
            <button type="submit" className={styles.salvar}>
              Criar fixa
            </button>
          </form>

          <div className={styles.lista}>
            {dados.despesasFixas.length === 0 ? (
              <p className={styles.vazio}>Nenhuma despesa fixa do veículo ainda.</p>
            ) : (
              dados.despesasFixas
                .filter((f) => fixaAtivaNoMes(f, mes))
                .map((f) => {
                  const paga = !!f.pagoPorMes[mes];
                  return (
                    <div key={f.id} className={styles.item}>
                      <div>
                        <p className={styles.itemNome}>{f.descricao}</p>
                        <p className={styles.itemDetalhe}>{f.categoria}</p>
                      </div>
                      <div className={styles.itemLado}>
                        <span className={styles.itemValor}>
                          {formatMoney(f.valor, cfg.currency)}
                        </span>
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
                        <button
                          className={styles.remover}
                          onClick={() => {
                            if (!window.confirm(`Excluir "${f.descricao}"?`)) return;
                            void agir(() => removerFixaVeiculo(uid!, f.id), "Excluída");
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

      {aba === "km" && (
        <>
          <form className={styles.form} onSubmit={salvarKm}>
            <p className={styles.formTitulo}>Registar quilometragem</p>
            <div className={styles.linhaDupla}>
              <label className={styles.campo}>
                Km
                <input
                  inputMode="decimal"
                  value={kmValor}
                  onChange={(e) => setKmValor(e.target.value)}
                  required
                />
              </label>
              <label className={styles.campo}>
                Data
                <input
                  type="date"
                  value={kmData}
                  onChange={(e) => setKmData(e.target.value)}
                  required
                />
              </label>
            </div>
            <label className={styles.campo}>
              Nota (opcional)
              <input value={kmNota} onChange={(e) => setKmNota(e.target.value)} />
            </label>
            <button type="submit" className={styles.salvar}>
              Registar
            </button>
          </form>

          <div className={styles.lista}>
            {dados.quilometragem.length === 0 ? (
              <p className={styles.vazio}>Nenhum registo de km ainda.</p>
            ) : (
              [...dados.quilometragem]
                .sort((a, b) => (a.data < b.data ? 1 : -1))
                .map((k) => (
                  <div key={k.id} className={styles.item}>
                    <div>
                      <p className={styles.itemNome}>{k.km.toLocaleString("pt-PT")} km</p>
                      <p className={styles.itemDetalhe}>
                        {k.nota ? `${k.nota} · ` : ""}
                        {k.data.slice(8, 10)}/{k.data.slice(5, 7)}
                      </p>
                    </div>
                    <button
                      className={styles.remover}
                      onClick={() => void agir(() => removerKm(uid!, k.id), "Removido")}
                      aria-label="Remover registo"
                    >
                      ×
                    </button>
                  </div>
                ))
            )}
          </div>
        </>
      )}
    </Pagina>
  );
}

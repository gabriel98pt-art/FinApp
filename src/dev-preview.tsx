// Entrada só de desenvolvimento: renderiza o app com as stores semeadas e sem
// login, pra conferir as telas na tela mesmo sem uma conta Firebase.
// `sessao: null` com `status: "autenticado"` faz o useSyncConta não arrancar,
// então nada toca na rede. Não entra no build de produção.
import { createRoot } from "react-dom/client";
import App from "./App";
import { CONFIG_PADRAO } from "./constants/configPadrao";
import { useAuthStore } from "./stores/authStore";
import { useCfgStore } from "./stores/cfgStore";
import {
  useDespesasFixasStore,
  useDespesasStore,
  useReceitasStore,
  useTransferenciasStore,
} from "./stores/lancamentosStore";
import { useParcelasStore } from "./stores/parcelasStore";
import { useVeiculoStore } from "./stores/veiculoStore";
import { useEventosStore } from "./stores/eventosStore";
import { useFundosStore } from "./stores/fundosStore";
import "./styles/index.css";

const CARTAO = "AB Gold (C)";
const CONTA = "Conta Principal";

useCfgStore.setState({
  carregado: true,
  erro: false,
  cfg: {
    ...CONFIG_PADRAO,
    contasCartoes: [CARTAO, CONTA],
    tipoCartao: { [CARTAO]: "credit", [CONTA]: "debit" },
    saldosIniciais: { [CONTA]: 250000 },
    locaisCarregamento: ["Casa", "Galp Matosinhos", "Ionity A1"],
    orcamentos: { Alimentação: 40000 },
    showTvde: true,
  },
});

const pagos = (meses: string[]) => Object.fromEntries(meses.map((m) => [m, true as const]));

useParcelasStore.setState({
  carregado: true,
  erro: false,
  itens: [
    {
      id: "p-atrasada",
      descricao: "Telemóvel",
      total: 60000,
      numParcelas: 6,
      primeiroMes: "2026-01",
      categoria: "Compras",
      cartao: CARTAO,
      autoDebit: true,
      pagoPorMes: {},
    },
    {
      id: "p-buraco",
      descricao: "Portátil",
      total: 120000,
      numParcelas: 6,
      primeiroMes: "2026-02",
      categoria: "Compras",
      cartao: CARTAO,
      autoDebit: true,
      pagoPorMes: pagos(["2026-02"]),
    },
    {
      id: "p-em-curso",
      descricao: "Colchão",
      total: 50000,
      numParcelas: 5,
      primeiroMes: "2026-05",
      categoria: "Casa",
      cartao: null,
      autoDebit: false,
      pagoPorMes: pagos(["2026-05", "2026-06"]),
    },
    {
      id: "p-futura",
      descricao: "Bicicleta",
      total: 40000,
      numParcelas: 4,
      primeiroMes: "2026-09",
      categoria: "Lazer",
      cartao: CARTAO,
      autoDebit: true,
      pagoPorMes: {},
    },
    {
      id: "p-quitada",
      descricao: "Fones",
      total: 9000,
      numParcelas: 3,
      primeiroMes: "2026-01",
      categoria: "Compras",
      cartao: CARTAO,
      autoDebit: true,
      pagoPorMes: pagos(["2026-01", "2026-02", "2026-03"]),
    },
    {
      id: "p-quitada-velha",
      descricao: "Cadeira",
      total: 20000,
      numParcelas: 2,
      primeiroMes: "2025-01",
      categoria: "Casa",
      cartao: null,
      autoDebit: false,
      pagoPorMes: pagos(["2025-01", "2025-02"]),
    },
  ],
});

useDespesasStore.setState({
  carregado: true,
  erro: false,
  itens: [
    {
      id: "d1",
      descricao: "Mercado",
      valor: 4230,
      data: "2026-07-10",
      categoria: "Alimentação",
      contaCartao: CARTAO,
    },
    {
      id: "d2",
      descricao: "Cinema",
      valor: 1800,
      data: "2026-07-12",
      categoria: "Lazer",
      contaCartao: CONTA,
    },
  ],
});

useReceitasStore.setState({
  carregado: true,
  erro: false,
  itens: [
    {
      id: "r1",
      descricao: "Salário",
      valor: 210000,
      data: "2026-07-01",
      fonte: "Trabalho",
      conta: CONTA,
    },
  ],
});

useDespesasFixasStore.setState({
  carregado: true,
  erro: false,
  itens: [
    {
      id: "f1",
      descricao: "Netflix",
      valor: 1599,
      categoria: "Assinaturas",
      contaCartao: CARTAO,
      pagoPorMes: {},
    },
  ],
});

useTransferenciasStore.setState({ carregado: true, erro: false, itens: [] });
useEventosStore.setState({ carregado: true, erro: false, itens: [] });
useFundosStore.setState({ carregado: true, erro: false, itens: [] });

useVeiculoStore.setState({
  carregado: true,
  erro: false,
  dados: {
    cargas: [
      {
        id: "c1",
        data: "2026-07-05",
        kwh: 32,
        precoKwh: 24,
        custo: 768,
        local: "Casa",
        contaCartao: CARTAO,
      },
    ],
    despesas: [
      {
        id: "dv1",
        data: "2026-07-08",
        valor: 8900,
        categoria: "Manutenção",
        contaCartao: CARTAO,
      },
    ],
    despesasFixas: [
      {
        id: "fv1",
        descricao: "Seguro",
        valor: 4500,
        categoria: "Seguro",
        contaCartao: CARTAO,
        pagoPorMes: {},
      },
    ],
    quilometragem: [{ id: "k1", data: "2026-07-01", km: 320 }],
  },
});

// O observador de sessão do authStore responde "deslogado" logo a seguir —
// mantém o app aberto forçando o estado de volta sempre que isso acontecer.
// O uid falso faz as telas que dependem dele renderizarem; as subscrições do
// RTDB falham por permissão, o que só marca `erro` sem apagar os dados
// semeados acima (ver syncService).
const SESSAO = { uid: "preview", email: "preview@local" };

function forcarSessao() {
  const s = useAuthStore.getState();
  if (s.status !== "autenticado" || s.sessao?.uid !== SESSAO.uid) {
    useAuthStore.setState({ status: "autenticado", sessao: SESSAO });
  }
}
forcarSessao();
useAuthStore.subscribe(forcarSessao);

// As subscrições falham por permissão e acendem a faixa "Não foi possível
// sincronizar", que aqui não diz nada de útil — os dados são de mentira e
// nunca vão sincronizar. Apaga o aviso assim que ele aparece.
type StoreSincronizada = {
  subscribe: (ouvinte: (s: { erro: boolean }) => void) => void;
  setState: (parcial: { erro: boolean; carregado: boolean }) => void;
};

const STORES_SINCRONIZADAS: StoreSincronizada[] = [
  useCfgStore,
  useReceitasStore,
  useDespesasStore,
  useDespesasFixasStore,
  useTransferenciasStore,
  useParcelasStore,
  useVeiculoStore,
  useEventosStore,
  useFundosStore,
];

for (const store of STORES_SINCRONIZADAS) {
  store.subscribe((s) => {
    if (s.erro) store.setState({ erro: false, carregado: true });
  });
}

createRoot(document.getElementById("root")!).render(<App />);

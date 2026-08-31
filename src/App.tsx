import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import Login from "./pages/Login";
import { useAuthStore } from "./stores/authStore";
import { useCfgStore } from "./stores/cfgStore";
import { useAplicarTema } from "./hooks/useAplicarTema";
import { useAplicarModoDiscreto } from "./hooks/useAplicarModoDiscreto";
import { useAplicarCoresPersonalizadas } from "./hooks/useAplicarCoresPersonalizadas";
import { useAlturaTeclado } from "./hooks/useAlturaTeclado";
import { usePwaUpdate } from "./hooks/usePwaUpdate";
import { useRecarregarChunkFalho } from "./hooks/useRecarregarChunkFalho";
import { useIgnorarArquivoSolto } from "./hooks/useIgnorarArquivoSolto";
import { useCapturarErros } from "./hooks/useCapturarErros";

// Achado da auditoria de Performance & PWA: AppShell (menu, sidebar, registro
// rápido) era importado estático, então o bundle de quem só vê a tela de
// Login (nunca chega a AppShell) incluía tudo isso — 606 KB de JS medidos ao
// vivo, boa parte deles nem usados. Lazy como as páginas: só entra no
// carregamento inicial de quem já está logado.
const AppShell = lazy(() => import("./layout/AppShell"));

// Lazy loading por página (seção 8 — performance)
const Inicio = lazy(() => import("./pages/Inicio"));
const Receitas = lazy(() => import("./pages/Receitas"));
const Despesas = lazy(() => import("./pages/Despesas"));
const Veiculo = lazy(() => import("./pages/Veiculo"));
const Cartoes = lazy(() => import("./pages/Cartoes"));
const Parcelas = lazy(() => import("./pages/Parcelas"));
const Calendario = lazy(() => import("./pages/Calendario"));
const Planejamento = lazy(() => import("./pages/Planejamento"));
const Transacoes = lazy(() => import("./pages/Transacoes"));
const Importar = lazy(() => import("./pages/Importar"));
const Tvde = lazy(() => import("./pages/Tvde"));
const Definicoes = lazy(() => import("./pages/Definicoes"));

/** /tvde só existe com o módulo ligado (opt-in por conta, seção 4.4).
 *  Enquanto a cfg carrega, não redireciona — evita expulsar quem recarrega
 *  a página já dentro do TVDE. */
function RotaTvde() {
  const showTvde = useCfgStore((s) => s.cfg.showTvde);
  const carregado = useCfgStore((s) => s.carregado);
  if (carregado && !showTvde) return <Navigate to="/" replace />;
  return <Tvde />;
}

/** /veiculo segue a mesma regra do TVDE, com o default trocado: o módulo
 *  Veículo nasce LIGADO (já existe há muito, há contas com dados lá dentro) e
 *  o interruptor em Definições › Veículo serve para quem não tem carro o
 *  esconder. Enquanto a cfg carrega, não redireciona — mesmo cuidado do TVDE. */
function RotaVeiculo() {
  const showVeiculo = useCfgStore((s) => s.cfg.showVeiculo);
  const carregado = useCfgStore((s) => s.carregado);
  if (carregado && !showVeiculo) return <Navigate to="/" replace />;
  return <Veiculo />;
}

export default function App() {
  useAplicarTema();
  useAplicarModoDiscreto();
  useAplicarCoresPersonalizadas();
  // Fora do gate de sessão: o Login também é um formulário, e o teclado do
  // telemóvel tapa-o do mesmo jeito que tapa as folhas lá dentro.
  useAlturaTeclado();
  // Fora do gate de sessão de propósito: procurar versão nova não depende de
  // estar logado, e a tela de login também precisa de se atualizar.
  usePwaUpdate();
  // Também fora do gate: um chunk stale pode falhar até na tela de login.
  useRecarregarChunkFalho();
  // Também fora do gate de sessão: largar um ficheiro ao lado da zona certa
  // não pode deitar o app fora, seja em que tela for.
  useIgnorarArquivoSolto();
  // Também fora do gate: um erro na tela de login continua a ser um erro que
  // vale a pena registar (só grava quando houver conta onde gravar).
  useCapturarErros();
  const status = useAuthStore((s) => s.status);

  // A rede de segurança fica FORA do gate de sessão: um crash de render na tela
  // de Login deixaria a mesma tela branca que um crash lá dentro. Continua
  // dentro do <StrictMode> do main.tsx.
  return (
    <ErrorBoundary>
      <Conteudo status={status} />
    </ErrorBoundary>
  );
}

function Conteudo({ status }: { status: ReturnType<typeof useAuthStore.getState>["status"] }) {
  // Nada de piscar tela: espera o Firebase restaurar a sessão persistida
  if (status === "carregando") return null;
  if (status === "deslogado") return <Login />;

  return (
    <BrowserRouter>
      {/* AppShell agora é lazy (ver comentário acima) — precisa de um
          Suspense por cima. `fallback={null}`, mesma escolha do Suspense
          interno do próprio AppShell para as páginas: nada de piscar um
          spinner num carregamento que normalmente é quase instantâneo. */}
      <Suspense fallback={null}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Inicio />} />
            <Route path="/receitas" element={<Receitas />} />
            <Route path="/despesas" element={<Despesas />} />
            <Route path="/veiculo" element={<RotaVeiculo />} />
            <Route path="/cartoes" element={<Cartoes />} />
            <Route path="/parcelas" element={<Parcelas />} />
            <Route path="/calendario" element={<Calendario />} />
            <Route path="/planejamento" element={<Planejamento />} />
            <Route path="/transacoes" element={<Transacoes />} />
            {/* Metas passou a ser uma aba de Planejamento (as duas telas
                respondiam à mesma pergunta). A rota antiga continua a existir
                e leva à aba certa — links guardados, o ecrã inicial do PWA e
                qualquer atalho antigo continuam a funcionar. */}
            <Route
              path="/metas"
              element={<Navigate to="/planejamento" replace state={{ aba: "metas" }} />}
            />
            <Route path="/importar" element={<Importar />} />
            <Route path="/tvde" element={<RotaTvde />} />
            <Route path="/definicoes" element={<Definicoes />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

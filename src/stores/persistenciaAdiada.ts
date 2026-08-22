import { createJSONStorage, type StateStorage } from "zustand/middleware";

// Achado da auditoria de Performance & PWA: as 9 stores persistidas (12
// chamadas de `persist`, seção 6.1) usavam o `localStorage` padrão do
// zustand — `setItem` é SÍNCRONO e bloqueia a thread principal a cada
// mudança de estado, inclusive em digitação (CampoMoeda) e no drag do
// BottomSheet, onde cada frame perdido é visível.
//
// A leitura continua síncrona (hidratação inicial não muda). A escrita fica
// em fila e só é aplicada de facto num idle callback — várias mudanças na
// mesma janela viram UM `setItem` por chave, não um por mudança.
//
// Fechar a aba/app antes do idle disparar perderia a última escrita — por
// isso a fila é esvaziada de forma síncrona em `visibilitychange`/`pagehide`,
// os dois sinais confiáveis de "a página pode não voltar" (`beforeunload`
// não dispara em iOS Safari e em trocas de app).

const filaEscrita = new Map<string, string>();
let idAgendado: ReturnType<typeof setTimeout> | number | undefined;

type ComRequestIdleCallback = typeof window & {
  requestIdleCallback?: (cb: () => void) => number;
  cancelIdleCallback?: (id: number) => void;
};

function escreverAgora() {
  for (const [nome, valor] of filaEscrita) {
    localStorage.setItem(nome, valor);
  }
  filaEscrita.clear();
}

function flush() {
  if (idAgendado === undefined) return;
  const janela = window as ComRequestIdleCallback;
  if (janela.cancelIdleCallback) janela.cancelIdleCallback(idAgendado as number);
  else clearTimeout(idAgendado as ReturnType<typeof setTimeout>);
  idAgendado = undefined;
  escreverAgora();
}

function agendar() {
  if (idAgendado !== undefined) return;
  const janela = window as ComRequestIdleCallback;
  idAgendado = janela.requestIdleCallback
    ? janela.requestIdleCallback(() => {
        idAgendado = undefined;
        escreverAgora();
      })
    : setTimeout(() => {
        idAgendado = undefined;
        escreverAgora();
      }, 0);
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
  window.addEventListener("pagehide", flush);
}

const storageAdiada: StateStorage = {
  getItem: (nome) => {
    // Uma escrita ainda na fila é mais recente que o que está em disco —
    // sem isto, ler logo a seguir a escrever (só acontece em teste, mas
    // aconteceria) devolvia o valor antigo.
    return filaEscrita.get(nome) ?? localStorage.getItem(nome);
  },
  setItem: (nome, valor) => {
    filaEscrita.set(nome, valor);
    agendar();
  },
  removeItem: (nome) => {
    filaEscrita.delete(nome);
    localStorage.removeItem(nome);
  },
};

// `createJSONStorage` chama este getter UMA vez, já na importação do módulo,
// dentro de um try/catch próprio — é assim que o padrão original
// (`createJSONStorage(() => window.localStorage)`) já lidava com ambiente
// sem `localStorage` de verdade (os testes de lógica pura, que correm em
// Node sem `window` nenhum; e este projeto testa jsdom sem `localStorage`
// implementado): o catch devolve `undefined`, e a store cai sozinha no "sem
// storage" (sem persistir, sem rebentar). Aqui replica-se o mesmo sinal, em
// vez de deixar `agendar()` descobrir a falta mais tarde, já dentro de um
// `setItem` real, fora do try/catch do zustand.
export const persistenciaAdiada = createJSONStorage(() => {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    throw new Error("sem localStorage");
  }
  return storageAdiada;
});

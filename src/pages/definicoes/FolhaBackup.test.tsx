// @vitest-environment jsdom

// Pedido do Gabriel (03/09/2026): colar (⌘V) um arquivo copiado direto na
// folha de Backup, sem precisar abrir o seletor — Importar extrato já tinha
// isso, só faltava aqui. O que se testa é o contrato: um ficheiro colado
// dispara a mesma confirmação + importação do seletor; texto colado (sem
// ficheiro) não faz nada, porque não é o gesto que a folha entende.
//
// Fase 1 do plano de backup (06/10/2026): a confirmação deixou de ser um
// diálogo genérico ANTES de ler o arquivo. Agora o arquivo é lido e validado
// logo que entra, e a folha mostra um resumo com "Restaurar backup" — só esse
// clique chama `importarBackup`. A validação usada é a REAL do serviço
// (`validarArquivoBackup` não é simulada), para o teste não mentir sobre o
// que passa e o que é recusado.

import { beforeEach, describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import FolhaBackup from "./FolhaBackup";

const exportarBackup = vi.fn(async () => "{}");
const importarBackup = vi.fn<(uid: string, json: string) => Promise<void>>(async () => {});
vi.mock("../../services/backupService", async (original) => {
  const real = await original<typeof import("../../services/backupService")>();
  return {
    validarArquivoBackup: real.validarArquivoBackup,
    exportarBackup: (...a: unknown[]) => exportarBackup(...(a as [])),
    importarBackup: (...a: unknown[]) => importarBackup(...(a as [string, string])),
  };
});
vi.mock("../../services/firebase", () => ({ db: {} }));

const mostrarToast = vi.fn();
vi.mock("../../stores/toastStore", () => ({
  mostrarToast: (...a: unknown[]) => mostrarToast(...a),
}));

/** O botão final de restaurar faz o papel da antiga `confirmar()`: aparece
 *  só quando o arquivo é válido, e só ele chama `importarBackup`. */
async function confirmarRestauracao() {
  const botao = await screen.findByRole("button", { name: "Restaurar backup" });
  fireEvent.click(botao);
}

/** Simula `e.clipboardData.files` — jsdom não cria `ClipboardEvent` com
 *  ficheiros sozinho, então a lista de ficheiros é forjada por cima. */
function colar(arquivo?: File) {
  const evento = new Event("paste", { bubbles: true, cancelable: true }) as ClipboardEvent;
  Object.defineProperty(evento, "clipboardData", {
    value: arquivo ? { files: [arquivo] } : { files: [] },
  });
  window.dispatchEvent(evento);
}

beforeEach(() => {
  importarBackup.mockClear();
  mostrarToast.mockClear();
});

describe("FolhaBackup — colar ficheiro (⌘V)", () => {
  test("colar um ficheiro mostra o resumo e importa só depois de confirmar", async () => {
    render(<FolhaBackup uid="u1" aberta aoFechar={() => {}} />);

    const arquivo = new File(['{"versao":1,"dados":{}}'], "backup.json", {
      type: "application/json",
    });
    colar(arquivo);

    await screen.findByRole("button", { name: "Restaurar backup" });
    expect(importarBackup).not.toHaveBeenCalled();
    await confirmarRestauracao();
    await vi.waitFor(() => expect(importarBackup).toHaveBeenCalledWith("u1", expect.any(String)));
  });

  test("colar texto (sem ficheiro) não faz nada — não é o gesto que a folha entende", () => {
    render(<FolhaBackup uid="u1" aberta aoFechar={() => {}} />);

    colar();

    expect(screen.queryByRole("button", { name: "Restaurar backup" })).toBeNull();
    expect(importarBackup).not.toHaveBeenCalled();
  });

  test("com a folha fechada, colar não importa nada", () => {
    render(<FolhaBackup uid="u1" aberta={false} aoFechar={() => {}} />);

    const arquivo = new File(['{"versao":1,"dados":{}}'], "backup.json", {
      type: "application/json",
    });
    colar(arquivo);

    expect(screen.queryByRole("button", { name: "Restaurar backup" })).toBeNull();
    expect(importarBackup).not.toHaveBeenCalled();
  });
});

// Zona visível de "arrastar ou colar arquivo" (05/10/2026) — antes só havia
// o `paste` escondido na window, testado acima; agora a mesma folha também
// aceita arrastar e soltar o arquivo direto na caixa.
describe("FolhaBackup — arrastar e soltar ficheiro", () => {
  function zona() {
    return screen.getByText(/Arraste o arquivo de backup aqui/).parentElement!;
  }

  test("soltar um ficheiro mostra o resumo e importa depois de confirmar", async () => {
    render(<FolhaBackup uid="u1" aberta aoFechar={() => {}} />);

    const arquivo = new File(['{"versao":1,"dados":{}}'], "backup.json", {
      type: "application/json",
    });
    fireEvent.drop(zona(), { dataTransfer: { types: ["Files"], files: [arquivo] } });

    await confirmarRestauracao();
    await vi.waitFor(() => expect(importarBackup).toHaveBeenCalledWith("u1", expect.any(String)));
  });

  test("soltar sem ficheiro (ex. texto arrastado) não faz nada", () => {
    render(<FolhaBackup uid="u1" aberta aoFechar={() => {}} />);

    fireEvent.drop(zona(), { dataTransfer: { types: ["text/plain"], files: [] } });

    expect(screen.queryByRole("button", { name: "Restaurar backup" })).toBeNull();
    expect(importarBackup).not.toHaveBeenCalled();
  });
});

describe("FolhaBackup — validar antes de confirmar", () => {
  function soltar(conteudo: string) {
    const arquivo = new File([conteudo], "backup.json", { type: "application/json" });
    const zona = screen.getByText(/Arraste o arquivo de backup aqui/).parentElement!;
    fireEvent.drop(zona, { dataTransfer: { types: ["Files"], files: [arquivo] } });
  }

  test("arquivo válido: resumo com data, lançamentos, contas e categorias", async () => {
    render(<FolhaBackup uid="u1" aberta aoFechar={() => {}} />);

    soltar(
      JSON.stringify({
        versao: 1,
        exportadoEm: "2026-08-12T10:00:00.000Z",
        dados: {
          cfg: { categoriasDespesa: ["Casa", "Lazer"], instituicoes: { i1: { nome: "A" } } },
          receitas: { r1: {}, r2: {} },
          despesasCorrentes: { c1: {} },
        },
      }),
    );

    expect(await screen.findByText(/^Backup de .*2026/)).toBeTruthy();
    expect(screen.getByText("3 lançamentos · 1 conta · 2 categorias")).toBeTruthy();
    expect(screen.getByText(/cópia de segurança automática/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeTruthy();
    expect(importarBackup).not.toHaveBeenCalled();
  });

  test("arquivo inválido: mostra o motivo específico e não oferece restaurar", async () => {
    render(<FolhaBackup uid="u1" aberta aoFechar={() => {}} />);

    soltar(JSON.stringify({ versao: 1, dados: { receitas: [{ descricao: "x" }] } }));

    const alerta = await screen.findByRole("alert");
    expect(alerta.textContent).toMatch(/receitas/);
    expect(screen.queryByRole("button", { name: "Restaurar backup" })).toBeNull();
    expect(importarBackup).not.toHaveBeenCalled();
  });

  test("versão desconhecida é recusada com a mensagem de versão", async () => {
    render(<FolhaBackup uid="u1" aberta aoFechar={() => {}} />);

    soltar(JSON.stringify({ versao: 7, dados: {} }));

    expect((await screen.findByRole("alert")).textContent).toMatch(
      /Versão de backup não suportada/,
    );
  });

  test("Cancelar volta à zona de arrastar sem importar nada", async () => {
    render(<FolhaBackup uid="u1" aberta aoFechar={() => {}} />);

    soltar(JSON.stringify({ versao: 1, dados: {} }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }));

    expect(screen.getByText(/Arraste o arquivo de backup aqui/)).toBeTruthy();
    expect(importarBackup).not.toHaveBeenCalled();
  });

  test("erro ao restaurar: mostra o motivo e mantém o resumo para tentar de novo", async () => {
    importarBackup.mockRejectedValueOnce(
      new Error(
        "Não foi possível criar a cópia de segurança dos dados atuais — nada foi alterado.",
      ),
    );
    render(<FolhaBackup uid="u1" aberta aoFechar={() => {}} />);

    soltar(JSON.stringify({ versao: 1, dados: {} }));
    await confirmarRestauracao();

    await vi.waitFor(() =>
      expect(mostrarToast).toHaveBeenCalledWith(expect.stringMatching(/cópia de segurança/)),
    );
    expect(await screen.findByRole("button", { name: "Restaurar backup" })).toBeTruthy();
  });

  test("sucesso: toast de restaurado e a folha volta ao início", async () => {
    render(<FolhaBackup uid="u1" aberta aoFechar={() => {}} />);

    soltar(JSON.stringify({ versao: 1, dados: {} }));
    await confirmarRestauracao();

    await vi.waitFor(() => expect(mostrarToast).toHaveBeenCalledWith("✓ Backup restaurado"));
    expect(await screen.findByText(/Arraste o arquivo de backup aqui/)).toBeTruthy();
  });
});

// @vitest-environment jsdom

// Pedido do Gabriel (03/09/2026): colar (⌘V) um arquivo copiado direto na
// folha de Backup, sem precisar abrir o seletor — Importar extrato já tinha
// isso, só faltava aqui. O que se testa é o contrato: um ficheiro colado
// dispara a mesma confirmação + importação do seletor; texto colado (sem
// ficheiro) não faz nada, porque não é o gesto que a folha entende.

import { beforeEach, describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import FolhaBackup from "./FolhaBackup";

const exportarBackup = vi.fn(async () => "{}");
const importarBackup = vi.fn(async () => {});
vi.mock("../../services/backupService", () => ({
  exportarBackup: (...a: unknown[]) => exportarBackup(...(a as [])),
  importarBackup: (...a: unknown[]) => importarBackup(...(a as [])),
}));

const confirmar = vi.fn(async () => true);
vi.mock("../../hooks/useConfirmar", () => ({ useConfirmar: () => confirmar }));

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
  confirmar.mockClear();
  importarBackup.mockClear();
});

describe("FolhaBackup — colar ficheiro (⌘V)", () => {
  test("colar um ficheiro pede confirmação e importa", async () => {
    render(<FolhaBackup uid="u1" aberta aoFechar={() => {}} />);

    const arquivo = new File(['{"versao":1,"dados":{}}'], "backup.json", {
      type: "application/json",
    });
    colar(arquivo);

    await vi.waitFor(() => expect(confirmar).toHaveBeenCalled());
    await vi.waitFor(() => expect(importarBackup).toHaveBeenCalledWith("u1", expect.any(String)));
  });

  test("colar texto (sem ficheiro) não faz nada — não é o gesto que a folha entende", () => {
    render(<FolhaBackup uid="u1" aberta aoFechar={() => {}} />);

    colar();

    expect(confirmar).not.toHaveBeenCalled();
    expect(importarBackup).not.toHaveBeenCalled();
  });

  test("com a folha fechada, colar não importa nada", () => {
    render(<FolhaBackup uid="u1" aberta={false} aoFechar={() => {}} />);

    const arquivo = new File(['{"versao":1,"dados":{}}'], "backup.json", {
      type: "application/json",
    });
    colar(arquivo);

    expect(confirmar).not.toHaveBeenCalled();
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

  test("soltar um ficheiro pede confirmação e importa", async () => {
    render(<FolhaBackup uid="u1" aberta aoFechar={() => {}} />);

    const arquivo = new File(['{"versao":1,"dados":{}}'], "backup.json", {
      type: "application/json",
    });
    fireEvent.drop(zona(), { dataTransfer: { types: ["Files"], files: [arquivo] } });

    await vi.waitFor(() => expect(confirmar).toHaveBeenCalled());
    await vi.waitFor(() => expect(importarBackup).toHaveBeenCalledWith("u1", expect.any(String)));
  });

  test("soltar sem ficheiro (ex. texto arrastado) não faz nada", () => {
    render(<FolhaBackup uid="u1" aberta aoFechar={() => {}} />);

    fireEvent.drop(zona(), { dataTransfer: { types: ["text/plain"], files: [] } });

    expect(confirmar).not.toHaveBeenCalled();
    expect(importarBackup).not.toHaveBeenCalled();
  });
});

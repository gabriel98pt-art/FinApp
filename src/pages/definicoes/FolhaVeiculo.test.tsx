// @vitest-environment jsdom

// A folha que reúne a configuração do módulo Veículo. O que se testa aqui é o
// que se perdeu ao sair da página Veículo: que a escolha continua a existir,
// continua a mostrar o valor guardado e continua a gravar em cfg.

import { describe, expect, test, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CONFIG_PADRAO } from "../../constants/configPadrao";
import type { ConfigConta } from "../../types";

vi.mock("../../services/firebase", () => ({ db: {}, auth: {} }));
const atualizarConfig = vi.fn(async () => {});
vi.mock("../../services/cfgService", () => ({
  atualizarConfig: (...a: unknown[]) => atualizarConfig(...(a as [])),
}));

const FolhaVeiculo = (await import("./FolhaVeiculo")).default;

function abrir(cfg: ConfigConta = CONFIG_PADRAO) {
  return render(<FolhaVeiculo cfg={cfg} uid="u1" aberta aoFechar={() => {}} />);
}

beforeEach(() => {
  atualizarConfig.mockClear();
});

describe("FolhaVeiculo", () => {
  test("mostra a motorização guardada em cfg", () => {
    abrir({ ...CONFIG_PADRAO, tipoVeiculo: "hibrido" });
    expect(screen.getByRole("button", { name: /Tipo de veículo/ })).toHaveTextContent("Híbrido");
  });

  test("escolher outra motorização grava em cfg", async () => {
    abrir();
    await userEvent.click(screen.getByRole("button", { name: /Tipo de veículo/ }));
    await userEvent.click(screen.getByRole("button", { name: "Combustão" }));
    expect(atualizarConfig).toHaveBeenCalledWith("u1", { tipoVeiculo: "combustao" });
  });
});

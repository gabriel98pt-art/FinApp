// @vitest-environment jsdom

// A entrada do foco na folha, que é feita um frame depois de ela abrir.
//
// Esperar o frame não é opcional (no mesmo tick a folha ainda tem
// `pointer-events:none` e o browser recusa o foco), mas um frame é tempo — e o
// que acontecer nesse intervalo tem de ser respeitado. Foi exactamente isso que
// partiu a suite do Registro Rápido: quem tocava num campo antes do frame
// chegar via o foco ser-lhe tirado e devolvido ao contentor da folha, e as
// teclas seguintes caíam no vazio. No teste isso aparecia como um campo `Nome`
// vazio e um submit que nunca acontecia, porque o campo é `required`.

import { describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import BottomSheet from "./BottomSheet";

/** Um frame de `requestAnimationFrame` — o jsdom dispara-os a ~16 ms. */
const umFrame = () => new Promise((r) => setTimeout(r, 50));

describe("foco da folha", () => {
  test("ao abrir, o foco entra na folha", async () => {
    render(
      <BottomSheet aberta aoFechar={vi.fn()} titulo="Folha">
        <input aria-label="Nome" />
      </BottomSheet>,
    );

    await waitFor(() => expect(screen.getByRole("dialog")).toHaveFocus());
  });

  test("não rouba o foco de um campo que já o recebeu", async () => {
    render(
      <BottomSheet aberta aoFechar={vi.fn()} titulo="Folha">
        <input aria-label="Nome" />
      </BottomSheet>,
    );

    // Antes do frame da abertura chegar — é esta a corrida.
    const nome = screen.getByLabelText("Nome");
    nome.focus();

    await umFrame();

    expect(nome).toHaveFocus();
  });
});

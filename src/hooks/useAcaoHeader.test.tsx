// @vitest-environment jsdom

// O "+" do cabeçalho é da PÁGINA aberta, mas quem o desenha é o Header, que
// vive fora dela e nunca desmonta. Toda a correção do mecanismo está em três
// coisas: a página põe a ação ao entrar, tira-a ao sair, e o clique chama
// sempre o handler do render mais recente (senão o "+" ficava preso ao estado
// da primeira renderização da tela).

import { describe, expect, test } from "vitest";
import { act, render } from "@testing-library/react";
import { useState } from "react";
import { useAcaoHeader } from "./useAcaoHeader";
import { useAcaoHeaderStore } from "../stores/acaoHeaderStore";

function Pagina({ acao }: { acao: Parameters<typeof useAcaoHeader>[0] }) {
  useAcaoHeader(acao);
  return null;
}

describe("useAcaoHeader", () => {
  test("regista a ação enquanto a página está montada e limpa-a ao sair", () => {
    const { unmount } = render(<Pagina acao={{ rotulo: "Adicionar evento", onClick: () => {} }} />);
    expect(useAcaoHeaderStore.getState().acao?.rotulo).toBe("Adicionar evento");
    unmount();
    expect(useAcaoHeaderStore.getState().acao).toBeNull();
  });

  test("passar null é o mesmo que não ter botão — para as abas internas sem nada a adicionar", () => {
    const { rerender } = render(<Pagina acao={{ rotulo: "Adicionar despesa fixa" }} />);
    expect(useAcaoHeaderStore.getState().acao).not.toBeNull();
    rerender(<Pagina acao={null} />);
    expect(useAcaoHeaderStore.getState().acao).toBeNull();
  });

  test("o clique usa o handler do render mais recente, não o do primeiro", () => {
    let visto: number | null = null;
    function Contador() {
      const [n, setN] = useState(0);
      useAcaoHeader({ rotulo: "Adicionar", onClick: () => (visto = n) });
      return <button onClick={() => setN(n + 1)}>somar</button>;
    }
    const { getByText } = render(<Contador />);
    act(() => getByText("somar").click());
    act(() => getByText("somar").click());
    act(() => useAcaoHeaderStore.getState().acao?.onClick?.());
    expect(visto).toBe(2);
  });

  test("a página que sai não apaga a ação da página que entra", () => {
    // Numa navegação, a limpeza da tela antiga e o registo da nova acontecem
    // no mesmo instante. Sem o dono guardado na store, a limpeza chegava
    // depois e o header ficava sem "+" na tela nova.
    const antiga = render(<Pagina acao={{ rotulo: "Adicionar evento" }} />);
    const nova = render(<Pagina acao={{ rotulo: "Adicionar fundo" }} />);
    antiga.unmount();
    expect(useAcaoHeaderStore.getState().acao?.rotulo).toBe("Adicionar fundo");
    nova.unmount();
  });

  test("com várias opções, o header recebe o menu em vez de um clique só", () => {
    const Icone = (() => null) as never;
    render(
      <Pagina
        acao={{
          rotulo: "Adicionar no veículo",
          acoes: [
            { rotulo: "Abastecimento", Icone, onClick: () => {} },
            { rotulo: "Quilometragem", Icone, onClick: () => {} },
          ],
        }}
      />,
    );
    expect(useAcaoHeaderStore.getState().acao?.acoes?.map((a) => a.rotulo)).toEqual([
      "Abastecimento",
      "Quilometragem",
    ]);
  });
});

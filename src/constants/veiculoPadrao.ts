import type { DadosVeiculo, TipoVeiculo } from "../types";

// Extraído de veiculoService.ts (mesmo motivo de tvdePadrao.ts): quebra o
// ciclo stores/veiculoStore.ts → services/veiculoService.ts → ... →
// stores/veiculoStore.ts. veiculoService.ts continua a exportá-la.

export const VEICULO_VAZIO: DadosVeiculo = {
  cargas: [],
  despesas: [],
  despesasFixas: [],
  quilometragem: [],
};

/** As 3 motorizações (item B1) e como se chamam na tela. Fonte única: a folha
 *  de Definições que as escolhe e a página Veículo que só as lê têm de dizer
 *  o mesmo nome. */
export const TIPOS_VEICULO: { valor: TipoVeiculo; rotulo: string }[] = [
  { valor: "eletrico", rotulo: "Elétrico" },
  { valor: "combustao", rotulo: "Combustão" },
  { valor: "hibrido", rotulo: "Híbrido" },
];

export function rotuloTipoVeiculo(tipo: TipoVeiculo): string {
  return TIPOS_VEICULO.find((t) => t.valor === tipo)?.rotulo ?? tipo;
}

// Formas de estado reutilizadas pelos testes de página.
//
// Cada teste continua a declarar os seus próprios `vi.mock` — são içados e não
// se partilham entre ficheiros. O que se partilha é a FORMA do estado, que é
// onde a repetição estava: toda a store de lista tem `itens`/`carregado`/`erro`,
// e escrever isso à mão trinta vezes é onde alguém troca um `carregado: false`
// por engano e passa uma hora a perceber porque é que a tela está vazia.

import type { DadosVeiculo } from "../types";

/** Store de lista: carregada e sem erro, que é o caso normal. */
export const lista = <T>(itens: T[] = []) => ({ itens, carregado: true, erro: false });

/** A mesma, mas com a subscrição caída — os itens que já lá estavam continuam. */
export const listaComErro = <T>(itens: T[] = []) => ({ itens, carregado: true, erro: true });

/** Ainda a carregar: sem itens e sem erro. É o estado que não pode ser
 *  confundido com "não há nada". */
export const listaCarregando = <T>() => ({ itens: [] as T[], carregado: false, erro: false });

/** O veículo não é uma lista — é um objecto com quatro coleções lá dentro. */
export const veiculoVazio = () => ({
  dados: {
    cargas: [],
    despesas: [],
    despesasFixas: [],
    quilometragem: [],
  } as unknown as DadosVeiculo,
  carregado: true,
  erro: false,
});

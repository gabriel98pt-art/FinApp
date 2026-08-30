import { useState, type FormEvent } from "react";
import { Pencil, Shapes, Palette, X } from "lucide-react";
import BottomSheet from "../../components/BottomSheet";
import CategoriaBolha from "../../components/CategoriaBolha";
import RenomearFolha from "../../components/RenomearFolha";
import SeletorCor from "../../components/SeletorCor";
import SeletorIcone from "../../components/SeletorIcone";
import { CORES_FONTE_RECEITA } from "../../constants/aparenciaCategoria";
import {
  adicionarItemLista,
  definirCorCategoria,
  definirIconeCategoria,
  removerItemLista,
  renomearCategoria,
  renomearFonte,
} from "../../services/cfgService";
import { useConfirmar } from "../../hooks/useConfirmar";
import { mostrarToast } from "../../stores/toastStore";
import { mensagemDeErroDados } from "../../utils/erroDados";
import { corDaCategoriaVisual } from "../../utils/categoriaVisual";
import type { ConfigConta } from "../../types";
import styles from "../Definicoes.module.css";

/** Lista editável de categorias de despesa, categorias do veículo OU fontes
 *  de receita — o mesmo editor serve as três (item 19: ícone, cor, renomear,
 *  remover).
 *
 *  Extraído de Definicoes.tsx sem mudar nada do comportamento — só o
 *  wrapper, que passa de `<div className={grupo}>` pra esta BottomSheet.
 *  SeletorIcone/SeletorCor abrem sempre um nível acima desta folha, pelo
 *  mesmo motivo do Copiloto: abrem de dentro dela, não da página. */
export default function FolhaCategorias({
  titulo,
  itens,
  lista,
  cfg,
  uid,
  aberta,
  nivel = 0,
  aoFechar,
}: {
  titulo: string;
  itens: string[];
  lista: "categoriasDespesa" | "categoriasVeiculo" | "fontesReceita";
  cfg: ConfigConta;
  uid: string;
  aberta: boolean;
  /** 0 quando aberta do índice de Definições (o caso das duas listas gerais);
   *  1 quando aberta de dentro de outra folha, como a do Veículo. */
  nivel?: number;
  aoFechar: () => void;
}) {
  const [novo, setNovo] = useState("");
  const confirmar = useConfirmar();
  // Categoria cujo ícone/cor está sendo escolhido agora (item 19).
  const [iconeDe, setIconeDe] = useState<string | null>(null);
  const [corDe, setCorDe] = useState<string | null>(null);
  const [renomeando, setRenomeando] = useState<string | null>(null);

  async function renomear(nomeNovo: string) {
    if (!renomeando) return;
    const alvo = renomeando;
    try {
      if (lista === "fontesReceita") await renomearFonte(uid, cfg, alvo, nomeNovo);
      else await renomearCategoria(uid, cfg, lista, alvo, nomeNovo);
      setRenomeando(null);
      mostrarToast(`✓ Agora chama-se "${nomeNovo.trim()}"`);
    } catch (err) {
      mostrarToast(mensagemDeErroDados(err, "Não foi possível renomear."));
    }
  }

  async function escolherIcone(icone: string | null) {
    if (!iconeDe) return;
    const alvo = iconeDe;
    setIconeDe(null);
    try {
      await definirIconeCategoria(uid, alvo, icone);
    } catch {
      mostrarToast("Não foi possível salvar o ícone.");
    }
  }

  async function escolherCor(cor: string | null) {
    if (!corDe) return;
    const alvo = corDe;
    setCorDe(null);
    try {
      await definirCorCategoria(uid, alvo, cor);
    } catch {
      mostrarToast("Não foi possível salvar a cor.");
    }
  }

  async function adicionar(e: FormEvent) {
    e.preventDefault();
    const nome = novo.trim();
    if (!nome) return mostrarToast("Escreva um nome primeiro.");
    try {
      await adicionarItemLista(uid, cfg, lista, nome);
      mostrarToast(`✓ "${nome}" adicionado`);
      setNovo("");
    } catch (err) {
      mostrarToast(mensagemDeErroDados(err, "Não foi possível adicionar."));
    }
  }

  async function remover(item: string) {
    if (!(await confirmar(`Remover "${item}"? Lançamentos que já usam esse nome não mudam.`)))
      return;
    try {
      await removerItemLista(uid, cfg, lista, item);
      mostrarToast(`"${item}" removido`);
    } catch {
      mostrarToast("Não foi possível remover.");
    }
  }

  // "Veículo" é o resumo dos 4 domínios do módulo (cargas, despesas, fixas,
  // km) — não é um item de `cfg.categoriasDespesa`, então nunca podia ser
  // renomeado nem removido daqui. Mas ele aparece como fatia própria no
  // donut de despesas, com cor guardada no mesmo `cfg.categoriaCor` — só a
  // cor entra aqui, como "categoria normal" pedido pelo Gabriel, e só
  // quando o módulo está ligado (desligado, a fatia nem aparece em lado
  // nenhum).
  const mostrarVeiculo = lista === "categoriasDespesa" && cfg.showVeiculo;

  // Cores que já pertencem a OUTRA categoria desta mesma lista — pra
  // avisar no seletor (item 26/08) sem impedir de repetir de propósito.
  // "Outra" é só dentro da lista sendo editada: são elas que aparecem juntas
  // no mesmo donut/legenda, então é aí que uma repetição confunde de verdade.
  const coresEmUso = corDe
    ? [
        ...itens.filter((i) => i !== corDe).map((i) => corDaCategoriaVisual(cfg, i)),
        ...(mostrarVeiculo && corDe !== "Veículo" ? [corDaCategoriaVisual(cfg, "Veículo")] : []),
      ]
    : [];

  return (
    <BottomSheet aberta={aberta} aoFechar={aoFechar} titulo={titulo} nivel={nivel}>
      {(itens.length > 0 || mostrarVeiculo) && (
        <ul className={styles.listaCategorias}>
          {itens.map((item) => (
            <li key={item} className={styles.linhaCategoria}>
              <CategoriaBolha categoria={item} />
              <span className={styles.nomeCategoria}>{item}</span>
              <button
                className={styles.acaoCategoria}
                onClick={() => setIconeDe(item)}
                aria-label={`Ícone de ${item}`}
                title="Ícone"
              >
                <Shapes size={16} aria-hidden />
              </button>
              <button
                className={styles.acaoCategoria}
                onClick={() => setCorDe(item)}
                aria-label={`Cor de ${item}`}
                title="Cor"
              >
                <Palette size={16} aria-hidden />
              </button>
              <button
                className={styles.acaoCategoria}
                onClick={() => setRenomeando(item)}
                aria-label={`Renomear ${item}`}
                title="Renomear"
              >
                <Pencil size={16} aria-hidden />
              </button>
              <button
                className={`${styles.acaoCategoria} ${styles.acaoRemover}`}
                onClick={() => void remover(item)}
                aria-label={`Remover ${item}`}
                title="Remover"
              >
                <X size={16} aria-hidden />
              </button>
            </li>
          ))}
          {mostrarVeiculo && (
            <li className={styles.linhaCategoria}>
              <CategoriaBolha categoria="Veículo" />
              <span className={styles.nomeCategoria}>Veículo</span>
              <button
                className={styles.acaoCategoria}
                onClick={() => setCorDe("Veículo")}
                aria-label="Cor de Veículo"
                title="Cor"
              >
                <Palette size={16} aria-hidden />
              </button>
            </li>
          )}
        </ul>
      )}
      <form className={styles.linhaAdicionar} onSubmit={adicionar}>
        <input
          className={styles.inputPequeno}
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          placeholder="Nova categoria…"
          aria-label={`Adicionar em ${titulo}`}
        />
        <button type="submit" className={styles.botaoPequeno}>
          Adicionar
        </button>
      </form>

      <SeletorIcone
        aberta={iconeDe !== null}
        aoFechar={() => setIconeDe(null)}
        titulo={iconeDe ? `Ícone de ${iconeDe}` : "Ícone"}
        valor={iconeDe ? (cfg.categoriaIcone?.[iconeDe] ?? "") : ""}
        aoEscolher={(i) => void escolherIcone(i)}
        nivel={nivel + 1}
      />
      <SeletorCor
        aberta={corDe !== null}
        aoFechar={() => setCorDe(null)}
        titulo={corDe ? `Cor de ${corDe}` : "Cor"}
        // A cor RESOLVIDA (escolha manual → semântica do nome → paleta por
        // hash), não só `cfg.categoriaCor[corDe]` cru — a maioria das
        // categorias nunca teve uma cor escolhida à mão, e mesmo assim
        // mostram uma cor em todo canto do app. Sem isto, abrir o seletor
        // de uma categoria "automática" não marcava opção nenhuma como
        // selecionada, mesmo já tendo uma cor bem definida.
        valor={corDe ? corDaCategoriaVisual(cfg, corDe) : ""}
        coresEmUso={coresEmUso}
        // Item 6 do lote de UX/nav (30/08): só a lista de fontes de receita
        // ganha o verde de volta na grade — despesa e veículo continuam sem
        // ele, a regra "verde é de receita" não muda.
        cores={lista === "fontesReceita" ? CORES_FONTE_RECEITA : undefined}
        aoEscolher={(c) => void escolherCor(c)}
        nivel={nivel + 1}
      />
      <RenomearFolha
        aberta={renomeando !== null}
        nomeAtual={renomeando}
        aoFechar={() => setRenomeando(null)}
        aoConfirmar={(n) => void renomear(n)}
        nivel={nivel + 1}
        aviso={
          // As categorias do veículo não entram no orçamento por categoria —
          // prometer que ele segue o nome novo seria mentira aqui.
          lista === "categoriasVeiculo"
            ? "As despesas do veículo e o ícone/cor seguem para o nome novo."
            : "Lançamentos, orçamento e o ícone/cor seguem para o nome novo."
        }
      />
    </BottomSheet>
  );
}

import { useRef, useState } from "react";
import { Settings, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Avatar from "../components/Avatar";
import MenuAcoesItem, { type AcaoItem } from "../components/MenuAcoesItem";
import FolhaConta from "../pages/conta/FolhaConta";
import { useAuthStore } from "../stores/authStore";
import { useCfgStore } from "../stores/cfgStore";
import styles from "./BotaoPerfil.module.css";

/** O botão do perfil, no topo à esquerda: a foto da pessoa (ou as iniciais) e um
 *  menu pequeno com «Minha conta» e «Definições». É a única porta para as
 *  Definições — saíram da barra lateral e do menu «Mais». */
export default function BotaoPerfil() {
  const navegar = useNavigate();
  const email = useAuthStore((s) => s.sessao?.email);
  const nome = useCfgStore((s) => s.cfg.nome);
  const foto = useCfgStore((s) => s.cfg.foto);
  const [menu, setMenu] = useState(false);
  const [conta, setConta] = useState(false);
  const ancora = useRef<HTMLButtonElement>(null);

  const acoes: AcaoItem[] = [
    { rotulo: "Minha conta", Icone: UserRound, onClick: () => setConta(true) },
    { rotulo: "Definições", Icone: Settings, onClick: () => navegar("/definicoes") },
  ];

  return (
    <>
      <button
        ref={ancora}
        type="button"
        className={styles.botao}
        onClick={() => setMenu(!menu)}
        aria-haspopup="dialog"
        aria-expanded={menu}
        aria-label={nome ? `Perfil de ${nome}` : "Perfil"}
      >
        <Avatar foto={foto} nome={nome} email={email} tamanho={32} />
      </button>
      <MenuAcoesItem
        aberta={menu}
        aoFechar={() => setMenu(false)}
        titulo="Perfil"
        ancoraRef={ancora}
        acoes={acoes}
      />
      <FolhaConta aberta={conta} aoFechar={() => setConta(false)} />
    </>
  );
}

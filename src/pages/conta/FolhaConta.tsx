import { useRef, useState, type FormEvent } from "react";
import { Camera, KeyRound, LogOut } from "lucide-react";
import Avatar from "../../components/Avatar";
import BottomSheet from "../../components/BottomSheet";
import Botao from "../../components/Botao";
import { sair } from "../../services/authService";
import { atualizarConfig } from "../../services/cfgService";
import { useAuthStore } from "../../stores/authStore";
import { useCfgStore } from "../../stores/cfgStore";
import { mostrarToast } from "../../stores/toastStore";
import { reduzirImagem } from "../../utils/imagem";
import { NOME_MAX, nomeLimpo } from "../../utils/perfil";
import FolhaSenha from "../definicoes/FolhaSenha";
import ApagarConta from "./ApagarConta";
import styles from "./FolhaConta.module.css";

/** «Minha conta»: foto, nome (opcional), e-mail (só leitura) e o que era a
 *  secção «Conta» de Definições — trocar senha, sair e apagar a conta. */
export default function FolhaConta({
  aberta,
  aoFechar,
}: {
  aberta: boolean;
  aoFechar: () => void;
}) {
  const sessao = useAuthStore((s) => s.sessao);
  const nomeGuardado = useCfgStore((s) => s.cfg.nome);
  const foto = useCfgStore((s) => s.cfg.foto);
  const uid = sessao?.uid;
  const [nome, setNome] = useState(nomeGuardado);
  const [guardando, setGuardando] = useState(false);
  const [aProcessar, setAProcessar] = useState(false);
  const [senhaAberta, setSenhaAberta] = useState(false);
  const inputFoto = useRef<HTMLInputElement>(null);

  // Cada abertura recomeça com o nome que está guardado (ajuste durante o
  // render, como na BottomSheet — num efeito seria uma renderização a mais).
  const [eraAberta, setEraAberta] = useState(aberta);
  if (eraAberta !== aberta) {
    setEraAberta(aberta);
    if (aberta) setNome(nomeGuardado);
  }

  async function aoEscolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const ficheiro = e.target.files?.[0];
    e.target.value = ""; // permite escolher o mesmo ficheiro outra vez
    if (!ficheiro || !uid) return;
    setAProcessar(true);
    try {
      const url = await reduzirImagem(ficheiro);
      await atualizarConfig(uid, { foto: url });
      mostrarToast("✓ Foto guardada");
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : "Não foi possível guardar a foto.");
    } finally {
      setAProcessar(false);
    }
  }

  async function removerFoto() {
    if (!uid) return;
    try {
      await atualizarConfig(uid, { foto: "" });
      mostrarToast("✓ Foto removida");
    } catch {
      mostrarToast("Não foi possível remover a foto.");
    }
  }

  async function guardarNome(e: FormEvent) {
    e.preventDefault();
    if (!uid || guardando) return;
    setGuardando(true);
    try {
      const limpo = nomeLimpo(nome);
      await atualizarConfig(uid, { nome: limpo });
      setNome(limpo);
      mostrarToast("✓ Nome guardado");
    } catch {
      mostrarToast("Não foi possível guardar o nome.");
    } finally {
      setGuardando(false);
    }
  }

  const nomeAlterado = nomeLimpo(nome) !== nomeGuardado;

  return (
    <>
      <BottomSheet aberta={aberta} aoFechar={aoFechar} titulo="Minha conta">
        <div className={styles.conteudo}>
          <div className={styles.foto}>
            <Avatar foto={foto} nome={nomeGuardado} email={sessao?.email} tamanho={72} />
            <div className={styles.fotoAcoes}>
              <Botao
                variante="secundario"
                disabled={aProcessar}
                onClick={() => inputFoto.current?.click()}
              >
                <Camera size={15} aria-hidden />
                {aProcessar ? "A processar…" : foto ? "Trocar foto" : "Escolher foto"}
              </Botao>
              {foto && (
                <Botao variante="perigo" onClick={() => void removerFoto()}>
                  Remover foto
                </Botao>
              )}
            </div>
            <input
              ref={inputFoto}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className={styles.escondido}
              onChange={(e) => void aoEscolherFoto(e)}
              aria-label="Escolher foto de perfil"
            />
          </div>

          <form className={styles.grupo} onSubmit={(e) => void guardarNome(e)}>
            <label className={styles.grupoTitulo} htmlFor="conta-nome">
              Nome (opcional)
            </label>
            <div className={styles.linha}>
              <input
                id="conta-nome"
                className={styles.input}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                maxLength={NOME_MAX}
                placeholder="Como quer ser chamado"
                autoComplete="name"
              />
              <Botao variante="secundario" type="submit" disabled={guardando || !nomeAlterado}>
                Guardar
              </Botao>
            </div>
          </form>

          <div className={styles.grupo}>
            <p className={styles.grupoTitulo}>E-mail</p>
            <p className={styles.email}>{sessao?.email ?? "—"}</p>
          </div>

          <div className={styles.acoes}>
            <Botao variante="secundario" onClick={() => setSenhaAberta(true)}>
              <KeyRound size={15} aria-hidden /> Trocar senha
            </Botao>
            <Botao variante="perigo" onClick={() => void sair()}>
              <LogOut size={15} aria-hidden /> Sair da conta
            </Botao>
          </div>

          <ApagarConta />
        </div>
      </BottomSheet>
      <FolhaSenha aberta={senhaAberta} aoFechar={() => setSenhaAberta(false)} nivel={1} />
    </>
  );
}

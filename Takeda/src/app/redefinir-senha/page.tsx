"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const MIN_SENHA = 10;

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => { if (!user) router.replace("/login?erro=link"); });
  }, [router]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (senha.length < MIN_SENHA || !/[a-zA-Z]/.test(senha) || !/\d/.test(senha))
      return setErro(`A senha precisa ter pelo menos ${MIN_SENHA} caracteres, com letras e números.`);
    if (senha !== senha2) return setErro("As senhas não conferem.");
    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password: senha });
    setBusy(false);
    if (error) return setErro(error.message);
    setOk(true);
    setTimeout(() => router.replace("/"), 1500);
  }

  return (
    <div className="center-page">
      <form className="card mfa-card" onSubmit={salvar}>
        <h2>Nova senha</h2>
        <p>Crie uma senha com pelo menos {MIN_SENHA} caracteres, com letras e números.</p>
        <input type="password" required placeholder="Nova senha" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" />
        <input type="password" required placeholder="Repita a nova senha" value={senha2} onChange={(e) => setSenha2(e.target.value)} autoComplete="new-password" />
        <button className="btn-primary" disabled={busy}>{busy ? "Salvando…" : "Salvar nova senha"}</button>
        {ok && <div className="msg ok">Senha alterada! Entrando…</div>}
        {erro && <div className="msg err">{erro}</div>}
      </form>
    </div>
  );
}

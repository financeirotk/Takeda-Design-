"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogoMark } from "@/components/Logo";

type Aba = "entrar" | "primeiro" | "esqueci";

const MIN_SENHA = 10;

function traduz(msg: string) {
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail primeiro: clique no link que enviamos.";
  if (m.includes("não autorizado") || m.includes("not authorized") || m.includes("403")) return "Este e-mail não foi convidado. Fale com a direção.";
  if (m.includes("already registered")) return "Este e-mail já tem senha. Use \"Entrar\" ou \"Esqueci minha senha\".";
  if (m.includes("rate")) return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
  if (m.includes("weak") || m.includes("password should")) return "Senha fraca. Use pelo menos 10 caracteres, com letras e números.";
  return msg;
}

export default function LoginPage() {
  const router = useRouter();
  const [aba, setAba] = useState<Aba>("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("erro") === "link")
      setErro("O link expirou ou já foi usado. Peça um novo.");
  }, []);

  function trocar(a: Aba) { setAba(a); setErro(""); setOk(""); setSenha(""); setSenha2(""); }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(""); setOk("");
    const supabase = createClient();
    const mail = email.trim().toLowerCase();
    setBusy(true);
    try {
      if (aba === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({ email: mail, password: senha });
        if (error) throw error;
        router.replace("/");
        router.refresh();
        return;
      }
      if (aba === "primeiro") {
        if (senha.length < MIN_SENHA || !/[a-zA-Z]/.test(senha) || !/\d/.test(senha))
          throw new Error(`A senha precisa ter pelo menos ${MIN_SENHA} caracteres, com letras e números.`);
        if (senha !== senha2) throw new Error("As senhas não conferem.");
        const { data, error } = await supabase.auth.signUp({
          email: mail, password: senha,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/` },
        });
        if (error) throw error;
        if (data.user && data.user.identities?.length === 0) throw new Error("already registered");
        if (data.session) { router.replace("/"); router.refresh(); return; }
        setOk("Conta criada! Enviamos um e-mail de confirmação. Clique no link para ativar sua conta.");
        return;
      }
      const { error } = await supabase.auth.resetPasswordForEmail(mail, {
        redirectTo: `${window.location.origin}/auth/callback?next=/redefinir-senha`,
      });
      if (error) throw error;
      setOk("Se este e-mail estiver cadastrado, você vai receber um link para criar uma nova senha.");
    } catch (err) {
      setErro(traduz((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <aside className="login-side">
        <div className="brand" style={{ display: "flex", alignItems: "center", gap: 12, letterSpacing: ".16em", fontWeight: 700 }}>
          <LogoMark size={34} /> TAKEDA DESIGN
        </div>
        <div>
          <h1>Intranet</h1>
          <p style={{ opacity: 0.85, marginTop: 8 }}>Painéis de gestão · Beta</p>
        </div>
        <small style={{ opacity: 0.7 }}>Acesso restrito a convidados</small>
      </aside>
      <main className="login-form-wrap">
        <form className="login-form" onSubmit={onSubmit}>
          <div className="tabs">
            <button type="button" className={aba === "entrar" ? "on" : ""} onClick={() => trocar("entrar")}>Entrar</button>
            <button type="button" className={aba === "primeiro" ? "on" : ""} onClick={() => trocar("primeiro")}>Primeiro acesso</button>
          </div>

          {aba === "entrar" && <p>Entre com seu e-mail e senha.</p>}
          {aba === "primeiro" && <p>Foi convidado? Crie sua senha. Só e-mails convidados conseguem se cadastrar.</p>}
          {aba === "esqueci" && <p>Informe seu e-mail para receber um link de redefinição de senha.</p>}

          <input type="email" required placeholder="seu@email.com" value={email}
            onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          {aba !== "esqueci" && (
            <input type="password" required placeholder={aba === "primeiro" ? `Crie uma senha (mín. ${MIN_SENHA} caracteres)` : "Senha"}
              value={senha} onChange={(e) => setSenha(e.target.value)}
              autoComplete={aba === "primeiro" ? "new-password" : "current-password"} />
          )}
          {aba === "primeiro" && (
            <input type="password" required placeholder="Repita a senha" value={senha2}
              onChange={(e) => setSenha2(e.target.value)} autoComplete="new-password" />
          )}

          <button className="btn-primary" disabled={busy}>
            {busy ? "Aguarde…" : aba === "entrar" ? "Entrar" : aba === "primeiro" ? "Criar senha" : "Enviar link"}
          </button>

          {aba === "entrar" && <button type="button" className="link-btn" onClick={() => trocar("esqueci")}>Esqueci minha senha</button>}
          {aba === "esqueci" && <button type="button" className="link-btn" onClick={() => trocar("entrar")}>Voltar para entrar</button>}

          {ok && <div className="msg ok">{ok}</div>}
          {erro && <div className="msg err">{erro}</div>}
        </form>
      </main>
    </div>
  );
}

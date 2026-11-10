"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Acesso = {
  email: string; nome: string | null; papel: string | null; convidado_em: string | null;
  user_id: string | null; ativo: boolean; conta_criada: boolean; email_confirmado: boolean;
  dois_fatores: boolean; ultimo_login: string | null;
};

const PAPEIS: { v: string; label: string; desc: string }[] = [
  { v: "admin", label: "Admin", desc: "Vê tudo e gerencia acessos" },
  { v: "direcao", label: "Direção", desc: "Vê todos os painéis" },
  { v: "coordenador", label: "Coordenador", desc: "Ainda sem painéis no beta" },
  { v: "colaborador", label: "Colaborador", desc: "Ainda sem painéis no beta" },
];

function status(a: Acesso) {
  if (!a.convidado_em) return { t: "Desativado", c: "#a3341f", bg: "#fde8e4" };
  if (!a.conta_criada) return { t: "Convidado · aguardando primeiro acesso", c: "#7a5b00", bg: "#fbf0cf" };
  if (!a.email_confirmado) return { t: "Aguardando confirmar e-mail", c: "#7a5b00", bg: "#fbf0cf" };
  return { t: "Ativo", c: "#22663f", bg: "#dff0e3" };
}

export default function AcessosPage() {
  const [lista, setLista] = useState<Acesso[] | null>(null);
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [papel, setPapel] = useState("direcao");
  const [meuId, setMeuId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    setMeuId(user?.id ?? null);
    const { data, error } = await supabase.rpc("admin_lista_acessos");
    if (error) setErro(error.message); else setLista(data as Acesso[]);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  async function convidar(e: React.FormEvent) {
    e.preventDefault(); setErro(""); setMsg("");
    const mail = email.trim().toLowerCase();
    const { error } = await createClient().from("convites").upsert({ email: mail, nome: nome.trim() || null, papel });
    if (error) return setErro(error.message);
    setMsg(`${mail} convidado. Peça para a pessoa abrir a intranet e clicar em "Primeiro acesso".`);
    setEmail(""); setNome(""); carregar();
  }

  async function mudarPapel(a: Acesso, novo: string) {
    setErro(""); setMsg("");
    const { error } = await createClient().from("convites").upsert({ email: a.email, nome: a.nome, papel: novo });
    if (error) setErro(error.message); else carregar();
  }

  async function remover(a: Acesso) {
    if (!confirm(`Remover o acesso de ${a.nome ?? a.email}? A pessoa perde o acesso aos dados na hora.`)) return;
    const { error } = await createClient().from("convites").delete().eq("email", a.email);
    if (error) setErro(error.message); else { setMsg("Acesso removido."); carregar(); }
  }

  return (
    <>
      <div className="topbar">
        <div>
          <p className="page-kicker">Administração</p>
          <h1 className="page-title">Acessos</h1>
        </div>
      </div>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2 className="hm-title" style={{ marginBottom: 12 }}>Convidar pessoa</h2>
        <form className="invite-form" onSubmit={convidar}>
          <input type="email" required placeholder="email@takedadesign.com.br" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          <select value={papel} onChange={(e) => setPapel(e.target.value)}>
            {PAPEIS.map((p) => <option key={p.v} value={p.v}>{p.label} — {p.desc}</option>)}
          </select>
          <button className="btn-primary" style={{ width: "auto", padding: "9px 18px" }}>Convidar</button>
        </form>
        {msg && <div className="msg ok">{msg}</div>}
        {erro && <div className="msg err">{erro}</div>}
      </section>

      <section className="card">
        {!lista ? <p>Carregando…</p> : (
          <div className="hm-wrap">
            <table className="acessos">
              <thead><tr><th>Pessoa</th><th>Nível</th><th>Situação</th><th>Último login</th><th /></tr></thead>
              <tbody>
                {lista.map((a) => {
                  const s = status(a);
                  const eu = a.user_id === meuId;
                  return (
                    <tr key={a.email}>
                      <td><b>{a.nome ?? "—"}</b><br /><span style={{ color: "var(--ink-soft)" }}>{a.email}</span></td>
                      <td>
                        {a.convidado_em && !eu ? (
                          <select value={a.papel ?? ""} onChange={(e) => mudarPapel(a, e.target.value)}>
                            {PAPEIS.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
                          </select>
                        ) : (PAPEIS.find((p) => p.v === a.papel)?.label ?? "—")}
                      </td>
                      <td><span className="badge" style={{ color: s.c, background: s.bg }}>{s.t}</span></td>
                      <td>{a.ultimo_login ? new Date(a.ultimo_login).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—"}</td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        {!eu && a.convidado_em && <button className="btn-ghost danger" onClick={() => remover(a)}>Remover</button>}
                        {!eu && !a.convidado_em && <button className="btn-ghost" onClick={() => mudarPapel(a, a.papel ?? "direcao")}>Reativar</button>}
                        {eu && <span style={{ color: "var(--muted)", fontSize: 12 }}>você</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

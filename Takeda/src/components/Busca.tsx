"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { qsGlobais } from "@/lib/filtros";

type P = { id: number; name: string; status_name: string };
const norm = (s: string | null | undefined) => (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Busca rápida de projeto (Ctrl+K / ⌘K) */
export function Busca() {
  const router = useRouter();
  const sp = useSearchParams();
  const [aberto, setAberto] = useState(false);
  const [q, setQ] = useState("");
  const [lista, setLista] = useState<P[] | null>(null);
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key?.toLowerCase() === "k") { e.preventDefault(); setAberto(true); }
      if (e.key === "Escape") setAberto(false);
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, []);

  const [erro, setErro] = useState(false);
  const carregar = () => {
    setErro(false);
    createClient().from("doit_projects").select("id,name,status_name").is("deleted_at", null).not("name", "is", null).order("name", { ascending: false }).limit(3000)
      .then(({ data, error }) => { if (error) setErro(true); else setLista(((data ?? []) as P[]).filter((p) => p.name)); }, () => setErro(true));
  };

  // ao abrir: limpa e foca (só quando abre, para não apagar o que já foi digitado)
  useEffect(() => {
    if (!aberto) return;
    setQ(""); setSel(0);
    setTimeout(() => input.current?.focus(), 30);
  }, [aberto]);

  // carrega a lista uma vez (na primeira abertura)
  useEffect(() => {
    if (aberto && !lista) carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  const res = useMemo(() => {
    if (!lista) return [];
    const termos = norm(q).split(/\s+/).filter(Boolean);
    return lista.filter((p) => termos.every((t) => norm(p.name).includes(t))).slice(0, 12);
  }, [lista, q]);

  const ir = (p: P) => {
    setAberto(false);
    const g = qsGlobais(new URLSearchParams(sp.toString()));
    router.push(`/producao/visao-projeto${g ? g + "&" : "?"}id=${p.id}`);
  };

  return (
    <>
      <button className="busca-btn" onClick={() => setAberto(true)} onMouseEnter={() => { if (!lista) carregar(); }} aria-label="Buscar projeto">
        <span aria-hidden>⌕</span> <span className="busca-txt">Buscar projeto</span> <kbd>Ctrl K</kbd>
      </button>
      {aberto && (
        <div className="modal-back busca-back" onClick={() => setAberto(false)}>
          <div className="busca" onClick={(e) => e.stopPropagation()}>
            <input ref={input} placeholder="Código, cliente, cidade… (ex.: 1977, Opportunity, Recife)" value={q}
              onChange={(e) => { setQ(e.target.value); setSel(0); }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, res.length - 1)); }
                if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
                if (e.key === "Enter" && res[sel]) ir(res[sel]);
              }} />
            <ul>
              {!lista && !erro && <li className="muted">Carregando projetos…</li>}
              {erro && <li className="muted" onClick={carregar}>Não consegui carregar a lista. Clique aqui para tentar de novo.</li>}
              {lista && res.length === 0 && <li className="muted">Nenhum projeto encontrado.</li>}
              {res.map((p, i) => (
                <li key={p.id} className={i === sel ? "on" : ""} onMouseEnter={() => setSel(i)} onClick={() => ir(p)}>
                  <span>{p.name}</span><small>{p.status_name}</small>
                </li>
              ))}
            </ul>
            <div className="busca-dica">↑↓ para navegar · Enter para abrir · Esc para fechar</div>
          </div>
        </div>
      )}
    </>
  );
}

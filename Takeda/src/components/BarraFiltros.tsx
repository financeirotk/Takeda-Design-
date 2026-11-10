"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { lerFiltros } from "@/lib/filtros";
import { Info } from "./Info";

/** Barra de filtros globais: vale para todas as abas e fica gravada no link */
export function BarraFiltros({ coords }: { coords: string[] }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const f = lerFiltros(sp);
  const [aberto, setAberto] = useState(false);

  const set = (k: string, v: string | null) => {
    const p = new URLSearchParams(sp.toString());
    if (v) p.set(k, v); else p.delete(k);
    router.push(`${path}${p.toString() ? `?${p}` : ""}`);
  };

  const chips: { k: string; label: string }[] = [];
  if (f.coord) chips.push({ k: "coord", label: `Coordenador: ${f.coord}` });
  if (f.status !== "todos") chips.push({ k: "status", label: f.status });
  if (f.plat) chips.push({ k: "plat", label: `Plataforma: ${f.plat}` });
  if (f.considerar === "tudo") chips.push({ k: "considerar", label: "Incluindo ocultos" });

  return (
    <div className="gbar">
      <button className="gbar-toggle" onClick={() => setAberto((v) => !v)}>
        Filtros{chips.length ? ` (${chips.length})` : ""} <span aria-hidden>{aberto ? "▴" : "▾"}</span>
      </button>
      <div className={`gbar-campos${aberto ? " aberto" : ""}`}>
        <label className="gfield">Coordenador
          <select value={f.coord ?? ""} onChange={(e) => set("coord", e.target.value || null)}>
            <option value="">Todos</option>
            {coords.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <div className="pills" role="group" aria-label="Status">
          {([["", "Todos"], ["andamento", "Em andamento"], ["hold", "On hold"]] as const).map(([v, l]) => {
            const ativo = (v === "" && f.status === "todos") || (v === "andamento" && f.status === "Em Andamento") || (v === "hold" && f.status === "On hold");
            return <button key={l} className={`pill${ativo ? " active" : ""}`} onClick={() => set("status", v || null)}>{l}</button>;
          })}
        </div>
        <div className="pills" role="group" aria-label="Plataforma">
          {([["", "CAD + BIM"], ["cad", "CAD"], ["bim", "BIM"]] as const).map(([v, l]) => {
            const ativo = (v === "" && !f.plat) || (v !== "" && f.plat === v.toUpperCase());
            return <button key={l} className={`pill${ativo ? " active" : ""}`} onClick={() => set("plat", v || null)}>{l}</button>;
          })}
        </div>
        <label className="gfield gcheck">
          <input type="checkbox" checked={f.considerar === "tudo"} onChange={(e) => set("considerar", e.target.checked ? "tudo" : null)} />
          Incluir projetos ocultos
          <Info texto="No DOit, cada projeto tem o campo “Considerar no Dashboard”. Os marcados como “Não” ficam fora dos painéis (igual ao Tableau). Marque aqui para incluir esses projetos também." />
        </label>
      </div>
      {chips.length > 0 && (
        <div className="chips-ativos">
          {chips.map((c) => (
            <button key={c.k} className="chip-x" onClick={() => set(c.k, null)} title="Remover filtro">{c.label} <b>×</b></button>
          ))}
          {chips.length > 1 && <button className="link-btn" style={{ margin: 0 }} onClick={() => router.push(path)}>limpar tudo</button>}
        </div>
      )}
    </div>
  );
}

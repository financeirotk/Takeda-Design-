"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { lerFiltros, qsGlobais } from "@/lib/filtros";

type P = { id: number; name: string; status_name: string; coordenador: string | null; considerar_dashboard: boolean | null; plataforma: string | null };
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Seletor de projeto: respeita os filtros globais (coordenador, status, considerar) */
export function ProjetoPicker({ projetos, atual }: { projetos: P[]; atual: number }) {
  const router = useRouter();
  const sp = useSearchParams();
  const f = lerFiltros(sp);
  const [busca, setBusca] = useState("");
  const lista = useMemo(() => projetos.filter((p) => p.id === atual || (
    (f.status === "todos" ? ["Em Andamento", "On hold"].includes(p.status_name) : p.status_name === f.status) &&
    (f.considerar === "tudo" || p.considerar_dashboard !== false) &&
    (!f.coord || (p.coordenador ?? "(sem coordenador)") === f.coord) &&
    (!f.plat || (p.plataforma ?? "").toUpperCase() === f.plat) &&
    (!busca || norm(p.name).includes(norm(busca))))), [projetos, f.status, f.considerar, f.coord, f.plat, busca, atual]);
  const g = qsGlobais(new URLSearchParams(sp.toString()));

  return (
    <div className="filters">
      <div className="field"><label>Filtrar lista</label>
        <input className="search" style={{ width: 170, minWidth: 0 }} placeholder="nome, cidade, código…" value={busca} onChange={(e) => setBusca(e.target.value)} /></div>
      <div className="field"><label>Projeto ({lista.length})</label>
        <select style={{ maxWidth: 340 }} value={atual} onChange={(e) => router.push(`/producao/visao-projeto${g ? g + "&" : "?"}id=${e.target.value}`)}>
          {lista.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select></div>
    </div>
  );
}

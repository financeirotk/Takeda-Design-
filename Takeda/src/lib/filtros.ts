// Filtros globais da intranet (ficam no link e valem para todas as abas)
export type Filtros = { coord: string | null; status: "todos" | "Em Andamento" | "On hold"; considerar: "sim" | "tudo"; plat: "CAD" | "BIM" | null };
export const CHAVES_GLOBAIS = ["coord", "status", "considerar", "plat"] as const;

type SPLike = { get(k: string): string | null };

export function lerFiltros(sp: SPLike | Record<string, string | undefined>): Filtros {
  const g = (k: string) => (typeof (sp as SPLike).get === "function" ? (sp as SPLike).get(k) : (sp as Record<string, string | undefined>)[k] ?? null);
  const st = g("status");
  return {
    coord: g("coord") || null,
    status: st === "andamento" ? "Em Andamento" : st === "hold" ? "On hold" : "todos",
    considerar: g("considerar") === "tudo" ? "tudo" : "sim",
    plat: g("plat") === "cad" ? "CAD" : g("plat") === "bim" ? "BIM" : null,
  };
}

export function passaFiltros<T extends { status_name: string; considerar_dashboard?: boolean | null; coordenador?: string | null; plataforma?: string | null }>(p: T, f: Filtros) {
  if (f.status !== "todos" && p.status_name !== f.status) return false;
  if (f.considerar === "sim" && p.considerar_dashboard === false) return false;
  if (f.coord && (p.coordenador ?? "(sem coordenador)") !== f.coord) return false;
  if (f.plat && (p.plataforma ?? "").toUpperCase() !== f.plat) return false;
  return true;
}

/** só o filtro de plataforma (CAD/BIM) */
export function passaPlat(p: { plataforma?: string | null }, f: Filtros) {
  return !f.plat || (p.plataforma ?? "").toUpperCase() === f.plat;
}

/** query string só com os filtros globais (para manter ao trocar de aba) */
export function qsGlobais(sp: URLSearchParams) {
  const q = new URLSearchParams();
  for (const k of CHAVES_GLOBAIS) { const v = sp.get(k); if (v) q.set(k, v); }
  const s = q.toString();
  return s ? `?${s}` : "";
}

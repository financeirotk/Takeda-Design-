// Gráficos leves em HTML/SVG (sem biblioteca), no visual dos painéis Takeda.
import { fmtH } from "@/lib/periodo";

export const FASE_CORES: Record<string, string> = {
  "EP1 - Estudo Preliminar 1": "#f2a1b4",
  "EP2 - Estudo Preliminar 2": "#a9805f",
  "AP - Anteprojeto": "#b07aa1",
  "Pré-Executivo": "#e9c46a",
  "EX - Projeto Executivo": "#3e6fa3",
  "LO - Liberado para Obra": "#e15759",
};
export const FASE_ORDEM = Object.keys(FASE_CORES);
const PALETA = ["#3e6fa3", "#59a14f", "#e9c46a", "#e15759", "#b07aa1", "#a9805f", "#f2a1b4", "#76b7b2", "#9c9c9c"];
export const cor = (i: number) => PALETA[i % PALETA.length];
export const corFase = (f: string | null | undefined) => (f && FASE_CORES[f]) || "#c9c9c9";

export const fmtN = (v: number | null | undefined, casas = 0) =>
  v == null || Number.isNaN(v) ? "—" : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
export const fmtR = (v: number | null | undefined) =>
  v == null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export type Delta = { atual: number; anterior: number | null | undefined; rotulo: string; melhor?: "sobe" | "desce" | "neutro" };

export function Spark({ valores, cor: c = "#3e6fa3", w = 110, h = 28 }: { valores: number[]; cor?: string; w?: number; h?: number }) {
  if (valores.length < 2) return null;
  const max = Math.max(...valores, 1), min = Math.min(...valores, 0);
  const pts = valores.map((v, i) => `${(i / (valores.length - 1)) * w},${h - 3 - ((v - min) / (max - min || 1)) * (h - 6)}`);
  const ult = pts[pts.length - 1].split(",");
  return (
    <svg width={w} height={h} className="spark" aria-hidden>
      <polyline points={pts.join(" ")} fill="none" stroke={c} strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx={ult[0]} cy={ult[1]} r="2.6" fill={c} />
    </svg>
  );
}

export function DeltaTag({ d }: { d: Delta }) {
  if (d.anterior == null) return <span className="delta neutro">sem histórico ainda</span>;
  const diff = d.atual - d.anterior;
  const pct = d.anterior ? (diff / d.anterior) * 100 : null;
  const sobe = diff > 0, igual = Math.abs(diff) < 1e-9;
  const bom = d.melhor === "neutro" || igual ? "neutro" : (sobe === (d.melhor !== "desce")) ? "bom" : "ruim";
  return (
    <span className={`delta ${bom}`} title={`antes: ${fmtN(d.anterior)}`}>
      {igual ? "=" : sobe ? "▲" : "▼"} {pct == null ? fmtN(Math.abs(diff)) : `${fmtN(Math.abs(pct), Math.abs(pct) < 10 ? 1 : 0)}%`} {d.rotulo}
    </span>
  );
}

export function Kpi({ valor, rotulo, sub, destaque, info, delta, spark, onClick }: {
  valor: React.ReactNode; rotulo: string; sub?: React.ReactNode; destaque?: string;
  info?: React.ReactNode; delta?: Delta; spark?: number[]; onClick?: () => void;
}) {
  return (
    <div className={`card kpi${onClick ? " kpi-click" : ""}`} onClick={onClick} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter") onClick(); } : undefined}>
      <div className="kpi-v" style={destaque ? { color: destaque } : undefined}>{valor}</div>
      <div className="kpi-l">{rotulo} {info}</div>
      {delta && <DeltaTag d={delta} />}
      {spark && <Spark valores={spark} />}
      {sub && <div className="kpi-s">{sub}</div>}
    </div>
  );
}

export function Donut({ pct, centro, rotulo, cor: c = "#2f5d8a", trilha = "#e4e4e4", size = 150 }:
  { pct: number; centro: React.ReactNode; rotulo?: string; cor?: string; trilha?: string; size?: number }) {
  const r = 42, circ = 2 * Math.PI * r, p = Math.max(0, Math.min(1, pct));
  return (
    <div className="donut" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <circle cx="50" cy="50" r={r} fill="none" stroke={trilha} strokeWidth="9" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={c} strokeWidth="9" strokeLinecap="butt"
          strokeDasharray={`${circ * p} ${circ}`} transform="rotate(-90 50 50)" />
      </svg>
      <div className="donut-c"><b>{centro}</b>{rotulo && <span>{rotulo}</span>}</div>
    </div>
  );
}

export type Seg = { k: string; v: number; c: string };

export function BarrasH({ itens, sufixo = " h", onClick, ativo }: {
  itens: { k: string; label: string; v: number; segs?: Seg[]; c?: string }[];
  sufixo?: string; onClick?: (k: string) => void; ativo?: string | null;
}) {
  const max = Math.max(1, ...itens.map((i) => i.v));
  return (
    <div className="barras-h">
      {itens.map((i) => (
        <div key={i.k} className={`bh-row${onClick ? " click" : ""}${ativo && ativo !== i.k ? " dim" : ""}`}
          onClick={onClick ? () => onClick(i.k) : undefined} title={`${i.label}: ${fmtN(i.v)}${sufixo}`}>
          <span className="bh-l">{i.label}</span>
          <span className="bh-track">
            <span className="bh-bar" style={{ width: `${(i.v / max) * 100}%` }}>
              {i.segs ? i.segs.filter((s) => s.v > 0).map((s) => (
                <span key={s.k} title={`${s.k}: ${fmtN(s.v)}${sufixo}`} style={{ flex: s.v, background: s.c }} />
              )) : <span style={{ flex: 1, background: i.c ?? "#3e6fa3" }} />}
            </span>
            <span className="bh-v">{fmtN(i.v)}{sufixo}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

export function BarrasV({ itens, sufixo = " h", altura = 150 }: { itens: { k: string; label: string; v: number; c?: string; segs?: Seg[] }[]; sufixo?: string; altura?: number }) {
  const max = Math.max(1, ...itens.map((i) => i.v));
  return (
    <div className="barras-v" style={{ height: altura + 40 }}>
      {itens.map((i) => (
        <div key={i.k} className="bv-col" title={`${i.label}: ${fmtN(i.v)}${sufixo}`}>
          <span className="bv-v">{fmtN(i.v)}{sufixo}</span>
          <span className="bv-bar" style={{ height: `${(i.v / max) * altura}px`, background: i.segs ? "transparent" : i.c ?? "#e9c46a", display: "flex", flexDirection: "column-reverse", overflow: "hidden" }}>
            {i.segs?.filter((x) => x.v > 0).map((x) => <span key={x.k} title={`${x.k}: ${fmtN(x.v)}${sufixo}`} style={{ flex: x.v, background: x.c }} />)}
          </span>
          <span className="bv-l">{i.label}</span>
        </div>
      ))}
    </div>
  );
}

export function Legenda({ itens }: { itens: { k: string; c: string }[] }) {
  return (
    <div className="legend" style={{ marginTop: 8 }}>
      {itens.map((i) => <span key={i.k}><i style={{ background: i.c }} />{i.k}</span>)}
    </div>
  );
}

export function Gantt({ itens }: { itens: { k: string; inicio: string; fim: string; horas: number; c: string }[] }) {
  if (!itens.length) return <div className="empty">Sem lançamentos com etapa.</div>;
  const t = (s: string) => new Date(s + "T12:00:00").getTime();
  const min = Math.min(...itens.map((i) => t(i.inicio)));
  const max = Math.max(...itens.map((i) => t(i.fim)), Date.now());
  const span = Math.max(1, max - min);
  const hoje = ((Date.now() - min) / span) * 100;
  const fmt = (ms: number) => new Date(ms).toLocaleDateString("pt-BR", { month: "2-digit", year: "2-digit" });
  const ticks = Array.from({ length: 5 }, (_, i) => min + (span * i) / 4);
  return (
    <div className="gantt">
      <div className="g-axis"><span />{<div className="g-ticks">{ticks.map((x) => <span key={x}>{fmt(x)}</span>)}</div>}</div>
      {itens.map((i) => {
        const l = ((t(i.inicio) - min) / span) * 100;
        const w = Math.max(0.8, ((t(i.fim) - t(i.inicio)) / span) * 100);
        const dias = Math.round((t(i.fim) - t(i.inicio)) / 86400000) + 1;
        return (
          <div key={i.k} className="g-row">
            <span className="g-l" title={i.k}>{i.k}</span>
            <span className="g-track">
              <span className="g-bar" style={{ left: `${l}%`, width: `${w}%`, background: i.c }} />
              <span className="g-txt" style={{ left: `calc(${Math.min(l + w, 82)}% + 6px)` }}>{dias}d | {fmtH(i.horas, 0)}h</span>
              <span className="g-hoje" style={{ left: `${hoje}%` }} />
            </span>
          </div>
        );
      })}
    </div>
  );
}

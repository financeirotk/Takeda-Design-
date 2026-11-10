"use client";

// Mapa do Brasil por estado, interativo (hover = detalhes, clique = fixa o estado).
// Geometria: @svg-maps/brazil (CC BY 4.0, https://github.com/VictorCazanave/svg-maps)
import { useMemo, useRef, useState } from "react";
import brazilRaw from "@svg-maps/brazil";
import { fmtN } from "@/components/charts";

type Loc = { id: string; name: string; path: string };
const brazil = brazilRaw as unknown as { viewBox: string; locations: Loc[] };

export type DadosUF = {
  uf: string;
  total: number;
  andamento: number;
  hold: number;
  concluido?: number;
  area: number;
  porCoord: [string, number][];
  porPadrao: [string, number][];
  porFase: [string, number][];
  projetos: { id: number; name: string; status: string }[];
};

const REGIAO: Record<string, string> = {
  AC: "Norte", AM: "Norte", AP: "Norte", PA: "Norte", RO: "Norte", RR: "Norte", TO: "Norte",
  AL: "Nordeste", BA: "Nordeste", CE: "Nordeste", MA: "Nordeste", PB: "Nordeste", PE: "Nordeste", PI: "Nordeste", RN: "Nordeste", SE: "Nordeste",
  DF: "Centro-Oeste", GO: "Centro-Oeste", MT: "Centro-Oeste", MS: "Centro-Oeste",
  ES: "Sudeste", MG: "Sudeste", RJ: "Sudeste", SP: "Sudeste",
  PR: "Sul", RS: "Sul", SC: "Sul",
};

// escala sequencial (azul Takeda), 0 = cinza claro
function corEscala(v: number, max: number) {
  if (!v) return "#ececec";
  const t = Math.sqrt(v / Math.max(max, 1));
  const a = [214, 228, 242], b = [31, 53, 80];
  const c = a.map((x, i) => Math.round(x + (b[i] - x) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export function MapaBrasil({ dados, onSelect }: { dados: Map<string, DadosUF>; onSelect?: (uf: string | null) => void }) {
  const [hover, setHover] = useState<string | null>(null);
  const [fixo, setFixo] = useState<string | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const max = useMemo(() => Math.max(1, ...[...dados.values()].map((d) => d.total)), [dados]);

  const ativo = hover ?? fixo;
  const info = ativo ? dados.get(ativo) : null;
  const nomeUF = (uf: string) => brazil.locations.find((l) => l.id.toUpperCase() === uf)?.name ?? uf;

  const porRegiao = useMemo(() => {
    const m = new Map<string, { n: number; ufs: [string, number][] }>();
    for (const d of dados.values()) {
      const r = REGIAO[d.uf] ?? "?"; const x = m.get(r) ?? { n: 0, ufs: [] };
      x.n += d.total; x.ufs.push([d.uf, d.total]); m.set(r, x);
    }
    return ["Nordeste", "Sudeste", "Sul", "Centro-Oeste", "Norte"].map((r) => {
      const x = m.get(r) ?? { n: 0, ufs: [] };
      return { r, n: x.n, ufs: x.ufs.sort((a, b) => b[1] - a[1]) };
    });
  }, [dados]);
  const maxReg = Math.max(1, ...porRegiao.map((x) => x.n));
  const fixar = (uf: string) => { setFixo(uf); onSelect?.(uf); };

  return (
    <div className="mapa">
      <div className="mapa-svg" ref={wrap} onMouseLeave={() => { setHover(null); setPos(null); }}>
        <svg viewBox={brazil.viewBox} role="img" aria-label="Mapa do Brasil com projetos por estado">
          {brazil.locations.map((l) => {
            const uf = l.id.toUpperCase();
            const d = dados.get(uf);
            const sel = uf === fixo;
            return (
              <path key={l.id} d={l.path} fill={corEscala(d?.total ?? 0, max)}
                stroke={sel ? "#b8203a" : "#fff"} strokeWidth={sel ? 2.5 : 0.8}
                className={`uf-path${d?.total ? " tem" : ""}${ativo === uf ? " on" : ""}`}
                onMouseMove={(e) => {
                  const r = wrap.current?.getBoundingClientRect();
                  if (r) setPos({ x: e.clientX - r.left, y: e.clientY - r.top });
                  setHover(uf);
                }}
                onClick={() => { const v = fixo === uf ? null : uf; setFixo(v); onSelect?.(v); }}>
                <title>{`${l.name}: ${d?.total ?? 0} projeto(s)`}</title>
              </path>
            );
          })}
        </svg>
        {hover && pos && (
          <div className="mapa-tip" style={{ left: Math.min(pos.x + 14, (wrap.current?.clientWidth ?? 400) - 230), top: pos.y + 14 }}>
            <b>{nomeUF(hover)} ({hover})</b>
            {dados.get(hover) ? (<>
              <div>{dados.get(hover)!.total} projetos · {dados.get(hover)!.andamento} em andamento · {dados.get(hover)!.hold} on hold{dados.get(hover)!.concluido ? ` · ${dados.get(hover)!.concluido} concluídos` : ""}</div>
              <div>{fmtN(dados.get(hover)!.area)} m² de intervenção</div>
              <small>clique para ver os projetos</small>
            </>) : <div>Nenhum projeto ativo</div>}
          </div>
        )}
        <div className="mapa-legenda">
          <span>menos</span>
          {[0.05, 0.2, 0.45, 0.7, 1].map((t) => <i key={t} style={{ background: corEscala(t * max, max) }} />)}
          <span>mais projetos</span>
          <span style={{ marginLeft: "auto" }}>Mapa: svg-maps (CC BY 4.0)</span>
        </div>
      </div>

      <div className="mapa-painel">
        {info ? (
          <>
            <div className="mp-t">{nomeUF(info.uf)} <small>({info.uf} · Região {REGIAO[info.uf]})</small>
              {fixo === info.uf && <button className="btn-ghost" onClick={() => { setFixo(null); onSelect?.(null); }}>fechar</button>}</div>
            <div className="mp-kpis">
              <div><b>{info.total}</b><span>projetos</span></div>
              <div><b>{info.andamento}</b><span>em andamento</span></div>
              <div><b>{info.hold}</b><span>on hold</span></div>
              {!!info.concluido && <div><b>{info.concluido}</b><span>concluídos</span></div>}
              <div><b>{fmtN(info.area / 1000, 0)} mil</b><span>m² intervenção</span></div>
            </div>
            <Mini titulo="Por coordenador" itens={info.porCoord} />
            <Mini titulo="Por padrão" itens={info.porPadrao} />
            <Mini titulo="Por fase" itens={info.porFase} />
            {fixo === info.uf && (
              <div className="mp-lista">
                <div className="mp-sub">Projetos</div>
                <ul>{info.projetos.map((p) => (
                  <li key={p.id}><a className="proj-link" href={`/producao/visao-projeto?id=${p.id}`}>{p.name}</a>{p.status !== "Em Andamento" && <small> · {p.status}</small>}</li>
                ))}</ul>
              </div>
            )}
            {fixo !== info.uf && <div className="kpi-s" style={{ marginTop: 8 }}>Clique no estado para fixar e ver a lista de projetos.</div>}
          </>
        ) : (
          <>
            <div className="mp-t">Projetos por região</div>
            {porRegiao.map(({ r, n, ufs }) => (
              <div key={r} className="reg-bloco">
                <div className="uf-row" style={{ gridTemplateColumns: "100px 1fr 34px" }}>
                  <span className="uf">{r}</span>
                  <span className="uf-bar"><i style={{ width: `${(n / maxReg) * 100}%` }} /></span>
                  <span className="uf-n">{n}</span>
                </div>
                {ufs.length > 0 && <div className="uf-chips">{ufs.map(([uf, q]) => (
                  <button key={uf} onClick={() => fixar(uf)} onMouseEnter={() => setHover(uf)} onMouseLeave={() => setHover(null)} title={nomeUF(uf)}>{uf} <b>{q}</b></button>
                ))}</div>}
              </div>
            ))}
            <div className="kpi-s" style={{ marginTop: 10 }}>Passe o mouse sobre um estado (ou clique na sigla) para ver os detalhes.</div>
          </>
        )}
      </div>
    </div>
  );
}

function Mini({ titulo, itens }: { titulo: string; itens: [string, number][] }) {
  if (!itens.length) return null;
  const max = Math.max(...itens.map((x) => x[1]));
  return (
    <div className="mp-mini">
      <div className="mp-sub">{titulo}</div>
      {itens.slice(0, 6).map(([k, v]) => (
        <div key={k} className="uf-row" style={{ gridTemplateColumns: "minmax(90px, 46%) 1fr 26px" }}>
          <span className="mp-k" title={k}>{k}</span>
          <span className="uf-bar"><i style={{ width: `${(v / max) * 100}%` }} /></span>
          <span className="uf-n">{v}</span>
        </div>
      ))}
    </div>
  );
}

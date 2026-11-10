"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { lerFiltros, passaPlat } from "@/lib/filtros";
import { Info } from "@/components/Info";
import { ModalProjetos, type ItemProjeto } from "@/components/ModalProjetos";
import { BarrasH, BarrasV, FASE_ORDEM, Kpi, Legenda, cor, corFase, fmtN } from "@/components/charts";
import "./numeros.css";
import { MapaBrasil, type DadosUF } from "@/components/MapaBrasil";

export type PN = {
  id: number; name: string; status_name: string; coordenador: string; fase: string; tipo: string; padrao: string;
  tamanho: string; plataforma: string; certificacao: string | null; area_m2: number | null; ano: number | null; uf: string | null;
  considerar_dashboard: boolean | null;
  ent_ep1: string | null; ent_ep2: string | null; ent_ap: string | null; ent_pe: string | null; ent_ex: string | null; ent_lo: string | null;
};

const COR_STATUS: Record<string, string> = { "Em Andamento": "#3e6fa3", "On hold": "#e9c46a", "Concluído": "#b5b5b5" };
const ROTULO_STATUS: Record<string, string> = { "Em Andamento": "Em andamento", "On hold": "On hold", "Concluído": "Concluído" };
const COR_PADRAO: Record<string, string> = { "ECONÔMICO": "#76b7b2", "MÉDIO": "#3e6fa3", "MÉDIO ALTO": "#9c755f", "ALTO": "#b8203a" };
const COR_TAM: Record<string, string> = { P: "#a0cbe8", M: "#3e6fa3", G: "#1f3550" };
const m2 = (v: number) => `${fmtN(v)} m²`;
const dias = (a: string | null, b: string | null) => (a && b ? (new Date(b).getTime() - new Date(a).getTime()) / 86400000 : null);
const mediana = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const i = Math.floor(s.length / 2); return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2; };

function agrupa(rows: PN[], chave: (p: PN) => string, seg: (p: PN) => string, cores: (s: string) => string, ordem?: string[]) {
  const m = new Map<string, Map<string, number>>();
  for (const p of rows) {
    const g = chave(p), s = seg(p);
    const inner = m.get(g) ?? new Map<string, number>();
    inner.set(s, (inner.get(s) ?? 0) + 1);
    m.set(g, inner);
  }
  const todosSeg = ordem ?? [...new Set(rows.map(seg))];
  return [...m.entries()].map(([k, inner]) => ({
    k, label: k, v: [...inner.values()].reduce((a, b) => a + b, 0),
    segs: todosSeg.map((s) => ({ k: s, v: inner.get(s) ?? 0, c: cores(s) })),
  })).sort((a, b) => b.v - a.v);
}

export function Numeros({ dados }: { dados: PN[] }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const fg = lerFiltros(sp);
  const coord = fg.coord;
  const setCoord = (fn: (c: string | null) => string | null) => {
    const v = fn(coord); const q = new URLSearchParams(sp.toString());
    if (v) q.set("coord", v); else q.delete("coord");
    router.push(`${path}${q.toString() ? `?${q}` : ""}`);
  };
  const [modal, setModal] = useState<null | { titulo: string; itens: ItemProjeto[] }>(null);
  const [verSemUf, setVerSemUf] = useState(false);
  const [escopo, setEscopo] = useState<"ativos" | "historico">("ativos");
  const ORD = escopo === "ativos" ? ["Em Andamento", "On hold"] : ["Em Andamento", "On hold", "Concluído"];
  const legStatus = ORD.map((k) => ({ k: ROTULO_STATUS[k], c: COR_STATUS[k] }));

  const ativos = useMemo(() => dados.map((p) => ({ ...p, area_m2: p.area_m2 == null ? null : Number(p.area_m2) }))
    .filter((p) => ORD.includes(p.status_name))
    .filter((p) => fg.status === "todos" || p.status_name === fg.status)
    .filter((p) => fg.considerar === "tudo" || p.considerar_dashboard !== false)
    .filter((p) => passaPlat(p, fg)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dados, fg.status, fg.considerar, fg.plat, escopo]);
  const base = useMemo(() => ativos.filter((p) => !coord || p.coordenador === coord), [ativos, coord]);
  const abrir = (titulo: string, filtro: (p: PN) => boolean, extra?: (p: PN) => string, porArea = false) =>
    setModal({ titulo, itens: base.filter(filtro).sort((a, b) => porArea ? (b.area_m2 ?? 0) - (a.area_m2 ?? 0) : b.name.localeCompare(a.name)).map((p) => ({ id: p.id, name: p.name, status: p.status_name, extra: extra?.(p) })) });

  const nAnd = base.filter((p) => p.status_name === "Em Andamento").length;
  const nHold = base.filter((p) => p.status_name === "On hold").length;
  const nConc = base.filter((p) => p.status_name === "Concluído").length;
  const area = base.reduce((s, p) => s + (p.area_m2 ?? 0), 0);
  const plat = (x: string) => base.filter((p) => p.plataforma.toUpperCase() === x);
  const cad = plat("CAD"), bim = plat("BIM");
  const charrette = base.filter((p) => p.tipo.toUpperCase().includes("CHARRETTE"));
  const certificados = base.filter((p) => p.certificacao);

  const statusSeg = (p: PN) => p.status_name;
  const corStatus = (s: string) => COR_STATUS[s] ?? "#ccc";
  const porCoord = agrupa(ativos, (p) => p.coordenador, statusSeg, corStatus, ORD);
  const porFase = agrupa(base, (p) => p.fase, statusSeg, corStatus, ORD)
    .sort((a, b) => (FASE_ORDEM.indexOf(a.k) + 99 * +(FASE_ORDEM.indexOf(a.k) < 0)) - (FASE_ORDEM.indexOf(b.k) + 99 * +(FASE_ORDEM.indexOf(b.k) < 0)))
    .map((g) => ({ ...g, c: corFase(g.k) }));
  const porTipo = agrupa(base, (p) => p.tipo, statusSeg, corStatus, ORD);
  const padraoCoord = agrupa(base, (p) => p.coordenador, (p) => p.padrao, (s) => COR_PADRAO[s] ?? "#ccc", ["ECONÔMICO", "MÉDIO", "MÉDIO ALTO", "ALTO", "(sem padrão)"]);
  const tamCoord = agrupa(base, (p) => p.coordenador, (p) => p.tamanho, (s) => COR_TAM[s] ?? "#ccc", ["P", "M", "G", "(sem tamanho)"]);

  const areaCoord = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of ativos) m.set(p.coordenador, (m.get(p.coordenador) ?? 0) + (p.area_m2 ?? 0));
    const tot = [...m.values()].reduce((a, b) => a + b, 0) || 1;
    return [...m.entries()].map(([k, v], i) => ({ k, label: k, v, pct: v / tot, c: cor(i) })).sort((a, b) => b.v - a.v);
  }, [ativos]);

  const porAno = useMemo(() => {
    const m = new Map<number, Map<string, number>>();
    for (const p of base) if (p.ano && p.ano > 2000) {
      const i = m.get(p.ano) ?? new Map<string, number>(); i.set(p.status_name, (i.get(p.status_name) ?? 0) + 1); m.set(p.ano, i);
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([a, i]) => ({
      k: String(a), label: String(a), v: [...i.values()].reduce((x, y) => x + y, 0),
      segs: ORD.map((st) => ({ k: ROTULO_STATUS[st], v: i.get(st) ?? 0, c: COR_STATUS[st] })),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, escopo]);

  const semUf = base.filter((p) => !p.uf);
  const dadosUF = useMemo(() => {
    const m = new Map<string, DadosUF>();
    const conta = (arr: [string, number][], k: string) => { const i = arr.findIndex((x) => x[0] === k); if (i >= 0) arr[i][1]++; else arr.push([k, 1]); };
    for (const p of base) {
      if (!p.uf) continue;
      const d = m.get(p.uf) ?? { uf: p.uf, total: 0, andamento: 0, hold: 0, concluido: 0, area: 0, porCoord: [], porPadrao: [], porFase: [], projetos: [] };
      d.total++; if (p.status_name === "Em Andamento") d.andamento++; else if (p.status_name === "On hold") d.hold++; else d.concluido = (d.concluido ?? 0) + 1;
      d.area += p.area_m2 ?? 0;
      conta(d.porCoord, p.coordenador); conta(d.porPadrao, p.padrao); conta(d.porFase, p.fase);
      d.projetos.push({ id: p.id, name: p.name, status: p.status_name });
      m.set(p.uf, d);
    }
    for (const d of m.values()) { d.porCoord.sort((a, b) => b[1] - a[1]); d.porPadrao.sort((a, b) => b[1] - a[1]); d.porFase.sort((a, b) => b[1] - a[1]); d.projetos.sort((a, b) => b.name.localeCompare(a.name)); }
    return m;
  }, [base]);

  // lead time entre fases (todos os projetos com as duas datas, não só ativos)
  const lead = useMemo(() => {
    const pares: [string, keyof PN, keyof PN][] = [
      ["EP1 → EP2", "ent_ep1", "ent_ep2"], ["EP2 → AP", "ent_ep2", "ent_ap"], ["AP → Executivo", "ent_ap", "ent_ex"], ["Executivo → Liberado Obra", "ent_ex", "ent_lo"],
    ];
    const src = dados.filter((p) => (!coord || p.coordenador === coord) && passaPlat(p, fg));
    return pares.map(([label, a, b]) => {
      const xs = src.map((p) => dias(p[a] as string | null, p[b] as string | null)).filter((d): d is number => d != null && d >= 0 && d < 3650);
      const lentos = src.map((p) => ({ p, d: dias(p[a] as string | null, p[b] as string | null) }))
        .filter((x) => x.d != null && x.d >= 0 && x.d < 3650).sort((x, y) => (y.d as number) - (x.d as number)).slice(0, 5);
      return { label, n: xs.length, med: mediana(xs), lentos };
    });
  }, [dados, coord, fg.plat]);

  return (
    <>
      <div className="escopo">
        <div className="pills" role="group" aria-label="Escopo">
          <button className={`pill${escopo === "ativos" ? " active" : ""}`} onClick={() => setEscopo("ativos")}>Carteira ativa</button>
          <button className={`pill${escopo === "historico" ? " active" : ""}`} onClick={() => setEscopo("historico")}>Histórico completo</button>
        </div>
        <Info texto="Carteira ativa: projetos em andamento e on hold. Histórico completo: soma também os concluídos, para os números de “já projetados” (ex.: total de projetos e m² em CAD, BIM e charrettes). Cancelados e propostas ficam de fora." />
      </div>
      <div className="kpi-grid">
        <Kpi valor={base.length} rotulo={escopo === "ativos" ? "Projetos ativos" : "Projetos no histórico"} sub={`${nAnd} em andamento · ${nHold} on hold${escopo === "historico" ? ` · ${nConc} concluídos` : ""}`} onClick={() => abrir(escopo === "ativos" ? "Projetos ativos" : "Todos os projetos", () => true, (p) => p.coordenador)} />
        <Kpi valor={m2(area)} rotulo="Área de intervenção paisagística" sub={escopo === "ativos" ? "soma dos projetos ativos" : "já projetados (inclui concluídos)"} info={<Info texto="Soma do campo 'Intervenção paisagística (m2)' do DOit nos projetos filtrados." />}
          onClick={() => abrir("Área de intervenção por projeto (maiores primeiro)", (p) => (p.area_m2 ?? 0) > 0, (p) => m2(p.area_m2 ?? 0), true)} />
        <Kpi valor={cad.length} rotulo="Projetos em CAD" sub={m2(cad.reduce((s, p) => s + (p.area_m2 ?? 0), 0))} onClick={() => abrir("Projetos em CAD", (p) => p.plataforma.toUpperCase() === "CAD", (p) => m2(p.area_m2 ?? 0))} />
        <Kpi valor={bim.length} rotulo="Projetos em BIM" sub={m2(bim.reduce((s, p) => s + (p.area_m2 ?? 0), 0))} onClick={() => abrir("Projetos em BIM", (p) => p.plataforma.toUpperCase() === "BIM", (p) => m2(p.area_m2 ?? 0))} />
        <Kpi valor={charrette.length} rotulo="Charrettes" sub={m2(charrette.reduce((s, p) => s + (p.area_m2 ?? 0), 0))} onClick={() => abrir("Charrettes", (p) => p.tipo.toUpperCase().includes("CHARRETTE"), (p) => m2(p.area_m2 ?? 0))} />
        <Kpi valor={certificados.length} rotulo="Com certificação" sub="LEED, GBC, AQUA, EDGE…" onClick={() => abrir("Projetos com certificação", (p) => !!p.certificacao, (p) => p.certificacao ?? "")} />
      </div>

      <div className="num-grid">
        <section className="card">
          <div className="card-t">Projetos por coordenador <small>(clique para filtrar a página)</small></div>
          <BarrasH itens={porCoord} sufixo="" ativo={coord} onClick={(k) => setCoord((c) => (c === k ? null : k))} />
          <Legenda itens={legStatus} />
        </section>

        <section className="card">
          <div className="card-t">Área de intervenção por coordenador</div>
          {areaCoord.map((a) => (
            <div key={a.k} className="bh-row click" onClick={() => abrir(`Área de intervenção · ${a.k}`, (p) => p.coordenador === a.k && (p.area_m2 ?? 0) > 0, (p) => m2(p.area_m2 ?? 0))}>
              <span className="bh-l" title={a.k}>{a.k}</span>
              <span className="bh-track"><span className="bh-bar" style={{ width: `${a.pct * 100}%` }}><span style={{ flex: 1, background: a.c }} /></span>
                <span className="bh-v">{fmtN(a.pct * 100, 1)}% · {m2(a.v)}</span></span>
            </div>
          ))}
        </section>

        <section className="card span2">
          <div className="card-t">Takeda em nível nacional <small>({fmtN(base.length - semUf.length)} projetos com estado identificado)</small></div>
          <MapaBrasil dados={dadosUF} />
          {semUf.length > 0 && (
            <div style={{ marginTop: 10, fontSize: 12, color: "var(--ink-soft)" }}>
              <button className="btn-ghost" onClick={() => setVerSemUf((v) => !v)}>{verSemUf ? "ocultar" : "ver"} {semUf.length} sem estado identificado</button>
              {verSemUf && <ul className="sem-uf">{semUf.map((p) => <li key={p.id}><Link className="proj-link" href={`/producao/visao-projeto?id=${p.id}`}>{p.name}</Link></li>)}</ul>}
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-t">Fases dos projetos</div>
          <BarrasH itens={porFase} sufixo="" onClick={(k) => abrir(`Fase: ${k}`, (p) => p.fase === k, (p) => p.coordenador)} />
          <Legenda itens={legStatus} />
        </section>

        <section className="card">
          <div className="card-t">Tipos de projeto</div>
          <BarrasH itens={porTipo} sufixo="" onClick={(k) => abrir(`Tipo: ${k}`, (p) => p.tipo === k, (p) => p.coordenador)} />
        </section>

        <section className="card">
          <div className="card-t">Projetos por padrão <small>(por coordenador)</small></div>
          <BarrasH itens={padraoCoord} sufixo="" onClick={(k) => abrir(`${k} · por padrão`, (p) => p.coordenador === k, (p) => `padrão ${p.padrao.toLowerCase()}`)} />
          <Legenda itens={["ECONÔMICO", "MÉDIO", "ALTO"].map((k) => ({ k: `Padrão ${k.toLowerCase()}`, c: COR_PADRAO[k] }))} />
        </section>

        <section className="card">
          <div className="card-t">Projetos por escala <small>(por coordenador)</small></div>
          <BarrasH itens={tamCoord} sufixo="" onClick={(k) => abrir(`${k} · por escala`, (p) => p.coordenador === k, (p) => `escala ${p.tamanho}`)} />
          <Legenda itens={[{ k: "P · até 2.000 m²", c: COR_TAM.P }, { k: "M · 2.000 a 10.000 m²", c: COR_TAM.M }, { k: "G · acima de 10.000 m²", c: COR_TAM.G }]} />
        </section>

        <section className="card span2">
          <div className="card-t">Projetos ao longo do tempo <small>(ano no código do projeto)</small></div>
          {porAno.length ? <BarrasV itens={porAno} sufixo="" altura={140} /> : <div className="empty">Sem dados.</div>}
          {porAno.length > 0 && <Legenda itens={legStatus} />}
        </section>

        <section className="card span2">
          <div className="card-t">Lead time entre fases <small>(tempo típico entre a entrega de uma fase e a da seguinte)</small>
            <Info texto="Para cada projeto, conta os dias entre as datas de entrega cadastradas no DOit (ex.: Entrega EP-2 → Entrega Anteprojeto). O número grande é a mediana: metade dos projetos levou menos, metade levou mais. A lista mostra os 5 que mais demoraram — às vezes é projeto parado, às vezes é data errada no cadastro." /></div>
          <div className="lead-grid">
            {lead.map((l) => (
              <div key={l.label} className="lead">
                <div className="lead-v">{l.med == null ? "—" : `${fmtN(l.med)} dias`}</div>
                <div className="lead-l">{l.label}</div>
                <div className="kpi-s">{l.n} projetos com as duas datas</div>
                {l.lentos.length > 0 && <ul>{l.lentos.map(({ p, d }) => (
                  <li key={p.id}><Link className="proj-link" href={`/producao/visao-projeto?id=${p.id}`} title={p.name}>{p.name.split(" - ").slice(0, 1).join("")} · {p.name.split(" - ").slice(2, 3).join("")}</Link> <span>{fmtN(d)} d</span></li>
                ))}</ul>}
              </div>
            ))}
          </div>
        </section>

        <section className="card span2">
          <div className="card-t">Certificações</div>
          {certificados.length === 0 ? <div className="empty">Nenhum projeto ativo com certificação cadastrada.</div> : (
            <table className="acessos"><tbody>
              {certificados.map((p) => (
                <tr key={p.id}><td><Link className="proj-link" href={`/producao/visao-projeto?id=${p.id}`}>{p.name}</Link></td><td><span className="badge" style={{ background: "#dff0e3", color: "#22663f" }}>{p.certificacao}</span></td><td>{p.coordenador}</td></tr>
              ))}
            </tbody></table>
          )}
        </section>
      </div>
      {modal && <ModalProjetos titulo={modal.titulo} itens={modal.itens} onClose={() => setModal(null)} />}
    </>
  );
}

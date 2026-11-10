"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { lerFiltros } from "@/lib/filtros";
import { Info } from "@/components/Info";
import { BarrasH, FASE_ORDEM, Kpi, Legenda, corFase, fmtN } from "@/components/charts";

export type Projeto = {
  id: number; name: string; status_name: string; customer_name: string | null; considerar_dashboard: boolean | null;
  horas_contratadas: number | null; horas_realizadas: number; horas_excedentes: number | null; pct_horas_contratadas: number | null;
  custo_mo: number | null; ultimo_lancamento: string | null; dias_sem_lancamento: number | null; horas_30d: number;
  coordenador: string | null; fase: string | null; padrao: string | null; tamanho: string | null; tipo_projeto: string | null;
  plataforma: string | null; certificacao: string | null;
};

const DIMENSOES: { k: keyof Projeto; label: string }[] = [
  { k: "coordenador", label: "Coordenador" },
  { k: "fase", label: "Fase" },
  { k: "padrao", label: "Padrão" },
  { k: "tamanho", label: "Tamanho" },
  { k: "tipo_projeto", label: "Tipo de Projeto" },
  { k: "plataforma", label: "Plataforma" },
  { k: "certificacao", label: "Certificação" },
  { k: "customer_name", label: "Cliente" },
  { k: "status_name", label: "Status" },
];

type Ord = { k: keyof Projeto; dir: 1 | -1 };
const FILTROS: { k: keyof Projeto; label: string }[] = [
  { k: "fase", label: "Fase" },
  { k: "padrao", label: "Padrão" },
  { k: "tamanho", label: "Tamanho" },
  { k: "tipo_projeto", label: "Tipo de Projeto" },
];
type FiltroKpi = null | "andamento" | "hold" | "vermelho" | "parados" | "excedentes";

export function ProjetosAtivos({ projetos }: { projetos: Projeto[] }) {
  const sp = useSearchParams();
  const fg = lerFiltros(sp);
  const status = fg.status;
  const [kpiF, setKpiF] = useState<FiltroKpi>(null);
  const [dias, setDias] = useState(30);
  const [dim, setDim] = useState<keyof Projeto>("coordenador");
  const [grupo, setGrupo] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [ord, setOrd] = useState<Ord>({ k: "horas_30d", dir: -1 });
  const [sel, setSel] = useState<Partial<Record<keyof Projeto, string>>>({});
  const opcoes = useMemo(() => Object.fromEntries(FILTROS.map((f) => [f.k,
    [...new Set(projetos.map((p) => String(p[f.k] ?? "(sem)")))].sort((a, b) => a.localeCompare(b, "pt-BR"))])) as Record<string, string[]>, [projetos]);
  const nFiltros = Object.values(sel).filter(Boolean).length;

  const base = useMemo(() => projetos.map((p) => ({
    ...p,
    horas_contratadas: p.horas_contratadas == null ? null : Number(p.horas_contratadas),
    horas_realizadas: Number(p.horas_realizadas ?? 0),
    horas_excedentes: Number(p.horas_excedentes ?? 0),
    pct_horas_contratadas: p.pct_horas_contratadas == null ? null : Number(p.pct_horas_contratadas),
    horas_30d: Number(p.horas_30d ?? 0),
    dias_sem_lancamento: p.dias_sem_lancamento == null ? null : Number(p.dias_sem_lancamento),
  })).filter((p) => fg.considerar === "tudo" || p.considerar_dashboard !== false)
    .filter((p) => !fg.coord || (p.coordenador ?? "(sem coordenador)") === fg.coord)
    .filter((p) => !fg.plat || (p.plataforma ?? "").toUpperCase() === fg.plat)
    .filter((p) => FILTROS.every((f) => !sel[f.k] || String(p[f.k] ?? "(sem)") === sel[f.k])), [projetos, fg.considerar, fg.coord, fg.plat, sel]);

  const kpis = useMemo(() => {
    const and = base.filter((p) => p.status_name === "Em Andamento");
    const hold = base.filter((p) => p.status_name === "On hold");
    const ativos = base.length || 1;
    const parados = and.filter((p) => p.dias_sem_lancamento == null || p.dias_sem_lancamento > dias);
    const exc = and.reduce((s, p) => s + (p.horas_excedentes ?? 0), 0);
    const comExc = and.filter((p) => (p.horas_excedentes ?? 0) > 0).length;
    const tot = and.reduce((s, p) => s + p.horas_realizadas, 0) || 1;
    const vermelho = and.filter((p) => (p.pct_horas_contratadas ?? 0) > 1).length;
    return { and: and.length, hold: hold.length, ativos, parados: parados.length, exc, comExc, pctExc: exc / tot, vermelho };
  }, [base, dias]);

  const filtrados = useMemo(() => base.filter((p) =>
    (status === "todos" || p.status_name === status) &&
    (kpiF !== "andamento" || p.status_name === "Em Andamento") &&
    (kpiF !== "hold" || p.status_name === "On hold") &&
    (kpiF !== "vermelho" || (p.status_name === "Em Andamento" && (p.pct_horas_contratadas ?? 0) > 1)) &&
    (kpiF !== "parados" || (p.status_name === "Em Andamento" && (p.dias_sem_lancamento == null || p.dias_sem_lancamento > dias))) &&
    (kpiF !== "excedentes" || (p.status_name === "Em Andamento" && (p.horas_excedentes ?? 0) > 0)) &&
    (!grupo || String(p[dim] ?? "(sem)") === grupo) &&
    (!busca || p.name.toLowerCase().includes(busca.toLowerCase()) || (p.customer_name ?? "").toLowerCase().includes(busca.toLowerCase()))
  ), [base, status, kpiF, dias, grupo, dim, busca]);

  const grupos = useMemo(() => {
    const m = new Map<string, Map<string, number>>();
    for (const p of base.filter((p) => status === "todos" || p.status_name === status)) {
      const g = String(p[dim] ?? "(sem)");
      const f = p.fase ?? "(sem fase)";
      const inner = m.get(g) ?? new Map<string, number>();
      inner.set(f, (inner.get(f) ?? 0) + 1);
      m.set(g, inner);
    }
    return [...m.entries()].map(([k, inner]) => ({
      k, label: k, v: [...inner.values()].reduce((a, b) => a + b, 0),
      segs: [...FASE_ORDEM, "(sem fase)"].map((f) => ({ k: f, v: inner.get(f) ?? 0, c: corFase(f) })),
    })).sort((a, b) => b.v - a.v).slice(0, 25);
  }, [base, dim, status]);

  const tabela = useMemo(() => [...filtrados].sort((a, b) => {
    const va = a[ord.k], vb = b[ord.k];
    if (va == null) return 1; if (vb == null) return -1;
    return (typeof va === "string" ? va.localeCompare(String(vb), "pt-BR") : Number(va) - Number(vb)) * ord.dir;
  }), [filtrados, ord]);

  const th = (k: keyof Projeto, label: string, right = false) => (
    <th className="sortable" style={right ? { textAlign: "right" } : undefined}
      onClick={() => setOrd((o) => ({ k, dir: o.k === k ? (o.dir === 1 ? -1 : 1) : -1 }))}>
      {label}{ord.k === k ? (ord.dir === 1 ? " ▲" : " ▼") : ""}
    </th>
  );

  return (
    <>
      <div className="filters filtros-extra">
        <div className="field"><label>Parado há mais de</label>
          <select value={dias} onChange={(e) => setDias(Number(e.target.value))}>
            {[15, 30, 60, 90].map((d) => <option key={d} value={d}>{d} dias</option>)}
          </select></div>
        {FILTROS.map((f) => (
          <div className="field" key={f.k}><label>{f.label}</label>
            <select value={sel[f.k] ?? ""} className={sel[f.k] ? "on" : ""}
              onChange={(e) => { setSel((s) => ({ ...s, [f.k]: e.target.value || undefined })); setGrupo(null); }}>
              <option value="">(Todos)</option>
              {opcoes[f.k as string].map((o) => <option key={o} value={o}>{o}</option>)}
            </select></div>
        ))}
        {(nFiltros > 0 || grupo || kpiF || busca) && (
          <button className="btn-ghost" onClick={() => { setSel({}); setGrupo(null); setKpiF(null); setBusca(""); }}>Limpar filtros</button>
        )}
      </div>

      <div className="kpi-grid">
        <Kpi valor={kpis.and} rotulo="Em andamento" sub={`${fmtN((kpis.and / kpis.ativos) * 100, 1)}% dos ativos · clique para filtrar`}
          onClick={() => setKpiF((v) => (v === "andamento" ? null : "andamento"))} destaque={kpiF === "andamento" ? "#2f5d8a" : undefined} />
        <Kpi valor={kpis.hold} rotulo="On hold" sub={`${fmtN((kpis.hold / kpis.ativos) * 100, 1)}% dos ativos · clique para filtrar`}
          onClick={() => setKpiF((v) => (v === "hold" ? null : "hold"))} destaque={kpiF === "hold" ? "#2f5d8a" : undefined} />
        <Kpi valor={kpis.vermelho} rotulo="No vermelho" sub="clique para filtrar" destaque="#c0392b"
          info={<Info texto="Em andamento com horas lançadas acima das horas contratadas no DOit." />}
          onClick={() => setKpiF((v) => (v === "vermelho" ? null : "vermelho"))} />
        <Kpi valor={kpis.parados} rotulo={`Parados há ${dias}+ dias`} sub="clique para filtrar" destaque="#b8203a"
          info={<Info texto="Em andamento sem nenhuma hora lançada no período escolhido em 'Parado há mais de'." />}
          onClick={() => setKpiF((v) => (v === "parados" ? null : "parados"))} />
        <Kpi valor={`${fmtN(kpis.exc)} h`} rotulo="Horas excedentes" sub={`${kpis.comExc} projetos · ${fmtN(kpis.pctExc * 100, 1)}% das horas`}
          info={<Info texto="Soma de (horas realizadas − horas contratadas) dos projetos em andamento que passaram do contratado." />}
          onClick={() => setKpiF((v) => (v === "excedentes" ? null : "excedentes"))} />
      </div>
      {kpiF && <div className="filtro-ativo">Tabela filtrada pelo cartão: <b>{{ andamento: "Em andamento", hold: "On hold", vermelho: "No vermelho", parados: `Parados há ${dias}+ dias`, excedentes: "Com horas excedentes" }[kpiF]}</b>
        <button className="btn-ghost" onClick={() => setKpiF(null)}>limpar</button></div>}

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="hm-head">
          <h2 className="hm-title">Projetos por <span className="per">{DIMENSOES.find((d) => d.k === dim)?.label}</span>
            <small style={{ color: "var(--muted)", fontSize: 12 }}> · clique para filtrar</small></h2>
          <div className="field"><label>Ver por</label>
            <select value={dim} onChange={(e) => { setDim(e.target.value as keyof Projeto); setGrupo(null); }}>
              {DIMENSOES.map((d) => <option key={d.k} value={d.k}>{d.label}</option>)}
            </select></div>
        </div>
        <BarrasH itens={grupos} sufixo="" ativo={grupo} onClick={(k) => setGrupo((g) => (g === k ? null : k))} />
        <Legenda itens={[...FASE_ORDEM, "(sem fase)"].map((f) => ({ k: f, c: corFase(f) }))} />
      </section>

      <section className="card">
        <div className="hm-head">
          <h2 className="hm-title">{tabela.length} projetos{grupo && <> · <span className="per">{grupo}</span> <button className="btn-ghost" onClick={() => setGrupo(null)}>limpar</button></>}</h2>
          <input className="search" placeholder="Buscar projeto ou cliente…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <div className="hm-wrap">
          <table className="acessos tabela-proj">
            <thead><tr>
              {th("name", "Projeto")}{th("coordenador", "Coordenador")}{th("fase", "Fase")}
              {th("horas_30d", "H 30 dias", true)}{th("horas_realizadas", "H realizadas", true)}{th("horas_contratadas", "H contratadas", true)}
              {th("pct_horas_contratadas", "% contratado", true)}{th("horas_excedentes", "H excedentes", true)}{th("dias_sem_lancamento", "Últ. lançamento", true)}
            </tr></thead>
            <tbody>
              {tabela.map((p) => {
                const pct = p.pct_horas_contratadas;
                return (
                  <tr key={p.id}>
                    <td><Link href={`/producao/visao-projeto?id=${p.id}`} className="proj-link">{p.name}</Link>
                      <div className="sub">{p.customer_name}{p.status_name !== "Em Andamento" ? ` · ${p.status_name}` : ""}</div></td>
                    <td>{p.coordenador ?? "—"}</td>
                    <td><span className="fase-dot" style={{ background: corFase(p.fase) }} />{p.fase ?? "—"}</td>
                    <td className="r">{fmtN(p.horas_30d)}</td>
                    <td className="r">{fmtN(p.horas_realizadas)}</td>
                    <td className="r">{p.horas_contratadas ? fmtN(p.horas_contratadas) : "—"}</td>
                    <td className="r">{pct == null ? "—" : (
                      <span className="pct-bar"><i style={{ width: `${Math.min(pct, 1.5) / 1.5 * 100}%`, background: pct > 1 ? "#e15759" : "#3e6fa3" }} />{fmtN(pct * 100, 0)}%</span>
                    )}</td>
                    <td className="r" style={{ color: (p.horas_excedentes ?? 0) > 0 ? "#c0392b" : undefined }}>{(p.horas_excedentes ?? 0) > 0 ? fmtN(p.horas_excedentes) : "—"}</td>
                    <td className="r" style={{ color: p.dias_sem_lancamento == null || p.dias_sem_lancamento > dias ? "#b8203a" : undefined }}>
                      {p.dias_sem_lancamento == null ? "nunca" : `há ${p.dias_sem_lancamento} d`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

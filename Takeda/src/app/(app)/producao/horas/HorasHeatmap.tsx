"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MESES, MESES_LONGOS, diasNoMes, diasUteis, fmtH, iso } from "@/lib/periodo";

export type Linha = {
  responsible_id: number | null;
  responsible_name: string | null;
  bucket: string | null; // null = total do período
  horas: number;
  horas_com_etapa: number;
  horas_com_projeto: number;
  qtd_atividades: number;
  qtd_projetos: number;
};

type Vis = "trabalhadas" | "acima" | "etapa" | "projeto";
type Props = { rows: Linha[]; ano: number; mes: number; modo: "mes" | "ytd"; vis: Vis; lim: number; inicio: string; fim: string };

const VIS_LABEL: Record<Vis, string> = {
  trabalhadas: "Trabalhadas",
  acima: "H Máx Dia",
  etapa: "Com Etapa",
  projeto: "Com Projetos",
};
const ALERTA_H = 14;

function cellStyle(v: number | undefined, vis: Vis, ref: number, max: number, pct?: number): React.CSSProperties {
  if (v == null || v === 0) return {};
  if (vis === "etapa" || vis === "projeto") {
    const p = pct ?? 0;
    if (p >= 0.95) return { background: "#dff0e3", color: "#22663f" };
    if (p >= 0.7) return { background: "#fbf0cf", color: "#7a5b00" };
    return { background: "#fbdcd5", color: "#a3341f" };
  }
  if (vis === "acima") {
    if (ref <= 8.01 && v > ALERTA_H) return { background: "#a83a1f", color: "#fff", fontWeight: 600 };
    if (v > ref + 0.05) {
      const a = Math.min(0.85, 0.18 + ((v - ref) / ref) * 1.2);
      return { background: `rgba(232,130,58,${a})`, color: a > 0.55 ? "#fff" : "#5a2e0c" };
    }
    if (v < ref - 0.05) {
      const a = Math.min(0.75, 0.12 + ((ref - v) / ref) * 0.9);
      return { background: `rgba(47,93,138,${a})`, color: a > 0.5 ? "#fff" : "#1f3550" };
    }
    return { color: "#555" };
  }
  const a = Math.min(0.7, 0.06 + (v / Math.max(max, 1)) * 0.64);
  return { background: `rgba(47,93,138,${a})`, color: a > 0.45 ? "#fff" : "#1f3550" };
}

export function HorasHeatmap({ rows, ano, mes, modo, vis, lim, inicio, fim }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: "nome", dir: 1 });
  const [detalhe, setDetalhe] = useState<null | { id: number; nome: string; de: string; ate: string; titulo: string }>(null);

  const setVis = (v: Vis) => {
    const p = new URLSearchParams(sp.toString());
    p.set("vis", v);
    router.push(`?${p.toString()}`);
  };

  const { pessoas, colunas, max, alertas } = useMemo(() => {
    type P = { id: number; nome: string; total?: Linha; cells: Map<string, Linha> };
    const map = new Map<number, P>();
    let max = 0, alertas = 0;
    const comDado = new Set<string>();
    for (const r0 of rows) {
      const r = { ...r0, horas: Number(r0.horas), horas_com_etapa: Number(r0.horas_com_etapa), horas_com_projeto: Number(r0.horas_com_projeto), qtd_atividades: Number(r0.qtd_atividades), qtd_projetos: Number(r0.qtd_projetos) };
      if (r.responsible_id == null) continue;
      const p: P = map.get(r.responsible_id) ?? { id: r.responsible_id, nome: r.responsible_name ?? "—", cells: new Map<string, Linha>() };
      if (r.bucket == null) p.total = r;
      else {
        p.cells.set(r.bucket, r);
        comDado.add(r.bucket);
        if (r.horas > max) max = r.horas;
        if (modo === "mes" && r.horas > ALERTA_H) alertas++;
      }
      map.set(r.responsible_id, p);
    }
    let colunas: { key: string; label: string; ref: number }[];
    if (modo === "ytd") {
      colunas = Array.from({ length: mes }, (_, i) => ({ key: iso(ano, i + 1, 1), label: MESES[i], ref: lim * diasUteis(ano, i + 1) }));
    } else {
      colunas = [];
      for (let d = 1; d <= diasNoMes(ano, mes); d++) {
        const k = iso(ano, mes, d);
        const w = new Date(Date.UTC(ano, mes - 1, d)).getUTCDay();
        if ((w !== 0 && w !== 6) || comDado.has(k)) colunas.push({ key: k, label: String(d), ref: lim });
      }
    }
    return { pessoas: [...map.values()].filter((p) => (p.total?.horas ?? 0) > 0), colunas, max, alertas };
  }, [rows, ano, mes, modo, lim]);

  const ordenadas = useMemo(() => {
    const val = (p: (typeof pessoas)[number]) => {
      if (sort.key === "nome") return p.nome;
      if (sort.key === "horas") return p.total?.horas ?? 0;
      if (sort.key === "ativ") return p.total?.qtd_atividades ?? 0;
      if (sort.key === "proj") return p.total?.qtd_projetos ?? 0;
      return p.cells.get(sort.key)?.horas ?? 0;
    };
    return [...pessoas].sort((a, b) => {
      const va = val(a), vb = val(b);
      return (typeof va === "string" ? va.localeCompare(vb as string, "pt-BR") : (va as number) - (vb as number)) * sort.dir;
    });
  }, [pessoas, sort]);

  const th = (key: string, label: React.ReactNode, cls = "") => (
    <th key={key} className={`sortable ${cls}`} onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === "nome" ? 1 : -1 }))}>
      {label}{sort.key === key ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
    </th>
  );

  const periodo = modo === "ytd" ? `YTD ${MESES[mes - 1]} ${ano}` : `${MESES[mes - 1]} ${ano}`;

  return (
    <>
      <div className="hm-head">
        <h2 className="hm-title">
          Horas {vis === "etapa" ? "com Etapa" : vis === "projeto" ? "com Projeto" : "Trabalhadas"}{" "}
          {vis === "acima" && <span className="hl">Acima de {lim} h </span>}
          | <span className="per">{periodo}</span>
        </h2>
        <div className="pills">
          {(Object.keys(VIS_LABEL) as Vis[]).map((v) => (
            <button key={v} className={`pill${vis === v ? " active" : ""}`} onClick={() => setVis(v)}>
              {VIS_LABEL[v]}
            </button>
          ))}
        </div>
      </div>

      <div className="hm-head">
        <div className="legend">
          {vis === "acima" && <>
            <span><i style={{ background: "rgba(232,130,58,.6)" }} />acima de {modo === "ytd" ? "jornada do mês" : `${lim} h`}</span>
            <span><i style={{ background: "rgba(47,93,138,.45)" }} />abaixo</span>
            {modo === "mes" && <span><i style={{ background: "#a83a1f" }} />mais de {ALERTA_H} h (revisar)</span>}
          </>}
          {(vis === "etapa" || vis === "projeto") && <>
            <span><i style={{ background: "#dff0e3" }} />≥ 95% {vis === "etapa" ? "com etapa" : "com projeto"}</span>
            <span><i style={{ background: "#fbf0cf" }} />70–95%</span>
            <span><i style={{ background: "#fbdcd5" }} />&lt; 70%</span>
          </>}
          <span>Clique numa célula para ver as atividades.</span>
        </div>
        {alertas > 0 && <span className="alert-chip">{alertas} lançamento{alertas > 1 ? "s" : ""} acima de {ALERTA_H} h no dia</span>}
      </div>

      {ordenadas.length === 0 ? (
        <div className="empty">Nenhuma hora lançada neste período.</div>
      ) : (
        <div className="hm-wrap">
          <table className="hm">
            <thead>
              <tr>
                {th("nome", "Responsável Atividade", "name")}
                {th("horas", <>Horas<br />{vis === "etapa" ? "c/ Etapa" : vis === "projeto" ? "c/ Projeto" : "Trabalhadas"}</>)}
                {th("ativ", <>Qtd<br />Atividades</>)}
                {th("proj", <>Qtd.<br />Projetos</>)}
                {colunas.map((c) => th(c.key, c.label))}
              </tr>
            </thead>
            <tbody>
              {ordenadas.map((p) => {
                const tot = p.total;
                const totH = vis === "etapa" ? tot?.horas_com_etapa : vis === "projeto" ? tot?.horas_com_projeto : tot?.horas;
                return (
                  <tr key={p.id}>
                    <td className="name" title={p.nome}>{p.nome}</td>
                    <td className="num">{fmtH(totH)}</td>
                    <td className="num">{tot?.qtd_atividades}</td>
                    <td className="num">{tot?.qtd_projetos}</td>
                    {colunas.map((c) => {
                      const cell = p.cells.get(c.key);
                      const v = vis === "etapa" ? cell?.horas_com_etapa : vis === "projeto" ? cell?.horas_com_projeto : cell?.horas;
                      const pct = cell && cell.horas > 0 ? (v ?? 0) / cell.horas : undefined;
                      const styleV = vis === "etapa" || vis === "projeto" ? cell?.horas : v;
                      return (
                        <td key={c.key} className={cell ? "cell" : ""}
                          style={cell ? cellStyle(styleV, vis, c.ref, max, pct) : undefined}
                          title={cell ? `${p.nome} · ${fmtH(cell.horas)} h · ${cell.qtd_atividades} atividade(s)` : undefined}
                          onClick={cell ? () => {
                            const de = c.key;
                            const ate = modo === "ytd" ? iso(ano, Number(c.key.slice(5, 7)), diasNoMes(ano, Number(c.key.slice(5, 7)))) : c.key;
                            const titulo = modo === "ytd"
                              ? `${MESES_LONGOS[Number(c.key.slice(5, 7)) - 1]} de ${ano}`
                              : new Date(c.key + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
                            setDetalhe({ id: p.id, nome: p.nome, de, ate, titulo });
                          } : undefined}>
                          {cell ? fmtH(v) : ""}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p style={{ color: "var(--muted)", fontSize: 12, margin: "10px 0 0" }}>
        Fonte: DOit · período {inicio.split("-").reverse().join("/")} a {fim.split("-").reverse().join("/")}
      </p>
      {detalhe && <DetalheAtividades {...detalhe} onClose={() => setDetalhe(null)} />}
    </>
  );
}

type Atividade = {
  id: number; start_date: string; start_time: string | null; end_time: string | null; worked_minutes: number | null;
  project_name: string | null; phase_one: string | null; phase_two: string | null; name: string | null; status: string | null;
};

function DetalheAtividades({ id, nome, de, ate, titulo, onClose }: { id: number; nome: string; de: string; ate: string; titulo: string; onClose: () => void }) {
  const [itens, setItens] = useState<Atividade[] | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    createClient().from("doit_activities")
      .select("id,start_date,start_time,end_time,worked_minutes,project_name,phase_one,phase_two,name,status")
      .eq("responsible_id", id).gte("start_date", de).lte("start_date", ate).is("deleted_at", null)
      .order("start_date").order("start_time").limit(1000)
      .then(({ data, error }) => { if (error) setErro(error.message); else setItens((data ?? []) as Atividade[]); });
  }, [id, de, ate]);

  const total = (itens ?? []).reduce((s, a) => s + Number(a.worked_minutes ?? 0), 0) / 60;
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="Fechar">×</button>
        <h3>{nome}</h3>
        <div style={{ color: "var(--ink-soft)" }}>{titulo} · {fmtH(total)} h em {itens?.length ?? "…"} atividade(s)</div>
        {erro && <div className="msg err">{erro}</div>}
        {!itens ? <p>Carregando…</p> : (
          <table>
            <thead><tr><th>Data</th><th>Horário</th><th>Horas</th><th>Projeto</th><th>Etapa</th><th>Descrição</th></tr></thead>
            <tbody>
              {itens.map((a) => (
                <tr key={a.id}>
                  <td>{a.start_date.split("-").reverse().slice(0, 2).join("/")}</td>
                  <td>{a.start_time?.slice(0, 5)}–{a.end_time?.slice(0, 5)}</td>
                  <td>{fmtH(Number(a.worked_minutes ?? 0) / 60)}</td>
                  <td>{a.project_name ?? <em style={{ color: "#a3341f" }}>sem projeto</em>}</td>
                  <td>{[a.phase_one, a.phase_two].filter(Boolean).join(" › ") || <em style={{ color: "#a3341f" }}>sem etapa</em>}</td>
                  <td>{a.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

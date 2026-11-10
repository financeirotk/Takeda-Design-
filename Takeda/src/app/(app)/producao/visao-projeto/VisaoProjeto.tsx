"use client";

import { useMemo, useState } from "react";
import { Donut, cor, fmtN, fmtR } from "@/components/charts";
import "./visao.css";

export type Cubo = { responsible_id: number; responsible_name: string; etapa: string; mes: string; horas: number; custo: number; inicio: string; fim: string };
export type Fin = { id: number; date: string | null; due_date: string | null; credit: number | null; debit: number | null; account: string | null; category1: string | null; description: string | null };
export type Resumo = { horas_contratadas: number | null; fase: string | null; valor_hora: number };

const n = (v: unknown) => (v == null ? 0 : Number(v));
const mesLabel = (iso: string) => { const d = new Date(iso + "T12:00:00"); return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getFullYear()).slice(2)}`; };
const CORES_ETAPA: [RegExp, string][] = [
  [/^SEM ETAPA/, "#e9c46a"], [/CONCEITO/, "#b07aa1"], [/DEFINI/, "#9c755f"], [/ANTEPROJETO/, "#59a14f"],
  [/PR[ÉE]-?\s?EXECUTIVO/, "#e15759"], [/EXECUTIVO/, "#4e79a7"], [/LIBERAD|OBRA/, "#76b7b2"], [/PLANTIO/, "#8cd17d"],
];
function corEtapa(e: string, todas: string[]) {
  for (const [re, c] of CORES_ETAPA) if (re.test(e)) return c;
  return cor(todas.indexOf(e) + 3);
}
const k = (v: number) => `R$${fmtN(v / 1000, 1)}K`;

export function VisaoProjeto({ cubo, fin, resumo }: { cubo: Cubo[]; fin: Fin[]; resumo: Resumo }) {
  const [pessoa, setPessoa] = useState<number | null>(null);
  const [mes, setMes] = useState<string | null>(null);

  const rows = useMemo(() => cubo.map((r) => ({ ...r, horas: n(r.horas), custo: n(r.custo) })), [cubo]);
  const filtrado = useMemo(() => rows.filter((r) => (pessoa == null || r.responsible_id === pessoa) && (!mes || r.mes === mes)), [rows, pessoa, mes]);

  // cores por etapa, na ordem cronológica de início
  const etapas = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) if (!m.has(r.etapa) || r.inicio < m.get(r.etapa)!) m.set(r.etapa, r.inicio);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([e]) => e);
  }, [rows]);
  const corE = (e: string) => corEtapa(e, etapas);

  const horas = filtrado.reduce((s, r) => s + r.horas, 0);
  const custoMO = filtrado.reduce((s, r) => s + r.custo, 0);
  const contratadas = n(resumo.horas_contratadas);
  const pctH = contratadas ? horas / contratadas : null;

  // financeiro (não muda com os filtros de equipe/mês)
  // Receita = horas contratadas × valor da hora (configurável em app_config.valor_hora)
  // Recebido = créditos do financeiro do DOit que já caíram em conta (não "A Receber")
  const receitas = fin.filter((f) => n(f.credit) > 0);
  const recebido = receitas.filter((f) => !(f.account ?? "").toLowerCase().includes("receber")).reduce((s, f) => s + n(f.credit), 0);
  const valorHora = n(resumo.valor_hora) || 180;
  const receita = contratadas * valorHora;
  const aReceber = Math.max(receita - recebido, 0);
  const custosProj = fin.reduce((s, f) => s + n(f.debit), 0);
  const margem = receita - custoMO - custosProj;
  const receitaMes = useMemo(() => {
    const m = new Map<string, { rec: number; ar: number }>();
    for (const f of receitas) {
      const d = (f.date ?? f.due_date ?? "").slice(0, 7);
      if (!d) continue;
      const cur = m.get(d) ?? { rec: 0, ar: 0 };
      if ((f.account ?? "").toLowerCase().includes("receber")) cur.ar += n(f.credit); else cur.rec += n(f.credit);
      m.set(d, cur);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [receitas]);

  const porEtapa = etapas.map((e) => ({ e, h: filtrado.filter((r) => r.etapa === e).reduce((s, r) => s + r.horas, 0) })).filter((x) => x.h > 0);
  const maxEtapa = Math.max(1, ...porEtapa.map((x) => x.h));

  const equipe = useMemo(() => {
    const m = new Map<number, { nome: string; total: number; seg: Map<string, number> }>();
    for (const r of rows.filter((r) => !mes || r.mes === mes)) {
      const cur = m.get(r.responsible_id) ?? { nome: r.responsible_name, total: 0, seg: new Map() };
      cur.total += r.horas; cur.seg.set(r.etapa, (cur.seg.get(r.etapa) ?? 0) + r.horas);
      m.set(r.responsible_id, cur);
    }
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [rows, mes]);
  const maxEq = Math.max(1, ...equipe.map(([, v]) => v.total));

  const meses = useMemo(() => {
    const m = new Map<string, Map<string, number>>();
    for (const r of rows.filter((r) => pessoa == null || r.responsible_id === pessoa)) {
      const cur = m.get(r.mes) ?? new Map<string, number>();
      cur.set(r.etapa, (cur.get(r.etapa) ?? 0) + r.horas);
      m.set(r.mes, cur);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows, pessoa]);
  const maxMes = Math.max(1, ...meses.map(([, v]) => [...v.values()].reduce((a, b) => a + b, 0)));

  const crono = useMemo(() => {
    const m = new Map<string, { inicio: string; fim: string; h: number }>();
    for (const r of filtrado) {
      if (r.etapa === "SEM ETAPA") continue;
      const cur = m.get(r.etapa) ?? { inicio: r.inicio, fim: r.fim, h: 0 };
      if (r.inicio < cur.inicio) cur.inicio = r.inicio;
      if (r.fim > cur.fim) cur.fim = r.fim;
      cur.h += r.horas;
      m.set(r.etapa, cur);
    }
    return [...m.entries()].sort((a, b) => a[1].inicio.localeCompare(b[1].inicio));
  }, [filtrado]);
  const t = (s: string) => new Date(s + "T12:00:00").getTime();
  const cMin = crono.length ? Math.min(...crono.map(([, v]) => t(v.inicio))) : Date.now();
  const cMax = Math.max(Date.now(), ...crono.map(([, v]) => t(v.fim)));
  const cSpan = Math.max(1, cMax - cMin);
  const duracaoMeses = crono.length ? (Math.max(...crono.map(([, v]) => t(v.fim))) - cMin) / (30.44 * 86400000) : 0;
  const horasCrono = crono.reduce((s, [, v]) => s + v.h, 0);
  const ticks = Array.from({ length: 5 }, (_, i) => cMin + (cSpan * i) / 4);

  const filtroAtivo = pessoa != null || mes;
  const nomePessoa = pessoa != null ? equipe.find(([id]) => id === pessoa)?.[1].nome : null;

  return (
    <>
      {filtroAtivo && (
        <div className="filtro-ativo">
          Filtrando: {nomePessoa && <b>{nomePessoa}</b>}{nomePessoa && mes && " · "}{mes && <b>{mesLabel(mes)}</b>}
          <button className="btn-ghost" onClick={() => { setPessoa(null); setMes(null); }}>limpar</button>
        </div>
      )}
      <div className="vp2">
        {/* linha 1 */}
        <section className="card a-rec center">
          <Donut pct={receita ? Math.min(1, recebido / receita) : 0} cor="#2f5d8a" trilha="#bfe3d8" centro={receita ? k(receita) : "—"} rotulo="Receita" size={170} />
          <div className="legend" style={{ justifyContent: "center" }}>
            <span><i style={{ background: "#2f5d8a" }} />Recebida</span>{aReceber > 0 && <span><i style={{ background: "#bfe3d8" }} />A/R</span>}
          </div>
          <div className="big-s">{contratadas ? `${fmtN(contratadas)} h contratadas × R$${fmtN(valorHora)}` : "sem horas contratadas no DOit"}</div>
        </section>
        <section className="card a-rcb center">
          <Donut pct={receita ? Math.min(1, recebido / receita) : 1} cor="#2f5d8a" trilha="#e9c46a" centro={k(recebido)} rotulo="Recebido" size={170} />
          <div className="big-s">{receita ? `${fmtN((recebido / receita) * 100, 1)}% da receita · A/R ${k(aReceber)}` : "lançamentos do financeiro do DOit"}</div>
        </section>
        <section className="card a-hrs center">
          <div className="big">{fmtN(horas)} h</div>
          <div className="big-l">Horas trabalhadas</div>
          <div className="big-s">{pctH != null ? `${fmtN(pctH * 100, 1)}% h contratadas` : "sem horas contratadas no DOit"}</div>
          <div className="limite">
            {contratadas > 0 && <span className="lim-grey" style={{ width: `${Math.min(1, contratadas / Math.max(horas, contratadas)) * 100}%` }} />}
            <span className="lim-bar" style={{ width: `${(horas / Math.max(horas, contratadas || horas || 1)) * 100}%`, background: pctH != null && pctH > 1 ? "#e15759" : "#3e6fa3" }} />
            {contratadas > 0 && <span className="lim-txt" style={{ left: `calc(${Math.min(1, contratadas / Math.max(horas, contratadas)) * 100}% + 6px)` }}>{fmtN(contratadas)} h</span>}
          </div>
        </section>
        <section className="card a-eta">
          <div className="card-t">Etapa</div>
          {porEtapa.map((x) => (
            <div key={x.e} className="bh-row"><span className="bh-l" title={x.e}>{x.e === "SEM ETAPA" ? "NULL" : x.e}</span>
              <span className="bh-track"><span className="bh-bar" style={{ width: `${(x.h / maxEtapa) * 100}%` }}><span style={{ flex: 1, background: corE(x.e) }} /></span>
                <span className="bh-v">{fmtN(x.h)} h</span></span></div>
          ))}
        </section>

        {/* linha 2 */}
        <section className="card a-cus center">
          <div className="mid">{k(custoMO)}</div><div className="mid-l">Custo M.O. Direta</div>
          <div className="mid" style={{ marginTop: 14 }}>{custosProj ? k(custosProj) : "Nenhum"}</div><div className="mid-l">Custos Projeto</div>
        </section>
        <section className="card a-mar center">
          <Donut pct={receita ? Math.max(0, margem / receita) : 0} cor="#4f7fae" size={130}
            centro={receita ? `$${fmtN(margem / 1000, 1)}K` : "—"} rotulo={receita ? `Margem Contribuição ${fmtN((margem / receita) * 100, 1)}%` : "Margem"} />
        </section>
        <section className="card a-chm center"><div className="mid">${fmtN(horas ? custoMO / horas : 0)}</div><div className="mid-l">Custo Hora Média</div></section>
        <section className="card a-hmt center"><div className="mid">R${fmtN(horas ? receita / horas : 0)}</div><div className="mid-l">Hora Média Trabalhada</div></section>

        <section className="card a-equ">
          <div className="card-t">Equipe <small>(clique para filtrar)</small></div>
          <div className="scroll-y" style={{ maxHeight: 170 }}>
            {equipe.map(([id, v]) => (
              <div key={id} className={`bh-row click${pessoa != null && pessoa !== id ? " dim" : ""}`} onClick={() => setPessoa((p) => (p === id ? null : id))}>
                <span className="bh-l" title={v.nome}>{v.nome}</span>
                <span className="bh-track"><span className="bh-bar" style={{ width: `${(v.total / maxEq) * 100}%` }}>
                  {etapas.filter((e) => v.seg.get(e)).map((e) => <span key={e} title={`${e}: ${fmtN(v.seg.get(e))} h`} style={{ flex: v.seg.get(e), background: corE(e) }} />)}
                </span><span className="bh-v">{fmtN(v.total)} h</span></span>
              </div>
            ))}
          </div>
        </section>
        <section className="card a-hme">
          <div className="card-t">Horas Mês <small>(clique para filtrar)</small></div>
          <div className="vstack">
            {meses.map(([m, seg]) => {
              const tot = [...seg.values()].reduce((a, b) => a + b, 0);
              return (
                <div key={m} className={`vs-col${mes && mes !== m ? " dim" : ""}`} onClick={() => setMes((x) => (x === m ? null : m))} title={`${mesLabel(m)}: ${fmtN(tot)} h`}>
                  <span className="bv-v">{fmtN(tot)} h</span>
                  <span className="vs-bar" style={{ height: `${(tot / maxMes) * 120}px` }}>
                    {etapas.filter((e) => seg.get(e)).reverse().map((e) => <span key={e} style={{ flex: seg.get(e), background: corE(e) }} />)}
                  </span>
                  <span className="bv-l">{mesLabel(m)}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* linha 3 */}
        <section className="card a-rme">
          <div className="card-t">Recebimentos por mês <small>(financeiro do DOit)</small></div>
          {receitaMes.length === 0 ? <div className="empty">Sem lançamentos de receita no DOit.</div> : (
            <div className="vstack" style={{ height: 190 }}>
              {receitaMes.map(([m, v]) => {
                const max = Math.max(...receitaMes.map(([, x]) => x.rec + x.ar));
                return (
                  <div key={m} className="vs-col" title={`${m}: ${fmtR(v.rec + v.ar)}`}>
                    <span className="bv-v">{k(v.rec + v.ar)}</span>
                    <span className="vs-bar" style={{ height: `${((v.rec + v.ar) / max) * 130}px`, width: 34 }}>
                      {v.ar > 0 && <span style={{ flex: v.ar, background: "#bfe3d8" }} />}
                      {v.rec > 0 && <span style={{ flex: v.rec, background: "#2f5d8a" }} />}
                    </span>
                    <span className="bv-l">{m.slice(5, 7)}-{m.slice(2, 4)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
        <section className="card a-cro">
          <div className="card-t" style={{ fontWeight: 400 }}><b>Cronograma</b> Duração: {fmtN(duracaoMeses, 1)} m | Horas: {fmtN(horasCrono)} h | Fase Atual: {resumo.fase ?? "—"}</div>
          {crono.length === 0 ? <div className="empty">Sem lançamentos com etapa.</div> : (
            <div className="gantt">
              <div className="g-axis"><span /><div className="g-ticks">{ticks.map((x) => <span key={x}>{new Date(x).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })}</span>)}</div></div>
              {crono.map(([e, v]) => {
                const l = ((t(v.inicio) - cMin) / cSpan) * 100;
                const w = Math.max(0.8, ((t(v.fim) - t(v.inicio)) / cSpan) * 100);
                const dias = Math.round((t(v.fim) - t(v.inicio)) / 86400000) + 1;
                return (
                  <div key={e} className="g-row">
                    <span className="g-l" title={e}>{e}</span>
                    <span className="g-track">
                      <span className="g-bar" style={{ left: `${l}%`, width: `${w}%`, background: corE(e) }} />
                      <span className="g-txt" style={l + w > 78 ? { right: `calc(${100 - l}% + 6px)` } : { left: `calc(${l + w}% + 6px)` }}>{dias}d | {fmtN(v.h)}h</span>
                      <span className="g-hoje" style={{ left: `${((Date.now() - cMin) / cSpan) * 100}%` }} />
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
      <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 10 }}>
        Receita: horas contratadas × R$ {fmtN(valorHora)}. Recebido: lançamentos do financeiro do DOit vinculados ao projeto. Custo M.O.: custo das atividades registrado no DOit.
      </p>
    </>
  );
}

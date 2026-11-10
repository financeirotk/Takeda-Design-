"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { MESES } from "@/lib/periodo";

export function HorasFiltros({ ano, mes, modo, primeiroAno }: { ano: number; mes: number; modo: string; primeiroAno: number }) {
  const router = useRouter();
  const sp = useSearchParams();
  const go = (patch: Record<string, string | number>) => {
    const p = new URLSearchParams(sp.toString());
    Object.entries(patch).forEach(([k, v]) => p.set(k, String(v)));
    router.push(`?${p.toString()}`);
  };
  const anoAtual = new Date().getFullYear();
  const anos = Array.from({ length: anoAtual - primeiroAno + 1 }, (_, i) => anoAtual - i);
  const step = (delta: number) => {
    let m = mes + delta, a = ano;
    if (m < 1) { m = 12; a--; } else if (m > 12) { m = 1; a++; }
    go({ mes: m, ano: a });
  };

  return (
    <div className="filters">
      <div className="field">
        <label>Ano</label>
        <select value={ano} onChange={(e) => go({ ano: e.target.value })}>
          {anos.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <div className="field">
        <label>{modo === "ytd" ? "Até o mês" : "Mês"}</label>
        <div className="stepper">
          <select value={mes} onChange={(e) => go({ mes: e.target.value })}>
            {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <button aria-label="Mês anterior" onClick={() => step(-1)}>‹</button>
          <button aria-label="Próximo mês" onClick={() => step(1)}>›</button>
        </div>
      </div>
      <div className="pills">
        <button className={`pill${modo === "mes" ? " active" : ""}`} onClick={() => go({ modo: "mes" })}>Mês</button>
        <button className={`pill${modo === "ytd" ? " active" : ""}`} onClick={() => go({ modo: "ytd" })}>YTD</button>
      </div>
    </div>
  );
}

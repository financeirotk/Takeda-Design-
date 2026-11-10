"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type State = { entity: string; status: string; last_finished_at: string | null; last_started_at: string | null; last_error: string | null };

function ago(iso: string | null) {
  if (!iso) return "nunca";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `há ${h} h` : `há ${Math.round(h / 24)} d`;
}

export function SyncStatus({ entity = "activities" }: { entity?: string }) {
  const router = useRouter();
  const [s, setS] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const { data } = await createClient().from("sync_state").select("entity,status,last_finished_at,last_started_at,last_error").eq("entity", entity).single();
    setS(data as State | null);
    return data as State | null;
  }, [entity]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (s?.status !== "running" && !busy) return;
    const t = setInterval(async () => {
      const d = await load();
      if (d && d.status !== "running") { setBusy(false); router.refresh(); }
    }, 5000);
    return () => clearInterval(t);
  }, [s?.status, busy, load, router]);

  async function refreshNow() {
    setBusy(true); setNote("");
    const { data, error } = await createClient().functions.invoke("doit-sync", { body: { entity } });
    if (error) { setNote("Não foi possível iniciar."); setBusy(false); return; }
    if (data?.request === "ja_em_andamento_ou_recente") { setNote("Atualizado há menos de 5 min."); setBusy(false); }
    await load();
    router.refresh();
  }

  const running = busy || s?.status === "running";
  return (
    <div className="sync" title={s?.last_error ?? ""}>
      <i className={`dot${running ? " running" : ""}`} style={s?.last_error ? { background: "#c0392b" } : undefined} />
      {running ? "Sincronizando com o DOit…" : `DOit atualizado ${ago(s?.last_finished_at ?? null)}`}
      <button onClick={refreshNow} disabled={running}>Atualizar agora</button>
      {note && <span>{note}</span>}
    </div>
  );
}

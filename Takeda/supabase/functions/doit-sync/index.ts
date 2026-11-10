// doit-sync: copia dados do DOit para o Supabase, em partes.
// Chamado pelo cron (header x-sync-secret) ou pelo botão "Atualizar agora" (JWT de usuário direção/admin).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2.45.4";

const BASE = "https://takeda.doit.com.br/cgi-bin/WebObjects/takeda.woa/api/v2";
const BUDGET_MS = 110_000; // plano free: 150s de parede
const EST_PAGE_MS: Record<string, number> = { activities: 6_000, projects: 25_000, contacts: 5_000, financial: 4_000 };

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: CORS });

const d = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v : null);
const n = (v: unknown) => (typeof v === "number" ? v : v == null || v === "" ? null : Number(v));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function dedupe<T extends Record<string, unknown>>(rows: T[], key: (r: T) => string): T[] {
  const m = new Map<string, T>();
  for (const r of rows) m.set(key(r), r);
  return [...m.values()];
}

async function doitGet(path: string): Promise<any[]> {
  const auth = "Basic " + btoa(`${Deno.env.get("DOIT_USER") ?? "api"}:${Deno.env.get("DOIT_PASSWORD")}`);
  let last = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(`${BASE}${path}`, { headers: { Authorization: auth, Accept: "application/json" } });
    const text = await r.text();
    if (r.ok) {
      try { const j = JSON.parse(text); if (Array.isArray(j)) return j; } catch { /* html de erro */ }
    }
    if ((r.status === 404 || r.status === 403) && path.startsWith("/financialRecords")) return [];
    last = `HTTP ${r.status}: ${text.slice(0, 200)}`;
    if (r.status === 401 || r.status === 416) break;
    await sleep(4000 * (attempt + 1));
  }
  throw new Error(`DOit ${path} -> ${last}`);
}

function personRow(p: any) {
  return { id: p.id, name: d(p.name), email: d(p.email)?.replace(/​/g, "") ?? null, login: d(p.login),
    function: d(p.function ?? p.functionAtTime), leader: p.leader ?? null, raw: p, synced_at: new Date().toISOString() };
}

async function upsert(sb: SupabaseClient, table: string, rows: any[], onConflict = "id") {
  if (!rows.length) return;
  const { error } = await sb.from(table).upsert(rows, { onConflict });
  if (error) throw new Error(`${table}: ${error.message}`);
}

async function savePage(sb: SupabaseClient, entity: string, items: any[], cycle: number) {
  const now = new Date().toISOString();
  if (entity === "activities") {
    const rows = items.map((x) => ({
      id: x.id, name: d(x.name), status: d(x.status), chargeable_status: d(x.chargeableStatus),
      start_date: d(x.startDate), end_date: d(x.endDate), start_time: d(x.startTime), end_time: d(x.endTime),
      worked_minutes: n(x.workedTime), cost: n(x.cost), cost_to_charge: n(x.costToCharge),
      project_id: x.project?.id ?? null, project_name: d(x.project?.name),
      responsible_id: x.responsible?.id ?? null, responsible_name: d(x.responsible?.name),
      responsible_function: d(x.responsible?.functionAtTime ?? x.responsible?.function),
      responsible_cost_at_time: n(x.responsible?.costAtTime),
      phase_one: d(x.phaseOne?.name), phase_two: d(x.phaseTwo?.name),
      raw: x, synced_at: now, last_seen_cycle: cycle, deleted_at: null,
    }));
    const people = items.map((x) => x.responsible).filter((p) => p?.id != null).map(personRow);
    await upsert(sb, "doit_people", dedupe(people, (r) => String(r.id)));
    await upsert(sb, "doit_activities", dedupe(rows, (r) => String(r.id)));
  } else if (entity === "projects") {
    const rows = items.map((x) => {
      const details: Record<string, unknown> = {};
      for (const it of x.details ?? []) if (it?.customKey) details[it.customKey] = it.value;
      return {
        id: x.id, name: d(x.name),
        status_name: d(x.status?.name), status_color: d(x.status?.color), status_order: n(x.status?.order), status_hidden: x.status?.isHidden ?? null,
        customer_id: x.customer?.id ?? null, customer_name: d(x.customer?.name),
        created_at_doit: d(x.createdAt), start_date: d(x.startDate), target_finish_date: d(x.targetFinishDate), dt_mod: d(x.dtMod),
        percent_done: n(x.percentDone),
        hired_minutes: n(x.activitiesInfo?.hiredMinutes), spent_minutes: n(x.activitiesInfo?.spentMinutes), paid_minutes: n(x.activitiesInfo?.paidMinutes),
        considerar_dashboard: details["Considerar no Dashboard"] == null ? null : String(details["Considerar no Dashboard"]) === "true",
        details, phases: x.phases ?? null,
        raw: x, synced_at: now, last_seen_cycle: cycle, deleted_at: null,
      };
    });
    const links: any[] = [];
    const people: any[] = [];
    for (const x of items) {
      for (const [role, list] of [["member", x.members], ["participant", x.participants], ["responsible", x.responsibles]] as const) {
        for (const p of list ?? []) {
          if (p?.id == null) continue;
          people.push(personRow(p));
          links.push({ project_id: x.id, person_id: p.id, role });
        }
      }
    }
    await upsert(sb, "doit_people", dedupe(people, (r) => String(r.id)));
    await upsert(sb, "doit_projects", dedupe(rows, (r) => String(r.id)));
    const ids = rows.map((r) => r.id);
    if (ids.length) {
      const { error } = await sb.from("doit_project_people").delete().in("project_id", ids);
      if (error) throw new Error(`doit_project_people delete: ${error.message}`);
    }
    await upsert(sb, "doit_project_people", dedupe(links, (r) => `${r.project_id}|${r.person_id}|${r.role}`), "project_id,person_id,role");
  } else if (entity === "financial") {
    const rows = items.map((x) => ({
      id: x.id, project_id: x.project?.id ?? null, project_name: d(x.project?.name),
      date: d(x.date), due_date: d(x.dueDate), issue_date: d(x.issueDate),
      credit: n(x.credit), debit: n(x.debit), balance: n(x.balance),
      account: d(x.account), type: d(x.type), department: d(x.department),
      category1: d(x.categoryFirstLevel), category2: d(x.categorySecondLevel), category3: d(x.categoryThirdLevel),
      description: d(x.description), from_to: d(typeof x.fromTo === "string" ? x.fromTo : x.fromTo?.name),
      raw: x, synced_at: now, last_seen_cycle: cycle, deleted_at: null,
    }));
    await upsert(sb, "doit_financial", dedupe(rows, (r) => String(r.id)));
  } else if (entity === "contacts") {
    const rows = items.map((x) => ({
      id: x.id, name: d(x.name), type: d(x.type), account_balance: n(x.accountBalance), remaining_credit: n(x.remainingCredit),
      created_at_doit: d(x.createdAt), modified_at: d(x.modifiedAt), raw: x, synced_at: now, last_seen_cycle: cycle, deleted_at: null,
    }));
    await upsert(sb, "doit_contacts", dedupe(rows, (r) => String(r.id)));
  }
}

async function runLoop(sb: SupabaseClient) {
  const t0 = Date.now();
  const report: any[] = [];
  while (Date.now() - t0 < BUDGET_MS - 10_000) {
    const { data: claimed, error } = await sb.rpc("sync_claim");
    if (error) throw new Error(`sync_claim: ${error.message}`);
    const s = (claimed as any[])?.[0];
    if (!s) break;
    const est = EST_PAGE_MS[s.entity] ?? 10_000;
    let page = s.next_page as number;
    let pages = 0, rows = 0, finished = false;
    try {
      if (s.entity === "financial") {
        // financeiro: a API exige filtro; percorre projeto a projeto (next_page = posição na lista)
        const { data: projs, error: pe } = await sb.from("doit_projects").select("id").is("deleted_at", null).order("id");
        if (pe) throw new Error(pe.message);
        const ids = (projs ?? []).map((x: any) => x.id);
        let idx = page - 1;
        while (idx < ids.length && Date.now() - t0 + est < BUDGET_MS) {
          let items: any[] = [];
          for (let pg = 1; pg < 50; pg++) {
            const part = await doitGet(`/financialRecords?projectID=${ids[idx]}&page=${pg}&limit=200`);
            items = items.concat(part);
            if (part.length < 200) break;
          }
          if (items.length) await savePage(sb, "financial", items, s.cycle);
          idx++; pages++; rows += items.length;
          await sb.rpc("sync_advance", { p_entity: s.entity, p_next_page: idx + 1, p_rows: items.length });
        }
        page = idx + 1;
        finished = idx >= ids.length;
      } else
      while (Date.now() - t0 + est < BUDGET_MS) {
        const items = await doitGet(`/${s.entity}?page=${page}&limit=${s.page_size}`);
        if (items.length) await savePage(sb, s.entity, items, s.cycle);
        page++; pages++; rows += items.length;
        await sb.rpc("sync_advance", { p_entity: s.entity, p_next_page: page, p_rows: items.length });
        if (items.length < s.page_size) { finished = true; break; }
      }
      if (finished) await sb.rpc("sync_finish", { p_entity: s.entity });
      else await sb.rpc("sync_release", { p_entity: s.entity, p_error: null });
      report.push({ entity: s.entity, pages, rows, nextPage: page, finished });
    } catch (e) {
      await sb.rpc("sync_release", { p_entity: s.entity, p_error: String(e).slice(0, 500) });
      report.push({ entity: s.entity, pages, rows, error: String(e) });
      break;
    }
  }
  return { ms: Date.now() - t0, report };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const body = await req.json().catch(() => ({}));

  // 1) cron
  const secret = req.headers.get("x-sync-secret");
  if (secret) {
    const { data } = await admin.rpc("get_sync_secret");
    if (!data || secret !== data) return json({ error: "unauthorized" }, 401);
    try {
      return json({ ok: true, mode: "cron", ...(await runLoop(admin)) });
    } catch (e) {
      return json({ ok: false, mode: "cron", error: String(e) }, 500);
    }
  }

  // 2) botão "Atualizar agora" (usuário logado com papel direção/admin)
  const authz = req.headers.get("Authorization") ?? "";
  if (!authz.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authz } }, auth: { persistSession: false } });
  const { data: u } = await userClient.auth.getUser();
  if (!u?.user) return json({ error: "unauthorized" }, 401);
  const { data, error } = await userClient.rpc("sync_request", { p_entity: body.entity ?? "all" });
  if (error) return json({ error: error.message }, 403);

  // roda em segundo plano e responde na hora; a tela acompanha pelo sync_state
  // @ts-ignore EdgeRuntime existe no runtime do Supabase
  EdgeRuntime.waitUntil(runLoop(admin).catch((e) => console.error("manual sync", e)));
  return json({ ok: true, mode: "manual", request: data });
});

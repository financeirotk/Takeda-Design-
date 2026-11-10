import { createClient } from "@/lib/supabase/server";
import { SyncStatus } from "@/components/SyncStatus";
import { ProjetoPicker } from "./ProjetoPicker";
import { VisaoProjeto, type Cubo, type Fin } from "./VisaoProjeto";
import { lerFiltros } from "@/lib/filtros";

type SP = Promise<Record<string, string | undefined>>;

export default async function VisaoProjetoPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const supabase = await createClient();

  const f = lerFiltros(sp);
  const { data: lista } = await supabase.from("v_projetos_numeros").select("id,name,status_name,considerar_dashboard,coordenador,plataforma").order("name", { ascending: false }).limit(3000);
  let id = Number(sp.id) || 0;
  if (!id) {
    let q = supabase.from("v_projetos_painel").select("id").eq("status_name", "Em Andamento");
    if (f.coord) q = q.eq("coordenador", f.coord);
    if (f.plat) q = q.eq("plataforma", f.plat);
    const { data: top } = await q.order("horas_30d", { ascending: false }).limit(1);
    id = top?.[0]?.id ?? lista?.[0]?.id ?? 0;
  }

  const [{ data: p }, { data: cubo }, { data: fin }, { data: cfg }] = await Promise.all([
    supabase.from("doit_projects").select("id,name,customer_name,status_name,hired_minutes,details").eq("id", id).single(),
    supabase.from("v_projeto_cubo").select("responsible_id,responsible_name,etapa,mes,horas,custo,inicio,fim").eq("project_id", id).limit(5000),
    supabase.from("doit_financial").select("id,date,due_date,credit,debit,account,category1,description").eq("project_id", id).is("deleted_at", null).limit(2000),
    supabase.from("app_config").select("valor").eq("chave", "valor_hora").maybeSingle(),
  ]);

  const det = (p?.details ?? {}) as Record<string, string>;
  return (
    <>
      <div className="topbar">
        <div>
          <p className="page-kicker">Projetos</p>
          <h1 className="page-title">Visão Projeto</h1>
        </div>
        <ProjetoPicker projetos={(lista ?? []) as { id: number; name: string; status_name: string; coordenador: string | null; considerar_dashboard: boolean | null; plataforma: string | null }[]} atual={id} />
        <SyncStatus entity="activities" />
      </div>
      {!p ? <div className="card empty">Projeto não encontrado.</div> : (
        <>
          <div className="proj-title">
            <h2>{p.name}{p.customer_name && <span> | {p.customer_name}</span>}</h2>
            <div className="chips">
              <span className="chip">{p.status_name}</span>
              {det["Coordenador"] && <span className="chip">Coord.: {det["Coordenador"]}</span>}
              {det["Padrão"] && <span className="chip">Padrão {det["Padrão"]}</span>}
              {det["Tamanho"] && <span className="chip">Tamanho {det["Tamanho"]}</span>}
              {det["Tipo de Projeto"] && <span className="chip">{det["Tipo de Projeto"]}</span>}
            </div>
          </div>
          <VisaoProjeto cubo={(cubo ?? []) as Cubo[]} fin={(fin ?? []) as Fin[]}
            resumo={{ horas_contratadas: p.hired_minutes == null ? null : Number(p.hired_minutes) / 60, fase: det["Fase"] ?? null, valor_hora: Number(cfg?.valor ?? 180) }} />
        </>
      )}
    </>
  );
}

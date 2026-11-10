import { createClient } from "@/lib/supabase/server";
import { SyncStatus } from "@/components/SyncStatus";
import { lerFiltros } from "@/lib/filtros";
import { Inicio, type KpisInicio, type ProjAlerta } from "./Inicio";

type SP = Promise<Record<string, string | undefined>>;

export default async function InicioPage({ searchParams }: { searchParams: SP }) {
  const f = lerFiltros(await searchParams);
  const supabase = await createClient();
  const [{ data: k }, { data: proj }, { data: semUf }] = await Promise.all([
    supabase.rpc("kpis_inicio", { p_coord: f.coord, p_plat: f.plat }),
    supabase.from("v_projetos_painel").select("id,name,status_name,coordenador,considerar_dashboard,plataforma,horas_contratadas,horas_realizadas,pct_horas_contratadas,dias_sem_lancamento,horas_30d").limit(2000),
    supabase.from("v_projetos_numeros").select("id,name,status_name,coordenador,considerar_dashboard,plataforma").is("uf", null).in("status_name", ["Em Andamento", "On hold"]).limit(500),
  ]);
  return (
    <>
      <div className="topbar">
        <div>
          <p className="page-kicker">Visão geral</p>
          <h1 className="page-title">Início</h1>
        </div>
        <SyncStatus entity="activities" />
      </div>
      <Inicio k={(k ?? {}) as KpisInicio} projetos={(proj ?? []) as ProjAlerta[]} semUf={(semUf ?? []) as ProjAlerta[]} />
    </>
  );
}

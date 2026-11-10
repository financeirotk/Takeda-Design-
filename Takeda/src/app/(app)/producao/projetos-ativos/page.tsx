import { createClient } from "@/lib/supabase/server";
import { SyncStatus } from "@/components/SyncStatus";
import { ProjetosAtivos, type Projeto } from "./ProjetosAtivos";

export default async function ProjetosAtivosPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("v_projetos_painel").select("*").limit(2000);
  if (error) throw new Error(error.message);
  return (
    <>
      <div className="topbar">
        <div>
          <p className="page-kicker">Produção</p>
          <h1 className="page-title">Projetos Ativos</h1>
        </div>
        <SyncStatus entity="projects" />
      </div>
      <ProjetosAtivos projetos={(data ?? []) as Projeto[]} />
    </>
  );
}

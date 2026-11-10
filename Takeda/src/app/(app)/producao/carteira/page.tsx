import { createClient } from "@/lib/supabase/server";
import { SyncStatus } from "@/components/SyncStatus";
import { Numeros, type PN } from "./Numeros";

export default async function CarteiraPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("v_projetos_numeros").select("*").limit(3000);
  if (error) throw new Error(error.message);
  return (
    <>
      <div className="topbar">
        <div>
          <p className="page-kicker">Projetos</p>
          <h1 className="page-title">Carteira de Projetos</h1>
        </div>
        <SyncStatus entity="projects" />
      </div>
      <Numeros dados={(data ?? []) as PN[]} />
    </>
  );
}

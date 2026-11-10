import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("nome,papel,ativo").eq("id", user.id).single();
  const allowed = !!(profile?.ativo && (profile.papel === "admin" || profile.papel === "direcao"));

  let coords: string[] = [];
  if (allowed) {
    // consulta leve (a view do painel é pesada e o layout roda em toda navegação)
    const { data } = await supabase.from("doit_projects").select("coordenador:details->>Coordenador").is("deleted_at", null).in("status_name", ["Em Andamento", "On hold"]).limit(2000);
    coords = [...new Set((data ?? []).map((r) => r.coordenador ?? "(sem coordenador)"))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }

  return (
    <AppShell nome={profile?.nome ?? user.email ?? ""} papel={profile?.papel ?? "sem acesso"} admin={profile?.papel === "admin"} allowed={allowed} coords={coords}>
      {allowed ? children : (
        <div className="card empty">
          <h2>Acesso pendente</h2>
          <p>Seu login funcionou, mas seu e-mail ({user.email}) não está liberado. Fale com a direção.</p>
        </div>
      )}
    </AppShell>
  );
}

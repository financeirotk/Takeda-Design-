import { createClient } from "@/lib/supabase/server";
import { SyncStatus } from "@/components/SyncStatus";
import { HorasFiltros } from "./HorasFiltros";
import { HorasHeatmap, type Linha } from "./HorasHeatmap";
import { iso, diasNoMes } from "@/lib/periodo";
import { lerFiltros } from "@/lib/filtros";
import { Info } from "@/components/Info";

type SP = Promise<Record<string, string | undefined>>;

export default async function DetalhesHorasPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const hoje = new Date();
  const ano = Number(sp.ano) || hoje.getFullYear();
  const mes = Math.min(12, Math.max(1, Number(sp.mes) || hoje.getMonth() + 1));
  const modo = sp.modo === "ytd" ? "ytd" : "mes";
  const vis = (["trabalhadas", "acima", "etapa", "projeto"].includes(sp.vis ?? "") ? sp.vis : "acima") as
    "trabalhadas" | "acima" | "etapa" | "projeto";
  const lim = Number(sp.lim) || 8;
  const f = lerFiltros(sp);

  const inicio = modo === "ytd" ? iso(ano, 1, 1) : iso(ano, mes, 1);
  const fim = iso(ano, mes, diasNoMes(ano, mes));

  const supabase = await createClient();
  const rows: Linha[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .rpc("horas_equipe", { p_inicio: inicio, p_fim: fim, p_granularidade: modo === "ytd" ? "mes" : "dia", p_coord: f.coord, p_plat: f.plat })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as Linha[]));
    if (!data || data.length < 1000) break;
  }

  const { data: anosData } = await supabase.from("doit_activities").select("start_date").order("start_date", { ascending: true }).not("start_date", "is", null).limit(1);
  const primeiroAno = anosData?.[0]?.start_date ? Number(anosData[0].start_date.slice(0, 4)) : ano - 3;

  return (
    <>
      <div className="topbar">
        <div>
          <p className="page-kicker">Produção</p>
          <h1 className="page-title">Horas da Equipe <Info texto="Horas lançadas no DOit por pessoa e dia. Com filtro de coordenador ou de plataforma (CAD/BIM), conta só as horas nos projetos correspondentes. Status e 'considerar no painel' não se aplicam aqui (são filtros de projeto)." /></h1>
        </div>
        <HorasFiltros ano={ano} mes={mes} modo={modo} primeiroAno={Math.max(primeiroAno, 2015)} />
        <SyncStatus entity="activities" />
      </div>
      <section className="card">
        <HorasHeatmap rows={rows} ano={ano} mes={mes} modo={modo} vis={vis} lim={lim} inicio={inicio} fim={fim} />
      </section>
    </>
  );
}

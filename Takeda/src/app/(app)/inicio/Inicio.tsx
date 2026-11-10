"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Kpi, fmtN, fmtR } from "@/components/charts";
import { Info } from "@/components/Info";
import { ModalProjetos, type ItemProjeto } from "@/components/ModalProjetos";
import { lerFiltros, passaFiltros, qsGlobais } from "@/lib/filtros";
import { MESES } from "@/lib/periodo";

type Serie = { mes: string; v: number }[] | null;
type Snap = { dia: string; andamento: number; hold: number; vermelho: number; parados: number; sem_contratadas: number; area: number } | null;
export type KpisInicio = {
  hoje: string; ini: string; ini_ant: string; fim_ant: string;
  horas_mes: number; horas_ant: number; pessoas_mes: number; pessoas_ant: number; projetos_mes: number; projetos_ant: number;
  receb_mes: number; receb_ant: number; serie_horas: Serie; serie_receb: Serie;
  acima14: { responsible_id: number; nome: string; dia: string; horas: number }[] | null;
  snap: Snap; snap_ref: Snap;
};
export type ProjAlerta = {
  id: number; name: string; status_name: string; coordenador: string | null; considerar_dashboard: boolean | null; plataforma?: string | null;
  horas_contratadas?: number | null; horas_realizadas?: number | null; pct_horas_contratadas?: number | null; dias_sem_lancamento?: number | null; horas_30d?: number | null;
};

const dm = (iso?: string) => (iso ? iso.split("-").reverse().slice(0, 2).join("/") : "");

export function Inicio({ k, projetos, semUf }: { k: KpisInicio; projetos: ProjAlerta[]; semUf: ProjAlerta[] }) {
  const sp = useSearchParams();
  const f = lerFiltros(sp);
  const g = qsGlobais(new URLSearchParams(sp.toString()));
  const [modal, setModal] = useState<null | { titulo: string; itens: ItemProjeto[] }>(null);
  const [diasParado, setDiasParado] = useState(30);
  // a foto diária da carteira é por coordenador (sem plataforma) e conta parados com corte de 30 dias
  const snapOk = !f.plat;

  const base = useMemo(() => projetos.filter((p) => passaFiltros(p, f)), [projetos, f]);
  const andamento = base.filter((p) => p.status_name === "Em Andamento");
  const vermelho = andamento.filter((p) => Number(p.pct_horas_contratadas ?? 0) > 1).sort((a, b) => Number(b.pct_horas_contratadas) - Number(a.pct_horas_contratadas));
  const parados = andamento.filter((p) => p.dias_sem_lancamento == null || Number(p.dias_sem_lancamento) > diasParado)
    .sort((a, b) => Number(b.dias_sem_lancamento ?? 99999) - Number(a.dias_sem_lancamento ?? 99999));
  const semContr = andamento.filter((p) => !Number(p.horas_contratadas ?? 0));
  const semEstado = semUf.filter((p) => passaFiltros(p, f));
  const acima14 = k.acima14 ?? [];

  const periodo = `${dm(k.ini)}–${dm(k.hoje)} vs ${dm(k.ini_ant)}–${dm(k.fim_ant)}`;
  const snapRot = k.snap_ref ? `vs ${dm(k.snap_ref.dia)}` : "";
  const dl = (atual: number | undefined, ant: number | undefined, melhor: "neutro" | "desce", ok = snapOk) =>
    ok ? { atual: atual ?? 0, anterior: ant, rotulo: snapRot, melhor } : undefined;
  const SelDias = () => (
    <span className="pills pills-mini" onClick={(e) => e.stopPropagation()}>
      {[30, 60, 90].map((d) => <button key={d} className={`pill${diasParado === d ? " active" : ""}`} onClick={() => setDiasParado(d)}>{d}d</button>)}
    </span>
  );
  const serie = (s: Serie) => (s ?? []).slice(0, -1).map((x) => Number(x.v));

  const alertas = [
    { n: vermelho.length, t: "projetos passaram das horas contratadas", cor: "#b8203a",
      abrir: () => setModal({ titulo: "Projetos no vermelho (acima das horas contratadas)", itens: vermelho.map((p) => ({ id: p.id, name: p.name, status: p.status_name, extra: `${fmtN(Number(p.pct_horas_contratadas) * 100)}% do contratado` })) }) },
    { n: parados.length, t: `projetos em andamento sem lançar horas há mais de ${diasParado} dias`, cor: "#b8203a", key: "parados",
      abrir: () => setModal({ titulo: `Em andamento e sem horas há mais de ${diasParado} dias`, itens: parados.map((p) => ({ id: p.id, name: p.name, extra: p.dias_sem_lancamento == null ? "nunca lançou" : `há ${p.dias_sem_lancamento} dias` })) }) },
    { n: acima14.length, t: "lançamentos com mais de 14h num único dia (este mês e o anterior)", cor: "#c77d16", href: `/producao/horas${g}` },
    { n: semContr.length, t: "projetos em andamento sem horas contratadas no DOit", cor: "#c77d16",
      abrir: () => setModal({ titulo: "Em andamento sem horas contratadas cadastradas", itens: semContr.map((p) => ({ id: p.id, name: p.name, extra: `${fmtN(Number(p.horas_realizadas ?? 0))} h lançadas` })) }) },
    { n: semEstado.length, t: "projetos sem cidade/estado identificável no nome", cor: "#6b6b6b",
      abrir: () => setModal({ titulo: "Projetos sem estado identificado", itens: semEstado.map((p) => ({ id: p.id, name: p.name, status: p.status_name })) }) },
  ].filter((a) => a.n > 0);

  return (
    <>
      <section className="card atencao">
        <div className="card-t">Precisa de atenção {f.coord && <small>· {f.coord}</small>}</div>
        {alertas.length === 0 ? <div className="kpi-s">Nada pendente com os filtros atuais.</div> : (
          <ul>
            {alertas.map((a) => (
              <li key={a.key ?? a.t}>
                {a.href ? (
                  <Link href={a.href} className="alerta"><b style={{ background: a.cor }}>{a.n}</b><span>{a.t}</span><i>ver ›</i></Link>
                ) : (
                  <div className="alerta" role="button" tabIndex={0} onClick={a.abrir}><b style={{ background: a.cor }}>{a.n}</b><span>{a.t}</span>{a.key === "parados" && <SelDias />}<i>ver ›</i></div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <h2 className="secao">Este mês <small>{periodo}</small> <Info texto="Compara do dia 1 até ontem com o mesmo intervalo do mês anterior, para a comparação ser justa. O dia de hoje fica de fora porque os lançamentos ainda não terminaram." /></h2>
      <div className="kpi-grid">
        <Kpi valor={`${fmtN(k.horas_mes)} h`} rotulo="Horas lançadas" delta={{ atual: k.horas_mes, anterior: k.horas_ant, rotulo: "vs mês anterior", melhor: "neutro" }}
          spark={serie(k.serie_horas)} sub="tendência: últimos 12 meses fechados" info={<Info texto="Soma das horas das atividades no DOit. Com filtro de coordenador, conta só projetos dele." />} />
        <Kpi valor={k.pessoas_mes} rotulo="Pessoas lançando horas" delta={{ atual: k.pessoas_mes, anterior: k.pessoas_ant, rotulo: "vs mês anterior", melhor: "neutro" }} />
        <Kpi valor={k.projetos_mes} rotulo="Projetos com horas no mês" delta={{ atual: k.projetos_mes, anterior: k.projetos_ant, rotulo: "vs mês anterior", melhor: "neutro" }} />
        <Kpi valor={fmtR(k.receb_mes)} rotulo="Recebimentos" delta={{ atual: k.receb_mes, anterior: k.receb_ant, rotulo: "vs mês anterior", melhor: "sobe" }}
          spark={serie(k.serie_receb)} sub="tendência: últimos 12 meses fechados" info={<Info texto="Créditos do financeiro do DOit que já caíram em conta (exclui a conta 'A Receber'), pela data do lançamento." />} />
      </div>

      <h2 className="secao">Carteira <small>{k.snap_ref ? `comparada com ${dm(k.snap_ref.dia)}` : `histórico começa a contar em ${dm(k.snap?.dia)}`}</small>
        <Info texto="Todo dia às 2h50 a intranet guarda uma foto da carteira (quantos projetos em andamento, parados etc.). A comparação usa a foto de 30 dias atrás. Ela aparece quando houver histórico suficiente." /></h2>
      <div className="kpi-grid">
        <Kpi valor={andamento.length} rotulo="Em andamento" delta={dl(k.snap?.andamento, k.snap_ref?.andamento, "neutro")}
          onClick={() => setModal({ titulo: "Projetos em andamento", itens: andamento.map((p) => ({ id: p.id, name: p.name, extra: `${fmtN(Number(p.horas_30d ?? 0))} h em 30d` })) })} sub="clique para listar" />
        <Kpi valor={base.length - andamento.length} rotulo="On hold" delta={dl(k.snap?.hold, k.snap_ref?.hold, "neutro")}
          onClick={() => setModal({ titulo: "Projetos on hold", itens: base.filter((p) => p.status_name !== "Em Andamento").map((p) => ({ id: p.id, name: p.name })) })} sub="clique para listar" />
        <Kpi valor={vermelho.length} rotulo="No vermelho" destaque="#b8203a" delta={dl(k.snap?.vermelho, k.snap_ref?.vermelho, "desce")}
          onClick={alertas.find((a) => a.t.startsWith("projetos passaram"))?.abrir} info={<Info texto="Em andamento com horas lançadas acima das horas contratadas no DOit." />} />
        <Kpi valor={parados.length} rotulo={`Parados há ${diasParado}+ dias`} destaque="#b8203a" delta={dl(k.snap?.parados, k.snap_ref?.parados, "desce", snapOk && diasParado === 30)} sub={<SelDias />}
          onClick={alertas.find((a) => a.key === "parados")?.abrir} info={<Info texto="Em andamento sem nenhuma hora lançada no período escolhido (30, 60 ou 90 dias). A comparação com o mês anterior só aparece no recorte de 30 dias." />} />
      </div>

      <h2 className="secao">Atalhos</h2>
      <div className="atalhos">
        <Link href={`/producao/horas${g}`} className="card atalho"><b>Horas da Equipe</b><span>lançamentos por pessoa e dia</span></Link>
        <Link href={`/producao/projetos-ativos${g}`} className="card atalho"><b>Projetos Ativos</b><span>carteira, fases e horas excedentes</span></Link>
        <Link href={`/producao/visao-projeto${g}`} className="card atalho"><b>Visão Projeto</b><span>receita, equipe e cronograma</span></Link>
        <Link href={`/producao/carteira${g}`} className="card atalho"><b>Carteira de Projetos</b><span>mapa, padrões, escala e lead time</span></Link>
      </div>
      <p className="kpi-s" style={{ marginTop: 12 }}>Meses na tendência: {(k.serie_horas ?? []).slice(0, -1).map((x) => MESES[new Date(x.mes + "T12:00:00").getMonth()]).join(" · ")}</p>

      {modal && <ModalProjetos titulo={modal.titulo} itens={modal.itens} onClose={() => setModal(null)} />}
    </>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { qsGlobais } from "@/lib/filtros";

type Item = { href: string; label: string; soon?: boolean };
const GROUPS: { title: string; items: Item[] }[] = [
  { title: "Visão geral", items: [{ href: "/inicio", label: "Início" }] },
  { title: "Produção", items: [
    { href: "/producao/horas", label: "Horas da Equipe" },
    { href: "/producao/projetos-ativos", label: "Projetos Ativos" },
    { href: "/producao/visao-projeto", label: "Visão Projeto" },
    { href: "/producao/carteira", label: "Carteira de Projetos" },
  ]},
  { title: "Financeiro", items: [{ href: "/financeiro", label: "Visão Financeira", soon: true }] },
  { title: "Comercial", items: [{ href: "/comercial", label: "Funil e Propostas", soon: true }] },
];

export function Nav({ admin = false, onNavigate }: { admin?: boolean; onNavigate?: () => void }) {
  const path = usePathname();
  const sp = useSearchParams();
  const g = qsGlobais(new URLSearchParams(sp.toString()));
  const groups = admin ? [...GROUPS, { title: "Administração", items: [{ href: "/admin/acessos", label: "Acessos" }] }] : GROUPS;
  return (
    <>
      {groups.map((gr) => (
        <nav className="nav-group" key={gr.title}>
          <h4>{gr.title}</h4>
          {gr.items.map((i) => (
            <Link key={i.href} href={`${i.href}${i.soon ? "" : g}`} onClick={onNavigate}
              className={`nav-link${path.startsWith(i.href) ? " active" : ""}${i.soon ? " soon" : ""}`}>
              {i.label}
            </Link>
          ))}
        </nav>
      ))}
    </>
  );
}

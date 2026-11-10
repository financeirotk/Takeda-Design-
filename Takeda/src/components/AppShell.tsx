"use client";

import { Suspense, useState } from "react";
import { Nav } from "./Nav";
import { LogoMark } from "./Logo";
import { BarraFiltros } from "./BarraFiltros";
import { Busca } from "./Busca";

export function AppShell({ nome, papel, admin, allowed, coords, children }: {
  nome: string; papel: string; admin: boolean; allowed: boolean; coords: string[]; children: React.ReactNode;
}) {
  const [menu, setMenu] = useState(false);
  return (
    <div className="shell">
      <aside className={`sidebar${menu ? " aberto" : ""}`}>
        <div className="brand">
          <LogoMark /> TAKEDA
          <button className="menu-btn" onClick={() => setMenu((v) => !v)} aria-label="Menu">{menu ? "✕" : "☰"}</button>
        </div>
        <div className="sidebar-nav">
          {allowed && <Suspense><Nav admin={admin} onNavigate={() => setMenu(false)} /></Suspense>}
          <div className="sidebar-foot">
            <div>{nome}</div>
            <div style={{ opacity: 0.7 }}>{papel}</div>
            <form action="/auth/sair" method="post"><button>Sair</button></form>
          </div>
        </div>
      </aside>
      <main className="main">
        {allowed && (
          <div className="header-global">
            <Suspense><BarraFiltros coords={coords} /></Suspense>
            <Suspense><Busca /></Suspense>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}

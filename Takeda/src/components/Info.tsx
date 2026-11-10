"use client";
import { useState } from "react";

/** ⓘ com explicação do número (hover no desktop, toque no celular) */
export function Info({ texto }: { texto: string }) {
  const [aberto, setAberto] = useState(false);
  return (
    <span className="info" onMouseEnter={() => setAberto(true)} onMouseLeave={() => setAberto(false)}
      onClick={(e) => { e.stopPropagation(); setAberto((v) => !v); }} role="button" aria-label="Como é calculado" tabIndex={0}>
      ⓘ{aberto && <span className="info-pop">{texto}</span>}
    </span>
  );
}

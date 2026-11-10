"use client";
import Link from "next/link";
import { useEffect } from "react";

export type ItemProjeto = { id: number; name: string; extra?: string; status?: string };

/** Lista de projetos por trás de qualquer número/gráfico clicado */
export function ModalProjetos({ titulo, itens, onClose }: { titulo: string; itens: ItemProjeto[]; onClose: () => void }) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [onClose]);
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="Fechar">×</button>
        <h3>{titulo}</h3>
        <div style={{ color: "var(--ink-soft)" }}>{itens.length} projeto(s)</div>
        <table><tbody>
          {itens.map((p) => (
            <tr key={p.id}>
              <td><Link className="proj-link" href={`/producao/visao-projeto?id=${p.id}`} onClick={onClose}>{p.name}</Link>
                {p.status && p.status !== "Em Andamento" && <small style={{ color: "var(--muted)" }}> · {p.status}</small>}</td>
              {p.extra !== undefined && <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{p.extra}</td>}
            </tr>
          ))}
        </tbody></table>
      </div>
    </div>
  );
}

"use client";

import { Fragment, useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const ROWS: { label: string; pts: string; group?: string }[] = [
  { label: "Resultado (ganador o empate)", pts: "+3", group: "Por partido" },
  { label: "Marcador exacto (ej. 2-1 = 2-1)", pts: "+5" },
  { label: "Total de amarillas del partido", pts: "+1" },
  { label: "Total de rojas del partido", pts: "+1" },
  { label: "⚽ Goleador acertado (por cada gol)", pts: "+3 c/u", group: "Por jugador" },
  { label: "🟨 Amarilla acertada (por jugador)", pts: "+2 c/u" },
  { label: "🟥 Roja acertada (por jugador)", pts: "+4 c/u" },
  { label: "🥇 Goleador del torneo", pts: "+10", group: "Predicciones iniciales" },
  { label: "🏆 Campeón del torneo", pts: "+15" },
];

export default function ScoringLegend() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3.5 py-3 text-left"
      >
        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-900">
          <HelpCircle className="h-4 w-4 text-blue-600" /> ¿Cómo se puntúa?
        </span>
        <ChevronDown className={cn("h-4 w-4 text-gray-400 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t border-gray-100 px-3.5 pb-3.5 pt-2">
          <table className="w-full text-[12px]">
            <tbody>
              {ROWS.map((r, i) => (
                <Fragment key={i}>
                  {r.group && (
                    <tr>
                      <td colSpan={2} className="pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                        {r.group}
                      </td>
                    </tr>
                  )}
                  <tr className="border-t border-gray-50">
                    <td className="py-1.5 pr-2 text-gray-700">{r.label}</td>
                    <td className="py-1.5 text-right font-semibold text-green-600">{r.pts}</td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
          <p className="mt-2.5 rounded-lg bg-blue-50 px-2.5 py-2 text-[11px] text-blue-700">
            Ej.: si acertás el <b>marcador exacto</b> (2-1 = 2-1) sumás <b>+3</b> (resultado) + <b>+5</b> (marcador) = <b>8</b>.
            Si ponés 3-0 a un 2-1, solo cobrás el resultado (+3): el marcador no es exacto.
          </p>
          <p className="mt-2 text-[10.5px] text-gray-400">
            🥇 El goleador y 🏆 el campeón del torneo se pueden cambiar hasta el último partido de la 1ª fecha.
          </p>
        </div>
      )}
    </div>
  );
}

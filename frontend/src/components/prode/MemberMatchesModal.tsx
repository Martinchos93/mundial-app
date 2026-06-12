"use client";

import { useState } from "react";
import { X, ChevronDown } from "lucide-react";
import { useBreakdown, type BreakdownComp } from "@/lib/api";
import { flagFor } from "@/lib/flags";
import { cn } from "@/lib/utils";

function DetailRow({ icon, label, detail, pts }: { icon: string; label: string; detail: string; pts: number }) {
  const win = pts > 0;
  return (
    <div className="flex items-center gap-2.5 border-t border-gray-50 py-2 first:border-t-0">
      <span className="w-5 flex-none text-center text-[14px]">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 text-[12.5px] font-medium text-gray-800">
          {label}
          <span className={win ? "text-green-600" : "text-gray-300"}>{win ? "✓" : "✗"}</span>
        </div>
        <div className="text-[11px] leading-snug text-gray-400">{detail}</div>
      </div>
      <span
        className={cn(
          "flex-none rounded-lg px-2 py-1 text-[12.5px] font-semibold",
          win ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400",
        )}
      >
        +{pts}
      </span>
    </div>
  );
}

type Row = {
  id: number;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  phase: string | null;
  scorers: string[];
  realYellows: number;
  realReds: number;
  pred: string;
  pts: number;
  comp?: BreakdownComp;
};

function buildDetail(r: Row): { icon: string; label: string; detail: string; pts: number }[] {
  const c = r.comp;
  if (!c) return [];
  const [ph, pa] = r.pred.split("-").map((n) => parseInt(n, 10));
  const outcome = (h: number | null, a: number | null) =>
    h == null || a == null || Number.isNaN(h) || Number.isNaN(a)
      ? "—"
      : h > a
        ? `gana ${r.home_team}`
        : h < a
          ? `gana ${r.away_team}`
          : "empate";
  const scorerHits = (c.pred_scorers ?? []).map(
    (name) => `${name}${r.scorers.includes(name) ? " ✅" : " ❌"}`,
  );

  const rows = [
    {
      icon: "🎯",
      label: "Resultado",
      detail: `Predijo «${outcome(ph, pa)}» · fue «${outcome(r.home_score, r.away_score)}»`,
      pts: c.pts_result,
    },
    {
      icon: "🔢",
      label: "Marcador exacto",
      detail: `Predijo ${r.pred} · fue ${r.home_score}-${r.away_score}`,
      pts: c.pts_exact + c.pts_bonus,
    },
    {
      icon: "🟨",
      label: "Amarillas del partido",
      detail:
        c.pred_yellows > 0
          ? `Predijo ${c.pred_yellows} · hubo ${r.realYellows}`
          : `No predijo amarillas (hubo ${r.realYellows})`,
      pts: c.pts_yellows,
    },
    {
      icon: "🟥",
      label: "Rojas del partido",
      detail:
        c.pred_reds > 0
          ? `Predijo ${c.pred_reds} · hubo ${r.realReds}`
          : `No predijo rojas (hubo ${r.realReds})`,
      pts: c.pts_reds,
    },
  ];
  if ((c.pred_scorers ?? []).length > 0 || c.pts_scorers > 0) {
    rows.push({
      icon: "⚽",
      label: "Goleadores",
      detail: scorerHits.length ? scorerHits.join(" · ") : "Sin goleadores predichos",
      pts: c.pts_scorers,
    });
  }
  if (c.pts_cards > 0) {
    rows.push({
      icon: "🟨🟥",
      label: "Tarjetas a jugadores",
      detail: "Puntos por tarjetas a los jugadores marcados",
      pts: c.pts_cards,
    });
  }
  return rows;
}

export default function MemberMatchesModal({
  groupId,
  member,
  onClose,
}: {
  groupId: number;
  member: { user_id: number; name: string };
  onClose: () => void;
}) {
  const { data } = useBreakdown(groupId);
  const uid = String(member.user_id);
  const [open, setOpen] = useState<number | null>(null);

  const rows: Row[] = (data?.matches ?? [])
    .filter((m) => m.preds[uid] !== undefined)
    .map((m) => ({
      id: m.id,
      home_team: m.home_team,
      away_team: m.away_team,
      home_score: m.home_score,
      away_score: m.away_score,
      phase: m.phase,
      scorers: m.scorers ?? [],
      realYellows: (m.home_yellows ?? 0) + (m.away_yellows ?? 0),
      realReds: (m.home_reds ?? 0) + (m.away_reds ?? 0),
      pred: m.preds[uid],
      pts: m.points[uid] ?? 0,
      comp: m.comps?.[uid],
    }));
  const total = rows.reduce((acc, r) => acc + r.pts, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="max-h-[82vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-gray-900">{member.name}</h2>
            <p className="text-[11px] text-gray-400">
              Partidos jugados · {total} {total === 1 ? "punto" : "puntos"} en total · tocá para ver el detalle
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {rows.length === 0 && (
          <p className="py-8 text-center text-[13px] text-gray-400">Todavía no tiene partidos puntuados.</p>
        )}

        <div className="space-y-1.5">
          {rows.map((m) => {
            const isOpen = open === m.id;
            return (
              <div key={m.id} className="overflow-hidden rounded-lg border border-gray-100">
                <button
                  onClick={() => setOpen(isOpen ? null : m.id)}
                  className="flex w-full items-center justify-between gap-2 px-2.5 py-2.5 text-left hover:bg-gray-50"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium text-gray-900">
                      {flagFor(m.home_team)} {m.home_team} {m.home_score}-{m.away_score} {m.away_team}{" "}
                      {flagFor(m.away_team)}
                    </div>
                    <div className="text-[11px] text-gray-400">
                      Predijo <span className="font-medium text-gray-600">{m.pred}</span> · {m.phase}
                    </div>
                  </div>
                  <div className="flex flex-none items-center gap-1.5">
                    <span
                      className={cn(
                        "rounded-lg px-2 py-1 text-[13px] font-semibold",
                        m.pts > 0 ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400",
                      )}
                    >
                      +{m.pts}
                    </span>
                    <ChevronDown
                      className={cn("h-4 w-4 text-gray-300 transition-transform", isOpen && "rotate-180")}
                    />
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-gray-100 bg-gray-50/50 px-2.5">
                    {buildDetail(m).map((d) => (
                      <DetailRow key={d.label} {...d} />
                    ))}
                    {m.scorers.length > 0 && (
                      <p className="border-t border-gray-100 py-2 text-[11px] text-gray-500">
                        ⚽ Marcaron: <span className="text-gray-700">{m.scorers.join(", ")}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

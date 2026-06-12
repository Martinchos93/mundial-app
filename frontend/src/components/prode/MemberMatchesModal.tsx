"use client";

import { X } from "lucide-react";
import { useBreakdown } from "@/lib/api";
import { flagFor } from "@/lib/flags";
import { cn } from "@/lib/utils";

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

  const rows = (data?.matches ?? [])
    .filter((m) => m.preds[uid] !== undefined)
    .map((m) => ({
      ...m,
      pred: m.preds[uid],
      pts: m.points[uid] ?? 0,
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
              Partidos jugados · {total} {total === 1 ? "punto" : "puntos"} en total
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {rows.length === 0 && (
          <p className="py-8 text-center text-[13px] text-gray-400">
            Todavía no tiene partidos puntuados.
          </p>
        )}

        <div className="divide-y divide-gray-50">
          {rows.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-2 py-2.5">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium text-gray-900">
                  {flagFor(m.home_team)} {m.home_team} {m.home_score}-{m.away_score} {m.away_team}{" "}
                  {flagFor(m.away_team)}
                </div>
                <div className="text-[11px] text-gray-400">
                  Predijo <span className="font-medium text-gray-600">{m.pred}</span> · {m.phase}
                </div>
              </div>
              <span
                className={cn(
                  "flex-none rounded-lg px-2 py-1 text-[13px] font-semibold",
                  m.pts > 0 ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400",
                )}
              >
                +{m.pts}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

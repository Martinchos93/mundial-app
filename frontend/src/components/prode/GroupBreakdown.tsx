"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useBreakdown, type BreakdownMatch } from "@/lib/api";
import { flagFor } from "@/lib/flags";
import { cn } from "@/lib/utils";

const AV = [
  "bg-blue-100 text-blue-600", "bg-amber-100 text-amber-600", "bg-green-100 text-green-600",
  "bg-pink-100 text-pink-600", "bg-purple-100 text-purple-600", "bg-orange-100 text-orange-600",
];
const initials = (n: string) => n.trim().slice(0, 2).toUpperCase();

export default function GroupBreakdown({ groupId, userId }: { groupId: number; userId: number }) {
  const { data } = useBreakdown(groupId);
  const [open, setOpen] = useState<number | null>(null);

  const members = data?.members ?? [];
  const matches = data?.matches ?? [];

  if (matches.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 text-center">
        <span className="text-2xl">📋</span>
        <p className="mt-2 text-[13px] text-gray-500">El desglose por partido aparece cuando se cargan resultados.</p>
      </div>
    );
  }

  const rowsFor = (m: BreakdownMatch) =>
    members
      .map((mem) => ({ ...mem, pts: m.points[String(mem.user_id)] ?? 0 }))
      .sort((a, b) => b.pts - a.pts);

  return (
    <div className="space-y-2">
      {matches.map((m) => {
        const mine = m.points[String(userId)] ?? 0;
        const expanded = open === m.id;
        return (
          <div key={m.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <button
              onClick={() => setOpen(expanded ? null : m.id)}
              className="flex w-full items-center justify-between gap-2 px-3.5 py-3 text-left"
            >
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-gray-900">
                  {flagFor(m.home_team)} {m.home_team} {m.home_score}-{m.away_score} {m.away_team} {flagFor(m.away_team)}
                </span>
                <span className="text-[11px] text-gray-400">{m.phase}</span>
              </span>
              <span className="flex flex-none items-center gap-2">
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", mine > 0 ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400")}>
                  vos +{mine}
                </span>
                <ChevronDown className={cn("h-4 w-4 text-gray-400 transition-transform", expanded && "rotate-180")} />
              </span>
            </button>
            {expanded && (
              <div className="border-t border-gray-100">
                {rowsFor(m).map((r, i) => (
                  <div
                    key={r.user_id}
                    className={cn("flex items-center gap-2.5 px-3.5 py-2", r.user_id === userId && "bg-blue-50/50")}
                  >
                    <span className="w-4 text-center text-[11px] text-gray-400">{i + 1}</span>
                    <span className={cn("flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-medium", AV[r.user_id % AV.length])}>
                      {r.avatar_emoji && r.avatar_emoji.length <= 2 ? r.avatar_emoji : initials(r.name)}
                    </span>
                    <span className="flex-1 text-[12.5px] text-gray-800">
                      {r.name}
                      {r.user_id === userId && <span className="ml-1 text-[11px] text-blue-600">(vos)</span>}
                    </span>
                    <span className={cn("text-[13px] font-semibold", r.pts > 0 ? "text-green-600" : "text-gray-400")}>
                      +{r.pts}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

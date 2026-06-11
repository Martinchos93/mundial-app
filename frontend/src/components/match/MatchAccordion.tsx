"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { ChevronDown } from "lucide-react";
import { cn, formatMatchDate, groupMatchesByDay } from "@/lib/utils";
import type { Match } from "@/types";

/** Round label for a day's matches (group stage vs a knockout round). */
function phaseLabel(ms: Match[]): string {
  const phases = ms.map((m) => m.phase || "");
  if (phases.every((p) => p.startsWith("Grupo"))) return "Fase de grupos";
  const distinct = Array.from(new Set(phases.filter(Boolean)));
  return distinct.length === 1 ? distinct[0] : "Eliminación";
}

/** Collapsible accordion of matches grouped by date (+ phase), with the current
 *  day auto-expanded, highlighted and (optionally) scrolled into focus. */
export default function MatchAccordion({
  matches,
  renderMatch,
  scrollToFocus = true,
  emptyText = "No hay partidos para mostrar.",
}: {
  matches: Match[];
  renderMatch: (m: Match) => React.ReactNode;
  scrollToFocus?: boolean;
  emptyText?: string;
}) {
  const days = useMemo(() => Array.from(groupMatchesByDay(matches).entries()), [matches]);

  const todayKey = format(new Date(), "yyyy-MM-dd");
  const focusKey = useMemo(() => {
    const keys = days.map(([k]) => k);
    if (keys.includes(todayKey)) return todayKey;
    return keys.find((k) => k >= todayKey) ?? keys[keys.length - 1] ?? "";
  }, [days, todayKey]);

  const [open, setOpen] = useState<Record<string, boolean>>({});
  const inited = useRef(false);
  const focusRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (inited.current || days.length === 0) return;
    inited.current = true;
    const init: Record<string, boolean> = {};
    if (focusKey) init[focusKey] = true;
    for (const [k, ms] of days) if (ms.some((m) => m.status === "live")) init[k] = true;
    setOpen(init);
    if (scrollToFocus) {
      setTimeout(() => focusRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }), 250);
    }
  }, [days, focusKey, scrollToFocus]);

  if (days.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-400">{emptyText}</p>;
  }

  return (
    <div className="space-y-2.5">
      {days.map(([day, dayMatches]) => {
        const isOpen = !!open[day];
        const hasLive = dayMatches.some((m) => m.status === "live");
        const finished = dayMatches.filter((m) => m.status === "finished").length;
        const isFocus = day === focusKey;
        return (
          <div
            key={day}
            ref={isFocus ? focusRef : undefined}
            className={cn(
              "scroll-mt-24 overflow-hidden rounded-xl border bg-white",
              isFocus ? "border-blue-300 ring-1 ring-blue-100" : "border-gray-200",
            )}
          >
            <button
              onClick={() => setOpen((o) => ({ ...o, [day]: !o[day] }))}
              className="flex w-full items-center justify-between gap-2 px-3.5 py-3 text-left"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold capitalize text-gray-900">
                    {formatMatchDate(dayMatches[0].kickoff_at)}
                  </span>
                  {hasLive && (
                    <span className="flex items-center gap-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-500">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" /> En vivo
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-gray-400">
                  {phaseLabel(dayMatches)} · {dayMatches.length} {dayMatches.length === 1 ? "partido" : "partidos"}
                  {finished > 0 && ` · ${finished} finalizado${finished === 1 ? "" : "s"}`}
                </div>
              </div>
              <ChevronDown className={cn("h-4 w-4 flex-none text-gray-400 transition-transform", isOpen && "rotate-180")} />
            </button>

            {isOpen && <div className="space-y-2 border-t border-gray-100 p-3">{dayMatches.map(renderMatch)}</div>}
          </div>
        );
      })}
    </div>
  );
}

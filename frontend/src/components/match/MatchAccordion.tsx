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

function daySummary(ms: Match[]): string {
  const finished = ms.filter((m) => m.status === "finished").length;
  return (
    `${phaseLabel(ms)} · ${ms.length} ${ms.length === 1 ? "partido" : "partidos"}` +
    (finished > 0 ? ` · ${finished} finalizado${finished === 1 ? "" : "s"}` : "")
  );
}

function LiveBadge() {
  return (
    <span className="flex items-center gap-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-500">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" /> En vivo
    </span>
  );
}

/** Matches organized into three fixed sections: TODAY (always open, pinned to
 *  top), then UPCOMING and PAST days as collapsible cards. */
export default function MatchAccordion({
  matches,
  renderMatch,
  emptyText = "No hay partidos para mostrar.",
}: {
  matches: Match[];
  renderMatch: (m: Match) => React.ReactNode;
  /** @deprecated kept for API compat — today is now always pinned to top. */
  scrollToFocus?: boolean;
  emptyText?: string;
}) {
  const days = useMemo(() => Array.from(groupMatchesByDay(matches).entries()), [matches]);
  const todayKey = format(new Date(), "yyyy-MM-dd");

  const { today, upcoming, past } = useMemo(() => {
    const today: [string, Match[]][] = [];
    const upcoming: [string, Match[]][] = [];
    const past: [string, Match[]][] = [];
    for (const entry of days) {
      const [k] = entry;
      if (k === todayKey) today.push(entry);
      else if (k > todayKey) upcoming.push(entry);
      else past.push(entry);
    }
    past.reverse(); // most recent first
    return { today, upcoming, past };
  }, [days, todayKey]);

  const [open, setOpen] = useState<Record<string, boolean>>({});
  const inited = useRef(false);
  useEffect(() => {
    if (inited.current || days.length === 0) return;
    inited.current = true;
    const init: Record<string, boolean> = {};
    let hasToday = false;
    for (const [k, ms] of days) {
      if (k === todayKey) hasToday = true;
      if (ms.some((m) => m.status === "live")) init[k] = true; // live days open
    }
    // Nothing today → open the next upcoming day so something is visible.
    if (!hasToday) {
      const firstUpcoming = days.find(([k]) => k > todayKey);
      if (firstUpcoming) init[firstUpcoming[0]] = true;
    }
    setOpen(init);
  }, [days, todayKey]);

  if (days.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-400">{emptyText}</p>;
  }

  const dayCard = (day: string, dayMatches: Match[]) => {
    const isOpen = !!open[day];
    const hasLive = dayMatches.some((m) => m.status === "live");
    return (
      <div
        key={day}
        className={cn(
          "overflow-hidden rounded-xl border bg-white",
          hasLive ? "border-blue-300 ring-1 ring-blue-100" : "border-gray-200",
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
              {hasLive && <LiveBadge />}
            </div>
            <div className="text-[11px] text-gray-400">{daySummary(dayMatches)}</div>
          </div>
          <ChevronDown className={cn("h-4 w-4 flex-none text-gray-400 transition-transform", isOpen && "rotate-180")} />
        </button>
        {isOpen && <div className="space-y-2 border-t border-gray-100 p-3">{dayMatches.map(renderMatch)}</div>}
      </div>
    );
  };

  const sectionLabel = (text: string) => (
    <p className="mb-1.5 mt-1 px-0.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{text}</p>
  );

  return (
    <div className="space-y-4">
      {/* HOY — always expanded, pinned to top */}
      {today.map(([day, ms]) => {
        const hasLive = ms.some((m) => m.status === "live");
        return (
          <div key={day} className="overflow-hidden rounded-xl border border-blue-300 bg-white ring-1 ring-blue-100">
            <div className="flex items-center justify-between gap-2 px-3.5 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-gray-900">Hoy</span>
                  {hasLive && <LiveBadge />}
                </div>
                <div className="text-[11px] text-gray-400">{daySummary(ms)}</div>
              </div>
            </div>
            <div className="space-y-2 border-t border-gray-100 p-3">{ms.map(renderMatch)}</div>
          </div>
        );
      })}

      {/* PRÓXIMOS — future days, chronological */}
      {upcoming.length > 0 && (
        <div>
          {sectionLabel("Próximos")}
          <div className="space-y-2.5">{upcoming.map(([day, ms]) => dayCard(day, ms))}</div>
        </div>
      )}

      {/* PASADOS — past days, most recent first */}
      {past.length > 0 && (
        <div>
          {sectionLabel("Pasados")}
          <div className="space-y-2.5">{past.map(([day, ms]) => dayCard(day, ms))}</div>
        </div>
      )}
    </div>
  );
}

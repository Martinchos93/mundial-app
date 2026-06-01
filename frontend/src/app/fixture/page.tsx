"use client";

import { useMemo, useState } from "react";
import { isToday, parseISO } from "date-fns";
import { Bell } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import MatchCard from "@/components/match/MatchCard";
import { useMatches, usePredictions } from "@/lib/api";
import { cn, formatMatchDate, groupMatchesByDay, timezoneLabel } from "@/lib/utils";
import type { Match } from "@/types";

type Filter = "all" | "live" | "today" | "finished";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "live", label: "En vivo" },
  { key: "today", label: "Hoy" },
  { key: "finished", label: "Finalizados" },
];

function CardSkeleton() {
  return <div className="h-28 animate-pulse rounded-xl border border-gray-200 bg-white" />;
}

function applyFilter(matches: Match[], filter: Filter): Match[] {
  switch (filter) {
    case "live":
      return matches.filter((m) => m.status === "live");
    case "today":
      return matches.filter((m) => isToday(parseISO(m.kickoff_at)));
    case "finished":
      return matches.filter((m) => m.status === "finished");
    default:
      return matches;
  }
}

export default function FixturePage() {
  const { data, isLoading, error } = useMatches();
  const { data: predictions } = usePredictions();
  const [filter, setFilter] = useState<Filter>("all");

  const grouped = useMemo(() => {
    if (!data) return new Map<string, Match[]>();
    return groupMatchesByDay(applyFilter(data, filter));
  }, [data, filter]);

  const findPred = (matchId: number) => predictions?.find((p) => p.match_id === matchId);

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Mundial 2026 🏆</h1>
          <p className="text-[11px] text-gray-400">Hora local · {timezoneLabel()}</p>
        </div>
        <Bell className="h-5 w-5 text-gray-400" />
      </header>

      <div className="flex gap-2 border-b border-gray-100 bg-white px-4 pb-3">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              filter === f.key ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <main className="px-4 pb-24 pt-3">
        {isLoading && (
          <div className="space-y-2">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        )}

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
            No se pudieron cargar los partidos.
          </p>
        )}

        {!isLoading && !error && grouped.size === 0 && (
          <p className="py-10 text-center text-sm text-gray-400">No hay partidos para mostrar.</p>
        )}

        <div className="space-y-5">
          {Array.from(grouped.entries()).map(([day, matches]) => {
            const hasLive = matches.some((m) => m.status === "live");
            return (
              <section key={day}>
                <div className="mb-2 flex items-center gap-1.5">
                  <h2 className="text-sm font-medium text-gray-700">
                    {formatMatchDate(matches[0].kickoff_at)}
                  </h2>
                  {hasLive && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-500">
                      En vivo
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  {matches.map((m) => (
                    <MatchCard key={m.id} match={m} prediction={findPred(m.id)} showPrediction />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </main>

      <Navbar />
    </>
  );
}

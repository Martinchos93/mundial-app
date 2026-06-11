"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { Bell, ChevronDown } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import MatchCard from "@/components/match/MatchCard";
import ProdeSwitcher from "@/components/prode/ProdeSwitcher";
import { useMatches, usePredictions, useNews, useGroupColumns } from "@/lib/api";
import { cn, formatMatchDate, groupMatchesByDay, timezoneLabel, getSelectedGroupId, setSelectedGroupId } from "@/lib/utils";
import type { Match } from "@/types";

function CardSkeleton() {
  return <div className="h-28 animate-pulse rounded-xl border border-gray-200 bg-white" />;
}

/** Round label for a day's matches (group stage vs a knockout round). */
function phaseLabel(ms: Match[]): string {
  const phases = ms.map((m) => m.phase || "");
  if (phases.every((p) => p.startsWith("Grupo"))) return "Fase de grupos";
  const distinct = Array.from(new Set(phases.filter(Boolean)));
  return distinct.length === 1 ? distinct[0] : "Eliminación";
}

export default function FixturePage() {
  const { data, isLoading, error } = useMatches();
  const { data: predictions } = usePredictions();
  const { data: news } = useNews();

  // Which prode we're viewing (predictions are per-prode).
  const [groupId, setGroupId] = useState<number | null>(null);
  useEffect(() => {
    const g = getSelectedGroupId();
    if (g) setGroupId(Number(g));
  }, []);
  const { data: columns } = useGroupColumns(groupId);
  const columnId = useMemo(() => {
    if (!columns?.length) return null;
    return (columns.find((c) => c.status === "active") ?? columns[0]).id;
  }, [columns]);

  function switchProde(id: number) {
    setGroupId(id);
    setSelectedGroupId(id);
  }

  const days = useMemo(() => {
    if (!data) return [] as [string, Match[]][];
    return Array.from(groupMatchesByDay(data).entries());
  }, [data]);

  const todayKey = format(new Date(), "yyyy-MM-dd");
  const focusKey = useMemo(() => {
    const keys = days.map(([k]) => k);
    if (keys.includes(todayKey)) return todayKey;
    return keys.find((k) => k >= todayKey) ?? keys[keys.length - 1] ?? "";
  }, [days, todayKey]);

  // Accordion state: open the focused day + any day with a live match.
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
    setTimeout(() => focusRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }), 250);
  }, [days, focusKey]);

  const findPred = (matchId: number) =>
    predictions?.find((p) => p.match_id === matchId && (columnId == null || p.column_id === columnId));

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Mundial 2026 🏆</h1>
          <p className="text-[11px] text-gray-400">Hora local · {timezoneLabel()}</p>
        </div>
        <Bell className="h-5 w-5 text-gray-400" />
      </header>

      <ProdeSwitcher value={groupId} onChange={switchProde} className="border-b border-gray-100 bg-white px-4 py-2.5" />

      <main className="px-4 pb-24 pt-3">
        {news?.items && news.items.length > 0 && (
          <div className="mb-4 -mx-4 flex gap-2.5 overflow-x-auto px-4">
            {news.items.slice(0, 6).map((n) => (
              <div key={n.id} className="w-56 flex-none overflow-hidden rounded-xl border border-gray-200 bg-white">
                {n.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={n.image_url} alt="" className="h-24 w-full object-cover" />
                )}
                <div className="p-3">
                  <div className="line-clamp-2 text-[13px] font-semibold text-gray-900">{n.title}</div>
                  <p className="mt-1 line-clamp-2 text-[11px] text-gray-500">{n.body}</p>
                </div>
              </div>
            ))}
          </div>
        )}

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

        {!isLoading && !error && days.length === 0 && (
          <p className="py-10 text-center text-sm text-gray-400">No hay partidos para mostrar.</p>
        )}

        <div className="space-y-2.5">
          {days.map(([day, matches]) => {
            const isOpen = !!open[day];
            const hasLive = matches.some((m) => m.status === "live");
            const finished = matches.filter((m) => m.status === "finished").length;
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
                        {formatMatchDate(matches[0].kickoff_at)}
                      </span>
                      {hasLive && (
                        <span className="flex items-center gap-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-500">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" /> En vivo
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-400">
                      {phaseLabel(matches)} · {matches.length} {matches.length === 1 ? "partido" : "partidos"}
                      {finished > 0 && ` · ${finished} finalizado${finished === 1 ? "" : "s"}`}
                    </div>
                  </div>
                  <ChevronDown className={cn("h-4 w-4 flex-none text-gray-400 transition-transform", isOpen && "rotate-180")} />
                </button>

                {isOpen && (
                  <div className="space-y-2 border-t border-gray-100 p-3">
                    {matches.map((m) => (
                      <MatchCard key={m.id} match={m} prediction={findPred(m.id)} showPrediction />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>

      <Navbar />
    </>
  );
}

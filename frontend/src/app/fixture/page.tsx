"use client";

import { useEffect, useMemo, useState } from "react";
import AccountButton from "@/components/account/AccountButton";
import ContactButton from "@/components/account/ContactButton";
import Navbar from "@/components/layout/Navbar";
import MatchCard from "@/components/match/MatchCard";
import MatchAccordion from "@/components/match/MatchAccordion";
import ProdeSwitcher from "@/components/prode/ProdeSwitcher";
import { useMatches, usePredictions, useNews, useGroupColumns } from "@/lib/api";
import { timezoneLabel, getSelectedGroupId, setSelectedGroupId } from "@/lib/utils";

function CardSkeleton() {
  return <div className="h-28 animate-pulse rounded-xl border border-gray-200 bg-white" />;
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

  const findPred = (matchId: number) =>
    predictions?.find((p) => p.match_id === matchId && (columnId == null || p.column_id === columnId));

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Mundial 2026 🏆</h1>
          <p className="text-[11px] text-gray-400">Hora local · {timezoneLabel()}</p>
        </div>
        <div className="flex items-center gap-1">
          <ContactButton />
          <AccountButton />
        </div>
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

        {!isLoading && !error && (
          <MatchAccordion
            matches={data ?? []}
            renderMatch={(m) => <MatchCard key={m.id} match={m} prediction={findPred(m.id)} showPrediction />}
          />
        )}
      </main>

      <Navbar />
    </>
  );
}

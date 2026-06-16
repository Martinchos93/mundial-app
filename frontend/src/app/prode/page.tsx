"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import MatchCard from "@/components/match/MatchCard";
import MatchAccordion from "@/components/match/MatchAccordion";
import PredictionForm from "@/components/prode/PredictionForm";
import TopScorerCard from "@/components/prode/TopScorerCard";
import ChampionCard from "@/components/prode/ChampionCard";
import GroupLeaderboardCard from "@/components/prode/GroupLeaderboardCard";
import GlobalRankingCard from "@/components/prode/GlobalRankingCard";
import ScoringLegend from "@/components/prode/ScoringLegend";
import ProdeSwitcher from "@/components/prode/ProdeSwitcher";
import { useMatches, usePredictions, useGroupColumns, useMe } from "@/lib/api";
import { getToken, getSelectedGroupId, setSelectedGroupId, getUserId } from "@/lib/utils";

function PendingNotice() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <span className="text-5xl">⏳</span>
      <h1 className="mt-4 text-lg font-semibold text-gray-900">Esperando aprobación</h1>
      <p className="mt-1 text-sm text-gray-400">
        El creador del grupo tiene que aceptarte antes de que puedas predecir.
      </p>
      <Link href="/grupos" className="mt-5 text-sm font-medium text-blue-600">
        Ver estado del grupo
      </Link>
    </div>
  );
}

function NoProde({ title, body, cta }: { title: string; body: string; cta: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <span className="text-5xl">🏆</span>
      <h1 className="mt-4 text-lg font-semibold text-gray-900">{title}</h1>
      <p className="mt-1 text-sm text-gray-400">{body}</p>
      <Link href="/grupos" className="mt-5 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700">
        {cta}
      </Link>
    </div>
  );
}

export default function ProdePage() {
  const token = getToken();
  const [groupId, setGroupId] = useState<number | null>(() => {
    const g = getSelectedGroupId();
    return g ? Number(g) : null;
  });
  const { data: me } = useMe();
  const { data: matches, isLoading } = useMatches();
  const { data: predictions, mutate: mutatePreds } = usePredictions();
  const { data: columns } = useGroupColumns(groupId);
  const columnId = useMemo(() => {
    if (!columns?.length) return null;
    return (columns.find((c) => c.status === "active") ?? columns[0]).id;
  }, [columns]);

  function switchProde(id: number) {
    setGroupId(id);
    setSelectedGroupId(id);
  }

  if (!token) return <NoProde title="Iniciá sesión" body="Necesitás una cuenta para jugar al prode." cta="Ir a iniciar sesión" />;
  if (!groupId) return <NoProde title="Elegí un prode" body="Creá o unite a un prode para empezar a predecir." cta="Ir a Prodes" />;

  const membership = me?.memberships.find((m) => String(m.group_id) === String(groupId));
  const group = membership ? { name: membership.group_name } : null;
  if (membership && membership.status === "pending") return <PendingNotice />;

  const findPred = (matchId: number) =>
    predictions?.find((p) => p.match_id === matchId && (columnId == null || p.column_id === columnId));

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-gray-100 bg-white px-4 py-3">
        <h1 className="text-base font-semibold text-gray-900">{group?.name ?? "Prode"}</h1>
        <p className="text-[11px] text-gray-400">Predecí los próximos partidos</p>
        <ProdeSwitcher value={groupId} onChange={switchProde} className="mt-2" />
      </header>

      <main className="px-4 pb-24 pt-3">
        {groupId && <GroupLeaderboardCard groupId={Number(groupId)} userId={Number(getUserId()) || 0} />}
        <GlobalRankingCard userId={Number(getUserId()) || 0} />
        <ScoringLegend />
        <ChampionCard columnId={columnId} />
        <TopScorerCard columnId={columnId} />

        {isLoading && <div className="h-28 animate-pulse rounded-xl border border-gray-200 bg-white" />}

        <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-gray-400">Partidos</p>
        <MatchAccordion
          matches={matches ?? []}
          scrollToFocus={false}
          emptyText="No hay partidos."
          renderMatch={(m) => {
            const pred = findPred(m.id);
            if (m.status === "scheduled") {
              return <MatchCard key={m.id} match={m} prediction={pred} showPrediction />;
            }
            return pred ? (
              <PredictionForm key={m.id} match={m} existing={pred} columnId={columnId} onSaved={() => mutatePreds()} />
            ) : (
              <MatchCard key={m.id} match={m} />
            );
          }}
        />
      </main>

      <Navbar />
    </>
  );
}

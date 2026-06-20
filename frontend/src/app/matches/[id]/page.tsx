"use client";

import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";
import { useMatch, usePredictions, useAIPrediction, useActiveColumnId, useSettings } from "@/lib/api";
import Navbar from "@/components/layout/Navbar";
import LiveStats from "@/components/match/LiveStats";
import Lineups from "@/components/match/Lineups";
import AIPredictionCard from "@/components/match/AIPredictionCard";
import MatchPredictionStats from "@/components/match/MatchPredictionStats";
import PredictionForm from "@/components/prode/PredictionForm";
import { formatFullDate } from "@/lib/utils";
import type { MatchEvent } from "@/types";

const EVENT_EMOJI: Record<string, string> = {
  Goal: "⚽",
  Card: "🟨",
  subst: "🔄",
  Var: "📺",
};

function eventEmoji(e: MatchEvent): string {
  if (e.type === "Card" && e.detail?.toLowerCase().includes("red")) return "🟥";
  return EVENT_EMOJI[e.type] ?? "•";
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-medium uppercase tracking-wider text-gray-400">{title}</h2>
      {children}
    </section>
  );
}

export default function MatchDetailPage({ params }: { params: { id: string } }) {
  const { data: match, isLoading, error } = useMatch(params.id);
  const columnId = useActiveColumnId();
  const { data: ai, mutate: mutateAI } = useAIPrediction(params.id);
  const { data: settings } = useSettings();
  const aiEnabled = settings?.ai_enabled ?? false;
  const { data: predictions } = usePredictions();
  const existing = predictions?.find((p) => p.match_id === Number(params.id));

  const showScore = match && (match.status === "live" || match.status === "finished");

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
        <Link href="/fixture" className="flex items-center gap-1 text-[13px] text-gray-500 transition-colors hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
        {match?.status === "live" && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-red-500">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
            En vivo · {match.minute ? `${match.minute}'` : ""}
          </span>
        )}
        {match?.status === "finished" && (
          <span className="text-xs font-medium text-gray-400">Final</span>
        )}
      </header>

      <main className="px-4 pb-24 pt-4">
        {isLoading && <div className="h-40 animate-pulse rounded-xl border border-gray-200 bg-white" />}
        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
            No se pudo cargar el partido.
          </p>
        )}

        {match && (
          <div className="space-y-6">
            {/* Hero */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 text-center">
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-400">
                {match.phase || "Fase de grupos"}
              </p>
              <div className="flex items-center justify-around">
                <Link
                  href={`/seleccion/${encodeURIComponent(match.home_team?.name || "")}`}
                  className="flex flex-col items-center gap-1 transition-opacity hover:opacity-70"
                >
                  <span className="text-5xl">{match.home_team?.flag_emoji || "🏳️"}</span>
                  <span className="text-sm font-medium text-gray-700">
                    {match.home_team?.short_name || match.home_team?.name}
                  </span>
                </Link>
                <div className="flex flex-col items-center">
                  {showScore ? (
                    <span className="text-4xl font-bold text-gray-900">
                      {match.home_score ?? 0} - {match.away_score ?? 0}
                    </span>
                  ) : (
                    <span className="text-2xl font-semibold text-gray-300">vs</span>
                  )}
                  {match.status === "live" && (
                    <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-red-500">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                      {match.minute ? `${match.minute}'` : "EN VIVO"}
                    </span>
                  )}
                  {match.status === "scheduled" && (
                    <span className="mt-1 text-xs text-gray-400">{formatFullDate(match.kickoff_at)}</span>
                  )}
                </div>
                <Link
                  href={`/seleccion/${encodeURIComponent(match.away_team?.name || "")}`}
                  className="flex flex-col items-center gap-1 transition-opacity hover:opacity-70"
                >
                  <span className="text-5xl">{match.away_team?.flag_emoji || "🏳️"}</span>
                  <span className="text-sm font-medium text-gray-700">
                    {match.away_team?.short_name || match.away_team?.name}
                  </span>
                </Link>
              </div>
              {match.venue && (
                <p className="mt-4 flex items-center justify-center gap-1 text-xs text-gray-400">
                  <MapPin className="h-3.5 w-3.5" /> {match.venue}
                </p>
              )}
            </div>

            {/* Events */}
            {match.events && match.events.length > 0 && (
              <Section title="Eventos">
                <div className="space-y-1.5 rounded-xl border border-gray-200 bg-white p-4">
                  {match.events.map((e) => (
                    <div key={e.id} className="flex items-center gap-3 text-sm">
                      <span className="w-8 text-right text-xs font-medium text-gray-400">{e.minute}&apos;</span>
                      <span>{eventEmoji(e)}</span>
                      <span className="text-gray-700">{e.player_name}</span>
                      {e.detail && <span className="text-xs text-gray-400">· {e.detail}</span>}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Live stats */}
            {(match.status === "live" || match.status === "finished") && (
              <Section title="Estadísticas">
                <LiveStats match={match} />
              </Section>
            )}

            {/* Lineups */}
            {match.lineups && (match.lineups.home || match.lineups.away) && (
              <Section title="Formaciones">
                <Lineups match={match} />
              </Section>
            )}

            {/* AI prediction (admin-toggleable) */}
            {aiEnabled && (
              <Section title="Predicción IA">
                <AIPredictionCard match={match} prediction={ai} onRefresh={() => mutateAI()} />
              </Section>
            )}

            {/* User prediction */}
            <Section title="Tu predicción">
              <PredictionForm match={match} existing={existing} columnId={columnId} />
            </Section>

            {/* Aggregated prediction stats (after the match) */}
            {match.status === "finished" && (match.prediction_stats?.top_scores?.length ?? 0) > 0 && (
              <Section title="Estadísticas de predicciones">
                <MatchPredictionStats match={match} />
              </Section>
            )}
          </div>
        )}
      </main>
      <Navbar />
    </>
  );
}

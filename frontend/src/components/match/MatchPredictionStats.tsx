"use client";

import type { Match } from "@/types";
import { cn } from "@/lib/utils";

/** Aggregated prediction stats for a finished match: the 3 most-predicted
 *  scorelines and the most-chosen goalscorer. Reused on the match detail page
 *  and on the prode "last match" summary. */
export default function MatchPredictionStats({
  match,
  showHeader = false,
}: {
  match: Match;
  showHeader?: boolean;
}) {
  const st = match.prediction_stats;
  if (!st || !st.top_scores || st.top_scores.length === 0) return null;

  const total = st.voters || st.top_scores.reduce((s, x) => s + x.count, 0);
  const actual =
    match.home_score != null && match.away_score != null
      ? `${match.home_score}-${match.away_score}`
      : null;
  const hn = match.home_team?.short_name || match.home_team?.name || "Local";
  const an = match.away_team?.short_name || match.away_team?.name || "Visitante";

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3.5">
      {showHeader && (
        <div className="mb-2.5 flex items-center justify-center gap-2 text-[13px] font-semibold text-gray-900">
          <span>{match.home_team?.flag_emoji} {hn}</span>
          <span className="rounded-md bg-gray-100 px-1.5 py-0.5">{match.home_score}-{match.away_score}</span>
          <span>{an} {match.away_team?.flag_emoji}</span>
        </div>
      )}
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        📊 Lo que predijo la gente
      </div>
      <div className="space-y-1.5">
        {st.top_scores.map((s, i) => {
          const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
          const hit = actual === s.score;
          return (
            <div key={i} className="relative overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
              <div
                className={cn("absolute inset-y-0 left-0", hit ? "bg-green-200/70" : "bg-blue-100")}
                style={{ width: `${pct}%` }}
              />
              <div className="relative flex items-center justify-between px-3 py-1.5 text-[13px]">
                <span className="font-medium text-gray-800">
                  {s.score}
                  {hit && " ✅"}
                </span>
                <span className="text-[11px] text-gray-500">{s.count} · {pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
      {st.top_scorer && (
        <div className="mt-2 flex items-center justify-between rounded-lg bg-gray-50 px-3 py-1.5 text-[12.5px]">
          <span className="text-gray-500">⚽ Goleador más elegido</span>
          <span className="font-medium text-gray-800">
            {st.top_scorer.name} <span className="text-gray-400">({st.top_scorer.count})</span>
          </span>
        </div>
      )}
      <p className="mt-1.5 text-[10px] text-gray-400">
        {total} {total === 1 ? "participante" : "participantes"}
      </p>
    </div>
  );
}

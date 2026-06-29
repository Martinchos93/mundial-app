"use client";

import Link from "next/link";
import type { Match, Prediction } from "@/types";
import { cn, formatMatchTime, timeUntilLock } from "@/lib/utils";
import { useSettings } from "@/lib/api";

interface Props {
  match: Match;
  prediction?: Prediction;
  showPrediction?: boolean;
  /** When provided, the card behaves as a button (inline selection) instead of a link. */
  onSelect?: (match: Match) => void;
}

function statusBadge(match: Match) {
  if (match.status === "live") {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-red-500">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
        {match.minute ? `${match.minute}'` : "EN VIVO"}
      </span>
    );
  }
  if (match.status === "finished") {
    return <span className="text-xs font-medium text-gray-400">Final</span>;
  }
  if (match.status === "postponed") {
    return <span className="text-xs font-medium text-amber-600">Pospuesto</span>;
  }
  return <span className="text-xs font-medium text-gray-900">{formatMatchTime(match.kickoff_at)}</span>;
}

function TeamSide({ flag, name }: { flag: string; name: string }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1">
      <span className="text-2xl leading-none">{flag || "🏳️"}</span>
      <span className="text-center text-xs font-medium text-gray-900">{name}</span>
    </div>
  );
}

function PredChip({ prediction }: { prediction: Prediction }) {
  const won = prediction.is_scored && prediction.total_points > 0;
  const scoredMiss = prediction.is_scored && prediction.total_points === 0;
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-medium",
        won && "bg-green-100 text-green-600",
        scoredMiss && "bg-gray-100 text-gray-500",
        !prediction.is_scored && "bg-blue-50 text-blue-600",
      )}
    >
      Tu pred: {prediction.pred_home_score}-{prediction.pred_away_score}
      {prediction.is_scored && ` · +${prediction.total_points}pts`}
    </span>
  );
}

export default function MatchCard({ match, prediction, showPrediction, onSelect }: Props) {
  const showScore = match.status === "live" || match.status === "finished";
  const ai = match.ai_prediction;
  const { data: settings } = useSettings();
  const aiEnabled = settings?.ai_enabled ?? false;

  const className = cn(
    "block w-full rounded-xl border bg-white p-3.5 text-left transition-colors hover:shadow-sm",
    match.status === "live" ? "border-red-200 bg-red-50/40" : "border-gray-200",
  );

  const inner = (
    <>
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-[11px] text-gray-400">{match.phase || "Fase de grupos"}</span>
        {statusBadge(match)}
      </div>

      <div className="flex items-center justify-between gap-2">
        <TeamSide flag={match.home_team?.flag_emoji} name={match.home_team?.short_name || match.home_team?.name} />
        {showScore ? (
          <div className="flex items-center gap-2">
            <span className="text-[22px] font-semibold text-gray-900">{match.home_score ?? 0}</span>
            <span className="text-lg text-gray-300">-</span>
            <span className="text-[22px] font-semibold text-gray-900">{match.away_score ?? 0}</span>
          </div>
        ) : (
          <span className="px-2 text-[13px] font-medium text-gray-400">vs</span>
        )}
        <TeamSide flag={match.away_team?.flag_emoji} name={match.away_team?.short_name || match.away_team?.name} />
      </div>

      {match.status === "finished" && match.home_score === match.away_score && !!match.advances && (
        <p className="mt-1 text-center text-[10.5px] font-medium text-amber-600">
          🥅 {(match.advances === 1 ? match.home_team : match.away_team)?.short_name ||
            (match.advances === 1 ? match.home_team : match.away_team)?.name} avanza por penales
          <span className="font-normal text-gray-400"> · empate para los puntos</span>
        </p>
      )}

      {showPrediction && (
        <div className="mt-2.5 flex items-center justify-between border-t border-gray-100 pt-2.5">
          {prediction ? (
            <PredChip prediction={prediction} />
          ) : match.status === "scheduled" ? (
            <span className="text-[11px] text-gray-400">{timeUntilLock(match.kickoff_at)}</span>
          ) : (
            <span />
          )}
          {aiEnabled && ai?.suggested_score && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
              IA: {ai.suggested_score}
            </span>
          )}
        </div>
      )}
    </>
  );

  if (onSelect) {
    return (
      <button type="button" onClick={() => onSelect(match)} className={className}>
        {inner}
      </button>
    );
  }

  return (
    <Link href={`/matches/${match.id}`} className={className}>
      {inner}
    </Link>
  );
}

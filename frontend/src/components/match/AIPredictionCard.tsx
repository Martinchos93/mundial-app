"use client";

import { useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import type { Match, AIPrediction, AIResult } from "@/types";
import { cn } from "@/lib/utils";
import { generateAIPrediction } from "@/lib/api";

interface Props {
  match: Match;
  prediction?: AIPrediction | null;
  onRefresh?: () => void;
}

function parseList(raw: string | undefined | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
}

function teamLabel(match: Match, result: AIResult): string {
  if (result === "local") return match.home_team?.short_name || match.home_team?.name || "Local";
  if (result === "visitante") return match.away_team?.short_name || match.away_team?.name || "Visitante";
  return "Empate";
}

export default function AIPredictionCard({ match, prediction, onRefresh }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      await generateAIPrediction(match.id);
      onRefresh?.();
    } catch {
      setError("No se pudo generar la predicción. Probá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  const factors = parseList(prediction?.decisive_factors);
  const players = parseList(prediction?.key_players);
  const probs: { label: string; key: AIResult; value: number }[] = [
    { label: teamLabel(match, "local"), key: "local", value: prediction?.prob_home ?? 0 },
    { label: "Empate", key: "empate", value: prediction?.prob_draw ?? 0 },
    { label: teamLabel(match, "visitante"), key: "visitante", value: prediction?.prob_away ?? 0 },
  ];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3.5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-sm">✨</span>
          <div>
            <p className="text-[13px] font-medium text-gray-900">Análisis Claude</p>
            <p className="text-[11px] text-gray-400">Basado en xG, forma y H2H</p>
          </div>
        </div>
        {prediction && (
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600 disabled:opacity-50"
            aria-label="Regenerar predicción"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
        )}
      </div>

      {error && <p className="mb-3 text-xs text-red-500">{error}</p>}

      {!prediction ? (
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Generar con IA
        </button>
      ) : (
        <>
          <div className="mb-3 flex gap-1.5">
            {probs.map((p) => {
              const best = prediction.result === p.key;
              return (
                <div
                  key={p.key}
                  className={cn(
                    "flex-1 rounded-lg p-2 text-center",
                    best ? "border border-blue-100 bg-blue-50" : "bg-gray-50",
                  )}
                >
                  <div className={cn("text-lg font-semibold", best ? "text-blue-600" : "text-gray-900")}>
                    {Math.round((p.value ?? 0) * 100)}%
                  </div>
                  <div className="mt-0.5 truncate text-[10px] text-gray-400">{p.label}</div>
                </div>
              );
            })}
          </div>

          <div className="mb-3 flex items-center justify-center gap-3 rounded-lg bg-gray-50 px-3 py-2.5">
            <span className="text-[11px] text-gray-400">Score</span>
            <span className="text-[22px] font-semibold text-gray-900">{prediction.suggested_score}</span>
            <span className="text-[11px] text-gray-400">
              Confianza {Math.round((prediction.confidence ?? 0) * 100)}%
            </span>
          </div>

          {prediction.summary && (
            <p className="mb-2.5 text-xs leading-relaxed text-gray-500">{prediction.summary}</p>
          )}

          {(factors.length > 0 || players.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {factors.map((f, i) => (
                <span key={`f${i}`} className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">
                  {f}
                </span>
              ))}
              {players.map((p, i) => (
                <span key={`p${i}`} className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-600">
                  {p}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

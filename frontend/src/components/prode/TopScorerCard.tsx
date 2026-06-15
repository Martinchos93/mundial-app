"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Check } from "lucide-react";
import {
  useTopScorer,
  submitTopScorer,
  searchPlayers,
  useMe,
  type PlayerSearchResult,
} from "@/lib/api";
import PositionBadge from "@/components/PositionBadge";

export default function TopScorerCard({ columnId }: { columnId: number | null }) {
  const { data, mutate } = useTopScorer(columnId);
  const { data: me } = useMe();
  const prodeCount = (me?.memberships ?? []).filter((m) => m.status === "active").length;
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PlayerSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [applyAll, setApplyAll] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search.
  useEffect(() => {
    if (!open) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        setResults(await searchPlayers(q));
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q, open]);

  if (!columnId) return null;

  const locked = !!data?.locked; // matchday 1 played → pick is frozen
  const pointsValue = data?.points_value ?? 10;

  async function pick(p: PlayerSearchResult) {
    setSaving(true);
    setError(null);
    try {
      await submitTopScorer(columnId!, p.name, p.team, prodeCount > 1 && applyAll);
      await mutate();
      setOpen(false);
      setQ("");
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      setError(status === 400 ? "Se jugó la 1ª fecha: ya no se puede cambiar." : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/60 p-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[13px] font-semibold text-gray-900">🥇 Goleador del torneo</h2>
          <p className="text-[11px] text-amber-700">Acertá el goleador y sumás +{pointsValue} pts</p>
        </div>
        {!locked && (
          <button
            onClick={() => setOpen((o) => !o)}
            className="rounded-lg bg-amber-500 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-amber-600"
          >
            {data?.pick ? "Cambiar" : "Elegir"}
          </button>
        )}
      </div>

      <p className="mt-1 text-[10.5px] text-amber-700/80">
        {locked
          ? "🔒 Cerrado: ya se jugó la 1ª fecha."
          : "Podés cambiarlo hasta el último partido de la 1ª fecha."}
      </p>

      <div className="mt-2 flex items-center gap-2 text-[13px]">
        {data?.pick ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 font-medium text-gray-800 ring-1 ring-amber-200">
            ⚽ {data.pick}
            {data.team_name && <span className="text-[11px] font-normal text-gray-400">· {data.team_name}</span>}
          </span>
        ) : (
          <span className="text-gray-400">Todavía no elegiste tu goleador.</span>
        )}
      </div>

      {data?.leader && (
        <p className="mt-2 text-[11px] text-gray-500">
          Líder actual: <span className="font-medium text-gray-700">{data.leader.name}</span> ({data.leader.goals} goles)
          {data.finished && data.pick && (
            <span className={data.pick.toLowerCase() === data.leader.name.toLowerCase() ? "text-green-600" : "text-gray-400"}>
              {" "}
              · {data.pick.toLowerCase() === data.leader.name.toLowerCase() ? `✅ ¡Acertaste! +${pointsValue}` : "❌ No acertaste"}
            </span>
          )}
        </p>
      )}

      {error && <p className="mt-2 text-[11px] text-red-500">{error}</p>}

      {open && !locked && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-white p-2">
          {prodeCount > 1 && (
            <label className="mb-2 flex cursor-pointer items-center gap-2 px-1">
              <input type="checkbox" checked={applyAll} onChange={(e) => setApplyAll(e.target.checked)} className="h-4 w-4 accent-amber-600" />
              <span className="text-[12px] text-gray-600">
                Aplicar a mis {prodeCount} prodes{!applyAll && <span className="text-gray-400"> · solo este</span>}
              </span>
            </label>
          )}
          <div className="flex items-center gap-2 rounded-md bg-gray-50 px-2">
            <Search className="h-3.5 w-3.5 text-gray-400" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar jugador o selección…"
              className="w-full bg-transparent py-2 text-[13px] text-gray-800 focus:outline-none"
            />
          </div>
          <div className="mt-1 max-h-60 overflow-y-auto">
            {loading && <p className="px-2 py-2 text-[12px] text-gray-400">Buscando…</p>}
            {!loading && results.length === 0 && (
              <p className="px-2 py-2 text-[12px] text-gray-400">Escribí un nombre para buscar.</p>
            )}
            {results.map((p) => (
              <button
                key={p.id}
                disabled={saving}
                onClick={() => pick(p)}
                className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left hover:bg-amber-50 disabled:opacity-50"
              >
                <span className="flex items-center gap-1.5 text-[13px] text-gray-800">
                  <PositionBadge position={p.position} />
                  {p.name}
                  <span className="text-[11px] text-gray-400">{p.team}</span>
                </span>
                {data?.pick === p.name && <Check className="h-4 w-4 flex-none text-green-500" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

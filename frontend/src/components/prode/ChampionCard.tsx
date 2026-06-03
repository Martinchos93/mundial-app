"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useChampion, submitChampion, useStandings } from "@/lib/api";

export default function ChampionCard({ columnId }: { columnId: number | null }) {
  const { data, mutate } = useChampion(columnId);
  const { data: teams } = useStandings();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = useMemo(() => {
    const seen = new Set<string>();
    const list = (teams ?? [])
      .map((t) => ({ name: t.name, flag: t.flag_emoji || "🏳️" }))
      .filter((t) => t.name && !seen.has(t.name) && seen.add(t.name));
    const term = q.trim().toLowerCase();
    return (term ? list.filter((t) => t.name.toLowerCase().includes(term)) : list).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [teams, q]);

  if (!columnId) return null;

  const locked = !!data?.started;
  const pointsValue = data?.points_value ?? 15;
  const flagOf = (name: string | null) =>
    (teams ?? []).find((t) => t.name === name)?.flag_emoji || "🏆";

  async function pick(name: string) {
    setSaving(true);
    setError(null);
    try {
      await submitChampion(columnId!, name);
      await mutate();
      setOpen(false);
      setQ("");
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      setError(status === 400 ? "El torneo ya comenzó: no se puede cambiar." : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  const hit = data?.finished && data?.pick && data.champion
    ? data.pick.toLowerCase() === data.champion.toLowerCase()
    : null;

  return (
    <div className="mb-3 rounded-xl border border-violet-200 bg-violet-50/60 p-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[13px] font-semibold text-gray-900">🏆 Campeón del torneo</h2>
          <p className="text-[11px] text-violet-700">Predicción inicial · acertás y sumás +{pointsValue} pts</p>
        </div>
        {!locked && (
          <button
            onClick={() => setOpen((o) => !o)}
            className="rounded-lg bg-violet-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-violet-700"
          >
            {data?.pick ? "Cambiar" : "Elegir"}
          </button>
        )}
      </div>

      <div className="mt-2 text-[13px]">
        {data?.pick ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 font-medium text-gray-800 ring-1 ring-violet-200">
            {flagOf(data.pick)} {data.pick}
          </span>
        ) : (
          <span className="text-gray-400">Todavía no elegiste tu campeón.</span>
        )}
        {hit !== null && (
          <span className={hit ? "ml-2 text-green-600" : "ml-2 text-gray-400"}>
            {hit ? `✅ ¡Campeón acertado! +${pointsValue}` : `❌ Salió campeón ${data?.champion}`}
          </span>
        )}
      </div>

      {error && <p className="mt-2 text-[11px] text-red-500">{error}</p>}

      {open && !locked && (
        <div className="mt-3 rounded-lg border border-violet-200 bg-white p-2">
          <div className="flex items-center gap-2 rounded-md bg-gray-50 px-2">
            <Search className="h-3.5 w-3.5 text-gray-400" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar selección…"
              className="w-full bg-transparent py-2 text-[13px] focus:outline-none"
            />
          </div>
          <div className="mt-1 grid max-h-60 grid-cols-2 gap-1 overflow-y-auto">
            {options.map((t) => (
              <button
                key={t.name}
                disabled={saving}
                onClick={() => pick(t.name)}
                className="flex items-center gap-1.5 rounded-md px-2 py-2 text-left text-[13px] hover:bg-violet-50 disabled:opacity-50"
              >
                <span>{t.flag}</span>
                <span className="truncate text-gray-800">{t.name}</span>
              </button>
            ))}
            {options.length === 0 && (
              <p className="col-span-2 px-2 py-2 text-[12px] text-gray-400">Sin resultados.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

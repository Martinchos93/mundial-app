"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import AccountButton from "@/components/account/AccountButton";
import ContactButton from "@/components/account/ContactButton";
import BracketView from "@/components/bracket/BracketView";
import TournamentStats from "@/components/stats/TournamentStats";
import { useStandings } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Team } from "@/types";

const ALL_GROUPS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

function FormPills({ form }: { form?: string }) {
  if (!form) return <span className="text-gray-300">—</span>;
  const recent = form.replace(/[^WDL]/gi, "").toUpperCase().slice(-5);
  return (
    <div className="flex justify-center gap-[3px]">
      {recent.split("").map((r, i) => (
        <span
          key={i}
          className={cn(
            "flex h-[15px] w-[15px] items-center justify-center rounded-[3px] text-[9px] font-medium",
            r === "W" && "bg-green-100 text-green-600",
            r === "D" && "bg-gray-100 text-gray-500",
            r === "L" && "bg-red-100 text-red-500",
          )}
        >
          {r === "W" ? "G" : r === "D" ? "E" : "P"}
        </span>
      ))}
    </div>
  );
}

export default function TeamsPage() {
  const { data, isLoading, error } = useStandings();
  const router = useRouter();

  const groups = useMemo(() => {
    const present = new Set((data ?? []).map((t) => t.group).filter(Boolean) as string[]);
    const list = ALL_GROUPS.filter((g) => present.has(g));
    return list.length ? list : ALL_GROUPS.slice(0, 8);
  }, [data]);

  const [active, setActive] = useState("A");
  const [view, setView] = useState<"grupos" | "cruces" | "stats">("grupos");
  const selected = groups.includes(active) ? active : groups[0];

  const rows = useMemo(() => {
    return (data ?? [])
      .filter((t) => t.group === selected)
      .sort((a, b) => (b.points ?? 0) - (a.points ?? 0) || (b.goal_difference ?? 0) - (a.goal_difference ?? 0));
  }, [data, selected]);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-gray-100 bg-white px-4 py-3">
        <div className="mb-2.5 flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-gray-900">
              {view === "grupos" ? "Tabla de grupos" : view === "cruces" ? "Cuadro de cruces" : "Estadísticas"}
            </h1>
            <p className="text-[11px] text-gray-400">Mundial 2026</p>
          </div>
          <div className="flex items-center gap-1">
            <ContactButton />
            <AccountButton />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 rounded-lg bg-gray-100 p-1">
          {(["grupos", "cruces", "stats"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "rounded-md py-1.5 text-sm font-medium capitalize transition-colors",
                view === v ? "bg-white text-gray-900 shadow-sm" : "text-gray-500",
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </header>

      {view === "cruces" ? (
        <>
          <main className="px-4 pb-24 pt-3">
            <BracketView />
          </main>
          <Navbar />
        </>
      ) : view === "stats" ? (
        <>
          <main className="px-4 pb-24 pt-3">
            <TournamentStats />
          </main>
          <Navbar />
        </>
      ) : (
      <>
      <div className="flex gap-1.5 overflow-x-auto border-b border-gray-100 bg-white px-4 py-2.5">
        {groups.map((g) => (
          <button
            key={g}
            onClick={() => setActive(g)}
            className={cn(
              "flex h-9 w-9 flex-none items-center justify-center rounded-full border text-xs font-medium transition-colors",
              selected === g
                ? "border-transparent bg-blue-600 text-white"
                : "border-gray-200 bg-white text-gray-500",
            )}
          >
            {g}
          </button>
        ))}
      </div>

      <main className="px-4 pb-24 pt-3">
        {isLoading && <div className="h-56 animate-pulse rounded-xl border border-gray-200 bg-white" />}
        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
            No se pudieron cargar las tablas.
          </p>
        )}

        {!isLoading && !error && (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="text-[10px] uppercase text-gray-400">
                  <th className="border-b border-gray-100 py-1.5 pl-2.5 text-left font-medium">Selección</th>
                  <th className="border-b border-gray-100 px-1 font-medium">PJ</th>
                  <th className="border-b border-gray-100 px-1 font-medium">G</th>
                  <th className="border-b border-gray-100 px-1 font-medium">E</th>
                  <th className="border-b border-gray-100 px-1 font-medium">P</th>
                  <th className="border-b border-gray-100 px-1 font-medium">GD</th>
                  <th className="border-b border-gray-100 px-1 font-medium">Pts</th>
                  <th className="border-b border-gray-100 px-1 font-medium">Forma</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t: Team, i) => {
                  const q = t.qualified ?? i < 2;
                  const third = t.qualifier === "third";
                  const qbg = q ? (third ? "bg-sky-50/50" : "bg-green-50/50") : "";
                  return (
                    <tr
                      key={t.id}
                      onClick={() => router.push(`/seleccion/${encodeURIComponent(t.name)}`)}
                      className="cursor-pointer"
                    >
                      <td
                        className={cn(
                          "border-b border-gray-50 py-2.5 pl-2.5 text-left",
                          q && !third && "border-l-[3px] border-l-green-400 bg-green-50/50",
                          q && third && "border-l-[3px] border-l-sky-400 bg-sky-50/50",
                        )}
                      >
                        <span className="flex items-center gap-1.5">
                          <span className="text-[11px] text-gray-400">{i + 1}</span>
                          <span>{t.flag_emoji || "🏳️"}</span>
                          <span className="font-medium text-gray-800">{t.short_name || t.name}</span>
                          {third && <span className="rounded-full bg-sky-100 px-1.5 text-[9px] font-semibold text-sky-600">3°</span>}
                        </span>
                      </td>
                      <td className={cn("border-b border-gray-50 px-1 text-center text-gray-500", qbg)}>{t.played ?? 0}</td>
                      <td className={cn("border-b border-gray-50 px-1 text-center text-gray-500", qbg)}>{t.wins ?? 0}</td>
                      <td className={cn("border-b border-gray-50 px-1 text-center text-gray-500", qbg)}>{t.draws ?? 0}</td>
                      <td className={cn("border-b border-gray-50 px-1 text-center text-gray-500", qbg)}>{t.losses ?? 0}</td>
                      <td className={cn("border-b border-gray-50 px-1 text-center text-gray-500", qbg)}>{t.goal_difference ?? 0}</td>
                      <td className={cn("border-b border-gray-50 px-1 text-center font-bold text-gray-900", qbg)}>{t.points ?? 0}</td>
                      <td className={cn("border-b border-gray-50 px-1", qbg)}>
                        <FormPills form={t.form} />
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-sm text-gray-400">
                      Sin datos para el grupo {selected}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-2 text-center text-[11px] text-gray-400">
          🟢 Clasifican 1° y 2° · 🔵 mejores 8 terceros (32 a dieciseisavos)
        </p>
      </main>

      <Navbar />
      </>
      )}
    </>
  );
}

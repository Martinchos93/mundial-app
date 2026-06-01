"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import { useAdminColumns, createColumn, updateColumn, recalculateColumn } from "@/lib/api";
import { cn, formatFullDate } from "@/lib/utils";
import type { Column, ColumnStatus } from "@/types";

const POINT_FIELDS = [
  { key: "pts_result", label: "Resultado", def: 3 },
  { key: "pts_goals", label: "Goles", def: 2 },
  { key: "pts_yellows", label: "Amarillas", def: 1 },
  { key: "pts_reds", label: "Rojas", def: 1 },
  { key: "pts_exact_score", label: "Score exacto", def: 3 },
] as const;

type PointKey = (typeof POINT_FIELDS)[number]["key"];

const STATUS_BADGE: Record<ColumnStatus, { label: string; cls: string }> = {
  draft: { label: "Borrador", cls: "bg-amber-100 text-amber-600" },
  active: { label: "Activa", cls: "bg-green-100 text-green-600" },
  closed: { label: "Cerrada", cls: "bg-gray-100 text-gray-500" },
};

function Mini({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-5 w-5 items-center justify-center rounded-full border border-gray-200 bg-white text-[13px] text-gray-600 hover:bg-gray-50"
    >
      {children}
    </button>
  );
}

function ColumnCard({ column, onChanged }: { column: Column; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const badge = STATUS_BADGE[column.status];

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-2.5 overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between px-3.5 py-3">
        <div>
          <div className="text-[13px] font-medium text-gray-900">{column.name}</div>
          <div className="text-[11px] text-gray-400">
            Res {column.pts_result} · Goles {column.pts_goals} · Score {column.pts_exact_score}
          </div>
        </div>
        <span className={cn("rounded-full px-2 py-0.5 text-[11px]", badge.cls)}>{badge.label}</span>
      </div>

      {column.ends_at && (
        <div className="flex justify-between border-t border-gray-100 px-3.5 py-2 text-xs">
          <span className="text-gray-500">Cierre</span>
          <span className="font-medium text-gray-700">{formatFullDate(column.ends_at)}</span>
        </div>
      )}

      <div className="flex gap-1.5 border-t border-gray-100 bg-gray-50 px-3.5 py-2.5">
        <button
          onClick={() => act(() => recalculateColumn(column.id))}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 disabled:opacity-60"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", busy && "animate-spin")} /> Recalcular
        </button>
        {column.status === "draft" && (
          <button
            onClick={() => act(() => updateColumn(column.id, { status: "active" }))}
            disabled={busy}
            className="ml-auto rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-60"
          >
            Activar
          </button>
        )}
        {column.status === "active" && (
          <button
            onClick={() => act(() => updateColumn(column.id, { status: "closed" }))}
            disabled={busy}
            className="ml-auto rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-60"
          >
            Cerrar columna
          </button>
        )}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { data: columns, isLoading, mutate } = useAdminColumns();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [points, setPoints] = useState<Record<PointKey, number>>(
    Object.fromEntries(POINT_FIELDS.map((f) => [f.key, f.def])) as Record<PointKey, number>,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setName("");
    setPoints(Object.fromEntries(POINT_FIELDS.map((f) => [f.key, f.def])) as Record<PointKey, number>);
    setError(null);
  }

  async function handleCreate() {
    if (!name.trim()) {
      setError("Ingresá un nombre.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createColumn({ name: name.trim(), ...points, group_ids: [] });
      resetForm();
      setShowForm(false);
      mutate();
    } catch {
      setError("No se pudo crear la columna.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Gestor de columnas</h1>
          <p className="text-[11px] text-gray-400">Back office</p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
        >
          + Nueva
        </button>
      </header>

      <main className="px-4 pb-24 pt-3">
        {showForm && (
          <div className="mb-2.5 rounded-xl border-2 border-blue-100 bg-white p-3.5">
            <div className="mb-3 text-[13px] font-medium text-gray-900">Nueva columna</div>
            <input
              className="mb-3 w-full rounded-lg border border-gray-200 px-2.5 py-2 text-[13px] focus:border-blue-400 focus:outline-none"
              placeholder="Ej: Semifinales"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="mb-3 grid grid-cols-2 gap-1.5">
              {POINT_FIELDS.map((f) => (
                <div key={f.key} className="flex items-center justify-between rounded-lg bg-gray-50 px-2 py-2">
                  <span className="text-[11px] text-gray-500">{f.label}</span>
                  <div className="flex items-center gap-1.5">
                    <Mini onClick={() => setPoints((p) => ({ ...p, [f.key]: Math.max(0, p[f.key] - 1) }))}>−</Mini>
                    <span className="min-w-3.5 text-center text-sm font-semibold text-gray-900">
                      {points[f.key]}
                    </span>
                    <Mini onClick={() => setPoints((p) => ({ ...p, [f.key]: p[f.key] + 1 }))}>+</Mini>
                  </div>
                </div>
              ))}
            </div>
            {error && <p className="mb-2 text-xs text-red-500">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="flex-1 rounded-lg border border-gray-200 bg-white py-2 text-[13px] text-gray-500 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={saving}
                className="flex-1 rounded-lg bg-blue-600 py-2 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? "Creando..." : "Crear"}
              </button>
            </div>
          </div>
        )}

        <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-gray-400">
          Columnas existentes
        </p>

        {isLoading && <div className="h-20 animate-pulse rounded-xl border border-gray-200 bg-white" />}

        {columns?.map((c) => (
          <ColumnCard key={c.id} column={c} onChanged={() => mutate()} />
        ))}

        {!isLoading && columns?.length === 0 && (
          <p className="py-10 text-center text-sm text-gray-400">No hay columnas creadas.</p>
        )}
      </main>

      <Navbar />
    </>
  );
}

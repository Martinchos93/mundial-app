"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { changePassword } from "@/lib/api";

export default function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (next.length < 6) {
      setError("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (next !== confirm) {
      setError("Las contraseñas nuevas no coinciden.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await changePassword(current, next);
      setDone(true);
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      setError(
        status === 400
          ? "La contraseña actual es incorrecta."
          : "No se pudo cambiar la contraseña. Probá de nuevo.",
      );
    } finally {
      setBusy(false);
    }
  }

  const input =
    "w-full rounded-lg border border-gray-200 px-3 py-2 text-[14px] focus:border-blue-400 focus:outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-gray-900">🔑 Cambiar contraseña</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {done ? (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
            <div className="text-2xl">✅</div>
            <p className="mt-1 text-[13px] text-gray-700">Tu contraseña se cambió correctamente.</p>
            <button
              onClick={onClose}
              className="mt-3 w-full rounded-lg bg-blue-600 py-2 text-[13px] font-medium text-white hover:bg-blue-700"
            >
              Listo
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            <input
              className={input}
              type="password"
              placeholder="Contraseña actual"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoFocus
            />
            <input
              className={input}
              type="password"
              placeholder="Nueva contraseña"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
            <input
              className={input}
              type="password"
              placeholder="Repetí la nueva contraseña"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
            {error && <p className="text-[11px] text-red-500">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button
                onClick={onClose}
                className="flex-1 rounded-lg border border-gray-200 py-2 text-[13px] font-medium text-gray-500 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={submit}
                disabled={busy}
                className="flex-1 rounded-lg bg-blue-600 py-2 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {busy ? "Guardando…" : "Cambiar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { sendContact, useMe } from "@/lib/api";

export default function ContactModal({ onClose }: { onClose: () => void }) {
  const { data: me } = useMe();
  const fullName = me ? `${me.user.first_name} ${me.user.last_name}`.trim() : "";

  const [name, setName] = useState(fullName);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (name.trim().length === 0) {
      setError("Poné tu nombre.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Poné un email válido para que te podamos responder.");
      return;
    }
    if (message.trim().length === 0) {
      setError("Escribí tu mensaje.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await sendContact({ name: name.trim(), email: email.trim(), message: message.trim() });
      setDone(true);
    } catch {
      setError("No se pudo enviar. Probá de nuevo.");
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
          <h3 className="text-[15px] font-semibold text-gray-900">💬 Enviar un mensaje al admin</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {done ? (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
            <div className="text-2xl">✅</div>
            <p className="mt-1 text-[13px] text-gray-700">¡Mensaje enviado! Te respondemos por email.</p>
            <button
              onClick={onClose}
              className="mt-3 w-full rounded-lg bg-blue-600 py-2 text-[13px] font-medium text-white hover:bg-blue-700"
            >
              Listo
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            <p className="text-[12px] text-gray-500">¿Dudas, sugerencias o un error? Contanos y te respondemos.</p>
            <input
              className={input}
              placeholder="Tu nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus={!fullName}
            />
            <input
              className={input}
              type="email"
              inputMode="email"
              placeholder="Tu email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <textarea
              className={`${input} resize-none`}
              placeholder="Tu mensaje…"
              rows={4}
              maxLength={2000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
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
                {busy ? "Enviando…" : "Enviar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

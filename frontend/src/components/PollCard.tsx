"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useActivePoll, respondPoll } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function PollCard() {
  const { data, mutate } = useActivePoll();
  const poll = data?.poll ?? null;
  const [dismissed, setDismissed] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  if (!poll || dismissed) return null;

  const showResults = poll.answered && poll.kind === "options";

  async function pickOption(i: number) {
    if (busy) return;
    setBusy(true);
    try { await respondPoll(poll!.id, { option_index: i }); await mutate(); } finally { setBusy(false); }
  }
  async function sendText() {
    if (busy || text.trim().length === 0) return;
    setBusy(true);
    try { await respondPoll(poll!.id, { text: text.trim() }); await mutate(); } finally { setBusy(false); }
  }

  const isMessage = poll.kind === "message";

  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-blue-200 bg-blue-50/60">
      <div className="flex items-start justify-between gap-2 px-3.5 pt-3 pb-3.5">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-blue-500">{isMessage ? "📣 Aviso" : "📣 Encuesta"}</div>
          <h3 className="mt-0.5 whitespace-pre-line text-[13.5px] font-semibold text-gray-900">{poll.question}</h3>
        </div>
        <button onClick={() => setDismissed(true)} className="rounded-full p-1 text-gray-400 hover:bg-white/60">
          <X className="h-4 w-4" />
        </button>
      </div>

      {!isMessage && (
      <div className="px-3.5 pb-3.5">
        {/* Opciones — sin responder */}
        {poll.kind === "options" && !poll.answered && (
          <div className="space-y-1.5">
            {poll.options.map((o, i) => (
              <button key={i} disabled={busy} onClick={() => pickOption(i)}
                className="flex w-full items-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-[13px] text-gray-800 hover:border-blue-400 hover:bg-blue-50 disabled:opacity-50">
                {o}
              </button>
            ))}
          </div>
        )}

        {/* Opciones — resultados */}
        {showResults && (
          <div className="space-y-1.5">
            {poll.options.map((o, i) => {
              const count = poll.tallies?.[i] ?? 0;
              const total = poll.total || 0;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              const mine = poll.my_option === i;
              return (
                <div key={i} className="relative overflow-hidden rounded-lg border border-gray-200 bg-white">
                  <div className={cn("absolute inset-y-0 left-0", mine ? "bg-blue-200/70" : "bg-gray-100")} style={{ width: `${pct}%` }} />
                  <div className="relative flex items-center justify-between px-3 py-2 text-[13px]">
                    <span className={cn("text-gray-800", mine && "font-semibold")}>{o}{mine && " ✓"}</span>
                    <span className="text-[11px] text-gray-500">{pct}%</span>
                  </div>
                </div>
              );
            })}
            <p className="pt-0.5 text-[10px] text-gray-400">{poll.total ?? 0} votos · ¡gracias por participar!</p>
          </div>
        )}

        {/* Texto libre — sin responder */}
        {poll.kind === "text" && !poll.answered && (
          <div>
            <textarea
              value={text} onChange={(e) => setText(e.target.value.slice(0, 500))}
              placeholder="Escribí tu respuesta…" rows={3}
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-[13px] focus:border-blue-400 focus:outline-none"
            />
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-[10px] text-gray-400">{text.length}/500</span>
              <button onClick={sendText} disabled={busy || !text.trim()}
                className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-[12px] font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {busy ? "Enviando…" : "Enviar"}
              </button>
            </div>
          </div>
        )}

        {/* Texto libre — ya respondió */}
        {poll.kind === "text" && poll.answered && (
          <div className="rounded-lg bg-white px-3 py-2 text-[12.5px] text-gray-600">
            ✅ ¡Gracias! Tu respuesta: <span className="italic text-gray-500">“{poll.my_text}”</span>
          </div>
        )}
      </div>
      )}
    </div>
  );
}

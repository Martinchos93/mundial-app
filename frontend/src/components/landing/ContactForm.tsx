"use client";

import { useState } from "react";
import { sendContact } from "@/lib/api";

export default function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) return;
    setStatus("sending");
    try {
      await sendContact({ name: name.trim(), email: email.trim(), message: message.trim() });
      setStatus("ok");
      setName("");
      setEmail("");
      setMessage("");
    } catch {
      setStatus("error");
    }
  }

  if (status === "ok") {
    return (
      <div className="rounded-2xl border border-white/15 bg-white/10 p-5 text-center backdrop-blur-md">
        <div className="text-3xl">✅</div>
        <p className="mt-2 text-[14px] font-semibold">¡Mensaje enviado!</p>
        <p className="mt-1 text-[12px] text-blue-50/80">Gracias por escribirnos, te respondemos pronto.</p>
        <button
          onClick={() => setStatus("idle")}
          className="mt-3 text-[12px] font-medium text-white underline"
        >
          Enviar otro
        </button>
      </div>
    );
  }

  const inputCls =
    "w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2.5 text-[13px] text-white placeholder-blue-100/60 backdrop-blur focus:border-white/50 focus:outline-none";

  return (
    <form onSubmit={submit} className="space-y-2.5 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md">
      <input className={inputCls} placeholder="Tu nombre" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
      <input className={inputCls} type="email" placeholder="Tu email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} />
      <textarea
        className={`${inputCls} h-24 resize-y`}
        placeholder="¿En qué te ayudamos? Dudas, sugerencias, lo que quieras."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={2000}
      />
      {status === "error" && <p className="text-[12px] text-red-300">No se pudo enviar. Probá de nuevo.</p>}
      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full rounded-xl bg-white py-2.5 text-[14px] font-semibold text-blue-700 shadow-lg transition-transform hover:scale-[1.02] disabled:opacity-60"
      >
        {status === "sending" ? "Enviando…" : "Enviar mensaje"}
      </button>
    </form>
  );
}

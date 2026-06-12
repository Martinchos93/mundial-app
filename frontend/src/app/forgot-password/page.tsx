"use client";

import { useState } from "react";
import Link from "next/link";
import { forgotPassword } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle() {
    if (!email.trim() || !email.includes("@")) {
      setError("Escribí un email válido.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await forgotPassword(email.trim());
      setSent(true);
    } catch {
      setError("No se pudo enviar. Intentá de nuevo en un momento.");
    } finally {
      setLoading(false);
    }
  }

  const input =
    "w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:border-blue-400 focus:outline-none";

  return (
    <div className="flex min-h-screen flex-col justify-center px-6">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="text-3xl">🔑</div>
          <h1 className="mt-2 text-xl font-semibold text-gray-900">Recuperar contraseña</h1>
          <p className="text-sm text-gray-400">Te mandamos un link a tu email</p>
        </div>

        {sent ? (
          <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-center">
            <div className="text-2xl">📧</div>
            <p className="mt-2 text-sm text-gray-700">
              Si <span className="font-medium">{email.trim()}</span> está registrado, te enviamos un link
              para restablecer la contraseña.
            </p>
            <p className="mt-2 text-xs text-gray-400">
              Revisá también la carpeta de spam. El link vence en 30 minutos.
            </p>
          </div>
        ) : (
          <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-5">
            <input
              className={input}
              type="email"
              placeholder="Tu email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handle()}
              autoFocus
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button
              onClick={handle}
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? "Enviando..." : "Enviar link"}
            </button>
          </div>
        )}

        <p className="mt-4 text-center text-sm text-gray-400">
          <Link href="/login" className="font-medium text-blue-600">
            Volver a iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  );
}

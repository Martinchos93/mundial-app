import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "ProdeGoat — Prode del Mundial 2026 gratis con amigos",
  description:
    "Creá tu prode del Mundial 2026 y jugá con amigos: fixture y resultados en vivo, tabla de posiciones, cuadro de eliminación, goleadores y predicciones. Gratis.",
  alternates: { canonical: "/" },
};

const FEATURES = [
  { icon: "📅", title: "Fixture en vivo", desc: "Los 104 partidos en tu horario, con resultados y estado en tiempo real." },
  { icon: "🏆", title: "Prode con amigos", desc: "Creá tu grupo, invitá a tus amigos y competí fecha a fecha." },
  { icon: "⚽", title: "Goleadores y tarjetas", desc: "Predecí quién marca y quién ve tarjeta en cada partido." },
  { icon: "🥇", title: "Campeón y goleador", desc: "Jugá tus predicciones del campeón y el goleador del torneo." },
  { icon: "📊", title: "Stats y tablas", desc: "Tabla de los 12 grupos, mejores terceros y cuadro de eliminación." },
  { icon: "🌎", title: "Mundial 2026", desc: "USA · México · Canadá. 48 selecciones, del 11/6 al 19/7 de 2026." },
];

const STEPS = [
  { n: "1", title: "Creá tu cuenta", desc: "Registrate gratis en menos de un minuto." },
  { n: "2", title: "Armá o unite a un prode", desc: "Creá un grupo o sumate con un código de invitación." },
  { n: "3", title: "Predecí y competí", desc: "Cargá tus predicciones y subí en la tabla de tu grupo." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-3">
        <span className="text-[15px] font-extrabold text-gray-900">ProdeGoat 🏆</span>
        <Link href="/login" className="text-[13px] font-medium text-blue-600">
          Entrar
        </Link>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-b from-blue-700 to-blue-500 px-5 pb-9 pt-7 text-center text-white">
        <p className="text-[12px] font-medium uppercase tracking-[0.2em] text-blue-100">
          Prode · Mundial 2026
        </p>
        <h1 className="mt-2 text-[30px] font-extrabold leading-tight">
          El prode del Mundial 2026, con tus amigos
        </h1>
        <p className="mx-auto mt-3 max-w-md text-[14px] leading-relaxed text-blue-50">
          Predecí resultados, goleadores, tarjetas, el campeón y el goleador del torneo. Fixture
          en vivo, tablas y cuadro de eliminación. Gratis.
        </p>
        <div className="mt-5 flex flex-col gap-2.5">
          <Link
            href="/register"
            className="rounded-xl bg-white py-3 text-[15px] font-semibold text-blue-700 shadow-sm transition-colors hover:bg-blue-50"
          >
            Crear cuenta gratis
          </Link>
          <Link
            href="/fixture"
            className="rounded-xl border border-white/40 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-white/10"
          >
            Ver el fixture
          </Link>
        </div>
        <p className="mt-4 text-[12px] text-blue-100">48 selecciones · 104 partidos · 100% gratis</p>
      </section>

      {/* Features */}
      <section className="px-4 py-7">
        <h2 className="mb-3.5 text-center text-[17px] font-bold text-gray-900">
          Todo el Mundial en un solo lugar
        </h2>
        <div className="grid grid-cols-2 gap-2.5">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border border-gray-200 bg-white p-3.5">
              <div className="text-xl">{f.icon}</div>
              <div className="mt-1.5 text-[13px] font-semibold text-gray-900">{f.title}</div>
              <p className="mt-1 text-[11.5px] leading-relaxed text-gray-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white px-4 py-7">
        <h2 className="mb-4 text-center text-[17px] font-bold text-gray-900">Cómo funciona</h2>
        <ol className="space-y-3">
          {STEPS.map((s) => (
            <li key={s.n} className="flex gap-3">
              <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-blue-600 text-[13px] font-bold text-white">
                {s.n}
              </span>
              <div>
                <div className="text-[14px] font-semibold text-gray-900">{s.title}</div>
                <p className="text-[12.5px] text-gray-500">{s.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Final CTA */}
      <section className="px-4 py-8 text-center">
        <h2 className="text-[18px] font-bold text-gray-900">¿Listo para jugar?</h2>
        <p className="mt-1 text-[13px] text-gray-500">Armá tu prode del Mundial 2026 en un minuto.</p>
        <Link
          href="/register"
          className="mt-4 inline-block rounded-xl bg-blue-600 px-6 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-blue-700"
        >
          Crear cuenta gratis
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 px-4 py-6 text-center">
        <nav className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-[13px] text-gray-500">
          <Link href="/news" className="hover:text-gray-900">Noticias</Link>
          <Link href="/fixture" className="hover:text-gray-900">Fixture</Link>
          <Link href="/teams" className="hover:text-gray-900">Tabla y cruces</Link>
          <Link href="/login" className="hover:text-gray-900">Iniciar sesión</Link>
        </nav>
        <p className="mt-4 text-[11px] text-gray-400">
          ProdeGoat · Prode del Mundial 2026 (USA · México · Canadá)
        </p>
      </footer>
    </div>
  );
}

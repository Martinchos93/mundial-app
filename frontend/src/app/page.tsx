import type { Metadata } from "next";
import Link from "next/link";
import ContactForm from "@/components/landing/ContactForm";

const SITE_URL = "https://prodegoat.app";

export const metadata: Metadata = {
  title: "ProdeGoat — Prode del Mundial 2026 gratis con amigos",
  description:
    "Creá tu prode del Mundial 2026 y jugá con amigos: fixture y resultados en vivo, tabla de posiciones, cuadro de eliminación, goleadores, campeón y predicciones. Gratis.",
  alternates: { canonical: "/" },
  keywords: [
    "prode mundial 2026",
    "prode del mundial",
    "prode con amigos",
    "fixture mundial 2026",
    "tabla de posiciones mundial 2026",
    "predicciones mundial 2026",
    "goleador del mundial 2026",
    "campeón del mundial 2026",
    "copa del mundo 2026",
    "prodegoat",
  ],
  openGraph: {
    type: "website",
    url: SITE_URL,
    title: "ProdeGoat — Prode del Mundial 2026 gratis con amigos",
    description:
      "Jugá el prode del Mundial 2026 con amigos: fixture en vivo, tablas, cuadro de eliminación, goleadores, campeón y más. Gratis.",
  },
};

// ---- Sections that link into the app -----------------------------------
const SECTIONS = [
  { href: "/fixture", icon: "📅", title: "Fixture", desc: "Los 104 partidos en tu horario, en vivo." },
  { href: "/news", icon: "📰", title: "Noticias", desc: "Lo último del Mundial 2026." },
  { href: "/prode", icon: "🏆", title: "Prode", desc: "Cargá tus predicciones y sumá puntos." },
  { href: "/grupos", icon: "👥", title: "Grupos", desc: "Creá tu prode o unite con amigos." },
  { href: "/teams", icon: "📊", title: "Tabla y cruces", desc: "Grupos, clasificados y eliminación." },
  { href: "/teams", icon: "⚽", title: "Goleadores", desc: "Stats y goleadores del torneo." },
];

const FEATURES = [
  { icon: "🥇", title: "Campeón y goleador", desc: "Predicciones iniciales: quién gana el Mundial y quién es el goleador." },
  { icon: "🎯", title: "Resultados y por jugador", desc: "Marcador, goleadores y tarjetas por jugador en cada partido." },
  { icon: "📈", title: "Tablas en tiempo real", desc: "Leaderboard de tu grupo que se actualiza con cada resultado." },
  { icon: "🆓", title: "100% gratis", desc: "Sin costo, sin anuncios molestos. Creá tu cuenta y jugá." },
];

const STEPS = [
  { n: "1", title: "Creá tu cuenta", desc: "Registrate gratis en menos de un minuto." },
  { n: "2", title: "Armá o unite a un prode", desc: "Creá un grupo o sumate con un código de invitación." },
  { n: "3", title: "Predecí y competí", desc: "Cargá tus predicciones y subí en la tabla de tu grupo." },
];

const FAQ = [
  {
    q: "¿Qué es ProdeGoat?",
    a: "ProdeGoat es un prode gratuito del Mundial 2026 para jugar con amigos: predecís resultados, goleadores, tarjetas, el campeón y el goleador del torneo, y competís en una tabla de posiciones.",
  },
  {
    q: "¿Es gratis jugar al prode del Mundial 2026?",
    a: "Sí, ProdeGoat es 100% gratis. Solo necesitás crear una cuenta para armar o unirte a un prode.",
  },
  {
    q: "¿Cuándo es el Mundial 2026?",
    a: "La Copa del Mundo 2026 se juega del 11 de junio al 19 de julio de 2026 en Estados Unidos, México y Canadá, con 48 selecciones y 104 partidos.",
  },
  {
    q: "¿Cómo juego con mis amigos?",
    a: "Creá un grupo (prode) y compartí el código de invitación. Tus amigos se unen, vos los aprobás y todos compiten en la misma tabla.",
  },
  {
    q: "¿Qué puedo predecir?",
    a: "Resultados de cada partido, goleadores y tarjetas por jugador, y predicciones iniciales del campeón y del goleador del torneo. Cada acierto suma puntos.",
  },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
    {
      "@type": "VideoObject",
      name: "ProdeGoat — Prode del Mundial 2026",
      description:
        "Prode del Mundial 2026 con amigos: fixture en vivo, tablas, goleadores, campeón y predicciones.",
      thumbnailUrl: `${SITE_URL}/hero-poster.jpg`,
      contentUrl: `${SITE_URL}/hero.mp4`,
      uploadDate: "2026-06-03",
    },
  ],
};

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/15 bg-white/10 backdrop-blur-md ${className}`}>
      {children}
    </div>
  );
}

export default function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />

      {/* Video background (full viewport, behind everything) */}
      <video
        className="fixed inset-0 -z-20 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster="/hero-poster.jpg"
        aria-hidden
      >
        <source src="/hero.mp4" type="video/mp4" />
      </video>
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-blue-950/80 via-blue-900/65 to-blue-950/90" />

      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-3">
        <span className="text-[15px] font-extrabold drop-shadow">ProdeGoat 🏆</span>
        <Link href="/login" className="rounded-lg bg-white/15 px-3 py-1.5 text-[13px] font-medium backdrop-blur hover:bg-white/25">
          Entrar
        </Link>
      </header>

      {/* Hero */}
      <section className="px-5 pb-8 pt-10 text-center">
        <p className="text-[12px] font-medium uppercase tracking-[0.25em] text-blue-100">Prode · Mundial 2026</p>
        <h1 className="mt-3 text-[32px] font-extrabold leading-tight drop-shadow-lg">
          El prode del Mundial 2026, con tus amigos
        </h1>
        <p className="mx-auto mt-3 max-w-md text-[14px] leading-relaxed text-blue-50/90">
          Predecí resultados, goleadores, tarjetas, el campeón y el goleador del torneo. Fixture en
          vivo, tablas y cuadro de eliminación. Gratis.
        </p>
        <div className="mx-auto mt-6 flex max-w-sm flex-col gap-2.5">
          <Link
            href="/register"
            className="rounded-xl bg-white py-3 text-[15px] font-semibold text-blue-700 shadow-lg transition-transform hover:scale-[1.02]"
          >
            Crear cuenta gratis
          </Link>
          <Link
            href="/fixture"
            className="rounded-xl border border-white/40 bg-white/5 py-3 text-[15px] font-semibold backdrop-blur transition-colors hover:bg-white/15"
          >
            Ver el fixture
          </Link>
        </div>
        <p className="mt-4 text-[12px] text-blue-100/80">48 selecciones · 104 partidos · 100% gratis</p>
      </section>

      {/* Sections — each links to its page */}
      <section className="px-4 py-6">
        <h2 className="mb-3 text-center text-[16px] font-bold drop-shadow">Explorá la app</h2>
        <div className="grid grid-cols-2 gap-2.5">
          {SECTIONS.map((s) => (
            <Link key={s.title} href={s.href}>
              <Card className="h-full p-3.5 transition-colors hover:bg-white/20">
                <div className="text-xl">{s.icon}</div>
                <div className="mt-1.5 text-[13px] font-semibold">{s.title}</div>
                <p className="mt-1 text-[11.5px] leading-relaxed text-blue-50/80">{s.desc}</p>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="px-4 py-6">
        <h2 className="mb-3 text-center text-[16px] font-bold drop-shadow">Por qué ProdeGoat</h2>
        <div className="grid grid-cols-1 gap-2.5">
          {FEATURES.map((f) => (
            <Card key={f.title} className="flex items-start gap-3 p-3.5">
              <span className="text-xl">{f.icon}</span>
              <div>
                <div className="text-[13px] font-semibold">{f.title}</div>
                <p className="mt-0.5 text-[12px] leading-relaxed text-blue-50/80">{f.desc}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 py-6">
        <h2 className="mb-4 text-center text-[16px] font-bold drop-shadow">Cómo funciona</h2>
        <ol className="mx-auto max-w-md space-y-3">
          {STEPS.map((s) => (
            <li key={s.n} className="flex gap-3">
              <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-white text-[13px] font-bold text-blue-700">
                {s.n}
              </span>
              <div>
                <div className="text-[14px] font-semibold">{s.title}</div>
                <p className="text-[12.5px] text-blue-50/80">{s.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* FAQ (SEO) */}
      <section className="px-4 py-6">
        <h2 className="mb-3 text-center text-[16px] font-bold drop-shadow">Preguntas frecuentes</h2>
        <div className="mx-auto max-w-md space-y-2">
          {FAQ.map((f) => (
            <Card key={f.q} className="p-3.5">
              <h3 className="text-[13px] font-semibold">{f.q}</h3>
              <p className="mt-1 text-[12px] leading-relaxed text-blue-50/80">{f.a}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section id="contacto" className="px-4 py-6">
        <h2 className="mb-1 text-center text-[16px] font-bold drop-shadow">Contacto</h2>
        <p className="mx-auto mb-3 max-w-md text-center text-[12.5px] text-blue-50/80">
          ¿Dudas, sugerencias o querés reportar algo? Escribinos y te respondemos.
        </p>
        <div className="mx-auto max-w-md">
          <ContactForm />
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 py-8 text-center">
        <h2 className="text-[18px] font-bold drop-shadow">¿Listo para jugar?</h2>
        <p className="mt-1 text-[13px] text-blue-50/80">Armá tu prode del Mundial 2026 en un minuto.</p>
        <Link
          href="/register"
          className="mt-4 inline-block rounded-xl bg-white px-6 py-3 text-[15px] font-semibold text-blue-700 shadow-lg transition-transform hover:scale-[1.02]"
        >
          Crear cuenta gratis
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/15 px-4 py-6 text-center">
        <nav className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-[13px] text-blue-50/80">
          <Link href="/news" className="hover:text-white">Noticias</Link>
          <Link href="/fixture" className="hover:text-white">Fixture</Link>
          <Link href="/prode" className="hover:text-white">Prode</Link>
          <Link href="/grupos" className="hover:text-white">Grupos</Link>
          <Link href="/teams" className="hover:text-white">Tabla y cruces</Link>
          <a href="#contacto" className="hover:text-white">Contacto</a>
          <Link href="/login" className="hover:text-white">Iniciar sesión</Link>
        </nav>
        <p className="mt-4 text-[11px] text-blue-100/60">
          ProdeGoat · Prode del Mundial 2026 (USA · México · Canadá)
        </p>
      </footer>
    </div>
  );
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Fixture y resultados en vivo del Mundial 2026",
  description:
    "Todos los partidos del Mundial 2026 por día en tu hora local: resultados en vivo, estado de cada partido y predicción de la IA. Seguilo minuto a minuto.",
  alternates: { canonical: "/fixture" },
};

export default function FixtureLayout({ children }: { children: React.ReactNode }) {
  return children;
}

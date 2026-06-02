import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Noticias del Mundial 2026",
  description:
    "Las últimas noticias del Mundial 2026: novedades de las selecciones, previas, análisis y todo lo que pasa en la Copa del Mundo.",
  alternates: { canonical: "/news" },
};

export default function NewsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tabla de posiciones, grupos y cuadro del Mundial 2026",
  description:
    "Tablas de los 12 grupos del Mundial 2026, clasificados (1°, 2° y los 8 mejores terceros) y el cuadro de eliminación completo de 16avos a la final.",
  alternates: { canonical: "/teams" },
};

export default function TeamsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

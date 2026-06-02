import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ProdeGoat — Prode del Mundial 2026",
    short_name: "ProdeGoat",
    description:
      "Prode del Mundial 2026 con amigos: fixture en vivo, predicciones con IA, tabla de posiciones y cuadro de eliminación.",
    start_url: "/",
    display: "standalone",
    background_color: "#f9fafb",
    theme_color: "#2563eb",
    lang: "es",
    categories: ["sports", "games"],
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}

import type { MetadataRoute } from "next";

const SITE_URL = "https://prodegoat.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = "2026-06-01";
  const route = (path: string, priority: number, freq: "daily" | "weekly") => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency: freq,
    priority,
  });

  return [
    route("/", 1, "daily"),
    route("/news", 0.9, "daily"),
    route("/fixture", 0.9, "daily"),
    route("/teams", 0.8, "daily"),
    route("/login", 0.4, "weekly"),
    route("/register", 0.5, "weekly"),
  ];
}

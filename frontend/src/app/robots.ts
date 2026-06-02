import type { MetadataRoute } from "next";

const SITE_URL = "https://prodegoat.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/grupos", "/prode"], // private / auth-only areas
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}

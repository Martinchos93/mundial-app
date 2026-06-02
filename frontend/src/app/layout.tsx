import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import SWRProvider from "@/components/providers/SWRProvider";

const inter = Inter({ subsets: ["latin"] });

const SITE_URL = "https://prodegoat.app";
const TITLE = "ProdeGoat — Prode del Mundial 2026 con amigos, IA y stats en vivo";
const DESCRIPTION =
  "Jugá al prode del Mundial 2026 gratis con tus amigos: fixture y resultados en vivo, tabla de posiciones, cuadro de eliminación, predicciones con IA y planteles. Creá tu grupo y competí.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s · ProdeGoat",
  },
  description: DESCRIPTION,
  applicationName: "ProdeGoat",
  keywords: [
    "prode mundial 2026",
    "prode",
    "mundial 2026",
    "copa del mundo 2026",
    "fixture mundial 2026",
    "predicciones mundial 2026",
    "prode con amigos",
    "tabla de posiciones mundial 2026",
    "resultados en vivo",
    "world cup 2026 predictions",
    "prodegoat",
  ],
  authors: [{ name: "ProdeGoat" }],
  creator: "ProdeGoat",
  publisher: "ProdeGoat",
  alternates: { canonical: "/" },
  category: "sports",
  openGraph: {
    type: "website",
    locale: "es_AR",
    url: SITE_URL,
    siteName: "ProdeGoat",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  // Favicon comes from the file-based convention (app/icon.svg) — the World Cup trophy.
  appleWebApp: { capable: true, title: "ProdeGoat", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#2563eb",
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "ProdeGoat",
      description: DESCRIPTION,
      inLanguage: "es",
    },
    {
      "@type": "WebApplication",
      name: "ProdeGoat",
      url: SITE_URL,
      applicationCategory: "SportsApplication",
      operatingSystem: "Web",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      description: DESCRIPTION,
    },
    {
      "@type": "SportsEvent",
      name: "Copa Mundial de la FIFA 2026",
      sport: "Soccer",
      startDate: "2026-06-11",
      endDate: "2026-07-19",
      location: {
        "@type": "Place",
        name: "Estados Unidos, México y Canadá",
      },
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${inter.className} bg-gray-50 text-gray-900 antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        <SWRProvider>
          <div className="mx-auto min-h-screen max-w-lg bg-gray-50">{children}</div>
        </SWRProvider>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import SWRProvider from "@/components/providers/SWRProvider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
// Microsoft Clarity (heatmaps + grabaciones de sesión). Overridable via env.
const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID || "x8zh9fnw6q";

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
  // Google Search Console ownership. Set GOOGLE_SITE_VERIFICATION in Vercel env
  // to the token from the "HTML tag" method (no code change needed).
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
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
      <body className={`${inter.variable} bg-gray-50 text-gray-900 antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        <SWRProvider>
          {/* Transparent wrapper so the landing's video background shows; app
              pages still sit on the body's gray-50. */}
          <div className="mx-auto min-h-screen max-w-lg">{children}</div>
        </SWRProvider>

        {/* Visit analytics (Vercel — no config beyond enabling it in the dashboard) */}
        <Analytics />

        {/* Microsoft Clarity — heatmaps, grabaciones y recorridos */}
        {CLARITY_ID && (
          <Script id="ms-clarity" strategy="afterInteractive">
            {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${CLARITY_ID}");`}
          </Script>
        )}

        {/* Optional Google Analytics 4 — set NEXT_PUBLIC_GA_ID (G-XXXXXXX) in Vercel */}
        {GA_ID && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
            <Script id="ga4" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}

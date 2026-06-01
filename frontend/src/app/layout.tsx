import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import SWRProvider from "@/components/providers/SWRProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Mundial 2026 🏆",
  description: "Fixture, stats en vivo, prode con amigos y predicciones de IA del Mundial 2026.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${inter.className} bg-gray-50 text-gray-900 antialiased`}>
        <SWRProvider>
          <div className="mx-auto min-h-screen max-w-lg bg-gray-50">{children}</div>
        </SWRProvider>
      </body>
    </html>
  );
}

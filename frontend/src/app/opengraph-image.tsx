import { ImageResponse } from "next/og";

export const alt = "ProdeGoat — Prode del Mundial 2026";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 60%, #3b82f6 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 30, letterSpacing: 8, opacity: 0.85 }}>
          PRODE · MUNDIAL 2026
        </div>
        <div style={{ display: "flex", fontSize: 130, fontWeight: 800, marginTop: 8 }}>
          ProdeGoat
        </div>
        <div style={{ display: "flex", fontSize: 40, opacity: 0.92, marginTop: 12 }}>
          Fixture en vivo · Predicciones con IA · Jugá con amigos
        </div>
        <div style={{ display: "flex", marginTop: 36, fontSize: 28, opacity: 0.8 }}>
          prodegoat.app
        </div>
      </div>
    ),
    { ...size },
  );
}

import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Every page renders per request so the proxy's CSP nonce reaches Next's inline scripts (ADR-004).
export const dynamic = "force-dynamic";

// One variable font for headlines and body (news-first redesign, see docs/DESIGN_SYSTEM.md).
// Preload the basic Latin file only (covers Filipino incl. ñ); latin-ext loads on demand via unicode-range.
const text = Inter({
  subsets: ["latin"],
  variable: "--font-text",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
};

export const viewport: Viewport = {
  themeColor: "#1d4ed8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fil" className={text.variable}>
      <body>{children}</body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Source_Serif_4 } from "next/font/google";
import "./globals.css";

// Every page renders per request so the proxy's CSP nonce reaches Next's inline scripts (ADR-004).
export const dynamic = "force-dynamic";

// Preload the basic Latin files only (covers Filipino incl. ñ); latin-ext loads on demand via unicode-range.
// No serif italic: italic styles in globals.css use the sans text font.
const display = Source_Serif_4({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const text = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
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
    <html lang="fil" className={`${display.variable} ${text.variable}`}>
      <body>{children}</body>
    </html>
  );
}

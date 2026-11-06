import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { cookies, headers } from "next/headers";
import { getLocale } from "@/lib/i18n/server";
import { isTheme, THEME_COOKIE } from "@/lib/theme";
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
  // Default icons drawn from the logo mark; Studio → Settings → Favicon overrides them on the public site.
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/brand/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/brand/apple-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1d4ed8",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Studio is English-only; the public site uses the reader's language (ADR-015).
  const studio = (await headers()).get("x-bnb-area") === "studio";
  const lang = studio ? "en" : await getLocale();
  // Theme is read on the server so the first paint is already in the right colours (no flash).
  const theme = (await cookies()).get(THEME_COOKIE)?.value;
  return (
    <html lang={lang} data-theme={isTheme(theme) ? theme : "light"} className={text.variable}>
      <body>{children}</body>
    </html>
  );
}

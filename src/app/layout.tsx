import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Hanken_Grotesk } from "next/font/google";
import { fontVariables } from "@/lib/fonts";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// The product's actual UI typeface (matches the original prototype,
// boatlocalprototype.netlify.app, which renders everything in Hanken
// Grotesk) — see globals.css's `body` rule for where this is applied.
// Geist above is kept only for --font-geist-mono's existing call sites
// (e.g. company id/guide slug display) — nothing renders in Geist Sans itself
// once this variable is wired in.
const hankenGrotesk = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Map App",
  description: "A white-labelled local guide app, with Boat Local tours always one tap away.",
};

// `viewportFit: "cover"` is load-bearing, not cosmetic: every
// `env(safe-area-inset-*)` in the app (GuestBottomNav's bottom padding,
// GuestPlaceDetail's scroller) resolves to 0 unless the viewport meta says
// cover — which is why the tab bar used to sit flush against the iPhone
// home indicator and read as cramped/cut off.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${hankenGrotesk.variable} ${fontVariables} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}

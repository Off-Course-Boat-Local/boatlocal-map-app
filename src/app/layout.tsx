import type { Metadata } from "next";
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
// (e.g. subdomain/slug display) — nothing renders in Geist Sans itself
// once this variable is wired in.
const hankenGrotesk = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Map App",
  description: "A white-labelled local guide app, with Boat Local tours always one tap away.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${hankenGrotesk.variable} ${fontVariables} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

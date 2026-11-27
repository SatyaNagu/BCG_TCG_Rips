import type { Metadata, Viewport } from "next";
import { Manrope, Unbounded } from "next/font/google";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { GoldCursor } from "@/components/providers/GoldCursor";
import { SmoothScroll } from "@/components/providers/SmoothScroll";
import "./globals.css";

// Font pairing (temporary pick, swap here once chosen).
const display = Unbounded({
  subsets: ["latin"],
  weight: ["500", "700", "800"],
  variable: "--font-display-face",
  display: "swap",
});

const body = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body-face",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "BC TCG", template: "%s · BC TCG" },
  description: "Rip packs, grade your pulls, and build your collection.",
};

export const viewport: Viewport = {
  themeColor: "#0F0F0F",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-sm focus:bg-accent focus:px-4 focus:py-2 focus:text-on-accent"
        >
          Skip to content
        </a>
        <SmoothScroll>
          <Header />
          <main id="main">{children}</main>
          <Footer />
        </SmoothScroll>
        <GoldCursor />
      </body>
    </html>
  );
}

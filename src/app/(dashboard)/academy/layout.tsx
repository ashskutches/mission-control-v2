/**
 * Server component layout for /academy
 *
 * Title, OG, and Twitter tags sourced from the live Shopify page at
 * leapsandrebounds.com/pages/academy — scraped 2026-06-04.
 *
 * Canonical points to the live Shopify URL (source of SEO truth).
 * robots: noindex — dashboard is auth-gated.
 */
import type { Metadata } from "next";

const CANONICAL = "https://leapsandrebounds.com/pages/academy";
const OG_IMAGE  = "https://leapsandrebounds.com/cdn/shop/t/417/assets/Logo_big.jpg?v=29916069122752871061779402042";

export const metadata: Metadata = {
  title: "Academy | Leaps & Rebounds",
  description:
    "Browse the full Leaps & Rebounds workout library — mini trampoline sessions for every level, plus assembly videos, programs, and instructor guides.",
  openGraph: {
    title: "Academy",
    description:
      "Browse the full Leaps & Rebounds workout library — mini trampoline sessions for every level, plus assembly videos, programs, and instructor guides.",
    url: CANONICAL,
    siteName: "Leaps and Rebounds",
    type: "website",
    images: [{ url: OG_IMAGE, alt: "Leaps & Rebounds Academy" }],
  },
  twitter: {
    card: "summary",
    title: "Academy | Leaps & Rebounds",
    description:
      "Browse the full Leaps & Rebounds workout library — mini trampoline sessions for every level.",
    images: [OG_IMAGE],
  },
  alternates: {
    canonical: CANONICAL,
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function AcademyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

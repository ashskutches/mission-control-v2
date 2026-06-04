/**
 * Server component layout for /academy/workouts/[id]
 *
 * Generates per-workout <title>, <meta name="description">, and Open Graph tags
 * using Next.js generateMetadata. This wraps the "use client" page.tsx so the
 * client component can keep its interactive state while the server still emits
 * proper SEO head tags.
 *
 * IDs match the live Shopify blog slugs at:
 * leapsandrebounds.com/blogs/mini-trampoline-workouts/[id]
 */
import type { Metadata } from "next";
import { WORKOUTS } from "./page";

const SITE_NAME = "Leaps & Rebounds Mission Control";
const SITE_URL  = "https://leapsandrebounds.com";
const OG_IMAGE  = `${SITE_URL}/cdn/shop/files/preview_images/Leaps_Intro_Video_Thumbnail_small.webp?v=1772051635`;

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  const workout = WORKOUTS.find(w => w.id === id);

  if (!workout) {
    return {
      title: `Workout Not Found | ${SITE_NAME}`,
      description: "This workout could not be found. Browse all mini trampoline workouts in the Academy.",
    };
  }

  const canonicalUrl = `${SITE_URL}/blogs/mini-trampoline-workouts/${workout.id}`;
  const title        = `${workout.title} — ${workout.duration}-Min ${workout.level} Rebounder Workout | Leaps & Rebounds`;
  const description  = `${workout.lede} Led by ${workout.inst}. ${workout.duration} minutes · ${workout.level} · Burns ${workout.burn ?? "calories"}.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: "Leaps & Rebounds",
      type: "article",
      images: [
        {
          url: workout.videoThumb ?? OG_IMAGE,
          width: 1280,
          height: 720,
          alt: `${workout.title} mini trampoline workout`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [workout.videoThumb ?? OG_IMAGE],
    },
    alternates: {
      // Point canonical at the live Shopify blog post — the single source of SEO truth
      canonical: canonicalUrl,
    },
    robots: {
      // Dashboard is auth-gated — don't let bots index these internal copies
      index: false,
      follow: false,
    },
  };
}

export default function WorkoutShowLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

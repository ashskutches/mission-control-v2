import type { NextConfig } from "next";

/**
 * Redirects for the retired /commerce tree.
 *
 * /commerce was in the sidebar for months and its section pages are linked from
 * Discord DMs, agent-written documents and bookmarks, so the paths have to keep
 * resolving. Same reasoning as the /customer/* redirects that survived that
 * section's merge into /orders.
 *
 * ORDER MATTERS — Next matches top to bottom, so every specific path sits above
 * the catch-all. Permanent (308) is deliberate: these are not coming back, and a
 * 307 would have browsers re-asking forever.
 *
 * Where a page has no successor (the Commerce dashboard, the sections manager, the
 * squad overviews, and section pages whose ids were never storable — cro, amazon,
 * loyalty, products) the catch-all lands on Command Center, whose space grid is
 * the closest thing to what those pages were for.
 */
const COMMERCE_REDIRECTS: { from: string; to: string }[] = [
    // Not a section page at all — the one genuinely live surface in the tree.
    { from: "/commerce/landing-pages", to: "/landing-pages" },

    // Section pages with a space that owns them now.
    { from: "/commerce/seo",                    to: "/seo" },
    { from: "/commerce/content",                to: "/content" },
    { from: "/commerce/social",                 to: "/social" },
    { from: "/commerce/support",                to: "/support" },
    { from: "/commerce/orders",                 to: "/orders" },
    { from: "/commerce/ops/logistics",          to: "/logistics" },
    { from: "/commerce/ops/resolution",         to: "/support" },
    { from: "/commerce/ops/community-support",  to: "/social" },
    // Email and paid ads both roll up into Marketing — see the `legacy` lists in
    // gravity-claw's utils/spaces.ts, which fold their insights the same way.
    { from: "/commerce/email",                  to: "/marketing" },
    { from: "/commerce/ads",                    to: "/marketing" },
    { from: "/commerce/acquisition/media-buying", to: "/marketing" },
    // Creator and influencer work is the Social space.
    { from: "/commerce/influencing",            to: "/social" },
    { from: "/commerce/acquisition/creator-outreach", to: "/social" },
    { from: "/commerce/acquisition/social-presence",  to: "/social" },
    { from: "/commerce/acquisition/search-visibility", to: "/seo" },
    // Storefront economics.
    { from: "/commerce/conversion/experimentation",  to: "/website" },
    { from: "/commerce/conversion/revenue-max",      to: "/website" },
    { from: "/commerce/conversion/catalog-architect", to: "/website" },
    { from: "/commerce/conversion/pricing-intel",    to: "/website" },
    { from: "/commerce/reviews",                to: "/brand" },
    { from: "/commerce/strategy/brand-sentinel", to: "/brand" },
    { from: "/commerce/strategy/profitability", to: "/profitability" },
];

const nextConfig: NextConfig = {
    async redirects() {
        return [
            ...COMMERCE_REDIRECTS.map(({ from, to }) => ({
                source: from,
                destination: to,
                permanent: true,
            })),
            // Everything else under /commerce, including /commerce itself.
            { source: "/commerce", destination: "/", permanent: true },
            { source: "/commerce/:path*", destination: "/", permanent: true },
        ];
    },
};

export default nextConfig;

/**
 * What is on the public report index, and what is deliberately not.
 *
 * Data rather than markup so that adding a report is one entry and removing one
 * is one deletion — including in a hurry.
 *
 * ── Why this list is shorter than the artifact gallery ──────────────────────
 *
 * 25 artifacts exist on the Claude account. These six are the Leaps & Rebounds
 * ones. Held back on purpose:
 *
 *   · Anthony's Painting and JB Painting work (3 reports, incl. a traffic audit
 *     carrying their GA4 property id) — client deliverables. They do not belong
 *     on an L&R domain, publicly, without those clients agreeing to it.
 *   · Cryptid and Divine game design (13 reports) — unrelated projects. Nobody
 *     reading this index is looking for card balance notes.
 *   · Mini PC Handoff Runbook — machine setup, unreviewed for host detail.
 *   · Insights Page Teardown — see SECURITY_HOLD below.
 */

export interface Report {
  slug: string;
  title: string;
  /** One line, in the report's own terms. Not a category label. */
  blurb: string;
  /** ISO date the work describes, not the date the file was last touched. */
  date: string;
  kind: "analysis" | "build" | "prototype" | "concept";
  /** The headline finding, when there is a single number worth leading with. */
  stat?: { value: string; label: string };
}

/**
 * ⚠️ NOT PUBLISHED, and this is the reason.
 *
 * "Insights Page Teardown" (2026-08-30) is a security writeup. Its second
 * section is headed "The gravity-claw admin API answers strangers" and lists
 * three endpoints verified to return 200 with real data to a caller holding no
 * cookie, key or session — the full insights board with dollar figures and
 * assignees, any single insight, and the team roster.
 *
 * That hole is still open: `/health` reported `adminAuth.mode: "audit"` on
 * 2026-09-08, which logs what it would block and allows everything. Publishing
 * the writeup at a URL anyone can open would be publishing a working index of
 * what to hit, against a live system, while it is still unguarded.
 *
 * It goes up when the API is closed — two env changes in this order:
 * NEXT_PUBLIC_BOT_URL=/api/bot here, then ADMIN_AUTH_MODE=enforce on
 * gravity-claw. The report itself says the same thing, and warns that flipping
 * the second first will 401 the whole dashboard.
 */
export const SECURITY_HOLD = {
  title: "Insights Page Teardown",
  reason: "Documents an unpatched hole in the live admin API. Publishes once that API is closed.",
} as const;

export const REPORTS: Report[] = [
  {
    slug: "doubled-brand",
    title: "The Doubled Brand",
    blurb:
      "Five of the ten highest-traffic pages print the brand name twice in the title tag, pushing " +
      "every one past Google's cut-off. The cause is one line of Liquid, and the fix changes no copy.",
    date: "2026-09-09",
    kind: "analysis",
    stat: { value: "21,026", label: "monthly impressions affected" },
  },
  {
    slug: "off-topic-half-million",
    title: "The Off-Topic Half-Million",
    blurb:
      "Half a million search impressions in 28 days, aimed at the wrong market. Only 1.4% of them " +
      "are somebody choosing which rebounder to buy, and those earned 48 clicks.",
    date: "2026-09-07",
    kind: "analysis",
    stat: { value: "0.87%", label: "sitewide click-through" },
  },
  {
    slug: "email-audit",
    title: "Email Audit",
    blurb:
      "A year of Klaviyo. Email drives 24% of store revenue on autopilot, while the list producing " +
      "it shrinks by ~6,000 people a year and the sends doing 89% of the volume return 5% of the value.",
    date: "2026-09-08",
    kind: "analysis",
    stat: { value: "19×", label: "flow vs campaign, per email" },
  },
  {
    slug: "rebounder-funnel-rebuild",
    title: "Rebounder Funnel Rebuild",
    blurb:
      "Eleven theme files and one funnel, staged on an unpublished theme. Built because 80% of " +
      "commercial rebounder queries are answered by a blog post rather than a page that sells.",
    date: "2026-09-08",
    kind: "build",
    stat: { value: "80.3%", label: "buying intent landing on the blog" },
  },
  {
    slug: "find-your-bounce",
    title: "Find Your Bounce",
    blurb:
      "A customer-facing fitness guide sorted by what someone is training for rather than by " +
      "product category — so the shortlist is already made by the time they pick a row.",
    date: "2026-08-26",
    kind: "concept",
  },
  {
    slug: "social-command",
    title: "Social Command",
    blurb:
      "Interactive mockup of the Social page, built around the open decision: aggregator or direct " +
      "APIs. Flip it and the credentials to collect, the launch blockers and the trade-offs all change.",
    date: "2026-08-18",
    kind: "prototype",
  },
  {
    slug: "feature-requests",
    title: "Feature Requests",
    blurb:
      "Interactive mockup of asking for something and what happens to it. Of the last 11 requests, " +
      "8 never needed a decision — already built, merged into another, or really a bug.",
    date: "2026-08-06",
    kind: "prototype",
  },
];

export const KIND_LABEL: Record<Report["kind"], string> = {
  analysis: "Analysis",
  build: "Build report",
  prototype: "Prototype",
  concept: "Concept",
};

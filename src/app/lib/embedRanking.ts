/**
 * How the embeds dashboard orders an embed's sections under the heading
 * "Sections — sorted by performance".
 *
 * Kept out of the page component so the ordering can be tested directly.
 */

export interface RankableSection {
  is_required?: boolean;
  embed_impressions?: number | null;
}

/**
 * Laplace prior for the ranking key, mirroring gravity-claw's
 * `smoothedAtcRate` (src/routes/intelligence/shared.ts). The prior mean
 * (1/40 = 2.5%) sits at the "performing well" threshold, so a section with no
 * data at all ranks as an average performer rather than as the worst one.
 *
 * These must stay in step with the server. The panel claims to show what the
 * bandit will serve; if the two rank on different keys it does not.
 */
export const RANK_PRIOR_COUNT = 1;
export const RANK_PRIOR_IMPRESSIONS = 40;

/** Display rate as a percentage, or null when there is nothing to divide by. */
export const rateOf = (count: number, impressions: number) =>
  impressions > 0 ? (count / impressions) * 100 : null;

/**
 * The key sections are ranked on — never the raw ratio.
 *
 * Raw count/impressions lets one impression that happened to convert read as a
 * 100% converter and take the top of the list away from a section with
 * thousands of impressions behind it, and sends a section that has never been
 * shown to the bottom even though UCB1's exploration bonus means it is the one
 * served next. Smoothing gives small samples a pull toward the prior, so the
 * displayed order matches the order the bandit ranks on.
 */
export const smoothedRateOf = (count: number, impressions: number) =>
  ((count ?? 0) + RANK_PRIOR_COUNT) / ((impressions ?? 0) + RANK_PRIOR_IMPRESSIONS);

/**
 * Order sections the way the panel presents them: required first, then by
 * performance.
 */
export function sortSectionsByPerformance<T extends RankableSection>(
  sections: T[],
  countOf: (s: T) => number
): T[] {
  return [...sections].sort((a, b) => {
    // Required always first within their group
    if (a.is_required !== b.is_required) return (b.is_required ? 1 : 0) - (a.is_required ? 1 : 0);
    return (
      smoothedRateOf(countOf(b), b.embed_impressions ?? 0) -
      smoothedRateOf(countOf(a), a.embed_impressions ?? 0)
    );
  });
}

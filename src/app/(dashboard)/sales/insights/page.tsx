"use client";
/**
 * Sales → Insights
 *
 * What the Sales lead agent has filed, and nothing else. The list, the sorting and
 * the assign/dismiss actions are all components/InsightsBoard — the same component
 * /pipeline renders — so this page is a section id and nothing more.
 *
 * This board starts EMPTY, and that is deliberate. Website carries a retired
 * `revenue` section from before spaces existed; rolling it up to Sales would have
 * silently moved historical insights off Website's board and onto this one on
 * deploy, with no record of the move. See the `legacy: []` note in
 * gravity-claw/src/utils/spaces.ts.
 */
import InsightsBoard from "@/components/InsightsBoard";

export default function SalesInsightsPage() {
  return (
    <InsightsBoard
      section="sales"
      emptyHint={
        <>
          Nothing open for Sales in this lane. Run an analysis from the{" "}
          <a href="/sales" style={{ color: "#64748b" }}>dashboard</a> to populate it —
          this space is new, so it has no history to show yet.
        </>
      }
    />
  );
}

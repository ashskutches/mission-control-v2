"use client";
/**
 * Content → Insights
 *
 * What the Content lead agent has filed, and nothing else. The list, the sorting
 * and the assign/dismiss actions are all components/InsightsBoard — the same
 * component /pipeline renders — so this page is a section id and nothing more.
 *
 * `section` is the SPACE id from lib/spaces.tsx, not a raw `agent_insights.section`
 * value. The server expands it to the retired sections that roll up here, so this
 * board shows the space's whole history rather than only rows filed since spaces
 * existed. See the note at the top of InsightsBoard.
 */
import InsightsBoard from "@/components/InsightsBoard";

export default function ContentInsightsPage() {
  return (
    <InsightsBoard
      section="content"
      emptyHint={
        <>
          Nothing open for Content in this lane. Run an analysis from the{" "}
          <a href="/content" style={{ color: "#64748b" }}>dashboard</a> to populate it.
        </>
      }
    />
  );
}

import type { Metadata } from "next";
import { REPORTS, KIND_LABEL, type Report } from "./manifest";

/**
 * /reports/claude — the public index of reports Claude wrote for Leaps & Rebounds.
 *
 * ## Why this page is not in the dashboard
 *
 * It sits at `src/app/reports/`, outside `(dashboard)`, so it gets no sidebar,
 * no session and no Midnight Glass chrome. That is the point: everyone who needs
 * to read these has no Claude seat and no Discord role, and a page wrapped in the
 * dashboard shell would either bounce them to /login or imply they can navigate
 * somewhere they cannot.
 *
 * `/reports` is in PUBLIC_PATHS in middleware.ts. Note that the middleware
 * matcher excludes `.png`/`.txt`/`.json` but NOT `.html`, so the exported pages
 * in `public/reports/claude/` would have been 307'd to /login without that entry
 * — the extension list is not a substitute for it.
 *
 * ## Not indexed, but not private either
 *
 * `robots` below and a Disallow in public/robots.txt keep it out of search.
 * Neither keeps out anyone holding the URL, and the reports carry real revenue
 * figures — that is a known, accepted trade for reports the team can actually
 * open. Tightening it is either a random path segment or a shared password in
 * middleware; both are small changes if this turns out to be too open.
 *
 * Design deliberately plain: light, system-font, no dependencies. Every report
 * behind it has its own strong art direction, so an index competing with them
 * makes the set look inconsistent rather than curated.
 */

export const metadata: Metadata = {
  title: "Reports — Leaps & Rebounds",
  description: "Analysis, build reports and prototypes written for Leaps & Rebounds.",
  robots: { index: false, follow: false, nocache: true },
};

const KIND_COLOR: Record<Report["kind"], string> = {
  analysis: "#1d6f5c",
  build: "#8a5a0b",
  prototype: "#4a5a8a",
  concept: "#8a3a5a",
};

function fmt(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });
}

export default function ReportIndex() {
  // Newest first. The manifest is kept in reading order for humans editing it,
  // so the sort lives here rather than relying on the array.
  const reports = [...REPORTS].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <main
      style={{
        maxWidth: 760, margin: "0 auto", padding: "56px 22px 96px",
        font: "16px/1.6 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: "#232323", background: "#faf9f5",
      }}
    >
      <header style={{ marginBottom: 40 }}>
        <p style={{
          margin: "0 0 10px", fontSize: 11, fontWeight: 700, letterSpacing: "0.11em",
          textTransform: "uppercase", color: "#8a8a82",
        }}>
          Leaps &amp; Rebounds
        </p>
        <h1 style={{ margin: "0 0 14px", fontSize: 34, lineHeight: 1.15, fontWeight: 800, letterSpacing: "-0.02em" }}>
          Reports
        </h1>
        <p style={{ margin: 0, fontSize: 16, color: "#55504a", maxWidth: 620 }}>
          Written by Claude while working on the store, the dashboard and the site.
          Each one states where its numbers came from and over what window, so a
          figure can be checked rather than taken.
        </p>
      </header>

      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 14 }}>
        {reports.map((r) => (
          <li key={r.slug}>
            <a
              href={`/reports/claude/${r.slug}.html`}
              style={{
                display: "block", textDecoration: "none", color: "inherit",
                background: "#fff", border: "1px solid #e4dacb", borderRadius: 12,
                padding: "18px 20px",
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 7 }}>
                <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em" }}>{r.title}</span>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
                  color: KIND_COLOR[r.kind], background: `${KIND_COLOR[r.kind]}14`,
                  padding: "2px 7px", borderRadius: 4,
                }}>
                  {KIND_LABEL[r.kind]}
                </span>
                <span style={{ fontSize: 12, color: "#948c81", marginLeft: "auto" }}>{fmt(r.date)}</span>
              </div>

              <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.62, color: "#55504a" }}>{r.blurb}</p>

              {/* Only where one number genuinely carries the report. A stat on
                  every card would make them all look like dashboards. */}
              {r.stat && (
                <p style={{ margin: "11px 0 0", fontSize: 13, color: "#837b70" }}>
                  <strong style={{ color: "#232323", fontSize: 15, fontWeight: 700 }}>{r.stat.value}</strong>
                  {" "}{r.stat.label}
                </p>
              )}
            </a>
          </li>
        ))}
      </ol>

      <p style={{ marginTop: 34, fontSize: 12.5, color: "#948c81", lineHeight: 1.6 }}>
        Internal. Not indexed by search engines, but anyone with this link can read it —
        several of these carry revenue figures. Send the link rather than forwarding the page.
      </p>
    </main>
  );
}

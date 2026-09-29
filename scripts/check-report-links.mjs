#!/usr/bin/env node
/**
 * check-report-links.mjs — every card on the index has to open something.
 *
 *   node scripts/check-report-links.mjs
 *
 * ## Why this exists
 *
 * Publishing a report is two edits in two places that nothing joins up:
 * `scripts/wrap-artifact.mjs <source.html> <slug>` writes
 * `public/reports/claude/<slug>.html`, and a REPORTS entry in manifest.ts carries
 * the same slug, which page.tsx turns into `href="/reports/claude/${slug}.html"`.
 * The two slugs have to be character-identical, and nothing enforces that they are.
 *
 * Nothing *can*, by default. `next build` copies public/ verbatim without ever
 * resolving an href against it, so a typo'd slug is not a build error. ESLint sees
 * a string template and has no idea it names a file. The index renders the broken
 * card exactly like a working one — right title, right blurb, right date — so the
 * page looks correct to the person who just edited it. The break surfaces when
 * somebody clicks, and the first click is plausibly the external reader the link
 * was sent to.
 *
 * ## What it looks for
 *
 * Set equality, in both directions, between REPORTS slugs and the `.html` files in
 * public/reports/claude:
 *
 *   · A slug with no file is the 404 card above.
 *   · A file with no slug is an artifact exported under a name the manifest never
 *     learned — the same mistake seen from the other end, since re-exporting under
 *     a changed slug leaves the orphan and the dead link together. It also catches
 *     something worse: a file in this directory is *published* whether or not the
 *     index links to it. manifest.ts holds several reports back deliberately (client
 *     deliverables, and SECURITY_HOLD, which documents a live unpatched API). Those
 *     are held back by never being exported, and an unlisted file here means that
 *     assumption has quietly stopped being true.
 *
 * Only this directory. public/reports/partners/ is a separate set with its own
 * manifest-free links, so it is out of scope by being out of the folder.
 *
 * Duplicate slugs are checked too, because set equality on its own cannot see them:
 * two entries sharing a slug point at one file, so both sides still match, while
 * page.tsx renders them with a duplicated React `key`.
 */

import { readdirSync } from "node:fs";
import { REPORTS } from "../src/app/reports/claude/manifest.ts";

const DIR = "public/reports/claude";

const slugs = REPORTS.map((r) => r.slug);
const files = readdirSync(DIR)
  .filter((name) => name.endsWith(".html"))
  .map((name) => name.slice(0, -".html".length));

const onDisk = new Set(files);
const listed = new Set(slugs);

const missing = slugs.filter((slug) => !onDisk.has(slug));
const orphaned = files.filter((slug) => !listed.has(slug)).sort();
const duplicated = [...new Set(slugs.filter((s, i) => slugs.indexOf(s) !== i))];

if (missing.length === 0 && orphaned.length === 0 && duplicated.length === 0) {
  console.log(
    `check-report-links: ${slugs.length} report(s) listed, ${slugs.length} file(s) to open.`
  );
  process.exit(0);
}

const lines = [];

for (const slug of missing) {
  const title = REPORTS.find((r) => r.slug === slug)?.title ?? slug;
  lines.push(
    `  manifest.ts: "${slug}" (${title})\n` +
      `    the index links /reports/claude/${slug}.html — ${DIR}/${slug}.html does not exist`
  );
}
for (const slug of orphaned) {
  lines.push(
    `  ${DIR}/${slug}.html\n` +
      `    published and reachable, but no REPORTS entry lists it`
  );
}
for (const slug of duplicated) {
  lines.push(`  manifest.ts: "${slug}" appears in REPORTS more than once`);
}

console.error(
  `check-report-links: ${lines.length} report(s) where the manifest and the ` +
    `exported files disagree.\n`
);
console.error(lines.join("\n"));
console.error(
  "\nA slug is the join between a REPORTS entry and the file wrap-artifact.mjs wrote; " +
    "the build and the linter both pass regardless. Fix by re-running " +
    "`node scripts/wrap-artifact.mjs <source.html> <slug>` under the listed slug, or by " +
    "correcting the slug in manifest.ts to match the file that exists."
);
process.exit(1);

#!/usr/bin/env node
/**
 * check-partner-spelling.mjs — keep partner-facing briefs in American spelling.
 *
 *   node scripts/check-partner-spelling.mjs
 *
 * ## Why this exists, and why it is scoped to one directory
 *
 * The pages under `public/reports/partners/` are not read the way the rest of
 * this app is read. A partner takes the document and ingests it into their
 * agent's knowledge base, so every word in it is eventually said back to one of
 * our customers. That makes the copy an output surface, not just a page.
 *
 * Leaps & Rebounds is a US company that does not ship internationally — the Loop
 * brief says so itself. So the spelling that reaches those customers should be
 * American, which is the same call ddb4cac made for the dashboard's own
 * user-visible strings.
 *
 * This check is deliberately NOT repo-wide. Most of the codebase — comments,
 * several dashboard labels — still uses British spelling, and changing that is
 * a separate decision nobody has made. Widening the glob would turn this from a
 * guard into a demand for a rewrite.
 *
 * ## Why a script and not a test
 *
 * There is no test runner in this project, and adding jest or vitest to guard a
 * static HTML asset would cost more than it protects. This is plain Node with no
 * dependencies, run the same way `wrap-artifact.mjs` is.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = "public/reports/partners";

/**
 * British form → American form. Each pattern is word-bounded and
 * case-insensitive, so it catches "Colour" in a heading as well as "colours" in
 * a table cell.
 *
 * Only unambiguous markers belong here. "cancelling" is not in the list: both
 * spellings are standard in American English, so flagging it would be a style
 * opinion rather than a convention check.
 */
const BRITISH = [
  [/\bcolours?\b/gi, "color / colors"],
  [/\bcolouring\b/gi, "coloring"],
  [/\bcolourways?\b/gi, "colorway / colorways"],
  [/\bprioritis(e|es|ed|ing|ation)\b/gi, "prioritiz-"],
  [/\bbehaviours?\b/gi, "behavior / behaviors"],
  [/\bcatalogues?\b/gi, "catalog / catalogs"],
  [/\borganis(e|es|ed|ing|ation|ations)\b/gi, "organiz-"],
  [/\brecognis(e|es|ed|ing)\b/gi, "recogniz-"],
  [/\bapologis(e|es|ed|ing)\b/gi, "apologiz-"],
  [/\bgrey\b/gi, "gray"],
  [/\blicence\b/gi, "license"],
  [/\bfavourites?\b/gi, "favorite / favorites"],
  [/\bunlabelled\b/gi, "unlabeled"],
  [/\blabelled\b/gi, "labeled"],
];

const failures = [];

for (const file of readdirSync(DIR).filter(f => f.endsWith(".html"))) {
  const path = join(DIR, file);
  readFileSync(path, "utf8").split("\n").forEach((line, i) => {
    for (const [pattern, american] of BRITISH) {
      for (const hit of line.matchAll(pattern)) {
        failures.push(`${path}:${i + 1}  "${hit[0]}" → ${american}`);
      }
    }
  });
}

if (failures.length) {
  console.error(
    `British spelling in a partner-facing brief (${failures.length}):\n` +
    failures.map(f => `  ${f}`).join("\n") +
    "\n\nThese documents are ingested verbatim into a partner's agent knowledge " +
    "base and read back to US customers. Use the American form."
  );
  process.exit(1);
}

console.log(`OK — ${DIR} is consistently American-spelled.`);

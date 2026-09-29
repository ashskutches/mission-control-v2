#!/usr/bin/env node
/**
 * check-manifest-hold-record.mjs — the publish/hold record has to stay true.
 *
 *   node scripts/check-manifest-hold-record.mjs
 *
 * ## Why this exists
 *
 * The header docblock of src/app/reports/claude/manifest.ts is the only place in
 * the repo that records which Claude artifacts may go on the public index and why
 * each of the rest is held. One of those holds is a security writeup that lists
 * three still-unauthenticated admin endpoints, so the docblock is read by someone
 * deciding whether an artifact is safe to publish.
 *
 * It opened with "25 artifacts exist on the Claude account. These six are the
 * Leaps & Rebounds ones", then enumerated holds of 3 + 13 + 1 + 1. Nothing
 * recomputed any of it. REPORTS reached nine entries and the prose still said six,
 * and 18 held + 9 listed came to 27 against a stated 25. A reader doing the
 * subtraction the prose invites finds an artifact unaccounted for, and the two
 * readings available are both wrong: hunt for a report that does not exist, or
 * conclude the hold list is incomplete and that some unlisted artifact was never
 * meant to be held.
 *
 * So the hold section now states no totals, and this check keeps it that way.
 *
 * ## What it looks for
 *
 *   · No cardinal — digit or number-word — anywhere in the hold section. A count
 *     written into prose that nothing recomputes is the defect itself; the count
 *     of published reports is REPORTS.length.
 *   · Both section markers still present, so the section cannot be renamed out
 *     from under the check and silently stop being checked.
 *   · SECURITY_HOLD.title still named in the hold section, so the bullet that
 *     defers to it ("see SECURITY_HOLD below") does not dangle.
 *   · No REPORTS title named in the hold section — nothing is recorded as held
 *     and published at the same time.
 *
 * The section ends at the "Deliberately no counts above" paragraph. That closing
 * paragraph quotes the numbers that were wrong, which is why the scan stops
 * before it: it is the epitaph, not the record.
 */

import { readFileSync } from "node:fs";

const MANIFEST = "src/app/reports/claude/manifest.ts";

/** Opens the hold section. Renaming it must fail loudly, not disable the check. */
const SECTION_START = /── Why this list is shorter than the artifact gallery/;

/** Closes it. Everything after is commentary on the numbers that were wrong. */
const SECTION_END = /Deliberately no counts above/;

/** "25", "18" — but not the 4 in "GA4", and not a digit glued to a word. */
const DIGITS = /(?<![A-Za-z0-9])\d+(?![A-Za-z0-9])/g;

/** "six", "thirteen" — "one" is left out; a singular is prose, not a tally. */
const WORDS =
  /\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|dozen|hundred)\b/gi;

const src = readFileSync(MANIFEST, "utf8");
const findings = [];

const startLine = src.split("\n").findIndex((l) => SECTION_START.test(l));
const endLine = src.split("\n").findIndex((l) => SECTION_END.test(l));

if (startLine === -1 || endLine === -1 || endLine < startLine) {
  console.error(
    `check-manifest-hold-record: cannot find the hold section in ${MANIFEST}.\n\n` +
      `  It is delimited by the "Why this list is shorter than the artifact gallery"\n` +
      `  heading and the "Deliberately no counts above" paragraph. If the docblock was\n` +
      `  reworded, move these markers with it — a check that silently finds nothing to\n` +
      `  check is worse than no check, because the section it guards is the only record\n` +
      `  of which artifacts may be published.`
  );
  process.exit(1);
}

const lines = src.split("\n");
const section = lines.slice(startLine, endLine);
const sectionText = section.join("\n");

for (const [offset, line] of section.entries()) {
  const found = [...(line.match(DIGITS) ?? []), ...(line.match(WORDS) ?? [])];
  if (found.length === 0) continue;
  findings.push(
    `  ${MANIFEST}:${startLine + offset + 1}\n` +
      `    counts in the hold section: ${found.map((f) => `"${f}"`).join(", ")}\n` +
      `      ${line.trim()}`
  );
}

const titles = (block) => [...block.matchAll(/title:\s*"([^"]+)"/g)].map(([, t]) => t);

const securityHold = src.match(/export const SECURITY_HOLD\s*=\s*\{([\s\S]*?)\}\s*as const;/);
if (!securityHold) {
  findings.push(`  ${MANIFEST}\n    SECURITY_HOLD is gone, but the hold section still defers to it.`);
} else {
  const [held] = titles(securityHold[1]);
  if (held && !sectionText.includes(held)) {
    findings.push(
      `  ${MANIFEST}\n` +
        `    SECURITY_HOLD is titled "${held}", which the hold section never names.\n` +
        `      The bullet that says "see SECURITY_HOLD below" points at nothing a\n` +
        `      reader can match, and the reason that artifact is held goes unread.`
    );
  }
}

const reports = src.match(/export const REPORTS:\s*Report\[\]\s*=\s*\[([\s\S]*?)\n\];/);
if (!reports) {
  findings.push(`  ${MANIFEST}\n    REPORTS array not found — nothing to check the record against.`);
} else {
  for (const title of titles(reports[1])) {
    if (sectionText.includes(title)) {
      findings.push(
        `  ${MANIFEST}\n` +
          `    "${title}" is published in REPORTS and still named in the hold section.\n` +
          `      One of the two is stale. If it was cleared to publish, delete its hold\n` +
          `      reason; the record cannot say both.`
      );
    }
  }
}

if (findings.length === 0) {
  const count = reports ? titles(reports[1]).length : 0;
  console.log(
    `check-manifest-hold-record: hold section states no totals, its cross-references ` +
      `resolve, and none of the ${count} published reports is also recorded as held.`
  );
  process.exit(0);
}

console.error(`check-manifest-hold-record: ${findings.length} problem(s) in the publish/hold record.\n`);
console.error(findings.join("\n\n"));
console.error(
  "\nThis docblock is what someone reads before deciding an artifact is safe to put " +
    "on a public URL, and one of the holds is a writeup of three admin endpoints that " +
    "still answer strangers. A total written into the prose drifts the first time " +
    "REPORTS changes, and a reader who subtracts a stale total from an accurate hold " +
    "list concludes the hold list has a gap in it. Take the number out rather than " +
    "correcting it: REPORTS.length already counts."
);
process.exit(1);

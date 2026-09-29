#!/usr/bin/env node
/**
 * check-report-reconciliation.mjs — a published reconciliation has to close.
 *
 *   node scripts/check-report-reconciliation.mjs
 *
 * ## Why this exists
 *
 * The reports index tells readers the whole point of these pages is that "a figure
 * can be checked rather than taken". A reader who takes that up does arithmetic:
 * headline number, minus the adjustment the page itself offers, should land on the
 * number in the table. When it does not, the page has spent the credibility it was
 * asking for — and the reader cannot tell which of the two figures is wrong, only
 * that one of them must be.
 *
 * It happened in the Sept 25 spike report. The stat tile said 26 orders, the funnel
 * table's Sep 25 row said 19 Completed, and the caption underneath offered
 * "The 26 orders also include 5 Collective orders, which have no storefront session."
 * 26 - 5 = 21, not 19. Both figures were right: 26 is the order count and 19 is
 * `sessions_that_completed_checkout` — a session metric, not an order metric, so the
 * two never had to agree in the first place. The caption was the defect. It framed a
 * basis difference as a subtraction, and then got the subtraction wrong.
 *
 * ## What it looks for
 *
 * A caption sentence of the shape "The N <things> also include M <...>", sitting
 * under a table. That sentence is a promise: N minus M is the table's figure. So the
 * check reads N and M, and requires N - M to appear in the table's last row — the
 * row these reports highlight as the day under discussion.
 *
 * This is deliberately narrow. It does not try to audit every number on every page;
 * it catches the one shape where a page does the reader's arithmetic for them and
 * gets it wrong. A page that states a basis difference in prose ("counts sessions,
 * not orders") does not match the pattern and is not checked — which is correct,
 * because such a page is not promising the numbers add up.
 *
 * If this fires, the fix is almost never to tweak M until it closes. It is to ask
 * whether the two figures are the same kind of thing at all, and if they are not,
 * to say so instead of subtracting.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = "public/reports";

/** A caption that follows a table, with the table's markup captured before it. */
const TABLE_THEN_CAPTION = /<table[^>]*>([\s\S]*?)<\/table>([\s\S]{0,400}?)<p class="cap">([^<]*)</g;

/** "The 26 orders also include 5 Collective orders" — a subtraction offered to the reader. */
const RECONCILIATION = /\bThe\s+([\d,]+)\s+([a-z]+)\s+also\s+includes?\s+([\d,]+)\s/i;

/** The last <tr> of a table body — the highlighted day these reports build up to. */
const LAST_ROW = /<tr\b[^>]*>(?:(?!<\/tr>)[\s\S])*<\/tr>(?![\s\S]*<tr\b)/;

const num = (s) => Number(s.replace(/,/g, ""));

function htmlFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...htmlFiles(p));
    else if (entry.name.endsWith(".html")) out.push(p);
  }
  return out;
}

/** Every integer written in a row's cells, comma separators normalised away. */
function rowNumbers(rowHtml) {
  const cells = [...rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)];
  const values = [];
  for (const [, cell] of cells) {
    const text = cell.replace(/<[^>]*>/g, "").trim();
    if (/^[\d,]+$/.test(text)) values.push(num(text));
  }
  return values;
}

/** Line number of a character offset, so a failure points at somewhere to edit. */
const lineOf = (text, index) => text.slice(0, index).split("\n").length;

const findings = [];

for (const file of htmlFiles(ROOT)) {
  const html = readFileSync(file, "utf8");
  for (const match of html.matchAll(TABLE_THEN_CAPTION)) {
    const [, tableBody, , caption] = match;
    const claim = caption.match(RECONCILIATION);
    if (!claim) continue;

    const [, totalText, noun, partText] = claim;
    const total = num(totalText);
    const part = num(partText);
    const expected = total - part;

    const lastRow = tableBody.match(LAST_ROW);
    if (!lastRow) continue;
    const values = rowNumbers(lastRow[0]);
    if (values.includes(expected)) continue;

    findings.push({
      file: relative(process.cwd(), file).replace(/\\/g, "/"),
      line: lineOf(html, html.indexOf(caption, match.index)),
      noun,
      total,
      part,
      expected,
      values,
    });
  }
}

if (findings.length === 0) {
  console.log("check-report-reconciliation: every published reconciliation closes.");
  process.exit(0);
}

console.error(
  `check-report-reconciliation: ${findings.length} caption(s) offering arithmetic that does not close.\n`
);
for (const f of findings) {
  console.error(
    `  ${f.file}:${f.line}\n` +
      `    caption says ${f.total} ${f.noun} minus ${f.part} => ${f.expected}\n` +
      `    table's last row has [${f.values.join(", ")}] — no ${f.expected}`
  );
}
console.error(
  "\nA reader who checks this comes up short and cannot tell which figure is wrong. " +
    "If the two numbers are different kinds of thing — orders vs converted sessions, say — " +
    "write that, rather than presenting a subtraction that does not land."
);
process.exit(1);

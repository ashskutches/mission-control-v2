#!/usr/bin/env node
/**
 * check-report-codes.mjs — keep redeemable discount codes out of the published
 * reports.
 *
 *   node scripts/check-report-codes.mjs
 *
 * ## Why this exists
 *
 * `public/reports` is served without a session: `/reports` is in PUBLIC_PATHS in
 * src/middleware.ts, so every one of these pages answers anyone holding the URL.
 * The index says so itself — "anyone with this link can read it" — and then
 * invites link-sharing. This repo is also public on GitHub, so anything written
 * into a report is published twice: once at the URL, once in source and in git
 * history, where deleting it later does not take it back.
 *
 * A discount code is the one thing on these pages that a stranger can *act* on.
 * Revenue figures are embarrassing to leak; a live code is money. It cost us one
 * already: a live 10% code shipped in the Sept 25 spike report next to the arithmetic
 * proving it worked ($1,760 gross, $1,584 charged), and it was an ACTIVE 10% code
 * with no expiry, no usage cap and no customer restriction.
 *
 * The rule the repo states for itself is already the right one — the sales-agent
 * knowledge base in public/reports/partners/loop-ai.html leaves the live code list
 * out on purpose. This script enforces that rule everywhere instead of leaving it
 * to whoever writes the next report.
 *
 * ## What it looks for, and why by shape
 *
 * By shape, not by a list of real codes: a denylist of live codes would have to
 * name them, which in a public repo is the very disclosure we are preventing.
 *
 * So: uppercase alphanumeric tokens carrying at least one letter *and* one digit,
 * inside the two elements these reports use to set a literal — `<code>` and
 * `<span class="path">`. That pattern is what a Shopify promo code looks like and
 * is deliberately narrow. Prose is untouched (lowercase), and so are the all-digit
 * literals the reports legitimately quote, such as the Google Ads campaign id
 * 23924847266 — no letters, no match.
 *
 * If this fires on something that is not a code, prefer rewording the report over
 * widening the allowlist. "after a 10% code" reads better than the code anyway,
 * and an authorised reader can always get the code from the order number.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = "public/reports";

/**
 * Tokens that match the shape but are not a redeemable code.
 *
 * Each entry needs a reason, and for a former code that means checking it is
 * actually dead rather than assuming it. Keep this short — see the note above
 * about rewording being the better fix.
 */
const ALLOWED = new Map([
  [
    "LP15OFFDEAL",
    "Named in rebounder-funnel-rebuild.html, which calls it 'verified active'. " +
      "That annotation is stale: Shopify's codeDiscountNodeByCode returned null " +
      "for it on 2026-09-26, so the code no longer exists and cannot be redeemed.",
  ],
]);

/** `<code>TOKEN</code>` and `<span class="path">TOKEN</span>` — how these reports set a literal. */
const LITERAL = /<(?:code|span\s+class="path")[^>]*>([^<]{4,30})<\//g;
const CODE_SHAPED = /^[A-Z0-9][A-Z0-9_-]{3,24}$/;

function htmlFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...htmlFiles(p));
    else if (entry.name.endsWith(".html")) out.push(p);
  }
  return out;
}

/** Line number of a character offset, so a failure points at somewhere to edit. */
const lineOf = (text, index) => text.slice(0, index).split("\n").length;

const findings = [];

for (const file of htmlFiles(ROOT)) {
  const html = readFileSync(file, "utf8");
  for (const match of html.matchAll(LITERAL)) {
    const token = match[1].trim();
    if (!CODE_SHAPED.test(token)) continue;
    if (!/[A-Z]/.test(token) || !/[0-9]/.test(token)) continue;
    if (ALLOWED.has(token)) continue;
    findings.push({
      file: relative(process.cwd(), file).replace(/\\/g, "/"),
      line: lineOf(html, match.index),
      token,
    });
  }
}

if (findings.length === 0) {
  console.log("check-report-codes: no redeemable discount codes in public/reports.");
  process.exit(0);
}

console.error(
  `check-report-codes: ${findings.length} discount-code-shaped literal(s) in publicly readable reports.\n`
);
for (const f of findings) {
  console.error(`  ${f.file}:${f.line}  ${f.token}`);
}
console.error(
  "\nThese pages need no session and this repo is public. Replace the code with its " +
    "effect (\"after a 10% code\"), or add it to ALLOWED with evidence it cannot be redeemed."
);
process.exit(1);

#!/usr/bin/env node
/**
 * check-report-order-basis.mjs — a page that prices an order has named a count.
 *
 *   node scripts/check-report-order-basis.mjs
 *
 * ## Why this exists
 *
 * The reports index tells readers the point of these pages is that "a figure can be
 * checked rather than taken". The cheapest check a reader runs on a commerce report
 * is the unit economics: revenue over the window, divided by orders, is the number
 * printed as revenue per order. A page that prints two of those three has asserted
 * the third, whether or not it meant to.
 *
 * The Conversion Map asserted it twice and disagreed with itself. One sentence read
 * "about $238k over the window ... roughly $960k a year at $185 per order", which
 * puts 1,286 orders in the window. Every percentage on the page divided by 1,091 —
 * the headline "0.91% of 120,342 sessions ended in an order", the share-of-orders
 * bars, the plan's per-page baselines. A reader who checked got 1,091 and 1,286 and
 * no way to tell which was wrong, only that one of them had to be.
 *
 * Both were right, and neither was an order count in the same sense. Checked against
 * the store: ShopifyQL `FROM sales SHOW orders, net_sales` returns 1,290 orders and
 * $302,383 net for the window; drop the seven no-product wholesale orders the page
 * already excludes ($64,778) and it is 1,283 orders on $237,605 — $185.20 each, the
 * page's own figure. `FROM sessions SHOW sessions_that_completed_checkout` returns
 * 1,091. That is a session metric. It is smaller because roughly two hundred orders
 * record no storefront session to attribute them to, so it was never going to reach
 * 1,283 and no correction to either number would have closed the gap.
 *
 * This is the same defect the Sept 25 spike report had (5431a66) — a session count
 * relabelled as orders — arriving in a different shape, which is why the checker that
 * commit shipped did not see it.
 *
 * ## What it looks for
 *
 * Every figure on a page that claims to be the window's order count, and whether they
 * agree. Three ways a page states one:
 *
 *   · "$R over the window ... $P per order"       → R / P orders
 *   · "... across N orders ..." in that sentence  → N orders
 *   · "P% of S sessions ended in an order"        → P × S orders
 *
 * All of them must land within 3% of each other. The tolerance is for rounding —
 * "$238k" is not $237,605 — not for a difference of basis.
 *
 * Deliberately narrow. It reads prose that names orders, and ignores prose that names
 * sessions, which is the whole point: "1,091 sessions completed checkout" makes no
 * claim about the order count and is not checked, while "1,091 sessions ended in an
 * order" makes one and is. A page needs fewer than two such claims to pass trivially,
 * and that is correct — a page that never prices an order is not promising anything
 * to divide.
 *
 * If this fires, the fix is almost never to adjust a number until it closes. It is to
 * ask whether the two figures count the same thing, and when they do not — sessions
 * that completed checkout are not orders — to say which is which.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = "public/reports";

/** Tolerance between two claims about the same count. Rounding, not basis. */
const TOLERANCE = 0.03;

/** "$185 per order", "$185 net per online order" — the page's revenue per order. */
const PER_ORDER = /\$([\d,.]+)\s*(k|m)?\s+(?:net\s+)?per\s+(?:online\s+)?order\b/gi;

/** "$238k over the window" — revenue for the window under discussion. */
const WINDOW_REVENUE = /\$([\d,.]+)\s*(k|m)?\s+(?:over|in|across|during)\s+the\s+window\b/i;

/** "across 1,283 orders" — the count the page says that revenue divides by. */
const STATED_ORDERS = /\b(?:across|from|on|over)\s+([\d,]+)\s+orders\b/i;

/** "0.91% of 120,342 sessions ended in an order" — a conversion rate read as orders. */
const SESSIONS_TO_ORDERS =
  /([\d.]+)\s*%\s+of\s+([\d,]+)\s+sessions\s+(?:ended\s+in\s+an\s+order|became\s+orders)/i;

/** <p> and <li> only: the prose blocks. Nested <div>s do not survive a regex. */
const PROSE_BLOCK = /<(p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;

const money = (digits, suffix) => {
  const n = Number(digits.replace(/,/g, ""));
  if (!suffix) return n;
  return suffix.toLowerCase() === "k" ? n * 1_000 : n * 1_000_000;
};

const count = (s) => Number(s.replace(/,/g, ""));

/** Tags out, one space in, so "<b>$238k</b> over" does not become "$238kover". */
const flatten = (html) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

function htmlFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...htmlFiles(p));
    else if (entry.name.endsWith(".html")) out.push(p);
  }
  return out;
}

/** Every claim a page makes about how many orders the window held. */
function orderClaims(html) {
  const claims = [];
  const whole = flatten(html);

  const conversion = whole.match(SESSIONS_TO_ORDERS);
  if (conversion) {
    const rate = Number(conversion[1]) / 100;
    const sessions = count(conversion[2]);
    claims.push({
      orders: rate * sessions,
      how: `${conversion[1]}% of ${conversion[2]} sessions "ended in an order"`,
    });
  }

  for (const [, , inner] of html.matchAll(PROSE_BLOCK)) {
    const text = flatten(inner);
    const rates = [...text.matchAll(PER_ORDER)];
    if (rates.length === 0) continue;

    const perOrder = money(rates[0][1], rates[0][2]);
    if (!perOrder) continue;

    const revenue = text.match(WINDOW_REVENUE);
    if (revenue) {
      claims.push({
        orders: money(revenue[1], revenue[2]) / perOrder,
        how: `$${revenue[1]}${revenue[2] ?? ""} over the window at $${rates[0][1]} per order`,
      });
    }

    const stated = text.match(STATED_ORDERS);
    if (stated) {
      claims.push({ orders: count(stated[1]), how: `"${stated[0]}"` });
    }
  }

  return claims;
}

const files = htmlFiles(ROOT).sort();
const findings = [];

for (const file of files) {
  const claims = orderClaims(readFileSync(file, "utf8"));
  if (claims.length < 2) continue;

  const [first] = claims;
  for (const other of claims.slice(1)) {
    const gap = Math.abs(other.orders - first.orders) / first.orders;
    if (gap <= TOLERANCE) continue;
    findings.push(
      `  ${file}\n` +
        `    ${first.how}\n` +
        `      → ${Math.round(first.orders).toLocaleString("en-US")} orders\n` +
        `    ${other.how}\n` +
        `      → ${Math.round(other.orders).toLocaleString("en-US")} orders\n` +
        `    ${(gap * 100).toFixed(1)}% apart — the page divides by two different counts`
    );
  }
}

if (findings.length === 0) {
  console.log(
    `check-report-order-basis: ${files.length} report(s) read, every order count agrees with itself.`
  );
  process.exit(0);
}

console.error(
  `check-report-order-basis: ${findings.length} page(s) stating an order count ` +
    `two ways, with the two disagreeing.\n`
);
console.error(findings.join("\n\n"));
console.error(
  "\nA reader checking revenue ÷ orders against the printed per-order figure lands on " +
    "one of these and cannot tell which is wrong. Before adjusting a number, check " +
    "whether the two count the same thing: `FROM sales SHOW orders` and " +
    "`FROM sessions SHOW sessions_that_completed_checkout` are different populations, " +
    "and a page using both has to say so rather than call both of them orders."
);
process.exit(1);

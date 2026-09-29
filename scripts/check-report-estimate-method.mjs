#!/usr/bin/env node
/**
 * check-report-estimate-method.mjs — a page that prints a method reproduces it.
 *
 *   node scripts/check-report-estimate-method.mjs
 *
 * ## Why this exists
 *
 * The reports index tells readers the point of these pages is that "a figure can be
 * checked rather than taken". An estimate table that prints its own arithmetic —
 * baseline, assumed improvement, dollars — invites exactly that check, and the
 * Method line under it says which arithmetic to run. A reader who runs it on every
 * row and finds four that land and one that doesn't has learned nothing about which
 * row is wrong, only that the method is decorative.
 *
 * The Conversion Map shipped one such row. The Advertorial row read "1 order on
 * normal-day traffic" / "~1% of real sessions" and priced it at $5k–$15k a year.
 * The page had already said (twice) that 1,275 of that page's 1,707 sessions landed
 * on 23 September with zero add-to-carts, that they were "not real shoppers", and
 * that the reader should "filter the 23 September spike out before reading any
 * conversion rate for this page". Applying the Method to what survives that filter —
 * 432 × 1% = 4.3 orders, less the 1 it has, × $185 × 4.06 — gives about $2.5k. The
 * printed $5k–$15k is only reachable from the un-filtered 1,707 (16.1 extra orders,
 * $12.1k), which is the spike the page tells you to remove. The inflated low end
 * carried into the headline "$150k–$300k", the hero stat, and the reports index card.
 *
 * The row was also the only one whose baseline cell named no denominator at all —
 * "normal-day traffic" is not a number — so there was nothing in the table to divide
 * and the reader had to go back up the page and pick between two session counts.
 * That is the shape of the defect worth catching: a rate applied to a population the
 * table declines to name.
 *
 * ## What it looks for
 *
 * Any table with an "Assumed improvement" and a "Per year" column, checked against
 * the Method prose on the same page ("× $185 net per online order, × 4.06 to get a
 * year"):
 *
 *   · every row states a population its rate can apply to
 *   · extra orders × per-order × annualiser reproduces the printed dollars
 *   · the total row is the sum of the rows above it, and its percentage of the
 *     stated online revenue
 *   · the headline and any "$Xk–$Yk / yr" chips agree with the table
 *
 * Within 10%. The tolerance is for rounding — $47.1k is printed as "$45k" — not for
 * a difference of basis. A row that misses by 2×–6× is not a rounding question.
 *
 * If this fires, the fix is not to widen the band until it covers the printed number.
 * It is to ask which population the row is really about, and if it is deliberately
 * not the 90-day baseline the Method promises, to say so in the row.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = "public/reports";

/** Rounding, not basis. $47.1k printed as "$45k" is fine; 2× is not. */
const TOLERANCE = 0.1;

/** "× $185 net per online order" — what one extra order is worth. */
const PER_ORDER = /\$([\d,.]+)\s*(?:net\s+)?per\s+(?:online\s+)?order\b/i;

/** "× 4.06 to get a year" — the annualiser applied to a 90-day window. */
const ANNUALISER = /×\s*([\d.]+)\s*to\s+get\s+a\s+year/i;

/** "1,091 of 2,747 checkouts completed" — count and population in one phrase. */
const OF_POPULATION = /([\d,]+)\s+of\s+([\d,]+)\s+checkouts/i;

/** "10 orders", "392 completed checkouts" — the row's own 90-day count. */
const ORDERS = /([\d,]+)\s+(?:orders?|completed\s+checkouts?)\b/i;

/** "46,332 sessions", "432 spike-filtered sessions" — the population to apply a rate to. */
const SESSIONS = /([\d,]+)\s+(?:[A-Za-z-]+\s+){0,2}sessions\b/i;

/** "392 orders, 1.23%" — population stated as a rate instead of a count. */
const RATE = /([\d.]+)\s*%/;

/** "+10–20% relative" — a lift on the row's own count. */
const RELATIVE = /\+\s*([\d.]+)(?:\s*[–-]\s*([\d.]+))?\s*%\s*relative/i;

/** "40% → 42–44%" — a target rate on the row's population. */
const ARROW = /[\d.]+\s*%\s*→\s*([\d.]+)(?:\s*[–-]\s*([\d.]+))?\s*%/;

/** "~1% of real sessions" — a target rate with the "from" side left implicit. */
const APPROX = /~\s*([\d.]+)(?:\s*[–-]\s*([\d.]+))?\s*%/;

/** "$45k–$90k", "$150k–$300k" — a printed dollar band. */
const BAND = /\$([\d.,]+)\s*(k|m)?\s*[–-]\s*\$?([\d.,]+)\s*(k|m)?/i;

/** "~$960k / yr online" — the revenue a total percentage is a percentage of. */
const REVENUE = /\$([\d.,]+)\s*(k|m)?/i;

const TABLE = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
const ROW = /<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi;
const CELL = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
const HEADLINE = /<h2\b[^>]*>([\s\S]*?)<\/h2>/gi;
const MONEY_CHIP = /<span class="chip money">([\s\S]*?)<\/span>/gi;
const METHOD = /<li>\s*<b>\s*Method:\s*<\/b>([\s\S]*?)<\/li>/i;

const money = (digits, suffix) => {
  const n = Number(String(digits).replace(/,/g, ""));
  if (!suffix) return n;
  return suffix.toLowerCase() === "k" ? n * 1_000 : n * 1_000_000;
};

const count = (s) => Number(String(s).replace(/,/g, ""));

/** Tags out, one space in, so "<b>$45k</b>–$90k" does not become "$45k–$90k" wrongly joined. */
const flatten = (html) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&rarr;/g, "→")
    .replace(/\s+/g, " ")
    .trim();

const usd = (n) =>
  n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${Math.round(n).toLocaleString("en-US")}`;

const off = (a, b) => Math.abs(a - b) / Math.abs(b);

function htmlFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...htmlFiles(p));
    else if (entry.name.endsWith(".html")) out.push(p);
  }
  return out;
}

const cells = (rowHtml) => [...rowHtml.matchAll(CELL)].map(([, inner]) => flatten(inner));

function band(text) {
  const m = text.match(BAND);
  if (!m) return null;
  return { lo: money(m[1], m[2] ?? m[4]), hi: money(m[3], m[4]) };
}

/** The count the row starts from, and the population a rate would apply to. */
function baseline(text) {
  const pair = text.match(OF_POPULATION);
  if (pair) return { orders: count(pair[1]), population: count(pair[2]) };

  const orders = text.match(ORDERS);
  if (!orders) return null;

  const sessions = text.match(SESSIONS);
  if (sessions) return { orders: count(orders[1]), population: count(sessions[1]) };

  const rate = text.match(RATE);
  if (rate && Number(rate[1]) > 0) {
    return { orders: count(orders[1]), population: count(orders[1]) / (Number(rate[1]) / 100) };
  }

  return { orders: count(orders[1]), population: null };
}

/** How many extra orders the assumed improvement is worth, as a [lo, hi] band. */
function extraOrders(improvement, base) {
  const apply = (m, fn) => {
    const lo = fn(Number(m[1]));
    const hi = m[2] === undefined ? lo : fn(Number(m[2]));
    return { lo, hi, point: m[2] === undefined };
  };

  const relative = improvement.match(RELATIVE);
  if (relative) return apply(relative, (pct) => base.orders * (pct / 100));

  const target = improvement.match(ARROW) ?? improvement.match(APPROX);
  if (!target) return null;
  if (base.population === null) return { needsPopulation: true };
  return apply(target, (pct) => base.population * (pct / 100) - base.orders);
}

const files = htmlFiles(ROOT).sort();
const findings = [];
let tablesChecked = 0;

for (const file of files) {
  const html = readFileSync(file, "utf8");

  const method = html.match(METHOD);
  if (!method) continue;
  const methodText = flatten(method[1]);
  const perOrder = methodText.match(PER_ORDER);
  const annualiser = methodText.match(ANNUALISER);
  if (!perOrder || !annualiser) continue;

  const value = money(perOrder[1]) * Number(annualiser[1]);
  const note = (msg) => findings.push(`  ${file}\n${msg}`);

  for (const [, tableInner] of html.matchAll(TABLE)) {
    const rows = [...tableInner.matchAll(ROW)];
    const header = rows.find(([, , inner]) => /Assumed improvement/i.test(inner));
    if (!header) continue;
    tablesChecked += 1;

    const printed = [];

    for (const [, attrs, inner] of rows) {
      const cs = cells(inner);
      if (cs.length < 4 || inner === header[2]) continue;

      const [label, baseCell, improvement, perYear] = cs;
      const stated = band(perYear);
      if (!stated) continue;

      if (/\btotal\b/i.test(attrs) || /^total$/i.test(label)) {
        const sum = printed.reduce(
          (acc, b) => ({ lo: acc.lo + b.lo, hi: acc.hi + b.hi }),
          { lo: 0, hi: 0 }
        );
        if (off(stated.lo, sum.lo) > TOLERANCE || off(stated.hi, sum.hi) > TOLERANCE) {
          note(
            `    Total row prints ${usd(stated.lo)}–${usd(stated.hi)}\n` +
              `      the rows above it add to ${usd(sum.lo)}–${usd(sum.hi)}`
          );
        }

        const revenue = baseCell.match(REVENUE);
        const share = improvement.match(RELATIVE) ?? improvement.match(/\+\s*([\d.]+)\s*[–-]\s*([\d.]+)\s*%/);
        if (revenue && share) {
          const base = money(revenue[1], revenue[2]);
          const lo = (Number(share[1]) / 100) * base;
          const hi = (Number(share[2] ?? share[1]) / 100) * base;
          if (off(lo, stated.lo) > TOLERANCE || off(hi, stated.hi) > TOLERANCE) {
            note(
              `    Total row calls itself ${improvement} of ${baseCell}\n` +
                `      which is ${usd(lo)}–${usd(hi)}, not the ${usd(stated.lo)}–${usd(stated.hi)} it prints`
            );
          }
        }
        continue;
      }

      printed.push(stated);

      const base = baseline(baseCell);
      if (!base) continue;

      const extra = extraOrders(improvement, base);
      if (!extra) continue;

      if (extra.needsPopulation) {
        note(
          `    "${label}" assumes "${improvement}" but its baseline is "${baseCell}"\n` +
            `      a rate needs a population, and the row names none — the reader cannot\n` +
            `      reproduce ${usd(stated.lo)}–${usd(stated.hi)} from anything in the table`
        );
        continue;
      }

      const lo = extra.lo * value;
      const hi = extra.hi * value;

      // A banded improvement should reproduce both printed endpoints. A point
      // improvement ("~1%") gives one number, which the printed band must contain.
      const fails = extra.point
        ? lo < stated.lo * (1 - TOLERANCE) || lo > stated.hi * (1 + TOLERANCE)
        : off(stated.lo, lo) > TOLERANCE || off(stated.hi, hi) > TOLERANCE;

      if (fails) {
        const computed = extra.point ? usd(lo) : `${usd(lo)}–${usd(hi)}`;
        note(
          `    "${label}" prints ${usd(stated.lo)}–${usd(stated.hi)} / yr\n` +
            `      baseline "${baseCell}", improvement "${improvement}"\n` +
            `      method gives ${extra.point ? extra.lo.toFixed(1) : `${extra.lo.toFixed(1)}–${extra.hi.toFixed(1)}`} extra orders → ${computed}`
        );
      }
    }

    const total = printed.reduce(
      (acc, b) => ({ lo: acc.lo + b.lo, hi: acc.hi + b.hi }),
      { lo: 0, hi: 0 }
    );

    for (const [, inner] of html.matchAll(HEADLINE)) {
      const text = flatten(inner);
      if (!/a year/i.test(text)) continue;
      const claimed = band(text);
      if (!claimed) continue;
      if (off(claimed.lo, total.lo) > TOLERANCE || off(claimed.hi, total.hi) > TOLERANCE) {
        note(
          `    Headline "${text}"\n` +
            `      the estimate table adds to ${usd(total.lo)}–${usd(total.hi)}`
        );
      }
      const midpoint = text.match(/midpoint\s+near\s+\$([\d.,]+)\s*(k|m)?/i);
      if (midpoint) {
        const mid = (claimed.lo + claimed.hi) / 2;
        if (off(money(midpoint[1], midpoint[2]), mid) > TOLERANCE) {
          note(
            `    Headline says midpoint near ${usd(money(midpoint[1], midpoint[2]))}\n` +
              `      the midpoint of its own ${usd(claimed.lo)}–${usd(claimed.hi)} is ${usd(mid)}`
          );
        }
      }
    }

    for (const [, inner] of html.matchAll(MONEY_CHIP)) {
      const chip = band(flatten(inner));
      if (!chip) continue;
      const matched = printed.some(
        (b) => off(b.lo, chip.lo) <= TOLERANCE && off(b.hi, chip.hi) <= TOLERANCE
      );
      if (!matched) {
        note(
          `    Chip "${flatten(inner)}" matches no row in the estimate table\n` +
            `      the table prints ${printed.map((b) => `${usd(b.lo)}–${usd(b.hi)}`).join(", ")}`
        );
      }
    }
  }
}

if (findings.length === 0) {
  console.log(
    `check-report-estimate-method: ${tablesChecked} estimate table(s) read, every row ` +
      `reproduces the method printed under it.`
  );
  process.exit(0);
}

console.error(
  `check-report-estimate-method: ${findings.length} figure(s) that do not reproduce ` +
    `from the page's own stated method.\n`
);
console.error(findings.join("\n\n"));
console.error(
  "\nA reader checking the table against the Method lands on one of these. Before " +
    "widening a band to cover the printed number, ask which population the row is " +
    "about: a page that tells the reader to filter a traffic spike out cannot price " +
    "a row on the un-filtered count, and a row deliberately sized to something other " +
    "than its 90-day baseline has to say so where the reader will see it."
);
process.exit(1);

#!/usr/bin/env node
/**
 * check-section-tabs.mjs — keep the section tab strip in one place.
 *
 *   node scripts/check-section-tabs.mjs
 *
 * ## Why this exists
 *
 * Eight sections each had their own hand-written copy of the pill strip under
 * the page header — identical markup down to the `${color}18` active fill and
 * the 0.06em letter-spacing. Identical markup does not stay identical. The
 * element id was already being slugified three different ways:
 *
 *     content, sales, seo     `label.toLowerCase().replace(/\s+/g, "-")`
 *     logistics, orders       `label.toLowerCase().replace(/[^a-z0-9]+/g, "-")…`
 *     marketing, website      `label.toLowerCase()`
 *     support                 no id at all
 *
 * so the id a label produced depended on which section it happened to live in,
 * and nothing anywhere said which rule was the right one. The strip now lives
 * in src/components/SectionTabs.tsx and the sections pass data.
 *
 * The failure mode this guards is copy-paste, not logic: a ninth section gets
 * added by duplicating an existing layout, and the fork starts again. Both
 * checks below are therefore textual — they look for the strip being rebuilt
 * by hand rather than for anything a type could catch.
 *
 * ## Why a script and not a test
 *
 * There is no test runner in this project. This is plain Node, run the same way
 * wrap-artifact.mjs is. It borrows the TypeScript
 * compiler — already a devDependency — only to execute the real `tabSlug`
 * source rather than a copy of it that could drift in its turn.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import ts from "typescript";

const ROOT = "src/app/(dashboard)";
const COMPONENT = "src/components/SectionTabs.tsx";

/** Every `layout.tsx` under the dashboard route group, at any depth. */
function layouts(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found.push(...layouts(path));
    else if (entry === "layout.tsx") found.push(path);
  }
  return found;
}

const failures = [];

// ── 1. Nobody rebuilds the pill by hand ───────────────────────────────────
//
// `letterSpacing: "0.06em"` is the strip's fingerprint: it appears in every
// one of the eight old copies and nowhere else in a layout. Content's second
// row — underlined text links, a genuinely different primitive — does not have
// it, which is exactly the line this check needs to draw.
const PILL = /letterSpacing:\s*"0\.06em"/;

// ── 2. Nobody invents a second slug rule ──────────────────────────────────
//
// An id built from a template literal must come from tabSlug. Anything else in
// that position is a fourth spelling of the rule, which is how this started.
const NAV_ID = /`[a-z-]*-nav-\$\{\s*(?!tabSlug\s*\()/;

for (const path of layouts(ROOT)) {
  readFileSync(path, "utf8").split("\n").forEach((line, i) => {
    const at = `${path}:${i + 1}`;
    if (PILL.test(line)) {
      failures.push(`${at}  hand-rolled pill strip — render <SectionTabs> instead`);
    }
    if (NAV_ID.test(line)) {
      failures.push(`${at}  nav id built by hand — use tabSlug() from SectionTabs`);
    }
  });
}

// ── 3. tabSlug produces usable, unique ids ────────────────────────────────
//
// Run the real implementation. Lifted out of the .tsx by source text and
// transpiled, because the module itself imports React and next/link and cannot
// be loaded from plain Node. If the function is ever renamed or reshaped past
// recognition this throws rather than quietly skipping.
function loadTabSlug() {
  const src = readFileSync(COMPONENT, "utf8");
  const start = src.indexOf("export function tabSlug");
  if (start === -1) {
    throw new Error(`${COMPONENT}: no 'export function tabSlug' to extract`);
  }
  const open = src.indexOf("{", start);
  let depth = 0, end = -1;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) { end = i + 1; break; }
  }
  if (end === -1) throw new Error(`${COMPONENT}: tabSlug body is unbalanced`);
  const js = ts.transpileModule(
    src.slice(start, end).replace("export ", ""),
    { compilerOptions: { target: ts.ScriptTarget.ES2020 } },
  ).outputText;
  return new Function(`${js}; return tabSlug;`)();
}

const tabSlug = loadTabSlug();

/**
 * Labels whose slug is worth pinning. The first four are the ones the old
 * regexes disagreed about — a bare toLowerCase() leaves a space or a bracket
 * inside the id, which is what made the drift matter rather than just untidy.
 */
const CASES = [
  ["Text Message (Testing)", "text-message-testing"],
  ["Warranty & Returns", "warranty-returns"],
  ["AI Visibility", "ai-visibility"],
  ["Tag Library", "tag-library"],
  ["Dashboard", "dashboard"],
];

for (const [label, expected] of CASES) {
  const got = tabSlug(label);
  if (got !== expected) {
    failures.push(`tabSlug(${JSON.stringify(label)}) → ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`);
  }
}

// Every label that actually ships must slug to a legal id, and no two labels in
// a section may collide — a collision puts the same id on two links, and the
// selector that reaches for it silently gets whichever came first.
const LABEL = /\blabel:\s*"([^"]*)"/g;
const LEGAL = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
let checked = 0;

for (const path of layouts(ROOT)) {
  const section = path.split(sep).at(-2);
  const seen = new Map();
  for (const [, label] of readFileSync(path, "utf8").matchAll(LABEL)) {
    const slug = tabSlug(label);
    checked++;
    if (!LEGAL.test(slug)) {
      failures.push(`${path}  "${label}" → "${section}-nav-${slug}" is not a usable element id`);
    }
    if (seen.has(slug)) {
      failures.push(`${path}  "${label}" and "${seen.get(slug)}" both slug to "${section}-nav-${slug}"`);
    }
    seen.set(slug, label);
  }
}

if (failures.length) {
  console.error(
    `Section tab strip (${failures.length}):\n` +
    failures.map(f => `  ${f}`).join("\n") +
    "\n\nThe strip lives in src/components/SectionTabs.tsx. A section supplies " +
    "items, an id prefix and an accent; it does not draw its own pills.\n"
  );
  process.exit(1);
}

console.log(`OK — every section renders <SectionTabs>, and ${checked} labels slug to unique, usable ids.`);

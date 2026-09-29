#!/usr/bin/env node
/**
 * check-nav-spelling.mjs — keep the section tab strips in American spelling.
 *
 *   node scripts/check-nav-spelling.mjs
 *
 * ## Why this exists
 *
 * ddb4cac ("Use American spelling in the dashboard copy") made the call that a
 * US company's dashboard should not say "unlabelled" or "colour" to its own
 * staff, and converted the user-visible strings it found on the Content pages.
 *
 * That call is easy to reverse without noticing. 1380121 regrouped the ten
 * Content tabs into five and wrote a `hint` for each one; the Tag Library hint
 * came out as "The tag vocabulary the library is organised by", which renders
 * directly under the tab strip on /content/tags — one click from
 * /content/training-data, where ddb4cac had changed "unlabelled" to
 * "unlabeled" for exactly this reason. Nothing flagged it, because the
 * regression is invisible inside its own diff: you only see it if you already
 * know ddb4cac landed.
 *
 * ## Why it is scoped to the section layouts
 *
 * A `label` or `hint` in one of these files is chrome. It is rendered on every
 * page of its section rather than on one screen, and it is written in a
 * different sitting from the page it describes — which is precisely how a
 * convention set on the pages gets missed in the navigation above them.
 *
 * This check is deliberately NOT repo-wide. Page bodies and the global sidebar
 * are still mixed — /content/training-data says "catalogue images" and "in this
 * colour", and the sidebar's Agents group says "Behaviour" — and standardizing
 * those is a separate decision nobody has made. Widening the glob would turn a
 * guard into a demand for a rewrite. Code comments are out of scope for the
 * same reason ddb4cac left them alone: nobody reads them as product copy.
 *
 * ## Why a script and not a test
 *
 * There is no test runner in this project. This is plain Node with no
 * dependencies, run the same way `wrap-artifact.mjs` is.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "src/app/(dashboard)";

/**
 * British form → American form. Each pattern is word-bounded and
 * case-insensitive, so it catches "Colour" in a tab label as well as "colours"
 * mid-sentence in a hint.
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

/**
 * The two keys that hold rendered text in a tab or group definition. `href`,
 * `icon` and `color` are not copy; the TypeScript `label: string;` lines in the
 * interface declarations carry no string literal, so they never match.
 */
const COPY_KEY = /\b(?:label|hint):\s*"([^"]*)"/g;

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
let scanned = 0;

for (const path of layouts(ROOT)) {
  readFileSync(path, "utf8").split("\n").forEach((line, i) => {
    for (const [, copy] of line.matchAll(COPY_KEY)) {
      scanned++;
      for (const [pattern, american] of BRITISH) {
        for (const hit of copy.matchAll(pattern)) {
          failures.push(`${path}:${i + 1}  "${hit[0]}" → ${american}  (in "${copy}")`);
        }
      }
    }
  });
}

if (failures.length) {
  console.error(
    `British spelling in a section tab strip (${failures.length}):\n` +
    failures.map(f => `  ${f}`).join("\n") +
    "\n\nThese strings sit above every page in their section. ddb4cac settled " +
    "on American spelling for the dashboard's user-visible copy; use the " +
    "American form here too.\n"
  );
  process.exit(1);
}

console.log(`OK — ${scanned} tab labels and hints are consistently American-spelled.`);

/**
 * A report page may style a theme attribute, or it may not set one. Not both.
 *
 * The reports under public/reports are standalone documents. Nothing wraps
 * them: src/app/reports/claude/page.tsx links straight at `/reports/claude/
 * <slug>.html`, and the Loop brief is handed out as a bare URL. Each file is
 * its own <html> root, so the only code that can put an attribute on that root
 * is a <script> in the file itself.
 *
 * The Loop brief shipped with `:root[data-theme="dark"]` and a matching
 * `:root:not([data-theme="light"])` guard on its prefers-color-scheme block,
 * and no script anywhere in the file. So the override never matched and the
 * guard never excluded anything — the page's real behaviour was `color-scheme:
 * light dark` plus the media query, which is what it still is. The cost was not
 * a broken render. It was a third copy of the palette to keep in sync and a
 * theme toggle that two selectors promised and nobody had written, which the
 * next person to edit the colours would have gone looking for.
 *
 * The rule is conditional, not a ban: style `data-theme` all you like on a page
 * that sets it. Add the toggle and this test goes quiet on its own.
 *
 * Run: npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

const PARTNER_BRIEF = "public/reports/partners/loop-ai.html";
const REPORTS_DIR = "public/reports";

/**
 * The five sibling reports still carrying the dead block the Loop brief just
 * lost. They are listed rather than fixed because that was a separate change
 * from this one, and listing them is what stops this guard from being a rule
 * with five silent exceptions.
 *
 * The assertion below is an equality, not a subset: clean one of these up and
 * the test fails until its line here is deleted. The list cannot go stale while
 * claiming to be current.
 */
const KNOWN_DEAD_THEME_CSS = [
    "public/reports/claude/conversion-map.html",
    "public/reports/claude/doubled-brand.html",
    "public/reports/claude/email-audit.html",
    "public/reports/claude/find-your-bounce.html",
    "public/reports/claude/off-topic-half-million.html",
    "public/reports/claude/rebounder-funnel-rebuild.html",
    "public/reports/claude/sept-25-spike.html",
];

/** A selector keyed on the theme attribute — `[data-theme="dark"]`, `:not(…)`. */
const STYLES_THE_ATTRIBUTE = /\[\s*data-theme\s*[~|^$*]?=/;

/**
 * Code that actually puts the attribute on an element — a script writing it, or
 * the root tag carrying it in the markup. Deliberately not a bare
 * `data-theme=`: that also matches the `[data-theme="dark"]` in a selector, so
 * every page would look like it sets what it only styles.
 */
const SETS_THE_ATTRIBUTE = /setAttribute\(\s*["'`]data-theme|dataset\.theme|<(?:html|body)\b[^>]*\sdata-theme\s*=/i;

/** Published report pages, each served as its own top-level document. */
function reportPages() {
    const out = [];
    const walk = (dir) => {
        for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
            const p = join(dir, entry.name);
            if (entry.isDirectory()) walk(p);
            else if (entry.name.endsWith(".html")) out.push(relative(".", p).split("\\").join("/"));
        }
    };
    walk(REPORTS_DIR);
    return out;
}

test("no report page styles a theme attribute that nothing in the page sets", () => {
    const dead = reportPages()
        .filter((p) => {
            const src = read(p);
            return STYLES_THE_ATTRIBUTE.test(src) && !SETS_THE_ATTRIBUTE.test(src);
        })
        .sort();

    assert.deepEqual(
        dead,
        KNOWN_DEAD_THEME_CSS,
        "a report styles [data-theme] but never sets it — either add the toggle the " +
            "selectors promise, or drop them; if you just cleaned one up, delete its " +
            "line from KNOWN_DEAD_THEME_CSS",
    );
});

test("the Loop brief's dark palette still redefines every colour the light one sets", () => {
    const src = read(PARTNER_BRIEF);

    // What survived the deletion has to be the *reachable* copy: the one inside
    // the media query, not a leftover unconditional block that would paint the
    // page dark for everyone.
    const light = src.match(/:root\s*\{([^}]*)\}/);
    const dark = src.match(/@media\s*\(\s*prefers-color-scheme:\s*dark\s*\)\s*\{\s*:root[^{]*\{([^}]*)\}/);
    assert.ok(light, "the brief has no base :root palette");
    assert.ok(dark, "the brief has no :root palette inside a prefers-color-scheme: dark query");

    const vars = (block) => [...block.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]).sort();
    assert.deepEqual(
        vars(dark[1]),
        vars(light[1]),
        "the two palettes have drifted — a custom property defined in one is missing from the other",
    );
});

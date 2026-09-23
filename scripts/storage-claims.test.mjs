/**
 * The rebounder does not fold. No surface may say it does.
 *
 * The frame is one rigid steel ring and the six legs screw into sockets — the
 * product page's own assembly copy ("just screw on the legs", "~8 minutes,
 * legs only") and its photography both show it: the setup shots thread legs in
 * one at a time, and the "built light" shot carries the rebounder upright with
 * the legs still protruding. There is no hinge. Nothing folds.
 *
 * "Folds flat" is therefore a capability claim for hardware we don't sell, and
 * storage is the objection it gets made into — the customer asking it is
 * standing in a small apartment deciding whether this thing fits. Answer it
 * wrong and they buy expecting a hinge, find six screw-in legs, and open a
 * return inside the 30-day window. So the words are load-bearing in a way the
 * usual marketing latitude does not cover.
 *
 * The rule enforced here is one-directional, like the warranty rule: a surface
 * may say it does NOT fold, and may stay silent, but may not claim it folds.
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

const BRAND_GUIDE = "src/components/AgentBrandGuide.tsx";
const PARTNER_BRIEF = "public/reports/partners/loop-ai.html";
const REPORTS_DIR = "public/reports";

/**
 * "Fold" is everywhere in this repo in senses that have nothing to do with the
 * hardware — "above the fold", "folded into section 9", "fold the useful
 * content into it". Only a fold predicated on the product is a product claim,
 * so match the subject too rather than the verb alone.
 */
const FOLD_CLAIM =
    /\b(?:it|they|both models|rebounder|trampoline|frame|legs|storage)\b[^.<]{0,40}\bfolds?\b|\bfolds?\b[^.<]{0,20}\b(?:flat|upright|away|down|against a wall|for storage)\b/i;

/** Is this sentence denying the fold rather than asserting it? */
const DENIES_THE_FOLD = /\b(?:do(?:es)?n[’']?t|do(?:es)? not|never|no|without)\b[^.]{0,20}\bfolds?\b/i;

/** Plain text of an HTML or TSX source, with tags and entities flattened. */
const asText = (src) =>
    src
        .replace(/<[^>]+>/g, " ")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&")
        .replace(/&#8217;|&rsquo;/g, "’");

/**
 * Every sentence in `src` that claims the product folds, with its line number,
 * so a failure names the copy to change instead of just the file.
 */
function foldClaims(src) {
    const out = [];
    // Split on sentence ends and on block boundaries, so a spec-list cell like
    // "<dd>Folds flat</dd>" is judged as its own fragment and not glued to its
    // neighbours in the same <dl>.
    const parts = src.split(/(?<=[.!?])\s+|(?=<(?:dd|dt|td|li|p|h[1-6])\b)|\n/i);
    // Locate each fragment by walking the source, because split() swallows the
    // separators it matched — a running sum of part.length drifts backwards and
    // reports a line number several lines shy of the copy it is complaining about.
    let cursor = 0;
    for (const part of parts) {
        const at = part ? src.indexOf(part, cursor) : cursor;
        if (at !== -1) cursor = at + part.length;
        const text = asText(part).replace(/\s+/g, " ").trim();
        if (text && FOLD_CLAIM.test(text) && !DENIES_THE_FOLD.test(text)) {
            out.push({ line: src.slice(0, at === -1 ? cursor : at).split("\n").length, text });
        }
    }
    return out;
}

/** Published report pages, which are live URLs anyone holding the link can open. */
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

test("the rebounder's storage answer is that the legs come off, not that it folds", () => {
    // Guards this file's premise. The Loop brief is the surface written closest
    // to the hardware, and it is the one the audit found telling the truth. If
    // the product ever ships a folding frame, this fails first and says to
    // revisit the assertions below rather than letting them enforce a stale fact.
    const row = read(PARTNER_BRIEF)
        .split("\n")
        .find((l) => /<td>Storage<\/td>/.test(l));
    assert.ok(row, `no Storage row found in ${PARTNER_BRIEF}`);
    assert.match(
        row,
        /screw off/i,
        "the Storage row no longer says the legs screw off — re-check the assertions in this file against the actual product",
    );
    assert.match(
        row,
        /don[’']?t fold/i,
        "the Storage row no longer says it doesn't fold — re-check the assertions in this file against the actual product",
    );
});

test("the brand guide does not tell agents the rebounder folds", () => {
    // This string is pasted verbatim into every internal agent prompt, so a
    // wrong fact here is the most widely repeated version of it in the company.
    const claims = foldClaims(read(BRAND_GUIDE));
    assert.deepEqual(
        claims.map((c) => `${BRAND_GUIDE}:${c.line} — ${c.text}`),
        [],
        "the brand guide claims a folding frame; the product has screw-in legs and no hinge",
    );
});

test("no published report claims the rebounder folds", () => {
    const claims = reportPages().flatMap((p) =>
        foldClaims(read(p)).map((c) => `${p}:${c.line} — ${c.text}`),
    );
    assert.deepEqual(
        claims,
        [],
        "these public pages claim a folding frame; the product has screw-in legs and no hinge",
    );
});

test("the brand guide still answers the space objection", () => {
    // The fix for a false capability claim is a true one, not a deletion. Small
    // spaces are the #1 reason this customer hesitates, and the honest answer —
    // it stores upright, the legs come off — still sells. Guards against a
    // future edit that resolves the conflict by dropping the differentiator.
    const guide = read(BRAND_GUIDE);
    const section = guide.slice(guide.indexOf("**Key differentiators**"));
    assert.match(
        section.slice(0, section.indexOf("**Product lines**")),
        /stores upright|under a bed|legs (?:unscrew|come off|screw off)/i,
        "the key differentiators no longer answer the space objection at all",
    );
});

/**
 * Two documents in this repo ground L&R's AI agents, and they disagree about
 * how the rebounder stores.
 *
 * src/components/AgentBrandGuide.tsx is the paste-ready brand guide. Its own
 * preamble says "Everything below is authoritative", and §7's five key
 * differentiators are the lines a content agent reaches for when it writes a
 * landing page or an ad. public/reports/partners/loop-ai.html is the knowledge
 * base ingested by Loop's abandoned-cart voice agent, and §4/§6 answer the
 * space objection with "the legs screw off, they don't fold."
 *
 * The brand guide claimed the opposite — "Folds flat, stores upright" — and it
 * is the one feeding generated copy, so it was the side that propagates. Both
 * are the designated answer to the same objection, so a customer could read
 * "folds flat" on the page that sold them, abandon the cart, and then hear the
 * phone agent say it doesn't fold, inside one purchase journey.
 *
 * The product doesn't fold. It is a rigid ring with six screw-in legs: the
 * store's own "built light" photo shows it carried as an unbroken circle with
 * the legs still on, and the PDP's own assembly copy is "95% pre-assembled,
 * legs only". The live Shopify description still carries the folding claim in
 * its marketing prose — that is a storefront fix outside this repo, and it is
 * why the brand guide must not restate it.
 *
 * So this suite pins the ground truth in the KB and holds the brand guide's
 * product facts to it.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const LOOP_BRIEF = "public/reports/partners/loop-ai.html";
const BRAND_GUIDE = "src/components/AgentBrandGuide.tsx";

const read = (p) =>
    readFileSync(fileURLToPath(new URL("../" + p, import.meta.url)), "utf8");

const brief = read(LOOP_BRIEF);
const guide = read(BRAND_GUIDE);

/** §7, from the "## 7. Product Facts" heading to the next `## ` heading. */
function productFacts() {
    const start = guide.indexOf("## 7. Product Facts");
    assert.notEqual(
        start,
        -1,
        `${BRAND_GUIDE} no longer has a "## 7. Product Facts" section. ` +
        `If the product facts moved, re-point this assertion at wherever the ` +
        `key differentiators now live.`,
    );
    const end = guide.indexOf("\n## ", start + 1);
    return guide.slice(start, end === -1 ? undefined : end);
}

test("premise: the Loop KB still says the rebounder does not fold", () => {
    // This is the ground truth the brand guide has to match. If the product
    // ever gains a folding frame, this assertion fails first and tells you to
    // re-decide the fact in both documents rather than silently flipping one.
    const line = brief
        .split("\n")
        .find((l) => /<dt>How do I store it\?<\/dt>/.test(l));

    assert.ok(
        line,
        `${LOOP_BRIEF} §4 no longer has a "How do I store it?" entry. That ` +
        `entry is where the storage fact is stated for the voice agent — ` +
        `re-point this assertion at whatever replaced it.`,
    );
    assert.match(
        line,
        /screw off/i,
        `${LOOP_BRIEF} §4's storage answer no longer says the legs screw off:` +
        `\n  ${line.trim()}`,
    );
    assert.match(
        line,
        /don't fold|do not fold|doesn't fold/i,
        `${LOOP_BRIEF} §4's storage answer no longer says the rebounder ` +
        `doesn't fold. If the product changed, fix ${BRAND_GUIDE} §7 to match ` +
        `before relaxing this:\n  ${line.trim()}`,
    );
});

test("the brand guide's space answer does not claim the rebounder folds", () => {
    const facts = productFacts();
    const claim = facts
        .split("\n")
        .find((l) => /\bfolds?\b|\bfolding\b/i.test(l));

    assert.equal(
        claim,
        undefined,
        `${BRAND_GUIDE} §7 tells agents the rebounder folds, and ` +
        `${LOOP_BRIEF} tells Loop's voice agent it doesn't. It doesn't — it's ` +
        `a rigid ring whose six legs screw off. The brand guide is the side ` +
        `that generates marketing copy, so this is the claim a customer reads ` +
        `before the phone call contradicts it:\n  ${String(claim).trim()}`,
    );
});

test("the brand guide still gives agents a space answer", () => {
    // Guard against fixing the line above by deleting it. The space objection
    // is real and #4 is the only place §7 answers it.
    assert.match(
        productFacts(),
        /the space answer/i,
        `${BRAND_GUIDE} §7 no longer has a "space answer" differentiator. ` +
        `Small-space buyers are the 40" model's whole case — say how it ` +
        `actually stores (legs screw off, stores flat) rather than dropping it.`,
    );
});

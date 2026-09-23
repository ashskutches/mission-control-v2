/**
 * Warranty scope must not widen as it moves outward.
 *
 * AgentBrandGuide.tsx holds the authoritative Guarantees line — it is ported from
 * the brand style guide doc and pasted verbatim into every internal agent prompt.
 * Outward-facing briefs (partner docs handed to third-party sales agents) must not
 * promise a broader warranty than that line allows, because those promises get made
 * on recorded calls and the in-house desk has to honour or decline them later.
 *
 * Run: npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

const BRAND_GUIDE = "src/components/AgentBrandGuide.tsx";
const PARTNER_BRIEF = "public/reports/partners/loop-ai.html";

/** The "**Guarantees:** ..." line from the authoritative brand guide string. */
function guaranteesLine() {
    const line = read(BRAND_GUIDE)
        .split("\n")
        .find((l) => l.startsWith("**Guarantees:**"));
    assert.ok(line, `no "**Guarantees:**" line found in ${BRAND_GUIDE}`);
    return line;
}

/**
 * Every mention of a lifetime warranty in `html`, with the sentence it sits in,
 * so a claim can be judged in context rather than by keyword alone.
 */
function lifetimeMentions(html) {
    const out = [];
    const re = /lifetime (?:frame )?warranty/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
        const start = html.lastIndexOf(".", m.index) + 1;
        const end = html.indexOf(".", m.index + m[0].length);
        out.push({
            index: m.index,
            line: html.slice(0, m.index).split("\n").length,
            sentence: html
                .slice(start, end === -1 ? html.length : end + 1)
                .replace(/<[^>]+>/g, "")
                .trim(),
        });
    }
    return out;
}

/** Does this sentence tie the lifetime claim to the US-made line? */
const scopedToUsMade = (sentence) => /American|USA|US-made|US-built/i.test(sentence);

/** Is the sentence forbidding the claim rather than making it? */
const forbidsTheClaim = (sentence) => /\bnever\b|\bdon.t\b|\bdo not\b/i.test(sentence);

test("the brand guide restricts the lifetime warranty to the US-made line", () => {
    // Guards the test's own premise. If the business widens the warranty line-wide,
    // this fails first and tells you to revisit the assertions below, rather than
    // letting them silently enforce a stale rule.
    assert.match(
        guaranteesLine(),
        /lifetime warranty on the American Edition only/i,
        "Guarantees line changed — re-check the partner-brief assertions in this file",
    );
});

test("the Loop partner brief never promises a lifetime warranty unscoped", () => {
    const unscoped = lifetimeMentions(read(PARTNER_BRIEF)).filter(
        (m) => !scopedToUsMade(m.sentence) && !forbidsTheClaim(m.sentence),
    );
    assert.deepEqual(
        unscoped.map((m) => `${PARTNER_BRIEF}:${m.line} — ${m.sentence}`),
        [],
        "these promise a lifetime warranty on models the brand guide does not cover",
    );
});

test("the Loop brief's Warranty policy row names the covered line", () => {
    const row = read(PARTNER_BRIEF)
        .split("\n")
        .find((l) => /<td>Warranty<\/td>/.test(l));
    assert.ok(row, `no Warranty policy row found in ${PARTNER_BRIEF}`);
    assert.ok(
        scopedToUsMade(row),
        "the Warranty row states a warranty without saying which line it covers",
    );
});

test("the Loop brief tells the agent not to quote warranty terms from memory", () => {
    // The brief already carries this rule for weight limits and restock dates.
    // Warranty needs it too — it is the claim most likely to close a sale and the
    // one the in-house desk has to honour afterwards.
    const rules = read(PARTNER_BRIEF).match(/<ul class="rules">[\s\S]*?<\/ul>/);
    assert.ok(rules, "no Never-rules list found in the partner brief");
    assert.match(
        rules[0],
        /warrant/i,
        "the Never-rules list says nothing about warranty claims",
    );
});

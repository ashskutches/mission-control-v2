/**
 * A public report may withhold a secret or publish it. It may not do both.
 *
 * Everything under public/reports is served without a session — `/reports` is
 * in PUBLIC_PATHS (src/middleware.ts), so the pages are readable by anyone
 * holding the URL, and noindex/nofollow stops crawlers, not people. The Loop
 * brief is the sharpest case: it is handed to a third-party vendor, so the link
 * comes to rest in their knowledge base, their sync logs and their agent
 * prompts. Its own header comment names the consequence and acts on it — the
 * live discount-code list is deliberately absent because "printing them on a
 * public URL publishes them".
 *
 * The defect this guards against is the half-measure that follows: withholding
 * the list while publishing the fact that the list is worth having. "Our store
 * has plenty of older influencer and affiliate codes that still work" hands a
 * reader the only thing the omission was protecting — that guessing pays — and
 * "let them try it at checkout" reads as the store sanctioning the attempt.
 * Anyone can always type a code into Shopify's checkout; what a public page can
 * add is the knowledge that it is worth doing, and that is what costs us.
 *
 * The rule is one-directional, like a warranty claim. A page may name a code it
 * means to publish, may say a code is expired or switched off, and may stay
 * silent. It may not say that codes it hasn't named are still redeemable, and
 * it may not invite the reader to test one at checkout.
 *
 * Fixing the copy is not the same as fixing the store. If those legacy codes
 * really are live, they still need auditing and deactivating in Shopify — that
 * is a decision for a person with the Shopify admin, not something a test can
 * assert. This file only stops the public pages from advertising it.
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
 * Both rules below are scoped to sentences that are actually about a discount
 * code. "Still works" and "checkout" are ordinary words in these reports — the
 * email audit is largely about checkout-abandon flows — and without this gate
 * the guard would fire on analysis prose that discloses nothing.
 */
const MENTIONS_A_CODE = /\bcodes?\b/i;

/** Says codes we haven't named remain redeemable. "still" is required, so a
 *  page is free to say the opposite: expired, switched off, no longer valid. */
const SAYS_THEY_STILL_WORK =
    /\bstill\b[^.<]{0,24}\b(?:work|works|working|valid|active|live|redeem|redeems|apply|applies)\b/i;

/** Invites the reader to find out whether a code is live by attempting it. */
const INVITES_AN_ATTEMPT = /\btry\b[^.<]{0,40}\b(?:at|in)\s+checkout\b/i;

/** Plain text of an HTML source, with tags and entities flattened. */
const asText = (src) =>
    src
        .replace(/<[^>]+>/g, " ")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&")
        .replace(/&#8217;|&rsquo;/g, "\u2019");

/**
 * Every sentence in `src` that discloses a live code, with its line number, so
 * a failure names the copy to change instead of just the file.
 */
function codeDisclosures(src) {
    const out = [];
    // Split on sentence ends and on block boundaries, so a table cell is judged
    // as its own fragment rather than glued to its neighbours in the same row.
    const parts = src.split(/(?<=[.!?])\s+|(?=<(?:dd|dt|td|li|p|h[1-6])\b)|\n/i);
    // Locate each fragment by walking the source: split() swallows the
    // separators it matched, so a running sum of part.length drifts backwards
    // and reports a line several lines shy of the copy it is complaining about.
    let cursor = 0;
    for (const part of parts) {
        const at = part ? src.indexOf(part, cursor) : cursor;
        if (at !== -1) cursor = at + part.length;
        const text = asText(part).replace(/\s+/g, " ").trim();
        if (!text || !MENTIONS_A_CODE.test(text)) continue;
        if (SAYS_THEY_STILL_WORK.test(text) || INVITES_AN_ATTEMPT.test(text)) {
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

test("no published report says our unlisted discount codes are still redeemable", () => {
    const found = reportPages().flatMap((p) =>
        codeDisclosures(read(p)).map((c) => `${p}:${c.line} — ${c.text}`),
    );
    assert.deepEqual(
        found,
        [],
        "these pages are public by link and tell the reader that codes we chose not to publish still work",
    );
});

test("the Loop brief still tells the partner to hand out only the code we send", () => {
    // The fix for an over-sharing rationale is a tighter instruction, not a
    // deleted one. Loop's agent still has to know it gets exactly one code and
    // is not an oracle for any other, or the omission above costs us the
    // control it was protecting. Guards against a future edit that resolves the
    // disclosure by dropping the rule along with it.
    const brief = asText(read(PARTNER_BRIEF)).replace(/\s+/g, " ");
    assert.match(
        brief,
        /only give out the code (?:you|we)/i,
        "the brief no longer tells Loop to give out only the code we send",
    );
    assert.match(
        brief,
        /shouldn[’']?t confirm or reject codes/i,
        "the brief no longer forbids the agent from confirming or rejecting other codes",
    );
});

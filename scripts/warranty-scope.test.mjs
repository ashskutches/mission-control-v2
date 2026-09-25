/**
 * The warranty scope every agent-facing artifact must agree on.
 *
 * Several documents in this repo are read by AI agents and spoken to customers:
 * AgentBrandGuide.tsx is pasted verbatim into our own agents' prompts, and the
 * Loop partner brief grounds a third party's abandoned-cart voice agent. When
 * they disagree about what the warranty covers, whichever agent the customer
 * reaches decides the warranty — and an over-broad promise made on a recorded
 * call is one we then either honour at cost or refuse in writing.
 *
 * Ground truth is the published, customer-facing warranty page, verified
 * 2026-09-25 at https://leapsandrebounds.com/pages/claim-warranty:
 *
 *   "Every Leaps & Rebounds trampoline is covered by a Lifetime Warranty!"
 *   Covered: Mat, Frame, Legs.   Not covered: Bungees.
 *
 * So the lifetime warranty is line-wide. It is NOT a feature of the USA-built
 * line, and no agent document may narrow it to one — narrowing costs a close on
 * every standard-unit cart, which is nearly every cart the recovery channel works.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(repo + p, "utf8");

const BRAND_GUIDE = "src/components/AgentBrandGuide.tsx";
const LOOP_BRIEF = "public/reports/partners/loop-ai.html";

const brandGuide = read(BRAND_GUIDE);
const loopBrief = read(LOOP_BRIEF);

/** Names for the USA-built premium line, in any document's wording. */
const US_LINE = /American Edition|American Tough|Made in USA/i;

test("premise: the agent documents do claim a lifetime warranty at all", () => {
    // Guards the rule below. If L&R ever narrows the real warranty, this fails
    // first and says so, rather than the suite silently enforcing a stale rule.
    for (const [path, text] of [[BRAND_GUIDE, brandGuide], [LOOP_BRIEF, loopBrief]]) {
        assert.match(
            text,
            /lifetime warranty/i,
            `${path} no longer mentions a lifetime warranty. If the published warranty ` +
            `page changed, re-verify it and update this file's ground truth before ` +
            `editing the assertions below.`,
        );
    }
});

test("the brand guide's Guarantees line does not restrict the lifetime warranty to one product line", () => {
    const line = brandGuide.split("\n").find((l) => l.includes("**Guarantees:**"));
    assert.ok(line, `${BRAND_GUIDE} has no **Guarantees:** line to check.`);

    const restricted = /lifetime warranty[^.\n]*\b(only|exclusive)/i.test(line) ||
        (US_LINE.test(line) && /lifetime warranty/i.test(line));

    assert.equal(
        restricted,
        false,
        `${BRAND_GUIDE} scopes the lifetime warranty to the USA-built line:\n  ${line.trim()}\n` +
        `The published warranty page covers "every Leaps & Rebounds trampoline".`,
    );
});

test("the brand guide does not sell lifetime warranty as what distinguishes the USA-built line", () => {
    const bullet = brandGuide
        .split("\n")
        .find((l) => /^- \*\*American Tough\*\*/.test(l.trim()));
    assert.ok(bullet, `${BRAND_GUIDE} has no American Tough product-line bullet to check.`);

    assert.doesNotMatch(
        bullet,
        /lifetime warranty/i,
        `${BRAND_GUIDE} lists the lifetime warranty as an American Tough differentiator:\n  ${bullet.trim()}\n` +
        `Every rebounder carries it, so it differentiates nothing. Its real ` +
        `differentiators are US build, weight capacity and premium positioning.`,
    );
});

test("no agent document narrows the lifetime warranty to a subset of the catalog", () => {
    for (const [path, text] of [[BRAND_GUIDE, brandGuide], [LOOP_BRIEF, loopBrief]]) {
        const offenders = text
            .split("\n")
            .filter((l) => /lifetime warranty/i.test(l))
            .filter((l) => /lifetime warranty[^.\n]*\b(only|exclusive)/i.test(l) ||
                /\b(only|exclusive)[^.\n]*lifetime warranty/i.test(l) ||
                new RegExp(`${US_LINE.source}[^.\n]{0,80}lifetime warranty`, "i").test(l));

        assert.deepEqual(
            offenders.map((l) => l.trim()),
            [],
            `${path} narrows the lifetime warranty to a subset of the catalog. ` +
            `It applies to every rebounder.`,
        );
    }
});

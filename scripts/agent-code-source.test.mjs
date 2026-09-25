/**
 * The Loop agent's discount code needs a referent inside the document that
 * grounds the agent.
 *
 * public/reports/partners/loop-ai.html is a knowledge base written to be
 * ingested — its own header comment says so. It refers to "the code", "the
 * agent's code" and "any other code" throughout, and §6's price objection, the
 * single most common reason an abandoned cart is abandoned, ends by telling the
 * agent to offer it. That is the only closing move §6 gives on price.
 *
 * But the document never says the code exists outside the document. It is never
 * named, never described, and nothing in it says a value will be supplied. An
 * agent grounded on this file alone reaches "offer the code" holding nothing,
 * and then either stalls on the one move it was given, or fills the gap with a
 * plausible-sounding string the customer enters and has rejected at checkout.
 *
 * The version before commit cf44e2c closed that loop in two sentences — "We'll
 * create the code in Shopify ourselves and email it to you" and "Please don't
 * make up a code, like SAVE10" — and the rewrite dropped both. Dropping the
 * first was deliberate and right: how the code gets provisioned is vendor
 * logistics and belongs in the reply email to Loop, per the header comment.
 * Dropping the second was not the same call. An email configures a human
 * integrator; only the ingested document constrains the model at the moment it
 * is on a call and short a code. The anti-fabrication rule has to live here.
 *
 * So §3 has to say two things this suite checks for: that the code is issued to
 * the agent rather than chosen by it, and that inventing one is forbidden.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const LOOP_BRIEF = "public/reports/partners/loop-ai.html";
const brief = readFileSync(
    fileURLToPath(new URL("../" + LOOP_BRIEF, import.meta.url)),
    "utf8",
);

/** §3, from the "The agent's discount code" heading to the end of the section. */
function codeRules() {
    const start = brief.indexOf("<h3>The agent's discount code</h3>");
    assert.notEqual(
        start,
        -1,
        `${LOOP_BRIEF} no longer has a "The agent's discount code" heading. ` +
        `If the code was withdrawn, this whole file is moot — delete it. ` +
        `If it just moved, re-point these assertions.`,
    );
    const end = brief.indexOf("</section>", start);
    return brief.slice(start, end);
}

test("premise: §6 still ends the price objection by telling the agent to offer the code", () => {
    // This is what makes the gap reachable. If §6 stops routing price objections
    // to the code, the agent never needs one and the rules below are dead weight.
    const line = brief
        .split("\n")
        .find((l) => /<dt>.*too expensive/i.test(l));

    assert.ok(
        line,
        `${LOOP_BRIEF} has no "It's too expensive" objection entry in §6. ` +
        `That entry is the path that reaches the code — re-point this assertion ` +
        `at whatever replaced it.`,
    );
    assert.match(
        line,
        /offer the code/i,
        `${LOOP_BRIEF} §6's price objection no longer tells the agent to offer ` +
        `the code. If the code is no longer a closing move, delete this file.`,
    );
});

test("§3 says the code is issued to the agent, not chosen by it", () => {
    const rules = codeRules();
    const rule = rules
        .split("\n")
        .find(
            (l) =>
                /<li>/.test(l) &&
                /configur|issued?|supplied?|given|sent|provided/i.test(l),
        );

    assert.ok(
        rule,
        `${LOOP_BRIEF} §3 governs "the agent's discount code" but never says ` +
        `the code comes from anywhere. The document is ingested as the agent's ` +
        `whole grounding, so "the code" has no value behind it and §3's "any ` +
        `other code" has nothing to be other than. Say in §3 that Leaps & ` +
        `Rebounds issues the code and configures it into the agent.`,
    );

    assert.match(
        rule,
        /only/i,
        `${LOOP_BRIEF} §3 mentions where the code comes from but doesn't make ` +
        `it the only one the agent may use, which is the part that binds:\n  ` +
        `${rule.trim()}`,
    );
});

test("§3 forbids the agent inventing a code", () => {
    const rules = codeRules();
    const rule = rules
        .split("\n")
        .find(
            (l) =>
                /<li>/.test(l) &&
                /invent|make up|made[- ]up|making up|fabricat|improvis|guess a code/i.test(
                    l,
                ),
        );

    assert.ok(
        rule,
        `${LOOP_BRIEF} §3 never tells the agent not to invent a code. On a ` +
        `price objection with no code in its grounding, inventing a ` +
        `plausible-looking one is the failure mode to expect — the store has ` +
        `live influencer codes with ordinary names, so a guess either fails at ` +
        `checkout or applies terms L&R never agreed. The document said this ` +
        `before commit cf44e2c and lost it in the rewrite; restore it.`,
    );
});

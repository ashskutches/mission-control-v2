/**
 * The discount code the Loop agent offers must be offerable on the cart it's
 * offered against.
 *
 * public/reports/partners/loop-ai.html grounds a third party's abandoned-cart
 * VOICE agent. Everything in it is spoken to a customer in real time, and the
 * customer acts on it at checkout minutes later — there is no preview step where
 * a bad instruction gets caught before it costs the sale.
 *
 * The brief gives that agent exactly one closing lever: a single discount code,
 * offered once, only on a price objection (§3, §6, §7). It also states in §3's
 * promotions table that the Halloween Bundle "Can't be combined with other
 * codes." Those two facts collide on a Halloween Bundle cart: the agent works
 * the price objection, offers its one code, and Shopify rejects it at checkout.
 * The customer has been quoted a price that does not exist, on the promotion
 * §6 separately tells the agent to push before it ends Oct 31.
 *
 * So wherever the brief tells the agent to offer the code, it has to also carry
 * the exception — otherwise the document knows the code will fail on these carts
 * and instructs the agent to offer it anyway.
 *
 * Note that §3's "Never guess whether discounts combine" does not cover this.
 * That rule governs what the agent says when a customer ASKS about combining,
 * and the agent here isn't guessing — the brief told it the answer.
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

/** The §6 entry that ends in the instruction to offer the code. */
function priceObjection() {
    const line = brief
        .split("\n")
        .find((l) => /<dt>.*too expensive/i.test(l));
    assert.ok(
        line,
        `${LOOP_BRIEF} has no "It's too expensive" objection entry in §6. ` +
        `That entry is the path that reaches the code — re-point this assertion ` +
        `at whatever replaced it.`,
    );
    return line;
}

test("premise: the brief still states the Halloween Bundle can't take a code", () => {
    // Guards everything below. If the bundle ends, or Shopify is reconfigured to
    // let the agent's code stack on it, this fails first and says so — rather
    // than the suite going on quietly enforcing a carve-out nothing needs.
    const row = brief
        .split("\n")
        .find((l) => /Halloween Bundle/i.test(l) && /combined/i.test(l));

    assert.ok(
        row,
        `${LOOP_BRIEF} no longer states that the Halloween Bundle can't combine ` +
        `with other codes. If that restriction is gone, delete this file along ` +
        `with the carve-outs it enforces. If the brief merely stopped saying so, ` +
        `restore the fact — the agent needs it.`,
    );
    assert.match(row, /[Cc]an't be combined with other codes/);
});

test("premise: the agent has exactly one code and it is its only discount lever", () => {
    // If the agent ever gets a second lever, "don't offer the code here" stops
    // being a dead end and the fallback wording below needs rethinking.
    assert.match(
        codeRules(),
        /It's the most the agent can offer/i,
        `${LOOP_BRIEF} no longer describes the code as the agent's ceiling.`,
    );
});

test("§3's code rules carve out the Halloween Bundle", () => {
    const rules = codeRules();
    const rule = rules
        .split("\n")
        .find((l) => /<li>/.test(l) && /halloween/i.test(l));

    assert.ok(
        rule,
        `${LOOP_BRIEF} §3 tells the agent when to offer its code but never ` +
        `mentions the Halloween Bundle, which §3's own promotions table says ` +
        `can't take a code. On a Halloween Bundle cart the agent follows these ` +
        `rules, offers the code, and it is rejected at checkout.`,
    );

    assert.match(
        rule,
        /don't offer|never offer|can't offer|doesn't (apply|work)|won't (apply|work)/i,
        `${LOOP_BRIEF} §3 mentions the Halloween Bundle in its code rules but ` +
        `doesn't actually tell the agent not to offer the code there:\n  ` +
        `${rule.trim()}`,
    );

    assert.match(
        rule,
        /value|risk|hand (it )?off|refer|info@leapsandrebounds\.com/i,
        `${LOOP_BRIEF} §3 blocks the code on a Halloween Bundle cart without ` +
        `saying what to do instead. The code is the agent's only lever, so ` +
        `removing it on a price objection leaves the call with nowhere to go:\n  ` +
        `${rule.trim()}`,
    );
});

test("§6's price objection doesn't send the agent to the code unconditionally", () => {
    const line = priceObjection();

    assert.match(
        line,
        /halloween|§3/i,
        `${LOOP_BRIEF} §6's price objection ends by telling the agent to offer ` +
        `the code, with no sign that it fails on a Halloween Bundle cart. This ` +
        `entry is a script the agent works turn by turn — the exception has to ` +
        `be reachable from here, not only from §3.`,
    );
});

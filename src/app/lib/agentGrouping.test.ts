import { test } from "node:test";
import assert from "node:assert/strict";

import {
  type AgentGroupable,
  agentSortKey, isAgentStuck, buildAgentGrouping,
} from "./agentGrouping.ts";

/** A board row with only the three fields the grouping reads. */
function row(
  assignee: AgentGroupable["assignee"],
  extra: Partial<AgentGroupable> = {},
): AgentGroupable {
  return { assignee, work: null, waiting_on_human: null, ...extra };
}

const agent = (name: string, extra: Partial<AgentGroupable> = {}) =>
  row({ kind: "agent" as const, name }, extra);
const human = (name: string, extra: Partial<AgentGroupable> = {}) =>
  row({ kind: "human" as const, name }, extra);
const nobody = () => row(null);

test("agentSortKey orders agents, then people, then nobody", () => {
  const keys = [nobody(), human("Ash"), agent("Zeta"), agent("alpha")]
    .map(agentSortKey)
    .sort();
  assert.deepEqual(keys, ["0|alpha", "0|zeta", "1|ash", "2|"]);
});

test("agentSortKey is case-insensitive, so one owner is one group", () => {
  assert.equal(agentSortKey(agent("Scout")), agentSortKey(agent("scout")));
});

test("isAgentStuck counts parked work and an unanswered question", () => {
  assert.equal(isAgentStuck(agent("Scout")), false);
  assert.equal(isAgentStuck(agent("Scout", { work: { status: "running" } })), false);
  assert.equal(isAgentStuck(agent("Scout", { work: { status: "blocked" } })), true);
  assert.equal(isAgentStuck(agent("Scout", { work: { status: "needs_human" } })), true);
  assert.equal(isAgentStuck(agent("Scout", { waiting_on_human: { question: "which?" } })), true);
});

test("buildAgentGrouping keys every row, parallel to the input", () => {
  const rows = [agent("Scout"), agent("Scout"), human("Ash"), nobody()];
  const { keys } = buildAgentGrouping(rows);
  assert.deepEqual(keys, ["0|scout", "0|scout", "1|ash", "2|"]);
  assert.equal(keys.length, rows.length);
});

test("buildAgentGrouping totals each group, and counts the stuck ones", () => {
  const { groups } = buildAgentGrouping([
    agent("Scout", { work: { status: "blocked" } }),
    agent("Scout", { waiting_on_human: { question: "which?" } }),
    agent("Scout", { work: { status: "running" } }),
    human("Ash"),
    nobody(),
    nobody(),
  ]);
  assert.deepEqual(groups.get("0|scout"), { count: 3, stuck: 2 });
  assert.deepEqual(groups.get("1|ash"), { count: 1, stuck: 0 });
  assert.deepEqual(groups.get("2|"), { count: 2, stuck: 0 });
  assert.equal(groups.size, 3);
});

test("an empty board groups into nothing rather than throwing", () => {
  const { keys, groups } = buildAgentGrouping([]);
  assert.deepEqual(keys, []);
  assert.equal(groups.size, 0);
});

/**
 * The header only renders where the key changes, and reads its totals from the
 * map — this is the render loop's logic, and what the old per-header
 * `items.filter(...)` rescan used to produce row by row.
 */
test("group headers land on each owner change and carry that owner's totals", () => {
  const rows = [
    agent("Scout", { work: { status: "blocked" } }),
    agent("Scout"),
    agent("Weaver"),
    human("Ash", { waiting_on_human: { question: "ok?" } }),
    nobody(),
  ];
  const grouping = buildAgentGrouping(rows);

  const headers = rows.flatMap((_, idx) => {
    const key = grouping.keys[idx];
    const starts = idx === 0 || grouping.keys[idx - 1] !== key;
    return starts ? [{ idx, ...grouping.groups.get(key)! }] : [];
  });

  assert.deepEqual(headers, [
    { idx: 0, count: 2, stuck: 1 },
    { idx: 2, count: 1, stuck: 0 },
    { idx: 3, count: 1, stuck: 1 },
    { idx: 4, count: 1, stuck: 0 },
  ]);
});

/** Each row is keyed exactly once, however many groups the board holds. */
test("keying is linear in rows, not rows x groups", () => {
  let calls = 0;
  const rows: AgentGroupable[] = Array.from({ length: 60 }, (_, i) => {
    const name = `agent-${i % 20}`;
    return {
      get assignee() { calls++; return { kind: "agent" as const, name }; },
      work: null,
      waiting_on_human: null,
    };
  });
  buildAgentGrouping(rows);
  assert.equal(calls, rows.length);
});

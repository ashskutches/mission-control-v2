/**
 * The Agent sort's grouping rules, lifted out of InsightsBoard so they can be
 * exercised without rendering a 200-row table.
 *
 * The input type is structural rather than `BoardItem`: this module reads three
 * fields, and importing the component's type would point the dependency back at
 * a 2000-line "use client" file.
 */

/** Just the parts of a board row the Agent grouping reads. */
export interface AgentGroupable {
  assignee: { kind: "agent" | "human"; name: string } | null;
  work: { status: string } | null;
  waiting_on_human: object | null;
}

/**
 * An agent has stopped and a person can get it moving again.
 *
 * Two ways that happens, and both count: the work row itself is parked
 * (`blocked`, or `needs_human` — which is where the runner puts an item whose
 * run budget ran out without the agent declaring it finished), or the agent has
 * asked someone a question and is still waiting on the answer. Same statuses
 * /agent-behavior calls "stuck now", so the two pages agree on the count.
 */
export const STUCK_WORK_STATUSES = new Set(["blocked", "needs_human"]);

export function isAgentStuck(item: AgentGroupable): boolean {
  if (item.work && STUCK_WORK_STATUSES.has(item.work.status)) return true;
  return !!item.waiting_on_human;
}

/**
 * The Agent sort's group order: agents A–Z, then people A–Z, then nobody.
 * Inside a group stuck rows come first, then the server's priority order.
 */
export function agentSortKey(item: AgentGroupable): string {
  const a = item.assignee;
  const bucket = a?.kind === "agent" ? "0" : a ? "1" : "2";
  return `${bucket}|${(a?.name ?? "").toLowerCase()}`;
}

/** What a group header shows: how many rows the owner holds, how many are stuck. */
export interface AgentGroup { count: number; stuck: number }

export interface AgentGrouping {
  /** `keys[i]` is row `i`'s group key — parallel to the rows passed in. */
  keys: string[];
  /** Totals per group key, for the header row. */
  groups: Map<string, AgentGroup>;
}

/**
 * Key every row once and total each group, for rows ALREADY sorted by
 * `agentSortKey`.
 *
 * The board used to derive this inside the render: every group header called
 * `items.filter(i => agentSortKey(i) === agentSortKey(item))` to find its own
 * members, so each header rescanned the whole list and each row was keyed once
 * per group. On /pipeline's default 200 rows with 20 owners that is 8,000-odd
 * `agentSortKey` calls, every one allocating a template string — and it ran
 * again on every keystroke in the Filter box, because `search` is component
 * state and re-renders the table. Keying each row once here makes it linear and
 * lets a header look its own totals up.
 */
export function buildAgentGrouping(rows: readonly AgentGroupable[]): AgentGrouping {
  const keys: string[] = [];
  const groups = new Map<string, AgentGroup>();
  for (const row of rows) {
    const key = agentSortKey(row);
    keys.push(key);
    let group = groups.get(key);
    if (!group) { group = { count: 0, stuck: 0 }; groups.set(key, group); }
    group.count++;
    if (isAgentStuck(row)) group.stuck++;
  }
  return { keys, groups };
}

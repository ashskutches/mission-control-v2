import { test } from "node:test";
import assert from "node:assert/strict";

import {
  type BoardSort,
  BOARD_LIMIT, boardSortParam, boardQuery,
} from "./insightsQuery.ts";

const EVERY_SORT: BoardSort[] = [
  "risk", "value", "effort", "newest", "section", "due", "type", "agent",
];

/**
 * The invariant the board's refetch behaviour rests on.
 *
 * `fetchBoard` is keyed on the query string, so the Agent tab only avoids a
 * pointless round trip for as long as it really does ask for what Priority
 * asks for. If that ever stops being true this fails here rather than showing
 * someone a stale board.
 */
test("the Agent sort asks the server for exactly what Priority asks for", () => {
  assert.equal(boardSortParam("agent"), "risk");
  assert.equal(
    boardQuery({ sort: "agent", lane: "all" }),
    boardQuery({ sort: "risk", lane: "all" }),
  );
});

test("Agent and Priority agree under every lane and section too", () => {
  for (const lane of ["business", "ops", "all"] as const) {
    assert.equal(
      boardQuery({ sort: "agent", lane }),
      boardQuery({ sort: "risk", lane }),
      `lane=${lane}`,
    );
    assert.equal(
      boardQuery({ sort: "agent", lane, section: "marketing" }),
      boardQuery({ sort: "risk", lane, section: "marketing" }),
      `lane=${lane} section=marketing`,
    );
  }
});

/** The flip side: no OTHER pair of tabs may collapse, or a real sort stops refetching. */
test("every other sort is distinct, so a real sort change still refetches", () => {
  const queries = EVERY_SORT
    .filter(s => s !== "agent")
    .map(sort => boardQuery({ sort, lane: "all" }));
  assert.equal(new Set(queries).size, queries.length);
});

test("lane and section each change the request", () => {
  const base = boardQuery({ sort: "risk", lane: "all" });
  assert.notEqual(base, boardQuery({ sort: "risk", lane: "ops" }));
  assert.notEqual(base, boardQuery({ sort: "risk", lane: "all", section: "marketing" }));
  assert.notEqual(
    boardQuery({ sort: "risk", lane: "all", section: "marketing" }),
    boardQuery({ sort: "risk", lane: "all", section: "support" }),
  );
});

/** An absent section is omitted, not sent as the string "null" or an empty value. */
test("no section means no section parameter", () => {
  for (const section of [undefined, null, ""]) {
    const params = new URLSearchParams(boardQuery({ sort: "risk", lane: "all", section }));
    assert.equal(params.has("section"), false, `section=${String(section)}`);
  }
});

test("the query is what the board endpoint expects", () => {
  const params = new URLSearchParams(
    boardQuery({ sort: "newest", lane: "business", section: "marketing" }),
  );
  assert.equal(params.get("sort"), "newest");
  assert.equal(params.get("lane"), "business");
  assert.equal(params.get("section"), "marketing");
  assert.equal(params.get("limit"), String(BOARD_LIMIT));
});

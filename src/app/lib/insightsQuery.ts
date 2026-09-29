/**
 * The request InsightsBoard makes for a board, built away from the component.
 *
 * Lifted out so the board can depend on the REQUEST rather than on the state
 * that happens to shape it. `fetchBoard` used to list `sort` in its useCallback
 * deps while sending `sort === "agent" ? "risk" : sort`, which meant toggling
 * between the Priority and Agent tabs gave the callback a new identity and
 * refired the load effect — for a query string byte-identical to the one
 * already answered. Depending on what this returns cannot drift that way: the
 * string changes exactly when the request changes, and not otherwise.
 *
 * It is also the only part of the board that can be checked without rendering a
 * 200-row table, which is where the test for that invariant lives.
 */

/** The board's sort tabs. `agent` is the one the server does not know about. */
export type BoardSort =
  | "risk" | "value" | "effort" | "newest" | "section" | "due" | "type" | "agent";

/** What the server is actually asked to sort by. */
export type ServerSort = Exclude<BoardSort, "agent">;

/**
 * The Agent sort is a grouping drawn client-side over the server's priority
 * order — see the `grouping` memo in InsightsBoard — so it asks for exactly
 * what Priority asks for. Every other tab is a real server sort and passes
 * straight through.
 *
 * If a future Agent tab ever needs its own server ordering, this is the single
 * place that changes, and `boardQuery` carries it into the deps for free.
 */
export function boardSortParam(sort: BoardSort): ServerSort {
  return sort === "agent" ? "risk" : sort;
}

/** How many rows a board load asks for. The board filters below this, not above it. */
export const BOARD_LIMIT = 200;

export interface BoardQueryOpts {
  sort: BoardSort;
  lane: "business" | "ops" | "all";
  /** A space id, not a section value — the server expands it. Omitted for /pipeline. */
  section?: string | null;
}

/** The query string for `GET /admin/insights/board`. */
export function boardQuery({ sort, lane, section }: BoardQueryOpts): string {
  const qs = new URLSearchParams({
    sort: boardSortParam(sort),
    lane,
    limit: String(BOARD_LIMIT),
  });
  if (section) qs.set("section", section);
  return qs.toString();
}

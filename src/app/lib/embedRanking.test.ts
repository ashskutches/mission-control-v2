import { test } from "node:test";
import assert from "node:assert/strict";
import { sortSectionsByPerformance } from "./embedRanking.ts";

interface TestSection {
  name: string;
  embed_impressions: number;
  c: number;
  is_required: boolean;
}

const count = (s: TestSection) => s.c;

const section = (name: string, impressions: number, c: number, is_required = false): TestSection =>
  ({ name, embed_impressions: impressions, c, is_required });

const names = (rows: TestSection[]) => rows.map(r => r.name);

test("a one-impression fluke does not outrank a proven converter", () => {
  // gravity-claw ranks this pool on a Laplace-smoothed rate for exactly this
  // reason: A is 2/41 = 4.9%, B is 401/2040 = 19.7%, so the server serves B.
  const sorted = sortSectionsByPerformance(
    [section("fluke", 1, 1), section("proven", 2000, 400)],
    count
  );
  assert.deepEqual(names(sorted), ["proven", "fluke"]);
});

test("a never-shown section is not ranked below a proven loser", () => {
  // 0 impressions means "no evidence", not "worst performer". UCB1 will serve
  // it next, so the panel must not bury it under a section that converts worse
  // than the prior.
  const sorted = sortSectionsByPerformance(
    [section("dud", 4000, 4), section("brand-new", 0, 0)],
    count
  );
  assert.deepEqual(names(sorted), ["brand-new", "dud"]);
});

test("with comparable sample sizes the better rate still wins", () => {
  const sorted = sortSectionsByPerformance(
    [section("worse", 1000, 50), section("better", 1000, 150)],
    count
  );
  assert.deepEqual(names(sorted), ["better", "worse"]);
});

test("required sections stay above optional ones regardless of rate", () => {
  const sorted = sortSectionsByPerformance(
    [section("optional-star", 1000, 500), section("required-dud", 1000, 1, true)],
    count
  );
  assert.deepEqual(names(sorted), ["required-dud", "optional-star"]);
});

test("required sections are ordered among themselves by performance", () => {
  const sorted = sortSectionsByPerformance(
    [section("req-low", 1000, 10, true), section("req-high", 1000, 200, true)],
    count
  );
  assert.deepEqual(names(sorted), ["req-high", "req-low"]);
});

test("the input array is not mutated", () => {
  const input = [section("a", 1000, 10), section("b", 1000, 200)];
  sortSectionsByPerformance(input, count);
  assert.deepEqual(names(input), ["a", "b"]);
});

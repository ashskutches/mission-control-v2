"use client";
/**
 * Sales → Profit — the absorbed P&L.
 *
 * One component, now rendered in three places: here, at /profitability (kept alive
 * for the `?tab=costs` deep link on the Insights blocker banner) and as Command
 * Center's Profitability tab.
 *
 * `subTabParam="sub"` for the same reason Command Center passes it: the inner
 * dashboard/costs switch writes its state into the query string, and `tab` is not
 * free here — leaving it as `tab` would work today but collide the moment this
 * section grows a query-driven tab of its own, which is exactly how the Command
 * Center collision happened.
 *
 * `showHeading={false}` because the Sales layout above already titles the page.
 */
import ProfitDashboard from "@/components/ProfitDashboard";

export default function SalesProfitPage() {
  return <ProfitDashboard subTabParam="sub" showHeading={false} />;
}

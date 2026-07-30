"use client";
/**
 * /profitability — the Profit dashboard on its own route.
 *
 * The dashboard itself now lives in components/ProfitDashboard so Command Center
 * can render it as a tab. This route is kept alive rather than redirected because
 * `/profitability?tab=costs` is already linked from the North Star blocker banner,
 * and a redirect would have to rewrite that parameter to survive.
 */
import ProfitDashboard from "@/components/ProfitDashboard";

export default function ProfitabilityPage() {
  return <ProfitDashboard />;
}

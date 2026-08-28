"use client";
/**
 * Sales → Dashboard
 *
 * The demand side of the order pull the P&L reads, in the order you'd act on it:
 *   1. Headline    — net revenue, orders, AOV, units per order, repeat rate
 *   2. Pressure    — what the revenue cost us in discount, refunds and ad spend
 *   3. Top sellers — what actually moved, by revenue, with margin where it is known
 *   4. Customer mix— new vs returning, on the window basis and the lifetime one
 *   5. Integrity   — line reconciliation, cost coverage, and the P&L's own blockers
 *
 * ONE ORDER PULL, TWO PAGES.
 * --------------------------
 * Everything here comes from `GET /admin/sales/overview`, which is `buildPnl`
 * reshaped rather than a second Shopify reader. That is deliberate: the Profit tab
 * of this same section reads the same build, so the two cannot drift into
 * disagreeing about the same orders. If a figure here looks wrong, it is wrong on
 * /sales/profit too, and the fix belongs in analytics/pnl.ts.
 *
 * THREE DENOMINATORS THIS PAGE REFUSES TO GET WRONG
 * -------------------------------------------------
 * - Discount rate divides by pre-discount basket value, not gross sales. Gross
 *   sales is already net of the code, so `discounts / grossSales` overstates it.
 * - Repeat rate counts customers with 2+ orders INSIDE the window. The lifetime
 *   reading is shown beside it and is several times larger (measured QTD: 4.3% vs
 *   27.8%) — the retention lever was once priced off the wrong one.
 * - Margin only appears on a product where a unit cost resolved. An unpriced line
 *   reads "not set", never 0% and never a site-average fill.
 */
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  DollarSign, ShoppingBag, Receipt, Layers3, Repeat, RefreshCw,
  TicketPercent, Undo2, Users, AlertTriangle, ArrowRight,
} from "lucide-react";
import SectionAgentPanel from "@/components/SectionAgentPanel";
import ChatBox from "@/components/ChatBox";
import {
  BOT_URL, LABEL, TH, TD, MetricCard, Panel, EmptyState, ShareBar,
  PeriodPicker, money, num, pct, mult, type PeriodKey,
} from "@/components/MarketingShared";

// ── Types (only what this page reads) ─────────────────────────────────────────

interface TopProduct {
  variantId: string | null;
  sku: string;
  title: string;
  variantTitle: string;
  quantity: number;
  orders: number;
  revenue: number;
  revenueSharePct: number | null;
  unitPrice: number;
  unitCost: number | null;
  costSource: string;
  grossProfit: number | null;
  marginPct: number | null;
  unitsPerOrder: number | null;
}

interface SalesOverview {
  period: { start: string; end: string; label: string };
  coverageFloor: number;
  revenue: {
    grossSales: number; discounts: number; preDiscountSales: number;
    tax: number; shippingCharged: number; refunds: number;
    netRevenue: number; nonProductRevenue: number; basis: string;
  };
  orders: {
    orders: number; cancelledOrders: number; refundedOrders: number; excludedOrders: number;
    aov: number; units: number; unitsPerOrder: number | null; avgUnitPrice: number | null;
  };
  customers: {
    customers: number; newCustomers: number; repeatCustomers: number;
    newSharePct: number | null; repeatRatePct: number | null;
    repeatCustomersLifetime: number; repeatRateLifetimePct: number | null;
    basis: string;
  };
  pressure: {
    discountRatePct: number | null; discountRateBasis: string;
    refundRatePct: number | null; refundRateBasis: string;
    cancelRatePct: number | null;
    mer: number | null; cac: number | null;
  };
  topProducts: TopProduct[];
  cogsCoverage: number;
  coverageSufficient: boolean;
  reconciliation: { lineDelta: number; reconciled: boolean; note: string };
  truncatedOrders: number;
  blockers: Array<{ code: string; message: string; fix: string; severity: "critical" | "warning" }>;
}

// ── Agent context ─────────────────────────────────────────────────────────────

const SALES_HINT = `
You are the lead agent for the **Sales** surface of Mission Control.
Your domain is revenue itself for leapsandrebounds.com — what sold, to whom, at what
discount, and what to sell more of:

- The order pull behind /admin/sales/overview — gross sales, discounts, refunds, net
  revenue, orders, units, AOV, basket size, new vs repeat customers
- Per-product performance — revenue, units, orders, units per order, and margin where
  a unit cost has been entered
- The P&L on the Profit tab — gross, contribution and net margin, MER and CAC

Rules you must hold to:
1. Gross sales is ALREADY net of discounts. A discount rate is discounts ÷ (gross sales
   + discounts). Dividing by gross sales alone overstates it, and quoting that figure to
   argue for less discounting is arguing from an inflated number.
2. Repeat rate has two readings and they differ by roughly 6×. The window reading counts
   customers with 2+ orders inside the period; the lifetime reading counts anyone who has
   ever ordered twice. Say which one you are using every time.
3. A product with no unit cost has NO margin — not a zero margin and not the site average.
   If cost coverage is below the floor, say so instead of ranking products by profit.
4. MER and CAC come from the P&L and are null when a credentialed ad channel collected
   nothing. A null there is a broken feed, not efficient spend — file it as a blockage,
   not as a finding.
5. Revenue that is not product revenue (financing and card-reward rows booked as manual
   orders) is out of every ratio on this page. Do not add it back to make a total match
   Shopify's own reporting.
6. A dollar figure in an insight needs a stated calculation in value_basis, and it is a
   claim, not a measurement, unless a system that can price the thing produced it.

Prioritise by revenue at stake per unit of effort. Name the specific product, segment or
discount — not "improve conversion".
`.trim();

const ACCENT = "#22c55e";

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SalesDashboardPage() {
  const [period, setPeriod] = useState<PeriodKey>("qtd");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SalesOverview | null>(null);
  const [assignedAgent, setAssignedAgent] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setData(await getJson<SalesOverview>(`${BOT_URL}/admin/sales/overview?period=${period}&limit=15`));
    setLoading(false);
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const r = data?.revenue;
  const o = data?.orders;
  const c = data?.customers;
  const p = data?.pressure;

  // Cost coverage gates every margin figure on the page, exactly as it does on the
  // Profit tab. Below the floor, per-product profit is not ranked — it is withheld.
  const coverageOk = data?.coverageSufficient ?? false;
  const coveragePct = data ? data.cogsCoverage * 100 : null;

  const agentMetrics = [
    { label: "Net revenue", value: money(r?.netRevenue), sub: data?.period.label },
    { label: "Orders", value: num(o?.orders) },
    { label: "AOV", value: money(o?.aov, 2) },
    { label: "Units", value: num(o?.units), sub: `${o?.unitsPerOrder ?? "—"} per order` },
    { label: "Discount rate", value: pct(p?.discountRatePct, 2), sub: "Of pre-discount basket value" },
    { label: "Refund rate", value: pct(p?.refundRatePct, 2) },
    { label: "Repeat rate (window)", value: pct(c?.repeatRatePct, 2), sub: "2+ orders inside the period" },
    { label: "New customers", value: num(c?.newCustomers) },
    { label: "COGS coverage", value: pct(coveragePct, 1), sub: coverageOk ? "Above the floor" : "Below the floor — margins withheld" },
  ];

  const accentColor = assignedAgent?.color ?? ACCENT;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "1.5rem", alignItems: "start" }}>

      {/* ── Left column ── */}
      <div>
        <div style={{ marginBottom: "1.25rem" }}>
          <SectionAgentPanel
            sectionId="sales"
            sectionName="Sales"
            sectionHint={SALES_HINT}
            accentColor={ACCENT}
            onAgentAssigned={a => setAssignedAgent(a)}
          />
        </div>

        <PeriodPicker
          value={period}
          onChange={setPeriod}
          right={
            <>
              <span style={{ fontSize: 10, color: "#475569" }}>
                {data ? `${data.period.start.slice(0, 10)} → ${data.period.end.slice(0, 10)}` : ""}
              </span>
              <button onClick={load} className="button is-ghost is-small" style={{ color: "#475569" }} aria-label="Refresh sales data">
                <RefreshCw size={12} className={loading ? "spin" : ""} />
              </button>
            </>
          }
        />

        {!loading && !data && (
          <EmptyState
            reason="The sales endpoint returned nothing. That is a live Shopify pull on every request — check /admin/sales/overview and the Shopify token before reading anything else on this page."
          />
        )}

        {/* ── 1. Headline ── */}
        <div style={{ display: "flex", gap: "0.85rem", flexWrap: "wrap", marginBottom: "0.6rem" }}>
          <MetricCard label="Net Revenue" icon={DollarSign} color={ACCENT} value={money(r?.netRevenue)} sub={data?.period.label} />
          <MetricCard label="Orders" icon={ShoppingBag} color="#38bdf8" value={num(o?.orders)} sub={o ? `${num(o.units)} units` : undefined} />
          <MetricCard label="AOV" icon={Receipt} color="#e98d20" value={money(o?.aov, 2)} />
          <MetricCard label="Units / Order" icon={Layers3} color="#a78bfa" value={o?.unitsPerOrder?.toFixed(2) ?? "—"} sub={o?.avgUnitPrice != null ? `${money(o.avgUnitPrice, 2)} avg unit` : undefined} />
          <MetricCard
            label="Repeat Rate" icon={Repeat} color="#f5a840"
            value={pct(c?.repeatRatePct, 2)} sub="2+ orders in this window"
          />
        </div>
        <p style={{ fontSize: 10, color: "#475569", marginBottom: "1.25rem", lineHeight: 1.5 }}>
          {r?.basis}{" "}
          {r != null && r.nonProductRevenue > 0 && (
            <>
              <strong style={{ color: "#e98d20" }}>{money(r.nonProductRevenue)}</strong> of non-product revenue
              (financing and card-reward rows booked as manual orders) is out of every figure above — it carries no
              COGS, so leaving it in would inflate margin, AOV and MER at once.{" "}
            </>
          )}
          The repeat rate counts customers who ordered twice <em>inside this window</em>. The lifetime reading —
          anyone who has ever ordered twice — is <strong style={{ color: "#f5a840" }}>{pct(c?.repeatRateLifetimePct, 2)}</strong>,
          and the two are not interchangeable.
        </p>

        {/* ── 2. Pressure ── */}
        <Panel
          title="What the revenue cost"
          note="Discount, refunds and acquisition spend against the same orders. These are the levers that move net revenue without selling a single extra unit — and the three places a flattering denominator hides a real problem."
        >
          <div style={{ display: "flex", gap: "0.85rem", flexWrap: "wrap" }}>
            <MetricCard label="Discount Rate" icon={TicketPercent} color="#f43f5e" value={pct(p?.discountRatePct, 2)} sub={r ? `${money(r.discounts)} off ${money(r.preDiscountSales)}` : undefined} />
            <MetricCard label="Refund Rate" icon={Undo2} color="#fb923c" value={pct(p?.refundRatePct, 2)} sub={data ? `${num(data.orders.refundedOrders)} orders refunded` : undefined} />
            <MetricCard
              label="MER" icon={DollarSign} color="#38bdf8" value={mult(p?.mer)}
              unavailable={p?.mer == null ? "No ad spend collected — a credentialed channel is silent, not efficient" : null}
            />
            <MetricCard
              label="CAC" icon={Users} color="#a78bfa" value={money(p?.cac, 2)}
              unavailable={p?.cac == null ? "Needs ad spend and new customers in the same window" : null}
            />
          </div>
          <p style={{ fontSize: 10, color: "#475569", marginTop: "0.85rem", lineHeight: 1.5 }}>
            {p?.discountRateBasis} {p?.refundRateBasis}
          </p>
        </Panel>

        {/* ── 3. Top sellers ── */}
        <Panel
          title="Top sellers"
          note="By net revenue in this window, after line-level and allocated order-level discounts. Margin is shown only where a unit cost has actually been entered — an unpriced product reads 'not set', never 0%."
          right={
            data && (
              <span style={{ fontSize: 10, color: "#475569" }}>
                COGS coverage {pct(coveragePct, 1)}
              </span>
            )
          }
        >
          {loading && !data ? (
            <p style={{ fontSize: 12, color: "#475569" }}>Loading…</p>
          ) : !data || data.topProducts.length === 0 ? (
            <EmptyState reason="No product lines in this window. Either nothing sold, or the order pull returned nothing — check the reconciliation panel below before concluding the first." />
          ) : (
            <>
              {!coverageOk && (
                <div style={{ marginBottom: "0.85rem" }}>
                  <EmptyState
                    reason={`Unit-cost coverage is ${pct(coveragePct, 1)}, below the ${pct(data.coverageFloor * 100, 0)} floor. Revenue and units below are measured; the margin column is only as complete as the costs behind it, so do not rank these products by profit yet.`}
                    action={
                      <Link href="/costs" style={{ color: ACCENT, fontSize: 11, fontWeight: 700, textDecoration: "none" }}>
                        Fill unit costs <ArrowRight size={11} style={{ verticalAlign: "middle" }} />
                      </Link>
                    }
                  />
                </div>
              )}
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ ...TH, textAlign: "left" }}>Product</th>
                      <th style={TH}>Revenue</th>
                      <th style={TH}>Share</th>
                      <th style={TH}>Units</th>
                      <th style={TH}>Orders</th>
                      <th style={TH}>Units/Order</th>
                      <th style={TH}>Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topProducts.slice(0, 10).map((row, i) => (
                      <tr key={`${row.variantId ?? row.sku}-${i}`} style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                        <td style={{ ...TD, textAlign: "left", maxWidth: 280, whiteSpace: "normal" }}>
                          <div style={{ color: "#e2e8f0", fontWeight: 600 }}>{row.title}</div>
                          {row.variantTitle && (
                            <div style={{ fontSize: 10, color: "#64748b" }}>{row.variantTitle}</div>
                          )}
                          <ShareBar pct={row.revenueSharePct ?? 0} color={ACCENT} />
                        </td>
                        <td style={{ ...TD, color: ACCENT, fontWeight: 700 }}>{money(row.revenue)}</td>
                        <td style={TD}>{pct(row.revenueSharePct, 1)}</td>
                        <td style={TD}>{num(row.quantity)}</td>
                        <td style={TD}>{num(row.orders)}</td>
                        <td style={TD}>{row.unitsPerOrder?.toFixed(2) ?? "—"}</td>
                        <td style={TD}>
                          {row.marginPct == null
                            ? <span style={{ color: "#b45309", fontSize: 10 }}>not set</span>
                            : pct(row.marginPct, 1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: "0.85rem" }}>
                <Link href="/sales/products" style={{ color: ACCENT, fontSize: 11, fontWeight: 700, textDecoration: "none" }}>
                  Every product that sold in this window <ArrowRight size={11} style={{ verticalAlign: "middle" }} />
                </Link>
              </div>
            </>
          )}
        </Panel>

        {/* ── 4. Customer mix ── */}
        <Panel
          title="Who bought"
          note="Distinct customers in the window, split by whether their Shopify account was created inside it. Both readings of repeat are shown because they answer different questions and differ by several times."
        >
          {!c ? (
            <p style={{ fontSize: 12, color: "#475569" }}>—</p>
          ) : (
            <div style={{ display: "flex", gap: "0.85rem", flexWrap: "wrap" }}>
              <MetricCard label="Customers" icon={Users} color="#38bdf8" value={num(c.customers)} />
              <MetricCard label="New" icon={Users} color={ACCENT} value={num(c.newCustomers)} sub={`${pct(c.newSharePct, 1)} of customers`} />
              <MetricCard label="Repeat (window)" icon={Repeat} color="#f5a840" value={num(c.repeatCustomers)} sub={`${pct(c.repeatRatePct, 2)} — 2+ orders in period`} />
              <MetricCard label="Repeat (lifetime)" icon={Repeat} color="#a78bfa" value={num(c.repeatCustomersLifetime)} sub={`${pct(c.repeatRateLifetimePct, 2)} — ever ordered twice`} />
            </div>
          )}
        </Panel>

        {/* ── 5. Integrity ── */}
        <Panel
          title="Can these numbers be trusted"
          note="The checks that decide whether anything above is quotable. Published rather than logged — the line-reconciliation delta is the check that caught an 11% overstatement in every per-product figure on 2026-08-04."
        >
          {!data ? (
            <p style={{ fontSize: 12, color: "#475569" }}>—</p>
          ) : (
            <div style={{ display: "grid", gap: "0.6rem" }}>
              <IntegrityRow
                ok={data.reconciliation.reconciled}
                label="Line reconciliation"
                value={`${money(data.reconciliation.lineDelta, 2)} delta`}
                detail={data.reconciliation.note}
              />
              <IntegrityRow
                ok={coverageOk}
                label="Unit-cost coverage"
                value={pct(coveragePct, 1)}
                detail={`Floor is ${pct(data.coverageFloor * 100, 0)}. Below it, every margin on this page and the Profit tab is only as good as the costs behind it.`}
              />
              <IntegrityRow
                ok={data.truncatedOrders === 0}
                label="Complete baskets"
                value={data.truncatedOrders === 0 ? "All orders" : `${num(data.truncatedOrders)} truncated`}
                detail="Orders with more line items than the page size have partial lines. They understate units and basket size rather than erroring."
              />
              {data.blockers.map(b => (
                <IntegrityRow
                  key={b.code}
                  ok={false}
                  label={b.code}
                  value={b.severity}
                  detail={`${b.message} — ${b.fix}`}
                />
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* ── Right: agent chat, primed with the same figures the page is showing ── */}
      <div style={{ position: "sticky", top: "1rem" }}>
        <div style={{ height: 520 }}>
          {assignedAgent ? (
            <ChatBox
              agentId={assignedAgent.id}
              agentName={assignedAgent.name}
              agentEmoji={assignedAgent.emoji}
              agentColor={accentColor}
              mode="fill"
              showHeader
              showChatLink
              conversationKey={`${assignedAgent.id}-sales`}
              context={{ sectionId: "sales", sectionName: "Sales", metrics: agentMetrics }}
            />
          ) : (
            <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.15)", borderRadius: 14, border: "1px dashed rgba(255,255,255,0.06)", opacity: 0.4, gap: 8 }}>
              <p style={{ fontSize: 13, color: "#475569", textAlign: "center" }}>
                Assign a lead agent above<br />to enable the Sales chat.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Integrity row ─────────────────────────────────────────────────────────────

function IntegrityRow({ ok, label, value, detail }: {
  ok: boolean; label: string; value: string; detail: string;
}) {
  const color = ok ? ACCENT : "#b45309";
  return (
    <div style={{
      display: "flex", gap: "0.6rem", alignItems: "flex-start",
      background: ok ? "rgba(34,197,94,0.04)" : "rgba(180,83,9,0.06)",
      border: `1px solid ${ok ? "rgba(34,197,94,0.15)" : "rgba(180,83,9,0.18)"}`,
      borderRadius: 10, padding: "0.7rem 0.85rem",
    }}>
      <AlertTriangle size={13} color={color} style={{ flexShrink: 0, marginTop: 2, opacity: ok ? 0.35 : 1 }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "baseline", flexWrap: "wrap" }}>
          <span style={{ ...LABEL, color: "#94a3b8" }}>{label}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color }}>{value}</span>
        </div>
        <p style={{ fontSize: 10.5, color: "#475569", marginTop: "0.25rem", lineHeight: 1.5 }}>{detail}</p>
      </div>
    </div>
  );
}

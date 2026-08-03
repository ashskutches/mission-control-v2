"use client";
/**
 * Marketing → Ads
 *
 * The media buyer's view. Profit → Campaigns answers "what did paid media do to
 * the P&L"; this answers "what do I change in Ads Manager today". Both read
 * /admin/profitability/ads — the split is framing, not a second copy of the data.
 *
 * WHAT THE EFFICIENCY OUTLIER LIST IS, AND IS NOT
 * -----------------------------------------------
 * Real creative-fatigue detection needs a time series: frequency crossing ~2-2.5
 * on prospecting, CTR down 20-25% sustained for three days, CPM drifting up with
 * no auction event. `ad_performance_daily` stores spend, impressions, clicks,
 * conversions and revenue per day per entity — it does not store frequency, and
 * this endpoint rolls the window up to one row per entity, so no trend survives
 * the read. What we can honestly compute is a cross-section: ads paying above
 * their channel's CPM while earning below its CTR. That is a shortlist to open in
 * Ads Manager, not a fatigue verdict, and it is labelled as such on the page.
 */
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Megaphone, DollarSign, MousePointerClick, Eye, TrendingDown,
  RefreshCw, DownloadCloud, ArrowRight, Clock, Flame,
} from "lucide-react";
import {
  BOT_URL, CARD, LABEL, TH, TD, PeriodPicker, MetricCard, Panel, EmptyState,
  ChannelPill, ShareBar, money, num, pct, mult, channelColor,
  type PeriodKey,
} from "@/components/MarketingShared";

// ── Types ─────────────────────────────────────────────────────────────────────

type Level = "campaign" | "adset" | "ad";

interface AdEntity {
  channel: string; level: Level; entityId: string; entityName: string;
  campaignId: string | null; campaignName: string | null;
  spend: number; impressions: number; clicks: number; conversions: number; revenue: number;
  cpm: number | null; cpc: number | null; ctr: number | null;
  costPerConversion: number | null; attributedRoas: number | null;
  spendShare: number; activeDays: number;
}
interface AdsResponse {
  period: { label: string };
  level: Level;
  entities: AdEntity[];
  totalSpend: number;
  underperformers: (AdEntity & { wastedSpend: number })[];
  freshness: { channel: string; level: string; lastDay: string | null }[];
  empty: boolean;
  emptyReason: string | null;
  note: string;
}
interface Blended {
  spend: number; impressions: number; clicks: number;
  cpm: number | null; cpc: number | null; ctr: number | null; mer: number | null;
}

const LEVELS: { key: Level; label: string }[] = [
  { key: "campaign", label: "Campaign" },
  { key: "adset", label: "Ad set" },
  { key: "ad", label: "Creative" },
];

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Spend-weighted mean, so one $5 test ad cannot move the benchmark. */
function weightedMean(rows: AdEntity[], pick: (e: AdEntity) => number | null): number | null {
  let acc = 0, den = 0;
  for (const r of rows) {
    const v = pick(r);
    if (v == null || !isFinite(v) || r.spend <= 0) continue;
    acc += v * r.spend;
    den += r.spend;
  }
  return den > 0 ? acc / den : null;
}

/**
 * Cross-sectional efficiency outliers — see the file header for why this is not
 * called fatigue. Thresholds are deliberately loose (25% below CTR benchmark, 15%
 * above CPM) because this is a shortlist to inspect, not an automatic pause rule.
 */
function efficiencyOutliers(entities: AdEntity[], minSpend = 100) {
  const byChannel = new Map<string, AdEntity[]>();
  for (const e of entities) {
    if (!byChannel.has(e.channel)) byChannel.set(e.channel, []);
    byChannel.get(e.channel)!.push(e);
  }

  const out: (AdEntity & { ctrBench: number; cpmBench: number })[] = [];
  for (const [, rows] of byChannel) {
    // A benchmark drawn from one or two rows is the row itself.
    if (rows.length < 3) continue;
    const ctrBench = weightedMean(rows, r => r.ctr);
    const cpmBench = weightedMean(rows, r => r.cpm);
    if (ctrBench == null || cpmBench == null) continue;

    for (const r of rows) {
      if (r.spend < minSpend || r.ctr == null || r.cpm == null) continue;
      if (r.ctr < ctrBench * 0.75 && r.cpm > cpmBench * 1.15) out.push({ ...r, ctrBench, cpmBench });
    }
  }
  return out.sort((a, b) => b.spend - a.spend);
}

function daysAgo(iso: string | null): string {
  if (!iso) return "never";
  const d = Math.round((Date.now() - Date.parse(iso)) / 86_400_000);
  if (!isFinite(d)) return "unknown";
  return d <= 0 ? "today" : d === 1 ? "1 day ago" : `${d} days ago`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MarketingAdsPage() {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [level, setLevel] = useState<Level>("campaign");
  const [channel, setChannel] = useState<string>("all");

  const [ads, setAds] = useState<AdsResponse | null>(null);
  const [blended, setBlended] = useState<Blended | null>(null);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [collectMsg, setCollectMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const ch = channel === "all" ? "" : `&channel=${channel}`;
    const [a, p] = await Promise.all([
      getJson<AdsResponse>(`${BOT_URL}/admin/profitability/ads?period=${period}&level=${level}${ch}&limit=100`),
      getJson<{ blended: Blended }>(`${BOT_URL}/admin/profitability/platforms?period=${period}`),
    ]);
    setAds(a);
    setBlended(p?.blended ?? null);
    setLoading(false);
  }, [period, level, channel]);

  useEffect(() => { load(); }, [load]);

  /** Pulls entity-level rows from Meta/Google for the window, then reloads. */
  const collect = async () => {
    setCollecting(true);
    setCollectMsg(null);
    try {
      const res = await fetch(`${BOT_URL}/admin/profitability/collect-ads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, levels: ["campaign", "ad"] }),
      });
      const d = await res.json();
      setCollectMsg(res.ok
        ? `Wrote ${d.rowsWritten ?? 0} rows.${(d.errors?.length ?? 0) > 0 ? ` ${d.errors.length} channel error(s): ${d.errors.map((e: any) => e.channel).join(", ")}.` : ""}`
        : `Collection failed: ${d.error ?? res.status}`);
      await load();
    } catch (err: any) {
      setCollectMsg(`Collection failed: ${err.message}`);
    } finally {
      setCollecting(false);
    }
  };

  const entities = ads?.entities ?? [];
  const under = ads?.underperformers ?? [];
  const outliers = level === "ad" ? efficiencyOutliers(entities) : [];
  const recoverable = under.reduce((s, u) => s + u.wastedSpend, 0);
  const channels = Array.from(new Set(entities.map(e => e.channel)));

  return (
    <div>
      {/* ── Controls ── */}
      <PeriodPicker
        value={period}
        onChange={setPeriod}
        right={
          <>
            <span style={{ fontSize: 10, color: "#475569" }}>{ads?.period?.label ?? ""}</span>
            <button
              onClick={collect}
              disabled={collecting}
              className="button is-small"
              style={{
                background: "rgba(244,63,94,0.12)", border: "1px solid rgba(244,63,94,0.28)",
                color: "#f43f5e", borderRadius: 8, fontSize: 10, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "0.06em", height: 28,
              }}
            >
              <DownloadCloud size={11} style={{ marginRight: 5 }} />
              {collecting ? "Collecting…" : "Collect now"}
            </button>
            <button onClick={load} className="button is-ghost is-small" style={{ color: "#475569" }} aria-label="Refresh ad data">
              <RefreshCw size={12} className={loading ? "spin" : ""} />
            </button>
          </>
        }
      />

      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "1.25rem", alignItems: "center" }}>
        {LEVELS.map(({ key, label }) => {
          const active = key === level;
          return (
            <button key={key} onClick={() => setLevel(key)}
              style={{
                background: active ? "rgba(244,63,94,0.14)" : "rgba(255,255,255,0.04)",
                color: active ? "#f43f5e" : "#64748b",
                border: active ? "1px solid rgba(244,63,94,0.3)" : "1px solid rgba(255,255,255,0.06)",
                borderRadius: 8, padding: "0.28rem 0.75rem", cursor: "pointer",
                fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
              }}>
              {label}
            </button>
          );
        })}
        {channels.length > 1 && (
          <>
            <span style={{ width: 1, height: 18, background: "rgba(255,255,255,0.08)", margin: "0 0.3rem" }} />
            {["all", ...channels].map(c => {
              const active = c === channel;
              const col = c === "all" ? "#94a3b8" : channelColor(c);
              return (
                <button key={c} onClick={() => setChannel(c)}
                  style={{
                    background: active ? `${col}18` : "rgba(255,255,255,0.04)",
                    color: active ? col : "#64748b",
                    border: active ? `1px solid ${col}30` : "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 8, padding: "0.28rem 0.7rem", cursor: "pointer",
                    fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
                  }}>
                  {c}
                </button>
              );
            })}
          </>
        )}
      </div>

      {collectMsg && (
        <p style={{ fontSize: 11, color: "#94a3b8", marginBottom: "1rem", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "0.5rem 0.75rem" }}>
          {collectMsg}
        </p>
      )}

      {/* ── Blended paid header ── */}
      <div style={{ display: "flex", gap: "0.85rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
        <MetricCard label="Paid Spend" icon={DollarSign} color="#f43f5e" value={money(blended?.spend)} sub={`${entities.length} ${level}s with data`} />
        <MetricCard label="Impressions" icon={Eye} color="#38bdf8" value={num(blended?.impressions)} sub={`CPM ${money(blended?.cpm, 2)}`} />
        <MetricCard label="Clicks" icon={MousePointerClick} color="#a78bfa" value={num(blended?.clicks)} sub={`CTR ${pct(blended?.ctr, 2)} · CPC ${money(blended?.cpc, 2)}`} />
        <MetricCard label="Blended MER" icon={Megaphone} color="#e98d20" value={mult(blended?.mer)} sub="Shopify revenue ÷ spend" />
        <MetricCard
          label="Recoverable" icon={TrendingDown} color="#b45309"
          value={money(recoverable)} sub="At 2.8x target, from underperformers"
        />
      </div>

      {/* ── Underperformers ── */}
      <Panel
        title="Budget to move first"
        note="Ranked by spend × shortfall against a 2.8x target, not by worst ROAS — a $9,000 campaign at 1.9x costs more than a $40 campaign at 0.1x. 'Recoverable' is what the target implies these would return, not money already lost. Minimum $100 spend."
      >
        {loading && !ads ? (
          <p style={{ fontSize: 12, color: "#475569" }}>Loading…</p>
        ) : under.length === 0 ? (
          <p style={{ fontSize: 12, color: "#475569" }}>
            {ads?.empty ? "No ad data stored for this window." : "Nothing above $100 spend is under the 2.8x target."}
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {under.map((u, i) => (
              <motion.div
                key={`${u.channel}:${u.entityId}`}
                initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                style={{ padding: "0.7rem 0.85rem", background: "rgba(180,83,9,0.05)", border: "1px solid rgba(180,83,9,0.15)", borderRadius: 9, display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}
              >
                <div style={{ flex: 1, minWidth: 180 }}>
                  <p style={{ fontSize: 12.5, fontWeight: 700, color: "#e2e8f0", marginBottom: 3 }}>{u.entityName}</p>
                  <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                    <ChannelPill channel={u.channel} />
                    <span style={{ fontSize: 9.5, color: "#475569" }}>{u.spendShare.toFixed(0)}% of channel budget · {u.activeDays}d active</span>
                  </div>
                </div>
                {[
                  { l: "Spend", v: money(u.spend), c: "#cbd5e1" },
                  { l: "ROAS", v: mult(u.attributedRoas), c: "#f43f5e" },
                  { l: "Cost / purch.", v: money(u.costPerConversion, 2), c: "#cbd5e1" },
                  { l: "Recoverable", v: money(u.wastedSpend), c: "#b45309" },
                ].map(({ l, v, c }) => (
                  <div key={l} style={{ textAlign: "right", minWidth: 78 }}>
                    <p style={{ ...LABEL, fontSize: 9 }}>{l}</p>
                    <p style={{ fontSize: 14, fontWeight: 800, color: c }}>{v}</p>
                  </div>
                ))}
              </motion.div>
            ))}
          </div>
        )}
      </Panel>

      {/* ── Efficiency outliers (creative level only) ── */}
      {level === "ad" && (
        <Panel
          title="Efficiency outliers — creative"
          note="Ads paying more than their channel's spend-weighted CPM while earning less than its CTR. This is a cross-section, not a fatigue verdict: ad_performance_daily does not store frequency, and this window is rolled up, so no trend is visible here. Open these in Ads Manager and check frequency and the CTR curve before pausing."
          right={<Flame size={13} color="#b45309" />}
        >
          {outliers.length === 0 ? (
            <p style={{ fontSize: 12, color: "#475569" }}>
              {entities.length < 3
                ? "Not enough creatives with data to set a benchmark — needs at least 3 per channel."
                : "No creative is both below its channel's CTR and above its CPM."}
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ ...TH, textAlign: "left" }}>Creative</th>
                    <th style={TH}>Spend</th>
                    <th style={TH}>CTR</th>
                    <th style={TH}>vs bench</th>
                    <th style={TH}>CPM</th>
                    <th style={TH}>vs bench</th>
                    <th style={TH}>ROAS</th>
                  </tr>
                </thead>
                <tbody>
                  {outliers.map(o => (
                    <tr key={`${o.channel}:${o.entityId}`} style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ ...TD, textAlign: "left", maxWidth: 240, whiteSpace: "normal" }}>
                        <span style={{ fontSize: 12, color: "#e2e8f0" }}>{o.entityName}</span>
                        {o.campaignName && <p style={{ fontSize: 9.5, color: "#475569" }}>{o.campaignName}</p>}
                      </td>
                      <td style={TD}>{money(o.spend)}</td>
                      <td style={TD}>{pct(o.ctr, 2)}</td>
                      <td style={{ ...TD, color: "#f43f5e" }}>{pct(((o.ctr! / o.ctrBench) - 1) * 100, 0)}</td>
                      <td style={TD}>{money(o.cpm, 2)}</td>
                      <td style={{ ...TD, color: "#b45309" }}>+{pct(((o.cpm! / o.cpmBench) - 1) * 100, 0)}</td>
                      <td style={TD}>{mult(o.attributedRoas)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {/* ── Full table ── */}
      <Panel
        title={`All ${LEVELS.find(l => l.key === level)?.label.toLowerCase()}s`}
        note={ads?.note ?? "Revenue and ROAS are each platform's own attribution — rank rows against each other, never total them into the business."}
        right={
          <Link href="/profitability" style={{ fontSize: 10, color: "#22c55e", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
            P&amp;L view <ArrowRight size={11} />
          </Link>
        }
      >
        {loading && !ads ? (
          <p style={{ fontSize: 12, color: "#475569" }}>Loading…</p>
        ) : !ads ? (
          <EmptyState reason="The ads endpoint did not respond. If gravity-claw was just deployed, give it a moment; otherwise check /admin/profitability/ads." />
        ) : ads.empty ? (
          <EmptyState
            reason={ads.emptyReason ?? "No entity-level ad data stored for this window."}
            action={
              <button onClick={collect} disabled={collecting}
                style={{ background: "rgba(244,63,94,0.12)", border: "1px solid rgba(244,63,94,0.28)", color: "#f43f5e", borderRadius: 8, padding: "0.35rem 0.8rem", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", cursor: "pointer" }}>
                {collecting ? "Collecting…" : "Run collection now"}
              </button>
            }
          />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ ...TH, textAlign: "left" }}>Name</th>
                  <th style={TH}>Spend</th>
                  <th style={TH}>Impr.</th>
                  <th style={TH}>Clicks</th>
                  <th style={TH}>CTR</th>
                  <th style={TH}>CPC</th>
                  <th style={TH}>CPM</th>
                  <th style={TH}>Purch.</th>
                  <th style={TH}>Cost / purch.</th>
                  <th style={TH}>Attr. ROAS</th>
                </tr>
              </thead>
              <tbody>
                {entities.map(e => {
                  const col = channelColor(e.channel);
                  return (
                    <tr key={`${e.channel}:${e.entityId}`} style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ ...TD, textAlign: "left", minWidth: 200, maxWidth: 280, whiteSpace: "normal" }}>
                        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", marginBottom: 2 }}>
                          <ChannelPill channel={e.channel} />
                          <span style={{ fontSize: 12, color: "#e2e8f0", fontWeight: 600 }}>{e.entityName}</span>
                        </div>
                        <ShareBar pct={e.spendShare} color={col} />
                        <span style={{ fontSize: 9.5, color: "#475569" }}>{e.spendShare.toFixed(0)}% of channel · {e.activeDays}d active</span>
                      </td>
                      <td style={TD}>{money(e.spend)}</td>
                      <td style={TD}>{num(e.impressions)}</td>
                      <td style={TD}>{num(e.clicks)}</td>
                      <td style={TD}>{pct(e.ctr, 2)}</td>
                      <td style={TD}>{money(e.cpc, 2)}</td>
                      <td style={TD}>{money(e.cpm, 2)}</td>
                      <td style={TD}>{num(e.conversions)}</td>
                      <td style={TD}>{money(e.costPerConversion, 2)}</td>
                      <td style={{ ...TD, fontWeight: 800, color: e.attributedRoas == null ? "#475569" : e.attributedRoas >= 2.8 ? "#22c55e" : e.attributedRoas >= 1 ? "#e98d20" : "#f43f5e" }}>
                        {mult(e.attributedRoas)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* ── Freshness ── */}
      <div style={{ ...CARD, display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
          <Clock size={13} color="#64748b" />
          <p style={LABEL}>Last collected</p>
        </div>
        {(ads?.freshness ?? []).length === 0 ? (
          <span style={{ fontSize: 11, color: "#475569" }}>Nothing collected yet.</span>
        ) : (
          (ads?.freshness ?? []).map(f => (
            <span key={`${f.channel}:${f.level}`} style={{ fontSize: 11, color: "#94a3b8" }}>
              <strong style={{ color: channelColor(f.channel) }}>{f.channel}</strong>
              <span style={{ color: "#475569" }}> · {f.level} · </span>
              {daysAgo(f.lastDay)}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { StatCard } from "@/components/StatCard";
import {
  ShoppingBag, TrendingUp, BarChart3,
  Megaphone, Users, Share2, SearchCheck,
  FlaskConical, Tag, LayoutGrid, Zap,
  LifeBuoy, Truck, MessageCircle, Mail,
  LineChart, Eye, ChevronRight,
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3000";

// ── Commerce squad definitions ────────────────────────────────────────────────

const SQUADS = [
  {
    id: "acquisition",
    label: "Acquisition & Traffic",
    description: "Top-of-funnel growth: paid media, outreach, social presence, and search visibility.",
    color: "#e98d20",
    icon: TrendingUp,
    areas: [
      { label: "Media Buying",      icon: Megaphone,   href: "/commerce/acquisition/media-buying",      desc: "Paid ad strategy & spend optimization" },
      { label: "Creator Outreach",  icon: Users,       href: "/commerce/acquisition/creator-outreach",  desc: "Influencer & UGC partnerships" },
      { label: "Social Presence",   icon: Share2,      href: "/commerce/acquisition/social-presence",   desc: "Organic social growth & scheduling" },
      { label: "Search Visibility", icon: SearchCheck, href: "/commerce/acquisition/search-visibility", desc: "SEO, blog, and discovery rankings" },
    ],
  },
  {
    id: "conversion",
    label: "Conversion & Merchandising",
    description: "Turn browsers into buyers: CRO, pricing intelligence, catalog, and revenue maximization.",
    color: "#4a9eff",
    icon: Zap,
    areas: [
      { label: "Experimentation",  icon: FlaskConical, href: "/commerce/conversion/experimentation",   desc: "A/B tests & landing page variants" },
      { label: "Pricing & Intel",  icon: Tag,          href: "/commerce/conversion/pricing-intel",     desc: "Competitive pricing & margin analysis" },
      { label: "Catalog Architect",icon: LayoutGrid,   href: "/commerce/conversion/catalog-architect", desc: "Product catalog structure & PDPs" },
      { label: "Revenue Max",      icon: Zap,          href: "/commerce/conversion/revenue-max",       desc: "Upsell, bundles & checkout optimization" },
    ],
  },
  {
    id: "ops",
    label: "Post-Purchase & Ops",
    description: "Deliver exceptional post-sale experiences: support, fulfillment, email, and community.",
    color: "#22c55e",
    icon: LifeBuoy,
    areas: [
      { label: "Resolution",        icon: LifeBuoy,      href: "/commerce/ops/resolution",        desc: "Customer support & dispute resolution" },
      { label: "Logistics",         icon: Truck,         href: "/commerce/ops/logistics",         desc: "Shipping, fulfillment & returns" },
      { label: "Community Support", icon: MessageCircle, href: "/commerce/ops/community-support", desc: "Reviews, Q&A & community engagement" },
      { label: "Email & CRM",       icon: Mail,          href: "/commerce/email",                 desc: "Flows, campaigns & lifecycle email" },
    ],
  },
  {
    id: "strategy",
    label: "Strategy & Finance",
    description: "High-level brand intelligence and profitability analytics.",
    color: "#a78bfa",
    icon: LineChart,
    areas: [
      { label: "Profitability",  icon: LineChart, href: "/commerce/strategy/profitability",  desc: "Margin, COGS & contribution analysis" },
      { label: "Brand Sentinel", icon: Eye,       href: "/commerce/strategy/brand-sentinel", desc: "Brand health, sentiment & positioning" },
    ],
  },
];

// ── Area card ─────────────────────────────────────────────────────────────────

function AreaCard({ area, squadColor, onClick }: {
  area: { label: string; icon: React.ElementType; href: string; desc: string };
  squadColor: string;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const Icon = area.icon;
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: "0.75rem",
        background: hovered ? `${squadColor}08` : "rgba(255,255,255,0.02)",
        border: `1px solid ${hovered ? `${squadColor}30` : "rgba(255,255,255,0.06)"}`,
        borderRadius: 10, padding: "0.75rem 1rem",
        cursor: "pointer", textAlign: "left", width: "100%",
        transition: "all 0.15s",
      }}
    >
      <div style={{
        width: 34, height: 34, borderRadius: 9, flexShrink: 0,
        background: `${squadColor}15`,
        border: `1px solid ${squadColor}25`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon size={15} color={squadColor} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", margin: 0, textTransform: "uppercase", letterSpacing: "0.04em" }}>{area.label}</p>
        <p style={{ fontSize: 10, color: "#475569", margin: "2px 0 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{area.desc}</p>
      </div>
      <ChevronRight size={13} color={hovered ? squadColor : "#334155"} style={{ flexShrink: 0, transition: "color 0.15s" }} />
    </button>
  );
}

// ── Squad section ─────────────────────────────────────────────────────────────

function SquadSection({ squad, onNav }: {
  squad: typeof SQUADS[number];
  onNav: (href: string) => void;
}) {
  const Icon = squad.icon;
  return (
    <div>
      {/* Squad header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${squad.color}18`, border: `1px solid ${squad.color}30`,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Icon size={17} color={squad.color} />
        </div>
        <div>
          <p style={{ fontSize: 13, fontWeight: 800, color: "#f0ede8", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>{squad.label}</p>
          <p style={{ fontSize: 10, color: "#475569", margin: 0, lineHeight: 1.4 }}>{squad.description}</p>
        </div>
      </div>

      {/* Area cards grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "0.5rem" }}>
        {squad.areas.map(area => (
          <AreaCard key={area.href} area={area} squadColor={squad.color} onClick={() => onNav(area.href)} />
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CommercePage() {
  const router = useRouter();
  const [shopify, setShopify] = useState<any>(null);
  const [forecast, setForecast] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      const fetchT = (url: string) =>
        fetch(url, { signal: AbortSignal.timeout(5000) }).then(r => r.json()).catch(() => null);
      const [s, f] = await Promise.all([
        fetchT(`${BOT_URL}/shopify`),
        fetchT(`${BOT_URL}/forecasting`),
      ]);
      if (s) setShopify(s);
      if (f) setForecast(f);
    };
    load();
  }, []);

  const onNav = (href: string) => router.push(href);

  return (
    <div className="px-4 pb-8 pt-4" style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>

      {/* ── Hero ── */}
      <section style={{
        background: "linear-gradient(135deg, rgba(233,141,32,0.06), rgba(0,0,0,0))",
        border: "1px solid rgba(233,141,32,0.1)", borderRadius: 16, padding: "20px 24px",
      }}>
        <p style={{ fontSize: 10, color: "#555", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", margin: 0 }}>
          Leaps &amp; Rebounds · Commerce
        </p>
        <h1 style={{ fontSize: "clamp(22px,3vw,36px)", fontWeight: 900, color: "#fff", margin: "4px 0 0", lineHeight: 1 }}>
          Commerce Hub
        </h1>
      </section>

      {/* ── Revenue KPIs ── */}
      <div>
        <p style={{ fontSize: 9, fontWeight: 800, color: "#444", textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 10px" }}>
          Live Revenue Intelligence
        </p>
        <div className="columns is-multiline">
          <div className="column is-4">
            <StatCard label="Today's Revenue" value={shopify ? `$${Number(shopify.todayRevenue).toLocaleString()}` : "—"} subValue={shopify ? `${shopify.todayOrders} orders · $${shopify.aov} AOV` : "Loading…"} color="var(--accent-emerald)" trend="up" icon={ShoppingBag} />
          </div>
          <div className="column is-4">
            <StatCard label="30-Day Sales" value={shopify ? `$${Number(shopify.total30d || 0).toLocaleString()}` : "—"} subValue="Rolling 30-day gross" color="var(--accent-blue)" icon={TrendingUp} />
          </div>
          <div className="column is-4">
            <StatCard label="Month-End Forecast" value={forecast?.estimatedMonthEnd ? `$${Number(forecast.estimatedMonthEnd).toLocaleString()}` : "—"} subValue="Projected from MTD pace" color="var(--accent-cyan)" icon={BarChart3} />
          </div>
        </div>
      </div>

      {/* ── Squad sections ── */}
      {SQUADS.map((squad, i) => (
        <React.Fragment key={squad.id}>
          {i > 0 && <div style={{ height: 1, background: "rgba(255,255,255,0.05)" }} />}
          <SquadSection squad={squad} onNav={onNav} />
        </React.Fragment>
      ))}
    </div>
  );
}

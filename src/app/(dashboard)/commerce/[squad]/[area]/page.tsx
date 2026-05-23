"use client";
/**
 * Dynamic commerce section page — handles any /commerce/[squad]/[area] route
 * that is NOT already covered by a static page file.
 *
 * Static files (e.g. acquisition/media-buying/page.tsx) take routing priority
 * and continue to work unchanged. This route catches all DB-backed areas added
 * via the /commerce/manage UI.
 */
import { use, useEffect, useState } from "react";
import { LayoutGrid } from "lucide-react";
import CommerceSectionPage, { type SectionConfig } from "@/components/CommerceSectionPage";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "http://localhost:3001";

// Icon name → actual lucide component mapping for dynamic rendering
// (We can't dynamic-import by string in RSC, so we ship a registry of commerce icons)
import {
  TrendingUp, Megaphone, Users, Share2, SearchCheck, FlaskConical,
  Tag, Zap, LifeBuoy, Truck, MessageCircle, Mail, LineChart, Eye,
  ShoppingBag, BarChart2, Target, Globe, Star, Rocket, Layers,
  PieChart, Activity, Monitor, Smartphone, MousePointer,
} from "lucide-react";

const ICON_REGISTRY: Record<string, React.ElementType> = {
  TrendingUp, Megaphone, Users, Share2, SearchCheck, FlaskConical,
  Tag, Zap, LifeBuoy, Truck, MessageCircle, Mail, LineChart, Eye,
  ShoppingBag, BarChart2, Target, Globe, Star, Rocket, Layers,
  PieChart, Activity, Monitor, Smartphone, MousePointer,
  LayoutGrid,
};

interface CommerceArea {
  id: string;
  squad_id: string;
  slug: string;
  label: string;
  description: string | null;
  icon_name: string | null;
  accent_color: string | null;
  subtitle: string | null;
  section_hint: string | null;
  active: boolean;
}

interface Squad {
  id: string;
  label: string | null;
  color: string | null;
}

export default function DynamicCommercePage({
  params,
}: {
  params: Promise<{ squad: string; area: string }>;
}) {
  const { squad: squadSlug, area: areaSlug } = use(params);

  const [area, setArea] = useState<CommerceArea | null>(null);
  const [squad, setSquad] = useState<Squad | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [areasRes, sectionsRes] = await Promise.all([
          fetch(`${BOT_URL}/admin/sections/areas?slug=${areaSlug}`),
          fetch(`${BOT_URL}/admin/sections`),
        ]);

        const areas: CommerceArea[] = areasRes.ok ? await areasRes.json() : [];
        const squads: Squad[] = sectionsRes.ok ? await sectionsRes.json() : [];

        const matched = areas.find(a => a.squad_id === squadSlug && a.slug === areaSlug);
        if (!matched || !matched.active) {
          setNotFound(true);
          return;
        }

        setArea(matched);
        setSquad(squads.find(s => s.id === squadSlug) ?? null);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [squadSlug, areaSlug]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: "#475569" }}>
        Loading…
      </div>
    );
  }

  if (notFound || !area) {
    return (
      <div style={{ padding: "3rem 2rem", textAlign: "center" }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🔍</div>
        <h1 style={{ fontWeight: 800, color: "#e2e8f0", fontSize: "1.25rem", marginBottom: "0.5rem" }}>
          Section not found
        </h1>
        <p style={{ color: "#64748b", fontSize: "0.875rem" }}>
          <code style={{ fontFamily: "monospace", color: "#94a3b8" }}>
            /commerce/{squadSlug}/{areaSlug}
          </code>{" "}
          doesn&apos;t exist yet.
        </p>
        <a
          href="/commerce/manage"
          style={{
            display: "inline-block", marginTop: "1.5rem",
            padding: "8px 18px", borderRadius: 8,
            background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.25)",
            color: "#a78bfa", fontWeight: 700, fontSize: "0.875rem", textDecoration: "none",
          }}
        >
          → Add it in Manage Sections
        </a>
      </div>
    );
  }

  const IconEl = ICON_REGISTRY[area.icon_name ?? ""] ?? LayoutGrid;
  const accentColor = area.accent_color ?? squad?.color ?? "#a78bfa";

  const config: SectionConfig = {
    sectionId:   area.slug,
    sectionName: area.label,
    subtitle:    area.subtitle ?? `${squad?.label ?? squadSlug} · ${area.description ?? ""}`,
    accentColor,
    icon:        <IconEl size={20} />,
    sectionHint: area.section_hint ?? undefined,
  };

  return <CommerceSectionPage config={config} />;
}

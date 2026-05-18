"use client";
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Layout, BookOpen } from "lucide-react";
import LandingPageFactory from "@/components/LandingPageFactory";
import ContentLibrary from "@/components/ContentLibrary";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3000";

export default function LandingPagesPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"factory" | "library">("factory");

  useEffect(() => {
    fetch(`${BOT_URL}/admin/agents`, { signal: AbortSignal.timeout(5_000) })
      .then(r => r.ok ? r.json() : [])
      .then(data => setAgents(Array.isArray(data) ? data.filter((a: any) => a.enabled !== false) : []))
      .catch(() => {});
  }, []);

  const tabs = [
    { key: "factory", label: "LP Factory",       icon: Layout,   color: "#818cf8" },
    { key: "library", label: "Content Library",  icon: BookOpen, color: "#f59e0b" },
  ] as const;

  return (
    <div className="px-4 pb-8 pt-4" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* Header */}
      <section style={{ background: "linear-gradient(135deg, rgba(129,140,248,0.08), rgba(0,0,0,0))",
        border: "1px solid rgba(129,140,248,0.15)", borderRadius: 16, padding: "20px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(129,140,248,0.12)",
            border: "1px solid rgba(129,140,248,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Layout size={22} color="#818cf8" />
          </div>
          <div>
            <p style={{ fontSize: 10, color: "#475569", fontWeight: 800, textTransform: "uppercase",
              letterSpacing: "0.12em", margin: 0 }}>Leaps & Rebounds</p>
            <h1 style={{ fontSize: "clamp(22px,3vw,34px)", fontWeight: 900, color: "#fff",
              margin: "2px 0 0", lineHeight: 1 }}>Landing Page Factory</h1>
            <p style={{ fontSize: 12, color: "#475569", margin: "4px 0 0" }}>
              URL → Brief → Code · Powered by GPT-4o
            </p>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6 }}>
        {tabs.map(t => {
          const Icon = t.icon;
          const isActive = activeTab === t.key;
          return (
            <motion.button key={t.key} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={() => setActiveTab(t.key)}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 18px", borderRadius: 10,
                background: isActive ? `${t.color}18` : "rgba(255,255,255,0.03)",
                border: `1px solid ${isActive ? t.color + "35" : "rgba(255,255,255,0.07)"}`,
                color: isActive ? t.color : "#475569", fontSize: 12, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              <Icon size={13} />
              {t.label}
            </motion.button>
          );
        })}
      </div>

      {/* Content */}
      <div style={{ display: "grid", gridTemplateColumns: activeTab === "factory" ? "1fr 360px" : "1fr",
        gap: "1.5rem", alignItems: "start" }}>
        {activeTab === "factory" ? (
          <>
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 14, padding: "20px 22px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <Layout size={14} color="#818cf8" />
                <p style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase",
                  letterSpacing: "0.08em", margin: 0 }}>Landing Pages</p>
              </div>
              <LandingPageFactory agents={agents} />
            </div>
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 14, padding: "20px 22px", position: "sticky", top: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <BookOpen size={14} color="#f59e0b" />
                <p style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase",
                  letterSpacing: "0.08em", margin: 0 }}>Assets</p>
              </div>
              <ContentLibrary />
            </div>
          </>
        ) : (
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 14, padding: "20px 22px" }}>
            <ContentLibrary />
          </div>
        )}
      </div>
    </div>
  );
}

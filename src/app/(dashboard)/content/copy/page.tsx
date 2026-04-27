"use client";
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy, Sparkles, Send, RefreshCw, CheckCircle2, AlertCircle,
  ArrowLeft, Mail, Megaphone, Package, MessageSquare, ClipboardCopy, Check,
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3001";
const ACCENT = "#10b981";

const CARD: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 12,
  padding: "1.25rem",
};

// ── Types ─────────────────────────────────────────────────────────────────────

type CopyType = "ad" | "email" | "product" | "sms";

interface CopyTemplate {
  id: CopyType;
  label: string;
  icon: React.ElementType;
  color: string;
  description: string;
  prompts: string[];
  fields: { key: string; label: string; placeholder: string }[];
}

// ── Templates ─────────────────────────────────────────────────────────────────

const COPY_TYPES: CopyTemplate[] = [
  {
    id: "ad",
    label: "Ad Copy",
    icon: Megaphone,
    color: "#f59e0b",
    description: "Facebook, Instagram, Google ads — headlines + body",
    prompts: [
      "High-energy rebounder ad targeting fitness beginners",
      "Joint pain relief angle — 50+ demographic",
      "Transformation story for Meta retargeting",
      "Black Friday urgency ad for our mini trampoline",
    ],
    fields: [
      { key: "audience", label: "Target Audience", placeholder: "e.g. fitness beginners, 35-55 female" },
      { key: "angle", label: "Core Angle / Hook", placeholder: "e.g. joint impact reduction, fun workout" },
      { key: "platform", label: "Platform", placeholder: "Facebook, Instagram, Google" },
    ],
  },
  {
    id: "email",
    label: "Email Copy",
    icon: Mail,
    color: "#38bdf8",
    description: "Subject lines, preheaders, and full email bodies",
    prompts: [
      "Welcome sequence email #1 — new subscriber",
      "Abandoned cart recovery — 24h follow-up",
      "Post-purchase onboarding: rebounder setup tips",
      "Re-engagement campaign for lapsed customers",
    ],
    fields: [
      { key: "flow", label: "Email Flow / Type", placeholder: "e.g. welcome, abandoned cart, post-purchase" },
      { key: "tone", label: "Tone", placeholder: "e.g. warm, energetic, educational" },
      { key: "cta", label: "Call To Action", placeholder: "e.g. shop now, watch video, get 20% off" },
    ],
  },
  {
    id: "product",
    label: "Product Descriptions",
    icon: Package,
    color: "#a78bfa",
    description: "Shopify product page copy — titles, descriptions, bullets",
    prompts: [
      "Main rebounder product — conversion-focused description",
      "Mini trampoline for kids — parent-focused safety angle",
      "Replacement bungee cords — technical + benefit copy",
      "Rebounder with handlebar — stability & confidence angle",
    ],
    fields: [
      { key: "product", label: "Product Name", placeholder: "e.g. Leaps & Rebounds 40\" Rebounder" },
      { key: "audience", label: "Primary Audience", placeholder: "e.g. fitness enthusiasts, seniors" },
      { key: "key_benefit", label: "Top Benefit", placeholder: "e.g. low-impact cardio, lymphatic drainage" },
    ],
  },
  {
    id: "sms",
    label: "SMS / Push",
    icon: MessageSquare,
    color: "#f472b6",
    description: "SMS campaigns, push notifications — short & punchy",
    prompts: [
      "Flash sale alert — 20% off, 24h only",
      "Order shipped confirmation + excitement builder",
      "Re-engagement: been a while — special offer",
      "Loyalty reward unlock notification",
    ],
    fields: [
      { key: "campaign", label: "Campaign Type", placeholder: "e.g. flash sale, shipping, loyalty" },
      { key: "offer", label: "Offer / Incentive", placeholder: "e.g. 20% off, free shipping, $10 credit" },
    ],
  },
];

// ── Copy Output Card ──────────────────────────────────────────────────────────

function CopyOutputCard({ copy, type }: { copy: string; type: CopyTemplate }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(copy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ ...CARD, border: `1px solid ${type.color}25`, background: `${type.color}04`, marginTop: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
        <CheckCircle2 size={13} color={ACCENT} />
        <span style={{ fontSize: 12, color: ACCENT, fontWeight: 700, flex: 1 }}>Copy generated</span>
        <button
          onClick={handleCopy}
          style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: 11, color: copied ? ACCENT : "#64748b", background: copied ? `${ACCENT}12` : "rgba(255,255,255,0.04)", border: `1px solid ${copied ? ACCENT + "30" : "rgba(255,255,255,0.08)"}`, borderRadius: 8, padding: "0.3rem 0.65rem", cursor: "pointer", transition: "all 0.15s" }}
          aria-label="Copy to clipboard"
        >
          {copied ? <Check size={11} /> : <ClipboardCopy size={11} />}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre style={{ fontSize: 12, color: "#e2e8f0", whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "inherit", margin: 0, lineHeight: 1.7 }}>
        {copy}
      </pre>
    </motion.div>
  );
}

// ── Copy Generator Panel ──────────────────────────────────────────────────────

function CopyGeneratorPanel({ template }: { template: CopyTemplate }) {
  const [fields, setFields] = useState<Record<string, string>>({});
  const [customPrompt, setCustomPrompt] = useState("");
  const [mode, setMode] = useState<"fields" | "freeform">("fields");
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setField = (key: string, value: string) => setFields(prev => ({ ...prev, [key]: value }));

  const buildPrompt = () => {
    if (mode === "freeform") return customPrompt.trim();
    const fieldStr = template.fields
      .filter(f => fields[f.key]?.trim())
      .map(f => `${f.label}: ${fields[f.key]}`)
      .join("\n");
    return `Generate ${template.label} for Leaps & Rebounds (rebounder/mini trampoline brand).\n\n${fieldStr || "Use your best judgment for a typical Leaps & Rebounds customer."}`;
  };

  const generate = async () => {
    const prompt = buildPrompt();
    if (!prompt) return;
    setState("loading");
    setOutput(null);
    setError(null);

    try {
      // Use the agent chat endpoint with a content-focused system prompt
      const res = await fetch(`${BOT_URL}/admin/ai/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content: `You are an expert ecommerce copywriter for Leaps & Rebounds, a premium rebounder and mini trampoline brand. 
You write high-converting ${template.label} copy. 
Brand voice: energetic, health-focused, inclusive, empowering. 
Key benefits: low-impact cardio, lymphatic drainage, joint pain relief, fun for all ages.
Always output ONLY the final copy — no preamble, no explanation, no meta-commentary.`,
            },
            { role: "user", content: prompt },
          ],
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? `HTTP ${res.status}`);
      setOutput(json.data?.content ?? json.data?.text ?? json.content ?? "");
      setState("success");
    } catch (err: any) {
      setError(err.message ?? "Unknown error");
      setState("error");
    }
  };

  return (
    <div>
      {/* Mode toggle */}
      <div style={{ display: "flex", gap: "0.4rem", marginBottom: "1rem" }}>
        {(["fields", "freeform"] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            style={{ fontSize: 11, fontWeight: 700, color: mode === m ? template.color : "#64748b", background: mode === m ? `${template.color}15` : "rgba(255,255,255,0.04)", border: `1px solid ${mode === m ? template.color + "40" : "rgba(255,255,255,0.08)"}`, borderRadius: 8, padding: "0.35rem 0.75rem", cursor: "pointer", transition: "all 0.12s", textTransform: "capitalize" }}>
            {m === "fields" ? "Guided" : "Freeform"}
          </button>
        ))}
      </div>

      {mode === "fields" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {template.fields.map(f => (
            <div key={f.key}>
              <label style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, display: "block", marginBottom: "0.3rem" }}>
                {f.label}
              </label>
              <input
                value={fields[f.key] ?? ""}
                onChange={e => setField(f.key, e.target.value)}
                placeholder={f.placeholder}
                style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "0.5rem 0.75rem", color: "#e2e8f0", fontSize: 12, outline: "none", boxSizing: "border-box" }}
                onFocus={e => (e.currentTarget.style.borderColor = `${template.color}50`)}
                onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
              />
            </div>
          ))}
        </div>
      ) : (
        <div>
          {/* Quick prompts */}
          <p style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: "0.5rem" }}>Quick briefs</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.75rem" }}>
            {template.prompts.map(p => (
              <button key={p} onClick={() => setCustomPrompt(p)}
                style={{ fontSize: 10, color: template.color, background: `${template.color}0d`, border: `1px solid ${template.color}22`, borderRadius: 20, padding: "0.2rem 0.65rem", cursor: "pointer" }}>
                {p.length > 50 ? p.slice(0, 50) + "…" : p}
              </button>
            ))}
          </div>
          <textarea
            value={customPrompt}
            onChange={e => setCustomPrompt(e.target.value)}
            placeholder="Describe exactly what copy you need…"
            rows={4}
            style={{ width: "100%", resize: "vertical", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "0.75rem", color: "#e2e8f0", fontSize: 12, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
            onFocus={e => (e.currentTarget.style.borderColor = `${template.color}50`)}
            onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
          />
        </div>
      )}

      <button
        onClick={generate}
        disabled={state === "loading"}
        style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem", background: state === "loading" ? "rgba(255,255,255,0.05)" : `linear-gradient(135deg, ${template.color}, ${template.color}cc)`, border: "none", borderRadius: 10, padding: "0.65rem 1.25rem", color: state === "loading" ? "#64748b" : "#0f172a", fontWeight: 800, fontSize: 13, cursor: state === "loading" ? "not-allowed" : "pointer", transition: "all 0.15s" }}>
        {state === "loading" ? <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={14} />}
        {state === "loading" ? "Generating…" : "Generate Copy"}
      </button>

      <AnimatePresence mode="wait">
        {state === "success" && output && (
          <CopyOutputCard key="out" copy={output} type={template} />
        )}
        {state === "error" && error && (
          <motion.div key="err" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            style={{ marginTop: "1rem", padding: "0.75rem", background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", borderRadius: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
              <AlertCircle size={13} color="#f43f5e" />
              <span style={{ fontSize: 12, color: "#f43f5e", fontWeight: 700 }}>Generation failed</span>
            </div>
            <p style={{ fontSize: 11, color: "#94a3b8" }}>{error}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CopyStudioPage() {
  const [activeType, setActiveType] = useState<CopyType>("ad");
  const template = COPY_TYPES.find(t => t.id === activeType) ?? COPY_TYPES[0];

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem" }}>
        <a href="/content" style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: 11, color: "#64748b", textDecoration: "none", fontWeight: 700 }}>
          <ArrowLeft size={11} /> Content Hub
        </a>
        <span style={{ fontSize: 11, color: "#334155" }}>/</span>
        <span style={{ fontSize: 11, color: ACCENT, fontWeight: 700 }}>Copy Studio</span>
      </div>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `${ACCENT}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Copy size={18} color={ACCENT} />
          </div>
          <div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#f1f5f9", margin: 0 }}>Copy Studio</h1>
            <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>AI-powered copy generation for ads, emails, products, and SMS</p>
          </div>
        </div>
      </motion.div>

      {/* Main layout */}
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: "1.25rem", alignItems: "start" }}>

        {/* Type selector */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {COPY_TYPES.map(t => {
            const Icon = t.icon;
            const isActive = activeType === t.id;
            return (
              <button key={t.id} onClick={() => setActiveType(t.id)}
                style={{ textAlign: "left", background: isActive ? `${t.color}12` : "rgba(255,255,255,0.02)", border: `1px solid ${isActive ? t.color + "40" : "rgba(255,255,255,0.06)"}`, borderRadius: 10, padding: "0.75rem", cursor: "pointer", transition: "all 0.12s" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                  <Icon size={14} color={isActive ? t.color : "#64748b"} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: isActive ? t.color : "#94a3b8" }}>{t.label}</span>
                </div>
                <p style={{ fontSize: 10, color: "#475569", margin: 0 }}>{t.description}</p>
              </button>
            );
          })}
        </div>

        {/* Generator panel */}
        <AnimatePresence mode="wait">
          <motion.div key={activeType} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.15 }}>
            <div style={{ ...CARD, border: `1px solid ${template.color}20` }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: `${template.color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <template.icon size={14} color={template.color} />
                </div>
                <div>
                  <p style={{ fontWeight: 800, color: "#f1f5f9", fontSize: 14, margin: 0 }}>{template.label}</p>
                  <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>{template.description}</p>
                </div>
              </div>
              <CopyGeneratorPanel template={template} />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

"use client";
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Layers, Sparkles, RefreshCw, CheckCircle2, AlertCircle,
  ArrowLeft, Code2, Eye, ClipboardCopy, Check, Info,
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3001";
const ACCENT = "#a78bfa";

const CARD: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 12,
  padding: "1.25rem",
};

// ── Section Templates ─────────────────────────────────────────────────────────

const SECTION_TEMPLATES = [
  { id: "hero", label: "Hero / Banner", desc: "Full-width headline, subtitle, CTA button" },
  { id: "features", label: "Feature Grid", desc: "Icon + heading + text benefit cards" },
  { id: "social-proof", label: "Social Proof", desc: "Reviews, ratings, customer photos" },
  { id: "product-showcase", label: "Product Showcase", desc: "Product image + specs + ATC" },
  { id: "comparison", label: "Comparison Table", desc: "Us vs competitors grid" },
  { id: "faq", label: "FAQ Accordion", desc: "Collapsible Q&A section" },
  { id: "transformation", label: "Transformation", desc: "Before/after or journey story" },
  { id: "custom", label: "Custom", desc: "Free-form description" },
];

const DESIGN_TOKENS = [
  { id: "lrb-dark", label: "Dark Brand", desc: "Dark background, orange accents" },
  { id: "lrb-light", label: "Light Brand", desc: "Warm off-white, charcoal text" },
  { id: "lrb-gradient", label: "Gradient", desc: "Multi-stop gradient background" },
];

// ── Code Block ────────────────────────────────────────────────────────────────

function CodeBlock({ code, lang = "liquid" }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.4rem 0.75rem", background: "rgba(0,0,0,0.3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <Code2 size={11} color="#64748b" />
          <span style={{ fontSize: 10, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{lang}</span>
        </div>
        <button onClick={handleCopy}
          style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: 10, color: copied ? ACCENT : "#64748b", background: "none", border: "none", cursor: "pointer" }}>
          {copied ? <Check size={10} /> : <ClipboardCopy size={10} />}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre style={{ margin: 0, padding: "1rem", background: "rgba(0,0,0,0.2)", color: "#94a3b8", fontSize: 11, overflowX: "auto", maxHeight: 400, lineHeight: 1.6 }}>
        {code}
      </pre>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SectionBuilderPage() {
  const [sectionType, setSectionType] = useState("hero");
  const [designToken, setDesignToken] = useState("lrb-dark");
  const [customDesc, setCustomDesc] = useState("");
  const [audience, setAudience] = useState("");
  const [goal, setGoal] = useState("");

  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"code" | "instructions">("code");

  const selectedTemplate = SECTION_TEMPLATES.find(t => t.id === sectionType)!;

  const buildPrompt = () => {
    const parts = [
      `Generate a Shopify Liquid snippet for a "${selectedTemplate.label}" section for Leaps & Rebounds — a premium rebounder/mini trampoline ecommerce brand.`,
      `Design style: ${DESIGN_TOKENS.find(d => d.id === designToken)?.label} (${DESIGN_TOKENS.find(d => d.id === designToken)?.desc})`,
      audience ? `Target audience: ${audience}` : "",
      goal ? `Primary goal: ${goal}` : "",
      sectionType === "custom" && customDesc ? `Custom description: ${customDesc}` : "",
      "",
      "RULES (follow strictly):",
      "- Output ONLY the .liquid file contents — no markdown, no explanation, no preamble",
      "- Self-contained: all styles must be inside a <style> block scoped with a unique section class",
      "- Do NOT use external JS libraries or Glider.js",
      "- Use CSS custom properties for brand tokens: --color-bg, --color-text, --color-accent (#FF8C00), --color-accent-warm, --color-surface",
      "- Mobile-first CSS with responsive breakpoints",
      "- Include schema JSON at the bottom with sensible Shopify section settings",
      "- The snippet filename convention is: lrb-[section-name].liquid",
      "- Comment the top of the file with: filename, purpose, and version 1.0",
    ].filter(Boolean);

    return parts.join("\n");
  };

  const generate = async () => {
    setState("loading");
    setCode(null);
    setError(null);

    try {
      const res = await fetch(`${BOT_URL}/admin/ai/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content: "You are an expert Shopify Liquid developer and ecommerce UI designer. You write pixel-perfect, self-contained Liquid snippets that follow strict coding conventions. Output ONLY the code — never add explanation, markdown, or preamble.",
            },
            { role: "user", content: buildPrompt() },
          ],
          max_tokens: 4096,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? `HTTP ${res.status}`);
      const rawCode = json.data?.content ?? json.data?.text ?? json.content ?? "";
      // Strip any accidental markdown fences
      const cleaned = rawCode.replace(/^```(?:liquid|html)?\n?/m, "").replace(/```\s*$/m, "").trim();
      setCode(cleaned);
      setState("success");
    } catch (err: any) {
      setError(err.message ?? "Unknown error");
      setState("error");
    }
  };

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem" }}>
        <a href="/content" style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: 11, color: "#64748b", textDecoration: "none", fontWeight: 700 }}>
          <ArrowLeft size={11} /> Content Hub
        </a>
        <span style={{ fontSize: 11, color: "#334155" }}>/</span>
        <span style={{ fontSize: 11, color: ACCENT, fontWeight: 700 }}>Section Builder</span>
      </div>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `${ACCENT}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Layers size={18} color={ACCENT} />
          </div>
          <div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#f1f5f9", margin: 0 }}>Section Builder</h1>
            <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>Generate Shopify Liquid snippets from a brief — then deploy + register for A/B testing</p>
          </div>
        </div>

        {/* Info banner */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", background: `${ACCENT}08`, border: `1px solid ${ACCENT}20`, borderRadius: 10, padding: "0.75rem 1rem" }}>
          <Info size={13} color={ACCENT} style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: 11, color: "#94a3b8", margin: 0, lineHeight: 1.6 }}>
            Generated snippets follow the <strong style={{ color: "#e2e8f0" }}>lrb-* design system</strong> conventions.
            After generation: copy to <code style={{ color: ACCENT, fontSize: 10 }}>gravity-claw/src/shopify-assets/snippets/</code>,
            deploy with <code style={{ color: ACCENT, fontSize: 10 }}>theme push</code>, then register in{" "}
            <a href="/audience/sections" style={{ color: ACCENT }}>Audience → Section Library</a> as a PAUSED variation.
          </p>
        </div>
      </motion.div>

      {/* Main layout */}
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "1.25rem", alignItems: "start" }}>

        {/* Config panel */}
        <div style={{ ...CARD, display: "flex", flexDirection: "column", gap: "1rem" }}>

          {/* Section type */}
          <div>
            <label style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, display: "block", marginBottom: "0.5rem" }}>
              Section Type
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
              {SECTION_TEMPLATES.map(t => (
                <button key={t.id} onClick={() => setSectionType(t.id)}
                  style={{ textAlign: "left", background: sectionType === t.id ? `${ACCENT}12` : "rgba(255,255,255,0.02)", border: `1px solid ${sectionType === t.id ? ACCENT + "40" : "rgba(255,255,255,0.06)"}`, borderRadius: 8, padding: "0.45rem 0.65rem", cursor: "pointer", transition: "all 0.12s" }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: sectionType === t.id ? ACCENT : "#94a3b8", margin: 0 }}>{t.label}</p>
                  <p style={{ fontSize: 10, color: "#475569", margin: 0 }}>{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Design style */}
          <div>
            <label style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, display: "block", marginBottom: "0.5rem" }}>
              Design Style
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
              {DESIGN_TOKENS.map(d => (
                <button key={d.id} onClick={() => setDesignToken(d.id)}
                  style={{ textAlign: "left", background: designToken === d.id ? `${ACCENT}12` : "rgba(255,255,255,0.02)", border: `1px solid ${designToken === d.id ? ACCENT + "40" : "rgba(255,255,255,0.06)"}`, borderRadius: 8, padding: "0.45rem 0.65rem", cursor: "pointer", transition: "all 0.12s" }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: designToken === d.id ? ACCENT : "#94a3b8", margin: 0 }}>{d.label}</p>
                  <p style={{ fontSize: 10, color: "#475569", margin: 0 }}>{d.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Optional fields */}
          {[
            { key: "audience", label: "Target Audience", placeholder: "e.g. seniors, fitness beginners", value: audience, set: setAudience },
            { key: "goal", label: "Conversion Goal", placeholder: "e.g. add to cart, email signup", value: goal, set: setGoal },
          ].map(f => (
            <div key={f.key}>
              <label style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, display: "block", marginBottom: "0.4rem" }}>
                {f.label} <span style={{ color: "#334155", textTransform: "lowercase", letterSpacing: 0 }}>(optional)</span>
              </label>
              <input value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "0.5rem 0.65rem", color: "#e2e8f0", fontSize: 12, outline: "none", boxSizing: "border-box" }}
                onFocus={e => (e.currentTarget.style.borderColor = `${ACCENT}50`)}
                onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
              />
            </div>
          ))}

          {/* Custom description */}
          {sectionType === "custom" && (
            <div>
              <label style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, display: "block", marginBottom: "0.4rem" }}>
                Custom Description
              </label>
              <textarea value={customDesc} onChange={e => setCustomDesc(e.target.value)}
                placeholder="Describe the section in detail…"
                rows={4}
                style={{ width: "100%", resize: "vertical", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "0.5rem 0.65rem", color: "#e2e8f0", fontSize: 12, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
              />
            </div>
          )}

          {/* Generate button */}
          <button onClick={generate} disabled={state === "loading"}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", background: state === "loading" ? "rgba(255,255,255,0.05)" : `linear-gradient(135deg, ${ACCENT}, #7c3aed)`, border: "none", borderRadius: 10, padding: "0.75rem", color: state === "loading" ? "#64748b" : "#fff", fontWeight: 800, fontSize: 13, cursor: state === "loading" ? "not-allowed" : "pointer", transition: "all 0.15s" }}>
            {state === "loading" ? <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={14} />}
            {state === "loading" ? "Generating…" : "Generate Snippet"}
          </button>
        </div>

        {/* Output panel */}
        <div>
          {state === "idle" && (
            <div style={{ ...CARD, textAlign: "center", padding: "4rem 2rem", opacity: 0.4 }}>
              <Layers size={32} color="#475569" style={{ marginBottom: "0.75rem" }} />
              <p style={{ color: "#475569", fontSize: 13 }}>Configure your section on the left, then click Generate.</p>
            </div>
          )}

          <AnimatePresence mode="wait">
            {state === "loading" && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{ ...CARD, textAlign: "center", padding: "4rem 2rem" }}>
                <RefreshCw size={24} color={ACCENT} style={{ animation: "spin 1s linear infinite", marginBottom: "1rem" }} />
                <p style={{ color: "#64748b", fontSize: 13 }}>Generating your Liquid snippet…</p>
                <p style={{ color: "#475569", fontSize: 11, marginTop: "0.4rem" }}>This usually takes 15-30 seconds</p>
              </motion.div>
            )}

            {state === "success" && code && (
              <motion.div key="success" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                  <CheckCircle2 size={14} color="#10b981" />
                  <span style={{ fontSize: 12, color: "#10b981", fontWeight: 700 }}>Snippet generated</span>
                  <span style={{ marginLeft: "auto", fontSize: 10, color: "#475569" }}>
                    {code.split("\n").length} lines
                  </span>
                </div>
                <CodeBlock code={code} lang="liquid" />

                <div style={{ marginTop: "1rem", ...CARD, background: "rgba(167,139,250,0.05)", border: "1px solid rgba(167,139,250,0.15)" }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: "0.5rem" }}>Next steps</p>
                  <ol style={{ fontSize: 11, color: "#94a3b8", paddingLeft: "1.25rem", margin: 0, lineHeight: 2 }}>
                    <li>Copy the code above and save as <code style={{ color: ACCENT, fontSize: 10 }}>gravity-claw/src/shopify-assets/snippets/lrb-{sectionType}.liquid</code></li>
                    <li>Run <code style={{ color: ACCENT, fontSize: 10 }}>theme push --env dev</code> to deploy to your dev theme</li>
                    <li>Add a <code style={{ color: ACCENT, fontSize: 10 }}>{"{% render 'lrb-{sectionType}' %}"}</code> include to a theme template</li>
                    <li>Go to <a href="/audience/sections" style={{ color: ACCENT }}>Audience → Section Library</a> → Register as a PAUSED variation → Resume into UCB1</li>
                  </ol>
                </div>
              </motion.div>
            )}

            {state === "error" && error && (
              <motion.div key="error" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                style={{ ...CARD, background: "rgba(244,63,94,0.06)", border: "1px solid rgba(244,63,94,0.2)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  <AlertCircle size={14} color="#f43f5e" />
                  <span style={{ fontSize: 12, color: "#f43f5e", fontWeight: 700 }}>Generation failed</span>
                </div>
                <p style={{ fontSize: 11, color: "#94a3b8" }}>{error}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

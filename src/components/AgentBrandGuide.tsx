"use client";
import React, { useMemo, useState } from "react";
import {
    Palette,
    Copy,
    Check,
    Download,
    FileText,
    Code2,
    ExternalLink,
    ChevronDown,
    ChevronRight,
    AlertTriangle,
} from "lucide-react";
import { MarkdownMessage } from "@/components/MarkdownMessage";

/**
 * The paste-ready brand guide for AI agents.
 *
 * This string IS the deliverable — everything on the page (the report view, the
 * per-section copy buttons, the .md download) is derived from it, so there is one
 * source of truth and the rendered view cannot drift from what gets copied.
 *
 * Ported from the Google Doc "Leaps & Rebounds Brand Style Guide for Development"
 * (linked as SOURCE_DOC_URL below). Deliberately excludes the doc's 2026-07-29 UX
 * audit snapshot — see ARCHIVED_AUDIT_NOTE. A point-in-time audit is not brand
 * guidance, and two of its headline figures are known-wrong, so pasting it into
 * every agent prompt would spread them.
 */
const BRAND_GUIDE_MD = `# Leaps & Rebounds — Brand Guide for AI Agents

You are writing, designing, or building for **Leaps & Rebounds (L&R)**. Everything below
is authoritative. Do not invent brand elements — if a detail you need is not here, say so
and ask, or verify it against live store data.

## 1. Brand Overview

- **Brand:** Leaps & Rebounds (L&R)
- **Product:** Bungee fitness rebounder — a mini trampoline on high-strength bungee cords, **not springs**
- **Position:** Mid-to-premium DTC fitness equipment. We compete on quality and warranty, **never on price**
- **Core value prop:** 70% less joint impact than traditional cardio equipment
- **Store:** Shopify DTC (leapsandrebounds.com) · Klaviyo email · Triple Whale · Amazon

## 2. Typography

- **Primary font:** Montserrat
- **Headings:** Montserrat Bold / SemiBold (600–900)
- **Body:** Montserrat Regular (400)
- **Fallback stack:** \`Verdana, Arial, sans-serif\`
- **Font personality:** Clean, modern, athletic but approachable

Never use script fonts, condensed display faces, or stiff corporate serifs.

\`\`\`css
font-family: 'Montserrat', Verdana, Arial, sans-serif;
\`\`\`

## 3. Color

| Role | Hex | Use for |
|---|---|---|
| Brand orange | \`#e98d20\` | CTAs, price highlights, key benefits, active states |
| Charcoal | \`#2e2e30\` | Headings, primary text, navigation |
| Gray | \`#D1D1D1\` | Body text, borders, secondary elements |
| White | \`#ffffff\` | Backgrounds, negative space |

**Rules**
- Orange is the only accent. One orange element per viewport should be the thing you want clicked.
- White backgrounds are the default on storefront and marketing — clean, wellness feel.
- Internal dark-UI surfaces (Mission Control) sit on \`#1a1a1c\` with orange-tinted borders at ~12% alpha. Same orange, same Montserrat.

\`\`\`css
:root {
  --primary-orange:   #e98d20;
  --primary-black:    #2e2e30;
  --secondary-gray:   #D1D1D1;
  --background-white: #ffffff;
}
\`\`\`

## 4. Visual Style

**Energy:** Bouncy and energetic, never aggressive.

**Target feel**
- Clean and modern, like a premium wellness brand
- Approachable fitness — not intimidating gym culture
- Family-friendly and inclusive
- Professional but warm

**Avoid**
- Dark, aggressive fitness aesthetics
- Overly clinical or medical looks
- Cheap or discount-store vibes
- Complex gradients and heavy effects

## 5. Brand Voice

**Core personality:** Encouraging, real, and direct — like a friend who happens to be a fitness coach.

- **Real** — talk like a person, no buzzwords
- **Encouraging** — the reader is already trying, respect that
- **Smart** — trust the customer to understand, don't over-explain
- **Specific** — numbers beat adjectives. "70% less joint impact", not "much gentler"

We are anti-punishment. Fitness here is something you get to do, not something you owe.

## 6. Words

**Words we use**

\`bounce\` · \`jump\` · \`low-impact\` · \`joint-friendly\` · \`fun\` · \`cardio\` · \`bungee\` · \`assembled\` · \`real\` · \`actually\` · \`finally\` · \`easy\` · \`family\`

**Words we never use**

| Banned | Why |
|---|---|
| Revolutionary, Game-changing | Overused and hollow |
| Premium, Luxury | Trying too hard — we show it instead |
| Hustle, Crush your goals | Wrong energy. We are anti-punishment |
| Amazing, Incredible | Vague. Be specific instead |

## 7. Product Facts

**Key differentiators**
1. **Bungee cords, not springs** — quieter, smoother, gentler
2. **Ships 95% assembled** — kills the setup objection
3. **70% less joint impact** — the primary health benefit
4. **Folds flat, stores upright** — the space answer
5. **30-day Jump Trial** — risk reversal

**Product lines**
- **Standard Rebounder** — core product, black frame
- **American Tough** — US-made, lifetime warranty, premium positioning
- **Stabilizer Bar** — accessory for balance assistance
- **Color variants** — Green (spring), Blue (summer), Red (holiday), Black (classic)

**Guarantees:** 30-day Jump Trial on everything; lifetime warranty on the American Edition only.

**Product imagery rule:** the ring and bungee colors change by season, but the **safety padding is always black**. Never generate a product image without a real product reference photo.

## 8. Target Customer

- **Demographics:** 35–60, primarily women, dealing with joint pain or high-impact fatigue
- **Psychographics:** Wants to stay fit without punishing their body. Researches before buying. Smart, skeptical of hype
- **What they are afraid of:** another piece of equipment that hurts, is loud, is a pain to assemble, or ends up in a closet

Write to one person, not a segment.

## 9. UI/UX Guidelines

**Layout**
- Clean, spacious layouts — never cramped
- **Mobile-first**; 60%+ of traffic is mobile
- Conversion-focused — every page guides toward purchase
- Trust signals (warranty, reviews, testimonials) sit high on the page

**Components**
- **Buttons:** 8px radius, solid fills for primary actions
- **Cards:** clean white backgrounds, subtle shadows
- **Forms:** simple, minimum friction
- **Navigation:** clear, never overwhelming

**Content strategy**
- Lead with benefits, not features — joint impact before technical specs
- Social-proof heavy: reviews, testimonials, user content
- Problem-first: name the joint pain before selling the solution

## 10. Technical Context

- **Platform:** Shopify, customized Dawn theme
- **Mobile optimization is critical** — majority of traffic
- **Page speed matters** — these customers comparison shop

**Sections a page usually needs**
- Hero with video or lifestyle imagery
- Benefits and feature comparison
- Customer reviews and testimonials
- Product comparison table
- FAQ answering the real objections
- Risk reversal — 30-day trial, warranty

**Components we build often:** image galleries with zoom, review stars, comparison tables, video testimonials, FAQ accordions, trust badges, mobile checkout.

## 11. Competitive Context

| Competitor | Tier | Read |
|---|---|---|
| Bellicon | Premium, $500+ | More expensive, aimed at serious athletes |
| JumpSport | Mid, $200–400 | Closest competitor |
| BCAN | Budget, $150–200 | Cheaper, quality concerns |

Also in the set: Acon, Cellerciser, Fit Bounce Pro.

**Positioning**
- **Quality over price** — not the cheapest, the best value
- **Wellness over performance** — preserving health, not chasing athletic output
- **Accessibility** — fitness for everyone, not elite athletes

## 12. Validation Checklist

Before shipping any design, page, or piece of copy:

- [ ] Does this read like a premium wellness brand?
- [ ] Would a 45-year-old woman with joint pain find it approachable?
- [ ] Is the benefit clear without explanation?
- [ ] Does it separate us from cheap competitors?
- [ ] Is it mobile-first?
- [ ] Are there specific numbers instead of adjectives?
- [ ] Zero banned words?
`;

const SOURCE_DOC_URL =
    "https://docs.google.com/document/d/15oFWIaFP45J0h3WU1b4Met3IuLyf6wTD_ElWeEoztGA/edit";

const SWATCHES = [
    { name: "Brand Orange", hex: "#e98d20", note: "CTAs, accents" },
    { name: "Charcoal", hex: "#2e2e30", note: "Headings, text" },
    { name: "Gray", hex: "#D1D1D1", note: "Body, borders" },
    { name: "White", hex: "#ffffff", note: "Backgrounds" },
];

const WORDS_USE = [
    "bounce", "jump", "low-impact", "joint-friendly", "fun", "cardio",
    "bungee", "assembled", "real", "actually", "finally", "easy", "family",
];

const WORDS_NEVER = [
    "Revolutionary", "Game-changing", "Premium", "Luxury",
    "Hustle", "Crush your goals", "Amazing", "Incredible",
];

/**
 * The source doc carries a 2026-07-29 UX audit. It is kept here for reference but
 * stays out of BRAND_GUIDE_MD: it is a snapshot, not brand guidance, and its
 * content-scale figures were measured off truncated reads.
 */
const ARCHIVED_AUDIT_NOTE = `**Two figures in that audit are wrong and must not be repeated:**

- It says **"43+ blog posts"** and a sitemap covering ~12% of content. The library is
  **785 articles** (see the Blog page). The audit counted a crawl sample, not the library.
- It says **"only 5 pages indexed"**. That reading came from a misconfigured Search Console
  property, not from the site. Live indexing lives on the SEO page.

The durable parts of that audit — mobile is 60%+ of traffic, trust signals belong above the
fold, page speed affects conversion — are already folded into sections 9 and 10 above.`;

async function writeClipboard(text: string) {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch {
        /* fall through to the textarea path */
    }
    try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return ok;
    } catch {
        return false;
    }
}

interface Section {
    id: string;
    title: string;
    body: string;
}

/** Split the guide on `## ` headings so each section can be copied on its own. */
function splitSections(md: string): { intro: string; sections: Section[] } {
    const parts = md.split(/\n(?=## )/);
    const intro = parts[0].trim();
    const sections = parts.slice(1).map((chunk, i) => {
        const nl = chunk.indexOf("\n");
        const heading = (nl === -1 ? chunk : chunk.slice(0, nl)).replace(/^##\s*/, "").trim();
        return { id: `s${i}`, title: heading, body: chunk.trim() };
    });
    return { intro, sections };
}

export function AgentBrandGuide() {
    const [view, setView] = useState<"report" | "markdown">("report");
    const [copied, setCopied] = useState<string | null>(null);
    const [showAudit, setShowAudit] = useState(false);

    const { intro, sections } = useMemo(() => splitSections(BRAND_GUIDE_MD), []);

    const stats = useMemo(() => {
        const chars = BRAND_GUIDE_MD.length;
        return {
            words: BRAND_GUIDE_MD.trim().split(/\s+/).length,
            chars,
            // Rough English heuristic — enough to know it fits in any context window.
            tokens: Math.round(chars / 4),
        };
    }, []);

    const copy = async (text: string, key: string) => {
        const ok = await writeClipboard(text);
        setCopied(ok ? key : "error");
        setTimeout(() => setCopied(null), 2000);
    };

    const download = () => {
        const blob = new Blob([BRAND_GUIDE_MD], { type: "text/markdown;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "leaps-and-rebounds-brand-guide.md";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const cardStyle: React.CSSProperties = {
        background: "rgba(255,255,255,0.02)",
        border: "1px solid var(--glass-border)",
        borderRadius: 12,
    };

    return (
        <div className="mb-6 brand-guide">
            {/*
              MarkdownMessage sets `word-break: break-all` on inline code — right for
              chat bubbles full of long URLs, wrong here, where §6 is a run of short
              word chips and "family" was splitting into "famil / y". Inline styles
              only lose to !important, hence the override.
            */}
            <style>{`
                .brand-guide code {
                    word-break: keep-all !important;
                    overflow-wrap: normal !important;
                    white-space: nowrap;
                }
                .brand-guide pre code { white-space: pre-wrap; }
            `}</style>

            {/* ── Header ─────────────────────────────────────────── */}
            <div
                className="box"
                style={{
                    background:
                        "linear-gradient(135deg, rgba(233,141,32,0.08), rgba(255,255,255,0.02))",
                    border: "1px solid rgba(233,141,32,0.22)",
                    borderRadius: 12,
                }}
            >
                <div
                    className="is-flex is-align-items-flex-start is-flex-wrap-wrap"
                    style={{ gap: "0.75rem" }}
                >
                    <div
                        style={{
                            width: 40,
                            height: 40,
                            background: "rgba(233,141,32,0.14)",
                            borderRadius: 10,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--accent-orange)",
                            flexShrink: 0,
                        }}
                    >
                        <Palette size={20} />
                    </div>

                    <div style={{ flex: "1 1 280px", minWidth: 0 }}>
                        <p className="has-text-weight-black is-size-6">Brand Guide for AI Agents</p>
                        <p className="has-text-grey is-size-7">
                            Paste-ready context. Drop the whole thing into any agent, prompt, or
                            chat before it writes copy or builds UI.
                        </p>
                        <p className="is-size-7 has-text-grey-light mt-2" style={{ fontSize: 11 }}>
                            {stats.words.toLocaleString()} words · {stats.chars.toLocaleString()} chars ·
                            ~{stats.tokens.toLocaleString()} tokens ·{" "}
                            <a
                                href={SOURCE_DOC_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: "var(--accent-orange)" }}
                            >
                                source doc <ExternalLink size={10} style={{ display: "inline" }} />
                            </a>
                        </p>
                    </div>

                    {/* Actions */}
                    <div
                        className="is-flex is-flex-wrap-wrap"
                        style={{ gap: "0.5rem", flexShrink: 0 }}
                    >
                        <button
                            className="button is-small"
                            onClick={() => copy(BRAND_GUIDE_MD, "all")}
                            style={{
                                background:
                                    copied === "all" ? "var(--accent-emerald)" : "var(--accent-orange)",
                                color: "#1a1a1c",
                                border: "none",
                                fontWeight: 800,
                            }}
                        >
                            {copied === "all" ? <Check size={14} /> : <Copy size={14} />}
                            <span style={{ marginLeft: 6 }}>
                                {copied === "all" ? "Copied" : "Copy full guide"}
                            </span>
                        </button>

                        <button
                            className="button is-small is-ghost"
                            onClick={download}
                            style={{
                                background: "rgba(255,255,255,0.05)",
                                color: "var(--text-secondary)",
                                border: "1px solid var(--glass-border)",
                                textDecoration: "none",
                            }}
                        >
                            <Download size={14} />
                            <span style={{ marginLeft: 6 }}>.md</span>
                        </button>
                    </div>
                </div>

                {/* View toggle */}
                <div className="is-flex mt-4" style={{ gap: "0.4rem" }}>
                    {(
                        [
                            { key: "report", label: "Report", icon: FileText },
                            { key: "markdown", label: "Raw markdown", icon: Code2 },
                        ] as const
                    ).map(({ key, label, icon: Icon }) => {
                        const active = view === key;
                        return (
                            <button
                                key={key}
                                className="button is-small"
                                onClick={() => setView(key)}
                                style={{
                                    background: active
                                        ? "rgba(233,141,32,0.16)"
                                        : "rgba(255,255,255,0.03)",
                                    color: active ? "var(--accent-orange)" : "var(--text-secondary)",
                                    border: `1px solid ${active ? "rgba(233,141,32,0.35)" : "var(--glass-border)"}`,
                                    fontWeight: 700,
                                    fontSize: 11,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.05em",
                                }}
                            >
                                <Icon size={12} />
                                <span style={{ marginLeft: 6 }}>{label}</span>
                            </button>
                        );
                    })}
                    {copied === "error" && (
                        <span className="is-size-7 ml-3" style={{ color: "var(--accent-rose)" }}>
                            Copy blocked by the browser — use the .md download.
                        </span>
                    )}
                </div>
            </div>

            {/* ── Report view ─────────────────────────────────────── */}
            {view === "report" && (
                <>
                    {/* Swatches — click to copy a hex */}
                    <div className="box mt-4" style={cardStyle}>
                        <p
                            className="is-size-7 has-text-weight-bold is-uppercase has-text-grey-light mb-3"
                            style={{ fontSize: 10, letterSpacing: "0.08em" }}
                        >
                            Palette — click a swatch to copy the hex
                        </p>
                        <div className="columns is-multiline is-mobile" style={{ margin: 0 }}>
                            {SWATCHES.map(s => (
                                <div
                                    key={s.hex}
                                    className="column is-half-mobile is-one-quarter-tablet"
                                    style={{ padding: "0.35rem" }}
                                >
                                    <button
                                        onClick={() => copy(s.hex, s.hex)}
                                        style={{
                                            width: "100%",
                                            textAlign: "left",
                                            background: "rgba(255,255,255,0.03)",
                                            border: "1px solid var(--glass-border)",
                                            borderRadius: 10,
                                            padding: "0.6rem",
                                            cursor: "pointer",
                                            color: "inherit",
                                            font: "inherit",
                                        }}
                                    >
                                        {/* Charcoal is nearly the card colour — a brighter
                                            ring is what makes it readable as a swatch. */}
                                        <div
                                            style={{
                                                height: 34,
                                                borderRadius: 6,
                                                background: s.hex,
                                                border: "1px solid rgba(255,255,255,0.35)",
                                                boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.25)",
                                                marginBottom: 8,
                                            }}
                                        />
                                        <p
                                            className="is-size-7 has-text-weight-bold"
                                            style={{ lineHeight: 1.2 }}
                                        >
                                            {s.name}
                                        </p>
                                        <p
                                            className="is-size-7"
                                            style={{
                                                fontFamily: "'JetBrains Mono', monospace",
                                                color:
                                                    copied === s.hex
                                                        ? "var(--accent-emerald)"
                                                        : "var(--accent-orange)",
                                                fontSize: 11,
                                            }}
                                        >
                                            {copied === s.hex ? "copied!" : s.hex}
                                        </p>
                                        <p
                                            className="is-size-7 has-text-grey"
                                            style={{ fontSize: 10 }}
                                        >
                                            {s.note}
                                        </p>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Words — the fastest thing to check copy against */}
                    <div className="columns is-multiline mt-2">
                        <div className="column is-half">
                            <div className="box" style={{ ...cardStyle, height: "100%" }}>
                                <p
                                    className="is-size-7 has-text-weight-bold is-uppercase mb-3"
                                    style={{
                                        fontSize: 10,
                                        letterSpacing: "0.08em",
                                        color: "var(--accent-emerald)",
                                    }}
                                >
                                    ✓ Words we use
                                </p>
                                <div className="is-flex is-flex-wrap-wrap" style={{ gap: "0.35rem" }}>
                                    {WORDS_USE.map(w => (
                                        <span
                                            key={w}
                                            className="is-size-7"
                                            style={{
                                                padding: "0.2rem 0.55rem",
                                                borderRadius: 99,
                                                background: "rgba(34,197,94,0.1)",
                                                border: "1px solid rgba(34,197,94,0.25)",
                                                color: "#7ee2a8",
                                            }}
                                        >
                                            {w}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="column is-half">
                            <div className="box" style={{ ...cardStyle, height: "100%" }}>
                                <p
                                    className="is-size-7 has-text-weight-bold is-uppercase mb-3"
                                    style={{
                                        fontSize: 10,
                                        letterSpacing: "0.08em",
                                        color: "var(--accent-rose)",
                                    }}
                                >
                                    ✕ Words we never use
                                </p>
                                <div className="is-flex is-flex-wrap-wrap" style={{ gap: "0.35rem" }}>
                                    {WORDS_NEVER.map(w => (
                                        <span
                                            key={w}
                                            className="is-size-7"
                                            style={{
                                                padding: "0.2rem 0.55rem",
                                                borderRadius: 99,
                                                background: "rgba(244,63,94,0.08)",
                                                border: "1px solid rgba(244,63,94,0.22)",
                                                color: "#f4a2ae",
                                                textDecoration: "line-through",
                                            }}
                                        >
                                            {w}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Intro + per-section cards, each independently copyable */}
                    <div className="box mt-2" style={cardStyle}>
                        <MarkdownMessage content={intro} />
                    </div>

                    {sections.map(sec => (
                        <div key={sec.id} className="box mt-3" style={cardStyle}>
                            <div
                                className="is-flex is-justify-content-space-between is-align-items-center mb-2"
                                style={{ gap: "0.75rem" }}
                            >
                                <p
                                    className="has-text-weight-black is-size-6"
                                    style={{ minWidth: 0 }}
                                >
                                    {sec.title}
                                </p>
                                <button
                                    className="button is-small"
                                    onClick={() => copy(sec.body, sec.id)}
                                    title={`Copy "${sec.title}" only`}
                                    style={{
                                        background: "rgba(255,255,255,0.04)",
                                        border: "1px solid var(--glass-border)",
                                        color:
                                            copied === sec.id
                                                ? "var(--accent-emerald)"
                                                : "var(--text-secondary)",
                                        flexShrink: 0,
                                        fontSize: 11,
                                    }}
                                >
                                    {copied === sec.id ? <Check size={12} /> : <Copy size={12} />}
                                    <span style={{ marginLeft: 5 }}>
                                        {copied === sec.id ? "Copied" : "Copy"}
                                    </span>
                                </button>
                            </div>
                            <MarkdownMessage content={sec.body.replace(/^##.*\n?/, "")} />
                        </div>
                    ))}
                </>
            )}

            {/* ── Raw markdown view ───────────────────────────────── */}
            {view === "markdown" && (
                <div className="box mt-4" style={cardStyle}>
                    <div
                        className="is-flex is-justify-content-space-between is-align-items-center mb-3"
                        style={{ gap: "0.75rem" }}
                    >
                        <p className="is-size-7 has-text-grey">
                            Select all and copy, or use the button. This is exactly what
                            &ldquo;Copy full guide&rdquo; puts on your clipboard.
                        </p>
                        <button
                            className="button is-small"
                            onClick={() => copy(BRAND_GUIDE_MD, "raw")}
                            style={{
                                background: "rgba(255,255,255,0.04)",
                                border: "1px solid var(--glass-border)",
                                color:
                                    copied === "raw" ? "var(--accent-emerald)" : "var(--text-secondary)",
                                flexShrink: 0,
                                fontSize: 11,
                            }}
                        >
                            {copied === "raw" ? <Check size={12} /> : <Copy size={12} />}
                            <span style={{ marginLeft: 5 }}>{copied === "raw" ? "Copied" : "Copy"}</span>
                        </button>
                    </div>
                    <pre
                        style={{
                            background: "rgba(0,0,0,0.35)",
                            border: "1px solid rgba(255,255,255,0.06)",
                            borderRadius: 8,
                            padding: "1rem",
                            maxHeight: "60vh",
                            overflow: "auto",
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 11.5,
                            lineHeight: 1.6,
                            color: "var(--text-secondary)",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                            userSelect: "text",
                        }}
                    >
                        {BRAND_GUIDE_MD}
                    </pre>
                </div>
            )}

            {/* ── Archived audit ──────────────────────────────────── */}
            <div className="box mt-4" style={{ ...cardStyle, borderStyle: "dashed" }}>
                <button
                    onClick={() => setShowAudit(v => !v)}
                    className="is-flex is-align-items-center"
                    style={{
                        gap: "0.5rem",
                        background: "none",
                        border: "none",
                        padding: 0,
                        cursor: "pointer",
                        color: "var(--text-secondary)",
                        font: "inherit",
                        width: "100%",
                        textAlign: "left",
                    }}
                >
                    {showAudit ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <AlertTriangle size={14} style={{ color: "var(--accent-gold)" }} />
                    <span className="is-size-7 has-text-weight-bold">
                        The source doc&rsquo;s 2026-07-29 UX audit is deliberately not in the copy
                    </span>
                </button>
                {showAudit && (
                    <div className="mt-3 is-size-7">
                        <MarkdownMessage content={ARCHIVED_AUDIT_NOTE} />
                        <p className="has-text-grey mt-2">
                            The full snapshot stays in the{" "}
                            <a
                                href={SOURCE_DOC_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: "var(--accent-orange)" }}
                            >
                                Google Doc
                            </a>
                            . For current numbers use the SEO and Blog pages, which read live data.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default AgentBrandGuide;

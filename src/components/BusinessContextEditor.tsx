"use client";
import React, { useEffect, useState, useMemo } from "react";
import { BookOpen, Sparkles, CheckCircle, XCircle, Save, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3000";

interface ContextField {
    key: string;
    label: string;
    category: string;
    value: string;
}

interface ParseResult {
    extracted: Record<string, string>;
    completeness: number;
    fieldsExtracted: number;
    totalFields: number;
}

const CATEGORY_ORDER = ["Brand", "Products & Links", "Social Media", "Competitors", "Goals"];

const PASTE_HINTS = [
    "Your website URL",
    "Brand name & tagline",
    "Brand colors (hex codes)",
    "Target audience description",
    "Product lines & descriptions",
    "Social media handles",
    "Competitor names & URLs",
    "Current quarter goals or revenue targets",
    "Brand voice & tone guidelines",
    "Brand do's and don'ts",
];

export function BusinessContextEditor() {
    const [fields, setFields] = useState<ContextField[]>([]);
    const [loading, setLoading] = useState(true);
    const [pasteText, setPasteText] = useState("");
    const [parsing, setParsing] = useState(false);
    const [parseResult, setParseResult] = useState<ParseResult | null>(null);
    const [pendingEdits, setPendingEdits] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

    // Load existing fields
    useEffect(() => {
        fetch(`${BOT_URL}/admin/business/context`)
            .then(r => r.json())
            .then(data => {
                setFields(data.fields ?? []);
                const expanded: Record<string, boolean> = {};
                (data.fields ?? []).forEach((f: ContextField) => { expanded[f.category] = true; });
                setExpandedCategories(expanded);
            })
            .catch(() => setError("Could not connect to bot API. Check NEXT_PUBLIC_BOT_URL."))
            .finally(() => setLoading(false));
    }, []);

    // Completeness from existing + pending
    const currentValues = useMemo(() => {
        const base: Record<string, string> = {};
        fields.forEach(f => { base[f.key] = f.value; });
        return { ...base, ...pendingEdits };
    }, [fields, pendingEdits]);

    const filledCount = useMemo(() =>
        Object.values(currentValues).filter(v => v?.trim()).length,
        [currentValues]
    );
    const completeness = fields.length > 0 ? Math.round((filledCount / fields.length) * 100) : 0;

    const handleParse = async () => {
        if (!pasteText.trim()) return;
        setParsing(true);
        setError(null);
        setParseResult(null);
        try {
            const res = await fetch(`${BOT_URL}/admin/business/ai-parse`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: pasteText }),
            });
            if (!res.ok) throw new Error(`Parse failed: ${res.status}`);
            const data: ParseResult = await res.json();
            setParseResult(data);
            // Merge extracted into pending edits
            setPendingEdits(prev => ({ ...prev, ...data.extracted }));
        } catch (e: any) {
            setError(e.message);
        } finally {
            setParsing(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        try {
            const updates = Object.entries(pendingEdits).map(([key, value]) => ({ key, value }));
            if (updates.length === 0) return;
            const res = await fetch(`${BOT_URL}/admin/business/context`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ updates }),
            });
            if (!res.ok) throw new Error(`Save failed: ${res.status}`);
            // Reflect saved edits back into fields
            setFields(prev => prev.map(f => ({ ...f, value: pendingEdits[f.key] ?? f.value })));
            setSavedKeys(new Set(Object.keys(pendingEdits)));
            setPendingEdits({});
            setPasteText("");
            setParseResult(null);
            setTimeout(() => setSavedKeys(new Set()), 3000);
        } catch (e: any) {
            setError(`Save failed: ${e.message}`);
        } finally {
            setSaving(false);
        }
    };

    const byCategory = useMemo(() => {
        return CATEGORY_ORDER.reduce<Record<string, ContextField[]>>((acc, cat) => {
            acc[cat] = fields.filter(f => f.category === cat);
            return acc;
        }, {});
    }, [fields]);

    const progressColor = completeness >= 80 ? "#00d08a" : completeness >= 50 ? "#ff8c00" : "#e74c3c";
    const pendingCount = Object.keys(pendingEdits).length;

    return (
        <div className="columns is-multiline">

            {/* ── Header ─────────────────────────────────────────── */}
            <div className="column is-12">
                <div className="box" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <div className="is-flex is-align-items-center" style={{ gap: "0.75rem", marginBottom: "1rem" }}>
                        <div style={{ width: 36, height: 36, background: "rgba(255,140,0,0.1)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-orange)" }}>
                            <BookOpen size={18} />
                        </div>
                        <div>
                            <p className="has-text-weight-black is-size-6">Brand Guide</p>
                            <p className="has-text-grey is-size-7">Paste anything — AI extracts your brand data automatically</p>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    {!loading && (
                        <div>
                            <div className="is-flex is-justify-content-space-between mb-1">
                                <span className="is-size-7 has-text-grey">Brand guide completeness</span>
                                <span className="is-size-7 has-text-weight-black" style={{ color: progressColor }}>{completeness}%</span>
                            </div>
                            <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 99, overflow: "hidden" }}>
                                <div style={{
                                    height: "100%",
                                    width: `${completeness}%`,
                                    background: `linear-gradient(90deg, ${progressColor}aa, ${progressColor})`,
                                    borderRadius: 99,
                                    transition: "width 0.6s ease",
                                }} />
                            </div>
                            <p className="is-size-7 has-text-grey mt-1">{filledCount} of {fields.length} fields filled</p>
                        </div>
                    )}
                </div>
            </div>

            {/* ── AI Paste Box ─────────────────────────────────────── */}
            <div className="column is-12">
                <div className="box" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,140,0,0.2)" }}>
                    <p className="has-text-weight-black is-size-6 mb-2" style={{ color: "var(--accent-orange)" }}>
                        <Sparkles size={14} style={{ marginRight: 6, display: "inline" }} />
                        Paste & Parse
                    </p>
                    <p className="has-text-grey is-size-7 mb-3">
                        Paste anything — your website, brand guidelines, product descriptions, social bios, competitor notes, goals. AI will extract what it can.
                    </p>

                    {/* Hint checklist of what to include */}
                    <div className="mb-3" style={{ padding: "0.75rem", background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
                        <p className="is-size-7 has-text-grey-light has-text-weight-bold mb-2 is-uppercase" style={{ fontSize: "10px", letterSpacing: "0.08em" }}>💡 Include as many of these as possible:</p>
                        <div className="columns is-multiline" style={{ margin: 0 }}>
                            {PASTE_HINTS.map(hint => (
                                <div key={hint} className="column is-6" style={{ padding: "2px 8px" }}>
                                    <span className="is-size-7 has-text-grey" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(255,140,0,0.5)", flexShrink: 0 }} />
                                        {hint}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <textarea
                        className="textarea"
                        rows={8}
                        placeholder={`Example:\nOur brand is Leaps & Rebounds. We sell premium mini trampolines at leapsandrebounds.com.\nOur brand colors are orange #FF6B00 and navy #1A1A3E. Target audience: active adults 25-45.\nCompetitors: Bellicon (premium), JumpSport (mid-range). Goal: 5X revenue by Q4 2025.\nInstagram: @leapsandrebounds TikTok: @leapsandrebounds...`}
                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", resize: "vertical" }}
                        value={pasteText}
                        onChange={e => setPasteText(e.target.value)}
                    />

                    <div className="is-flex is-align-items-center mt-3" style={{ gap: "0.75rem" }}>
                        <button
                            className={`button is-warning ${parsing ? "is-loading" : ""}`}
                            onClick={handleParse}
                            disabled={parsing || !pasteText.trim()}
                        >
                            <span className="icon"><Sparkles size={14} /></span>
                            <span>Parse with AI</span>
                        </button>
                        {parseResult && (
                            <span className="is-size-7 has-text-success">
                                ✅ Extracted {parseResult.fieldsExtracted} fields from your text
                            </span>
                        )}
                    </div>

                    {error && (
                        <p className="help is-danger mt-2">{error}</p>
                    )}
                </div>
            </div>

            {/* ── Pending Save Banner ──────────────────────────────── */}
            {pendingCount > 0 && (
                <div className="column is-12">
                    <div className="box is-flex is-align-items-center is-justify-content-space-between" style={{ background: "rgba(255,140,0,0.08)", border: "1px solid rgba(255,140,0,0.3)" }}>
                        <p className="is-size-7 has-text-weight-bold" style={{ color: "var(--accent-orange)" }}>
                            {pendingCount} field{pendingCount !== 1 ? "s" : ""} ready to save — review below and confirm
                        </p>
                        <button
                            className={`button is-warning is-small ${saving ? "is-loading" : ""}`}
                            onClick={handleSave}
                            disabled={saving}
                        >
                            <span className="icon"><Save size={14} /></span>
                            <span>Save {pendingCount} Fields</span>
                        </button>
                    </div>
                </div>
            )}

            {/* ── Field Checklist by Category ───────────────────────── */}
            {!loading && CATEGORY_ORDER.map(category => {
                const catFields = byCategory[category] ?? [];
                if (catFields.length === 0) return null;
                const isExpanded = expandedCategories[category] !== false;
                const catFilled = catFields.filter(f => (pendingEdits[f.key] ?? f.value)?.trim()).length;

                return (
                    <div key={category} className="column is-12 is-6-desktop">
                        <div className="box" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                            <div
                                className="is-flex is-align-items-center is-justify-content-space-between mb-3"
                                style={{ cursor: "pointer" }}
                                onClick={() => setExpandedCategories(prev => ({ ...prev, [category]: !isExpanded }))}
                            >
                                <div className="is-flex is-align-items-center" style={{ gap: "0.5rem" }}>
                                    <p className="is-size-7 is-uppercase has-text-weight-black has-text-grey-light" style={{ letterSpacing: "0.08em" }}>
                                        {category}
                                    </p>
                                    <span className="tag is-small is-dark" style={{ fontSize: 10 }}>{catFilled}/{catFields.length}</span>
                                </div>
                                {isExpanded ? <ChevronUp size={14} className="has-text-grey" /> : <ChevronDown size={14} className="has-text-grey" />}
                            </div>

                            {isExpanded && catFields.map(field => {
                                const pending = pendingEdits[field.key];
                                const displayValue = pending ?? field.value;
                                const isFilled = displayValue?.trim();
                                const isPending = pending !== undefined && pending !== field.value;
                                const isSaved = savedKeys.has(field.key);

                                return (
                                    <div key={field.key} className="mb-3">
                                        <div className="is-flex is-align-items-center mb-1" style={{ gap: "0.4rem" }}>
                                            {isSaved ? (
                                                <CheckCircle size={12} style={{ color: "#00d08a", flexShrink: 0 }} />
                                            ) : isFilled ? (
                                                <CheckCircle size={12} style={{ color: isPending ? "#ff8c00" : "#00d08a", flexShrink: 0 }} />
                                            ) : (
                                                <XCircle size={12} style={{ color: "rgba(255,255,255,0.2)", flexShrink: 0 }} />
                                            )}
                                            <label className="is-size-7 has-text-grey-light" style={{ fontWeight: 600 }}>
                                                {field.label}
                                                {isPending && <span style={{ color: "#ff8c00", marginLeft: 4 }}>●</span>}
                                            </label>
                                        </div>
                                        <input
                                            className="input is-small"
                                            style={{
                                                background: isPending ? "rgba(255,140,0,0.07)" : "rgba(255,255,255,0.04)",
                                                border: isPending ? "1px solid rgba(255,140,0,0.3)" : "1px solid rgba(255,255,255,0.08)",
                                                color: "#fff",
                                                transition: "all 0.2s",
                                            }}
                                            value={displayValue ?? ""}
                                            onChange={e => setPendingEdits(prev => ({ ...prev, [field.key]: e.target.value }))}
                                            placeholder={`Add ${field.label.toLowerCase()}...`}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}

            {/* ── Bottom Save ─────────────────────────────────────── */}
            {!loading && pendingCount > 0 && (
                <div className="column is-12">
                    <button
                        className={`button is-warning is-fullwidth ${saving ? "is-loading" : ""}`}
                        onClick={handleSave}
                        disabled={saving}
                    >
                        <span className="icon"><Save size={16} /></span>
                        <span>Save {pendingCount} Changed Fields</span>
                    </button>
                    <p className="has-text-grey is-size-7 has-text-centered mt-2">
                        Changes take effect immediately — no redeploy needed.
                    </p>
                </div>
            )}

            {loading && (
                <div className="column is-12 has-text-centered py-6">
                    <RefreshCw size={24} className="has-text-grey" style={{ animation: "spin 1s linear infinite" }} />
                </div>
            )}

            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}

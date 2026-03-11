"use client";
import React, { useEffect, useState } from "react";
import { BookOpen, Save, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3000";

interface ContextField {
    key: string;
    label: string;
    category: string;
    value: string;
}

export function BusinessContextEditor() {
    const [fields, setFields] = useState<ContextField[]>([]);
    const [edits, setEdits] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${BOT_URL}/admin/business-context`)
            .then(r => r.json())
            .then(data => {
                setFields(data.fields ?? []);
                const initial: Record<string, string> = {};
                (data.fields ?? []).forEach((f: ContextField) => { initial[f.key] = f.value; });
                setEdits(initial);
            })
            .catch(() => setError("Could not connect to the bot API."))
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setSaved(false);
        setError(null);
        try {
            const updates = Object.entries(edits).map(([key, value]) => ({ key, value }));
            const res = await fetch(`${BOT_URL}/admin/business-context`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ updates }),
            });
            if (!res.ok) throw new Error("Save failed");
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch {
            setError("Failed to save. Check the bot server connection.");
        } finally {
            setSaving(false);
        }
    };

    // Group fields by category
    const byCategory = fields.reduce<Record<string, ContextField[]>>((acc, f) => {
        if (!acc[f.category]) acc[f.category] = [];
        acc[f.category]!.push(f);
        return acc;
    }, {});

    const isMultiline = (key: string) =>
        ["brand.voice", "brand.usp", "brand.dos", "brand.donts", "competitors.list", "goals.current", "goals.growth_focus", "business.products"].includes(key);

    const hasChanges = fields.some(f => edits[f.key] !== f.value);

    return (
        <div className="columns is-multiline">
            {/* Header */}
            <div className="column is-12">
                <div className="box" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <div className="is-flex is-align-items-center is-justify-content-space-between">
                        <div className="is-flex is-align-items-center" style={{ gap: "0.75rem" }}>
                            <div style={{ width: 36, height: 36, background: "rgba(255,140,0,0.1)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-orange)" }}>
                                <BookOpen size={18} />
                            </div>
                            <div>
                                <p className="has-text-weight-black is-size-6">Brand Guide</p>
                                <p className="has-text-grey is-size-7">Injected into agent system prompts when <code className="has-text-warning">business_context: true</code></p>
                            </div>
                        </div>
                        <div className="is-flex is-align-items-center" style={{ gap: "0.75rem" }}>
                            {saved && (
                                <span className="is-flex is-align-items-center has-text-success is-size-7" style={{ gap: 4 }}>
                                    <CheckCircle size={14} /> Saved
                                </span>
                            )}
                            {error && (
                                <span className="is-flex is-align-items-center has-text-danger is-size-7" style={{ gap: 4 }}>
                                    <AlertCircle size={14} /> {error}
                                </span>
                            )}
                            <button
                                className={`button is-warning is-small ${saving ? "is-loading" : ""}`}
                                onClick={handleSave}
                                disabled={saving || loading}
                            >
                                <span className="icon"><Save size={14} /></span>
                                <span>Save All</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Loading */}
            {loading && (
                <div className="column is-12 has-text-centered py-6">
                    <RefreshCw size={24} className="has-text-grey spin" />
                    <p className="has-text-grey is-size-7 mt-2">Loading business context...</p>
                </div>
            )}

            {/* Categories */}
            {!loading && Object.entries(byCategory).map(([category, catFields]) => (
                <div key={category} className="column is-6">
                    <div className="box" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", height: "100%" }}>
                        <p className="is-size-7 is-uppercase has-text-weight-black has-text-grey tracking-widest mb-4" style={{ letterSpacing: "0.1em" }}>
                            {category}
                        </p>
                        {catFields.map(field => (
                            <div key={field.key} className="mb-4">
                                <label className="label is-size-7 has-text-grey-light mb-1" style={{ fontWeight: 600 }}>
                                    {field.label}
                                </label>
                                {isMultiline(field.key) ? (
                                    <textarea
                                        className="textarea is-small"
                                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", resize: "vertical", minHeight: 80 }}
                                        value={edits[field.key] ?? ""}
                                        onChange={e => setEdits(prev => ({ ...prev, [field.key]: e.target.value }))}
                                        placeholder={`Enter ${field.label.toLowerCase()}...`}
                                        rows={3}
                                    />
                                ) : (
                                    <input
                                        className="input is-small"
                                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
                                        value={edits[field.key] ?? ""}
                                        onChange={e => setEdits(prev => ({ ...prev, [field.key]: e.target.value }))}
                                        placeholder={`Enter ${field.label.toLowerCase()}...`}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            {/* Bottom Save */}
            {!loading && (
                <div className="column is-12">
                    <button
                        className={`button is-warning is-fullwidth ${saving ? "is-loading" : ""}`}
                        onClick={handleSave}
                        disabled={saving}
                    >
                        <span className="icon"><Save size={16} /></span>
                        <span>Save Brand Guide</span>
                    </button>
                    <p className="has-text-grey is-size-7 has-text-centered mt-2">
                        Changes take effect immediately — no redeploy needed.
                    </p>
                </div>
            )}
        </div>
    );
}

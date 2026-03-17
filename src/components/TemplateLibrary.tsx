"use client";
import React, { useEffect, useState } from "react";
import { Library, ExternalLink, Plus, Search, Filter } from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3000";

const CATEGORY_COLORS: Record<string, string> = {
    "Design": "#ff6b9d",
    "Engineering": "#4da6ff",
    "Marketing": "#ff8c00",
    "Paid Media": "#a855f7",
    "Product": "#22c55e",
    "Project Management": "#06b6d4",
    "Testing": "#f59e0b",
    "Support": "#10b981",
    "Specialized": "#e879f9",
};

interface AgentTemplate {
    id: string;
    slug: string;
    name: string;
    description: string;
    category: string;
    emoji: string;
    source_url: string;
}

interface Grouped {
    [category: string]: AgentTemplate[];
}

export function TemplateLibrary() {
    const [templates, setTemplates] = useState<AgentTemplate[]>([]);
    const [grouped, setGrouped] = useState<Grouped>({});
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [spawning, setSpawning] = useState<string | null>(null);
    const [spawned, setSpawned] = useState<string | null>(null);

    useEffect(() => {
        fetch(`${BOT_URL}/admin/agents/templates`)
            .then(r => r.json())
            .then(data => {
                console.log('[TemplateLibrary] templates response:', data);
                const fetchedTemplates = Array.isArray(data) ? data : (data.templates ?? []);
                setTemplates(fetchedTemplates);

                const newGrouped: Grouped = {};
                for (const t of fetchedTemplates) {
                    if (!newGrouped[t.category]) newGrouped[t.category] = [];
                    newGrouped[t.category]!.push(t);
                }
                setGrouped(newGrouped);
            })
            .catch(() => setError("Could not load template library. Run: npx tsx scripts/seed-agent-templates.ts"))
            .finally(() => setLoading(false));
    }, []);

    const categories = Object.keys(grouped).sort();

    const filtered = templates.filter(t => {
        const matchesCategory = !activeCategory || t.category === activeCategory;
        const matchesSearch = !search ||
            t.name.toLowerCase().includes(search.toLowerCase()) ||
            t.description.toLowerCase().includes(search.toLowerCase()) ||
            t.category.toLowerCase().includes(search.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    const filteredGrouped: Grouped = {};
    for (const t of filtered) {
        if (!filteredGrouped[t.category]) filteredGrouped[t.category] = [];
        filteredGrouped[t.category]!.push(t);
    }

    const handleSpawn = async (template: AgentTemplate) => {
        setSpawning(template.slug);
        try {
            // Fetch full template with system_prompt
            const res = await fetch(`${BOT_URL}/admin/agents/templates/${template.slug}`);
            if (!res.ok) throw new Error(`Could not load template (${res.status})`);
            const full = await res.json();

            // Build payload matching AgentDef shape expected by POST /admin/agents
            const id = `agent-${Date.now()}`;
            const createRes = await fetch(`${BOT_URL}/admin/agents`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id,
                    name: full.name,
                    type: "worker",
                    specialization: full.category,
                    discordChannelId: "",
                    features: {},
                    emoji: full.emoji ?? "🤖",
                    mission: full.system_prompt.slice(0, 3000),
                    personality: "",
                    context: "",
                    constraints: "",
                }),
            });
            if (!createRes.ok) {
                const body = await createRes.json().catch(() => ({}));
                throw new Error(body.error || `Server error ${createRes.status}`);
            }
            setSpawned(template.slug);
            setTimeout(() => setSpawned(null), 3000);
        } catch (e: any) {
            setError(`Spawn failed: ${e.message}`);
        } finally {
            setSpawning(null);
        }
    };

    return (
        <div className="columns is-multiline">
            {/* Header */}
            <div className="column is-12">
                <div className="box" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <div className="is-flex is-align-items-center is-justify-content-space-between">
                        <div className="is-flex is-align-items-center" style={{ gap: "0.75rem" }}>
                            <div style={{ width: 36, height: 36, background: "rgba(255,140,0,0.1)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-orange)" }}>
                                <Library size={18} />
                            </div>
                            <div>
                                <p className="has-text-weight-black is-size-6">Agent Template Library</p>
                                <p className="has-text-grey is-size-7">{templates.length} preloaded specialist profiles · Click to spawn a new agent</p>
                            </div>
                        </div>
                        <div>
                            <span className="tag is-dark is-size-7">{templates.length} templates</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Search + Category Filter */}
            <div className="column is-12">
                <div className="is-flex" style={{ gap: "0.75rem", flexWrap: "wrap" }}>
                    <div className="control has-icons-left" style={{ flex: 1, minWidth: 200 }}>
                        <input
                            className="input is-small"
                            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
                            placeholder="Search agents..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                        <span className="icon is-left has-text-grey"><Search size={14} /></span>
                    </div>
                    <div className="is-flex" style={{ gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                        <button
                            className={`button is-small ${!activeCategory ? "is-warning" : "is-dark"}`}
                            onClick={() => setActiveCategory(null)}
                        >All</button>
                        {categories.map(cat => (
                            <button
                                key={cat}
                                className={`button is-small ${activeCategory === cat ? "is-warning" : "is-dark"}`}
                                onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                                style={{ borderLeft: `3px solid ${CATEGORY_COLORS[cat] ?? "#888"}` }}
                            >{cat}</button>
                        ))}
                    </div>
                </div>
            </div>

            {error && (
                <div className="column is-12">
                    <div className="notification is-danger is-light is-size-7">
                        <strong>⚠️ {error}</strong>
                        <br />Run the seed script first: <code>npx tsx scripts/seed-agent-templates.ts</code>
                    </div>
                </div>
            )}

            {loading && (
                <div className="column is-12 has-text-centered py-6">
                    <p className="has-text-grey is-size-7">Loading template library...</p>
                </div>
            )}

            {/* Grouped Template Cards */}
            {!loading && Object.entries(filteredGrouped).sort().map(([category, catTemplates]) => (
                <div key={category} className="column is-12">
                    <p className="is-size-7 is-uppercase has-text-weight-black mb-3"
                        style={{ letterSpacing: "0.1em", color: CATEGORY_COLORS[category] ?? "#888", borderBottom: `1px solid ${CATEGORY_COLORS[category] ?? "#888"}22`, paddingBottom: 6 }}>
                        {category} Division · {catTemplates.length} agents
                    </p>
                    <div className="columns is-multiline">
                        {catTemplates.map(template => (
                            <div key={template.slug} className="column is-4-desktop is-6-tablet is-12-mobile">
                                <div
                                    className="box"
                                    style={{
                                        background: "rgba(255,255,255,0.02)",
                                        border: `1px solid rgba(255,255,255,0.06)`,
                                        height: "100%",
                                        display: "flex",
                                        flexDirection: "column",
                                        transition: "border-color 0.2s",
                                        cursor: "default",
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.borderColor = CATEGORY_COLORS[category] ?? "#555")}
                                    onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)")}
                                >
                                    <div className="is-flex is-align-items-center mb-2" style={{ gap: "0.5rem" }}>
                                        <span style={{ fontSize: 20 }}>{template.emoji}</span>
                                        <p className="has-text-weight-black is-size-7">{template.name}</p>
                                    </div>
                                    <p className="has-text-grey is-size-7 mb-3" style={{ flex: 1, lineHeight: 1.5 }}>
                                        {template.description?.slice(0, 120)}{template.description?.length > 120 ? "..." : ""}
                                    </p>
                                    <div className="is-flex is-align-items-center is-justify-content-space-between mt-auto">
                                        <a
                                            href={template.source_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="is-size-7 has-text-grey"
                                            style={{ display: "flex", alignItems: "center", gap: 4 }}
                                        >
                                            <ExternalLink size={10} /> Source
                                        </a>
                                        <button
                                            className={`button is-small ${spawned === template.slug ? "is-success" : "is-dark"} ${spawning === template.slug ? "is-loading" : ""}`}
                                            onClick={() => handleSpawn(template)}
                                            disabled={!!spawning}
                                            style={{ borderColor: CATEGORY_COLORS[category] ?? "#555" }}
                                        >
                                            {spawned === template.slug ? (
                                                <>✅ Spawned</>
                                            ) : (
                                                <><Plus size={12} style={{ marginRight: 4 }} />Spawn Agent</>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            {!loading && filtered.length === 0 && !error && (
                <div className="column is-12 has-text-centered py-6">
                    <p className="has-text-grey is-size-7">No templates found for "{search}"</p>
                </div>
            )}
        </div>
    );
}

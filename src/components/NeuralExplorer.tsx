"use client";
import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Filter,
    Search,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
} from "lucide-react";
import { cn } from "@/app/lib/utils";

interface Fact {
    key: string;
    value: string;
    category?: string;
    updated_at: string;
}

const PAGE_SIZE = 12;
const VALUE_PREVIEW_CHARS = 220;

function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

function getSynapseColor(cat?: string): string {
    switch (cat) {
        case "Commerce":     return "var(--accent-emerald)";
        case "Operations":   return "var(--accent-orange)";
        case "Strategy":     return "var(--accent-cyan)";
        case "Intelligence": return "var(--accent-blue)";
        default:             return "#6366f1";
    }
}

function FactCard({ fact, viewMode }: { fact: Fact; viewMode: "grid" | "list" }) {
    const [expanded, setExpanded] = useState(false);
    const color = getSynapseColor(fact.category);
    const isLong = fact.value.length > VALUE_PREVIEW_CHARS;
    const displayValue = isLong && !expanded
        ? fact.value.slice(0, VALUE_PREVIEW_CHARS) + "…"
        : fact.value;

    // Human-readable key: strip known prefixes, replace underscores
    const label = fact.key
        .replace(/^agent_def:/, "")
        .replace(/_/g, " ");

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="box p-4 is-relative mb-0"
            style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.07)",
                overflow: "hidden",
                height: viewMode === "grid" ? "100%" : undefined,
            }}
        >
            {/* Accent bar */}
            <div style={{ position: "absolute", top: 0, left: 0, width: 3, height: "100%", background: color, opacity: 0.45 }} />

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {/* Top row */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{
                        fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em",
                        color, background: `${color}18`, border: `1px solid ${color}33`,
                        borderRadius: 4, padding: "2px 6px", flexShrink: 0,
                    }}>
                        {fact.category || "General"}
                    </span>
                    <span style={{ fontSize: 10, color: "#555", flexShrink: 0 }}>{timeAgo(fact.updated_at)}</span>
                </div>

                {/* Key */}
                <p className="has-text-white has-text-weight-bold" style={{ fontSize: 12, lineHeight: 1.4, wordBreak: "break-word" }}>
                    {label}
                </p>

                {/* Value */}
                <p className="has-text-grey-light" style={{ fontSize: 11, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {displayValue}
                </p>

                {/* Expand / collapse if long */}
                {isLong && (
                    <button
                        onClick={() => setExpanded(e => !e)}
                        style={{
                            all: "unset", cursor: "pointer", fontSize: 10, color: "#6366f1",
                            display: "inline-flex", alignItems: "center", gap: 3,
                        }}
                    >
                        <ChevronDown size={11} style={{ transform: expanded ? "rotate(180deg)" : undefined, transition: "transform .2s" }} />
                        {expanded ? "Show less" : `+${fact.value.length - VALUE_PREVIEW_CHARS} more chars`}
                    </button>
                )}
            </div>
        </motion.div>
    );
}

export const NeuralExplorer = ({ facts }: { facts: Fact[] }) => {
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
    const [category, setCategory] = useState("All");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(0);

    const categories = useMemo(() => {
        const cats = new Set(facts.map(f => f.category || "General"));
        return ["All", ...Array.from(cats).sort()];
    }, [facts]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return facts
            .filter(f => {
                if (category !== "All" && (f.category || "General") !== category) return false;
                if (q && !f.key.toLowerCase().includes(q) && !f.value.toLowerCase().includes(q)) return false;
                return true;
            })
            .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    }, [facts, category, search]);

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const pageFacts = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    const handleCategory = (cat: string) => { setCategory(cat); setPage(0); };
    const handleSearch = (s: string) => { setSearch(s); setPage(0); };

    // Build page number list with ellipsis
    const pageNumbers = Array.from({ length: totalPages }, (_, i) => i)
        .filter(i => i === 0 || i === totalPages - 1 || Math.abs(i - page) <= 2);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

            {/* ── Toolbar ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {/* Search + view toggle */}
                <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                    <div style={{ position: "relative", flex: 1 }}>
                        <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#555", pointerEvents: "none" }} />
                        <input
                            type="text"
                            placeholder="Search memory nodes…"
                            value={search}
                            onChange={e => handleSearch(e.target.value)}
                            style={{
                                width: "100%", paddingLeft: 30, paddingRight: 10, height: 34,
                                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                                borderRadius: 8, color: "#fff", fontSize: 12, outline: "none",
                                boxSizing: "border-box",
                            }}
                        />
                    </div>
                    <div style={{ display: "flex", gap: 2, background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 2, flexShrink: 0 }}>
                        {(["grid", "list"] as const).map(m => (
                            <button key={m} onClick={() => setViewMode(m)} style={{
                                all: "unset", cursor: "pointer", padding: "4px 10px", borderRadius: 6,
                                fontSize: 11, fontWeight: 700, textTransform: "capitalize",
                                color: viewMode === m ? "#fff" : "#555",
                                background: viewMode === m ? "rgba(255,255,255,0.1)" : "transparent",
                            }}>{m}</button>
                        ))}
                    </div>
                </div>

                {/* Category pills */}
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {categories.map(cat => (
                        <button key={cat} onClick={() => handleCategory(cat)} style={{
                            all: "unset", cursor: "pointer", fontSize: 10, fontWeight: 700,
                            textTransform: "uppercase", letterSpacing: "0.06em", borderRadius: 6, padding: "3px 9px",
                            background: category === cat ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.04)",
                            border: category === cat ? "1px solid rgba(99,102,241,0.5)" : "1px solid transparent",
                            color: category === cat ? "#818cf8" : "#666",
                        }}>{cat}</button>
                    ))}
                </div>
            </div>

            {/* ── Stats bar ── */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, color: "#555" }}>
                    {filtered.length === facts.length
                        ? `${facts.length} nodes`
                        : `${filtered.length} of ${facts.length} nodes`}
                    {totalPages > 1 && ` · page ${page + 1} of ${totalPages}`}
                </span>
                {search && (
                    <button onClick={() => handleSearch("")} style={{ all: "unset", cursor: "pointer", fontSize: 10, color: "#555" }}>
                        Clear ✕
                    </button>
                )}
            </div>

            {/* ── Cards ── */}
            {pageFacts.length === 0 ? (
                <div style={{ padding: "3rem", textAlign: "center", border: "2px dashed rgba(255,255,255,0.05)", borderRadius: 12 }}>
                    <Filter size={28} style={{ color: "#333", margin: "0 auto 0.75rem" }} />
                    <p style={{ fontSize: 13, color: "#555" }}>No memory nodes found</p>
                    {search && <p style={{ fontSize: 11, color: "#444", marginTop: 4 }}>Try a different search term</p>}
                </div>
            ) : (
                <AnimatePresence mode="popLayout">
                    <div className={cn("columns is-multiline")} style={{ rowGap: "0.75rem" }}>
                        {pageFacts.map(fact => (
                            <div key={fact.key} className={cn("column", viewMode === "grid" ? "is-4" : "is-12")}>
                                <FactCard fact={fact} viewMode={viewMode} />
                            </div>
                        ))}
                    </div>
                </AnimatePresence>
            )}

            {/* ── Pagination ── */}
            {totalPages > 1 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", paddingTop: "0.5rem" }}>
                    <button
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0}
                        style={{
                            all: "unset", cursor: page === 0 ? "not-allowed" : "pointer",
                            padding: "5px 10px", borderRadius: 7, fontSize: 12, fontWeight: 700,
                            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)",
                            color: page === 0 ? "#333" : "#888", display: "inline-flex", alignItems: "center", gap: 4,
                        }}
                    >
                        <ChevronLeft size={13} /> Prev
                    </button>

                    {pageNumbers.map((i, idx) => {
                        const prev = pageNumbers[idx - 1];
                        const showEllipsis = prev !== undefined && i - prev > 1;
                        return (
                            <React.Fragment key={i}>
                                {showEllipsis && <span style={{ fontSize: 12, color: "#444", padding: "0 2px" }}>…</span>}
                                <button onClick={() => setPage(i)} style={{
                                    all: "unset", cursor: "pointer", minWidth: 30, height: 30,
                                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                                    borderRadius: 7, fontSize: 12, fontWeight: 700,
                                    background: page === i ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.04)",
                                    border: page === i ? "1px solid rgba(99,102,241,0.5)" : "1px solid rgba(255,255,255,0.06)",
                                    color: page === i ? "#818cf8" : "#666",
                                }}>{i + 1}</button>
                            </React.Fragment>
                        );
                    })}

                    <button
                        onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={page === totalPages - 1}
                        style={{
                            all: "unset", cursor: page === totalPages - 1 ? "not-allowed" : "pointer",
                            padding: "5px 10px", borderRadius: 7, fontSize: 12, fontWeight: 700,
                            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)",
                            color: page === totalPages - 1 ? "#333" : "#888",
                            display: "inline-flex", alignItems: "center", gap: 4,
                        }}
                    >
                        Next <ChevronRight size={13} />
                    </button>
                </div>
            )}
        </div>
    );
};

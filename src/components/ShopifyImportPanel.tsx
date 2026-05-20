"use client";
import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, RefreshCw, ArrowDownToLine, CheckCircle2, AlertCircle,
  Layers, Puzzle, ChevronRight, Globe, Link2, Plus,
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3001";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ShopifyAsset {
  key: string;
  type: "blocks" | "sections";
  name: string;
  filename: string;
  size: number;
  updated_at: string | null;
}

interface PersonalizationSection {
  id: string;
  name: string;
  shopify_section_id: string;
  active: boolean;
}

interface ImportResult {
  ok: boolean;
  snippet?: { id: string; filename: string; lines: number; already_existed: boolean; schema_stripped: boolean };
  variation?: { id: string; name: string; shopify_section_id: string };
  section?: { id: string; name: string };
  variation_error?: string;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 12,
  padding: "1.1rem",
};

const INPUT: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: "0.5rem 0.75rem",
  color: "#e2e8f0",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
};

const PURPLE = "#818cf8";

// ── Asset Row ─────────────────────────────────────────────────────────────────

function AssetRow({ asset, selected, onClick }: {
  asset: ShopifyAsset;
  selected: boolean;
  onClick: () => void;
}) {
  const isBlock = asset.type === "blocks";
  const color = isBlock ? "#a78bfa" : "#38bdf8";
  const label = isBlock ? "BLOCK" : "SECTION";
  const Icon = isBlock ? Puzzle : Layers;
  const kb = asset.size ? (asset.size / 1024).toFixed(1) : "?";
  const date = asset.updated_at
    ? new Date(asset.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "–";

  return (
    <motion.div
      whileHover={{ x: 2 }}
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: "0.75rem",
        padding: "0.65rem 0.85rem", borderRadius: 9, cursor: "pointer",
        background: selected ? `${color}10` : "rgba(255,255,255,0.02)",
        border: selected ? `1px solid ${color}40` : "1px solid rgba(255,255,255,0.05)",
        transition: "all 0.12s",
      }}
    >
      <div style={{ width: 28, height: 28, borderRadius: 7, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={13} color={color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {asset.name}
        </p>
        <p style={{ fontSize: 10, color: "#475569", margin: 0 }}>{kb} KB · {date}</p>
      </div>
      <span style={{ fontSize: 9, fontWeight: 800, color, background: `${color}18`, border: `1px solid ${color}30`, borderRadius: 8, padding: "2px 6px", letterSpacing: "0.05em", flexShrink: 0 }}>
        {label}
      </span>
      {selected && <ChevronRight size={13} color={color} style={{ flexShrink: 0 }} />}
    </motion.div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export default function ShopifyImportPanel({ themeId, onImported, onClose }: {
  themeId: number | null;
  onImported: () => void;
  onClose: () => void;
}) {
  const [assets, setAssets] = useState<ShopifyAsset[]>([]);
  const [sections, setSections] = useState<PersonalizationSection[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [selected, setSelected] = useState<ShopifyAsset | null>(null);
  const [snippetName, setSnippetName] = useState("");
  const [sectionId, setSectionId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAssets = useCallback(async () => {
    setLoadingAssets(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (themeId) params.set("theme_id", String(themeId));
      const res = await fetch(`${BOT_URL}/admin/snippets/shopify-assets?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setAssets(json.assets ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingAssets(false);
    }
  }, [themeId]);

  const loadSections = useCallback(async () => {
    try {
      const res = await fetch(`${BOT_URL}/admin/snippets/sections-list`);
      const json = await res.json();
      setSections(json.sections ?? []);
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => {
    loadAssets();
    loadSections();
  }, [loadAssets, loadSections]);

  // Auto-suggest snippet name from selected asset
  useEffect(() => {
    if (selected && !snippetName) {
      // Prefix with lrb- if not already present
      const base = selected.name.replace(/[^a-z0-9-_]/gi, "-").toLowerCase();
      setSnippetName(base.startsWith("lrb-") ? base : `lrb-${base}`);
    }
  }, [selected]);

  const handleImport = async () => {
    if (!selected || !snippetName.trim()) return;
    setImporting(true);
    setResult(null);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        asset_key: selected.key,
        snippet_name: snippetName.trim(),
      };
      if (themeId) body.theme_id = themeId;
      if (sectionId) body.section_id = sectionId;

      const res = await fetch(`${BOT_URL}/admin/snippets/import-from-shopify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json: ImportResult = await res.json();
      if (!res.ok) throw new Error((json as any).error ?? `HTTP ${res.status}`);
      setResult(json);
      if (json.ok) onImported();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setImporting(false);
    }
  };

  const filtered = assets.filter(a =>
    !search || a.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <button onClick={onClose}
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "0.4rem 0.75rem", color: "#64748b", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <X size={12} /> Back
        </button>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: "#f0ede8", margin: 0 }}>
          Import from Shopify
        </h2>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {themeId && (
            <span style={{ fontSize: 10, color: "#64748b", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "2px 8px", display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <Globe size={9} /> Theme {themeId}
            </span>
          )}
          <button onClick={loadAssets} disabled={loadingAssets}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#475569" }}>
            <RefreshCw size={13} style={loadingAssets ? { animation: "spin 1s linear infinite" } : undefined} />
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", alignItems: "start" }}>
        {/* Left: asset list */}
        <div style={CARD}>
          <p style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: "0.75rem" }}>
            {loadingAssets ? "Loading…" : `${filtered.length} blocks & sections on Shopify`}
          </p>

          {/* Search */}
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name…"
            style={{ ...INPUT, marginBottom: "0.75rem", fontSize: 12 }}
          />

          {/* List */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", maxHeight: 380, overflowY: "auto" }}>
            {loadingAssets ? (
              [0, 1, 2, 3].map(i => (
                <div key={i} style={{ height: 52, background: "rgba(255,255,255,0.03)", borderRadius: 9, animation: "pulse 1.5s infinite" }} />
              ))
            ) : filtered.length === 0 ? (
              <p style={{ fontSize: 12, color: "#475569", textAlign: "center", padding: "2rem 0" }}>
                No blocks or sections found.
              </p>
            ) : (
              filtered.map(a => (
                <AssetRow
                  key={a.key}
                  asset={a}
                  selected={selected?.key === a.key}
                  onClick={() => { setSelected(a); setResult(null); setError(null); }}
                />
              ))
            )}
          </div>
        </div>

        {/* Right: configure + import */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          <AnimatePresence mode="wait">
            {!selected ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{ ...CARD, textAlign: "center", padding: "3rem 1.5rem", border: "1px dashed rgba(255,255,255,0.06)" }}>
                <ArrowDownToLine size={24} color="#334155" style={{ margin: "0 auto 0.75rem" }} />
                <p style={{ fontSize: 12, color: "#475569" }}>Select a block or section on the left to configure the import.</p>
              </motion.div>
            ) : (
              <motion.div key="config" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>

                {/* Selected asset info */}
                <div style={{ ...CARD, border: `1px solid ${selected.type === "blocks" ? "rgba(167,139,250,0.25)" : "rgba(56,189,248,0.25)"}` }}>
                  <p style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: "0.4rem" }}>
                    Selected
                  </p>
                  <p style={{ fontSize: 13, fontWeight: 800, color: "#e2e8f0", margin: 0 }}>{selected.name}</p>
                  <p style={{ fontSize: 10, color: "#475569", margin: "0.2rem 0 0" }}>
                    {selected.key} · {selected.type}
                  </p>
                </div>

                {/* Snippet name */}
                <div>
                  <label style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, display: "block", marginBottom: "0.4rem" }}>
                    Snippet Name
                  </label>
                  <input
                    value={snippetName}
                    onChange={e => setSnippetName(e.target.value)}
                    placeholder="lrb-my-snippet"
                    style={INPUT}
                    onFocus={e => (e.currentTarget.style.borderColor = `${PURPLE}60`)}
                    onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
                  />
                  <p style={{ fontSize: 10, color: "#334155", marginTop: "0.3rem" }}>
                    Saved as <code style={{ color: PURPLE }}>{snippetName || "lrb-…"}.liquid</code> · Schema block will be stripped automatically
                  </p>
                </div>

                {/* Section picker */}
                <div>
                  <label style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, display: "block", marginBottom: "0.4rem" }}>
                    Register as Variation in Section <span style={{ color: "#334155", fontWeight: 400 }}>(optional)</span>
                  </label>
                  <select
                    value={sectionId}
                    onChange={e => setSectionId(e.target.value)}
                    style={{ ...INPUT, cursor: "pointer" }}
                  >
                    <option value="">— Skip registration —</option>
                    {sections.map(s => (
                      <option key={s.id} value={s.id} style={{ background: "#0f172a" }}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  {sectionId && (
                    <p style={{ fontSize: 10, color: "#818cf8", marginTop: "0.3rem", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                      <Link2 size={9} /> Will be added as a PAUSED variation — activate it in Website → Embeds
                    </p>
                  )}
                </div>

                {/* Error */}
                {error && (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", borderRadius: 8, padding: "0.6rem 0.9rem" }}>
                    <AlertCircle size={13} color="#f43f5e" />
                    <span style={{ fontSize: 12, color: "#f43f5e" }}>{error}</span>
                  </div>
                )}

                {/* Success result */}
                {result?.ok && (
                  <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                    style={{ background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 10, padding: "0.85rem 1rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
                      <CheckCircle2 size={14} color="#22c55e" />
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#22c55e" }}>
                        {result.snippet?.already_existed ? "Updated" : "Imported"} successfully
                      </span>
                    </div>
                    <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>
                      <code style={{ color: "#818cf8" }}>{result.snippet?.filename}</code>
                      {" · "}{result.snippet?.lines} lines
                      {result.snippet?.schema_stripped && " · schema stripped"}
                    </p>
                    {result.variation && (
                      <p style={{ fontSize: 11, color: "#64748b", margin: "0.3rem 0 0", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                        <Link2 size={9} color="#818cf8" />
                        Registered as PAUSED variation in <strong style={{ color: "#e2e8f0" }}>{result.section?.name}</strong>
                      </p>
                    )}
                    {result.variation_error && (
                      <p style={{ fontSize: 11, color: "#f59e0b", margin: "0.3rem 0 0" }}>
                        ⚠ Variation not created: {result.variation_error}
                      </p>
                    )}
                  </motion.div>
                )}

                {/* Import button */}
                <button
                  onClick={handleImport}
                  disabled={importing || !snippetName.trim()}
                  id="snippet-import-confirm"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                    background: importing ? "rgba(129,140,248,0.06)" : "linear-gradient(135deg, #818cf8, #a78bfa)",
                    border: "none", borderRadius: 10, padding: "0.85rem",
                    color: "#fff", fontWeight: 800, fontSize: 14,
                    cursor: (importing || !snippetName.trim()) ? "not-allowed" : "pointer",
                    opacity: !snippetName.trim() ? 0.5 : 1,
                    transition: "all 0.15s",
                  }}
                >
                  {importing
                    ? <><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> Importing…</>
                    : <><Plus size={14} /> Import & Register</>}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

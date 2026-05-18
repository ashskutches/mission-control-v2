"use client";
import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Image, Video, FileText, MessageSquare, Plus, Trash2,
  Filter, RefreshCw, Loader2, Tag, Link,
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3000";

interface Asset {
  id: string;
  type: "image" | "video" | "copy_block" | "testimonial";
  name: string;
  tags: string[];
  url: string | null;
  thumbnail_url: string | null;
  content: string | null;
  author: string | null;
  source: string | null;
  created_at: string;
}

const TYPE_CONFIG = {
  image:       { icon: Image,          color: "#38bdf8", label: "Image"       },
  video:       { icon: Video,          color: "#818cf8", label: "Video"       },
  copy_block:  { icon: FileText,       color: "#f59e0b", label: "Copy Block"  },
  testimonial: { icon: MessageSquare,  color: "#34d399", label: "Testimonial" },
} as const;

function AssetCard({ asset, onDelete }: { asset: Asset; onDelete: () => void }) {
  const cfg = TYPE_CONFIG[asset.type] ?? TYPE_CONFIG.copy_block;
  const Icon = cfg.icon;

  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0,
          background: `${cfg.color}12`, border: `1px solid ${cfg.color}25`,
          display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={13} color={cfg.color} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", margin: "0 0 3px",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {asset.name}
          </p>
          {asset.content && (
            <p style={{ fontSize: 11, color: "#64748b", margin: "0 0 5px", lineHeight: 1.45,
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {asset.content}
            </p>
          )}
          {asset.author && (
            <p style={{ fontSize: 10, color: "#475569", margin: "0 0 5px" }}>— {asset.author}</p>
          )}
          {asset.url && (
            <a href={asset.url} target="_blank" rel="noreferrer"
              style={{ fontSize: 10, color: "#334155", display: "flex", alignItems: "center", gap: 3, textDecoration: "none" }}>
              <Link size={9} /> {asset.url.slice(0, 55)}{asset.url.length > 55 ? "…" : ""}
            </a>
          )}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
            {asset.tags.map(t => (
              <span key={t} style={{ fontSize: 9, color: "#475569", background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)", borderRadius: 3, padding: "1px 5px" }}>
                {t}
              </span>
            ))}
          </div>
        </div>
        <button onClick={onDelete} style={{ background: "none", border: "none", cursor: "pointer",
          color: "#334155", padding: 3, flexShrink: 0 }}>
          <Trash2 size={12} />
        </button>
      </div>
    </motion.div>
  );
}

function AddAssetForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<Asset["type"]>("image");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [content, setContent] = useState("");
  const [author, setAuthor] = useState("");
  const [tags, setTags] = useState("");
  const [source, setSource] = useState("advertorial-landing");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) return;
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`${BOT_URL}/admin/landing-pages/assets`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type, name: name.trim(),
          tags: tags.split(",").map(t => t.trim()).filter(Boolean),
          url: url.trim() || null,
          content: content.trim() || null,
          author: author.trim() || null,
          source: source.trim() || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setName(""); setUrl(""); setContent(""); setAuthor(""); setTags(""); setOpen(false);
      onAdded();
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ marginBottom: 12 }}>
      {!open ? (
        <button onClick={() => setOpen(true)}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8,
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
            color: "#64748b", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
          <Plus size={12} /> Add Asset
        </button>
      ) : (
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 10, padding: "14px 16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <div>
              <label style={{ fontSize: 9, color: "#475569", fontWeight: 700, display: "block", marginBottom: 3,
                textTransform: "uppercase", letterSpacing: "0.07em" }}>Type</label>
              <select value={type} onChange={e => setType(e.target.value as Asset["type"])}
                style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
                  borderRadius: 7, color: "#e2e8f0", padding: "6px 8px", fontSize: 11, fontFamily: "inherit", outline: "none" }}>
                {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 9, color: "#475569", fontWeight: 700, display: "block", marginBottom: 3,
                textTransform: "uppercase", letterSpacing: "0.07em" }}>Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Hero lifestyle image"
                style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
                  borderRadius: 7, color: "#e2e8f0", padding: "6px 8px", fontSize: 11, fontFamily: "inherit",
                  outline: "none", boxSizing: "border-box" }} />
            </div>
          </div>

          {(type === "image" || type === "video") && (
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 9, color: "#475569", fontWeight: 700, display: "block", marginBottom: 3,
                textTransform: "uppercase", letterSpacing: "0.07em" }}>CDN URL</label>
              <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://cdn.shopify.com/…"
                style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
                  borderRadius: 7, color: "#e2e8f0", padding: "6px 8px", fontSize: 11, fontFamily: "inherit",
                  outline: "none", boxSizing: "border-box" }} />
            </div>
          )}

          {(type === "copy_block" || type === "testimonial") && (
            <>
              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 9, color: "#475569", fontWeight: 700, display: "block", marginBottom: 3,
                  textTransform: "uppercase", letterSpacing: "0.07em" }}>Content</label>
                <textarea value={content} onChange={e => setContent(e.target.value)} rows={3}
                  placeholder="Copy text or testimonial quote…"
                  style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
                    borderRadius: 7, color: "#e2e8f0", padding: "6px 8px", fontSize: 11, fontFamily: "inherit",
                    outline: "none", resize: "vertical", boxSizing: "border-box" }} />
              </div>
              {type === "testimonial" && (
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 9, color: "#475569", fontWeight: 700, display: "block", marginBottom: 3,
                    textTransform: "uppercase", letterSpacing: "0.07em" }}>Author</label>
                  <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="Linda M., 62"
                    style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
                      borderRadius: 7, color: "#e2e8f0", padding: "6px 8px", fontSize: 11, fontFamily: "inherit",
                      outline: "none", boxSizing: "border-box" }} />
                </div>
              )}
            </>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 9, color: "#475569", fontWeight: 700, display: "block", marginBottom: 3,
                textTransform: "uppercase", letterSpacing: "0.07em" }}>Tags (comma-sep)</label>
              <input value={tags} onChange={e => setTags(e.target.value)} placeholder="hero, lifestyle, pain"
                style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
                  borderRadius: 7, color: "#e2e8f0", padding: "6px 8px", fontSize: 11, fontFamily: "inherit",
                  outline: "none", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ fontSize: 9, color: "#475569", fontWeight: 700, display: "block", marginBottom: 3,
                textTransform: "uppercase", letterSpacing: "0.07em" }}>Source</label>
              <input value={source} onChange={e => setSource(e.target.value)} placeholder="advertorial-landing"
                style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
                  borderRadius: 7, color: "#e2e8f0", padding: "6px 8px", fontSize: 11, fontFamily: "inherit",
                  outline: "none", boxSizing: "border-box" }} />
            </div>
          </div>

          {err && <p style={{ fontSize: 11, color: "#ef4444", margin: "0 0 8px" }}>{err}</p>}

          <div style={{ display: "flex", gap: 8 }}>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={submit}
              disabled={loading || !name.trim()}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 7,
                background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.25)", color: "#34d399",
                fontSize: 12, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer" }}>
              {loading ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> : <Plus size={11} />}
              Add
            </motion.button>
            <button onClick={() => setOpen(false)}
              style={{ padding: "6px 12px", borderRadius: 7, background: "none",
                border: "1px solid rgba(255,255,255,0.07)", color: "#475569", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ContentLibrary() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState<string>("all");

  const fetch_ = useCallback(async (type?: string) => {
    setLoading(true);
    try {
      const url = type && type !== "all"
        ? `${BOT_URL}/admin/landing-pages/assets?type=${type}`
        : `${BOT_URL}/admin/landing-pages/assets`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      setAssets(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch_(activeType === "all" ? undefined : activeType); }, [activeType, fetch_]);

  const deleteAsset = async (id: string) => {
    await fetch(`${BOT_URL}/admin/landing-pages/assets/${id}`, { method: "DELETE" });
    setAssets(prev => prev.filter(a => a.id !== id));
  };

  const tabs = [
    { key: "all", label: "All", color: "#94a3b8" },
    ...Object.entries(TYPE_CONFIG).map(([k, v]) => ({ key: k, label: v.label, color: v.color })),
  ];

  const grouped = activeType === "all"
    ? Object.entries(TYPE_CONFIG).reduce((acc, [type]) => {
        const items = assets.filter(a => a.type === type);
        if (items.length) acc[type] = items;
        return acc;
      }, {} as Record<string, Asset[]>)
    : { [activeType]: assets };

  return (
    <div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <h2 style={{ fontSize: 13, fontWeight: 800, color: "#e2e8f0", margin: "0 0 2px",
            textTransform: "uppercase", letterSpacing: "0.08em" }}>Content Library</h2>
          <p style={{ fontSize: 10, color: "#334155", margin: 0 }}>{assets.length} assets</p>
        </div>
        <button onClick={() => fetch_(activeType === "all" ? undefined : activeType)}
          style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, padding: "4px 10px",
            borderRadius: 7, cursor: "pointer", background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)", color: "#475569" }}>
          <RefreshCw size={10} />
        </button>
      </div>

      {/* Type filter tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveType(t.key)}
            style={{ padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer",
              fontFamily: "inherit", textTransform: "uppercase", letterSpacing: "0.06em",
              background: activeType === t.key ? `${t.color}18` : "rgba(255,255,255,0.03)",
              border: `1px solid ${activeType === t.key ? t.color + "35" : "rgba(255,255,255,0.07)"}`,
              color: activeType === t.key ? t.color : "#475569" }}>
            {t.label}
          </button>
        ))}
      </div>

      <AddAssetForm onAdded={() => fetch_(activeType === "all" ? undefined : activeType)} />

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#334155", fontSize: 12, padding: "1rem 0" }}>
          <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Loading assets…
        </div>
      ) : (
        <div>
          {Object.entries(grouped).map(([type, items]) => {
            const cfg = TYPE_CONFIG[type as keyof typeof TYPE_CONFIG];
            const Icon = cfg?.icon ?? FileText;
            return (
              <div key={type} style={{ marginBottom: 20 }}>
                {activeType === "all" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <Icon size={11} color={cfg?.color ?? "#94a3b8"} />
                    <span style={{ fontSize: 10, fontWeight: 800, color: "#475569", textTransform: "uppercase",
                      letterSpacing: "0.09em" }}>{cfg?.label ?? type}</span>
                    <span style={{ fontSize: 10, color: "#334155" }}>({items.length})</span>
                  </div>
                )}
                <div style={{ display: "grid", gap: 6 }}>
                  <AnimatePresence>
                    {items.map(a => (
                      <AssetCard key={a.id} asset={a} onDelete={() => deleteAsset(a.id)} />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
          {assets.length === 0 && (
            <div style={{ textAlign: "center", padding: "1.5rem", color: "#334155", fontSize: 12,
              background: "rgba(255,255,255,0.015)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.05)" }}>
              No assets yet — add one above or trigger DB migrations to seed defaults.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

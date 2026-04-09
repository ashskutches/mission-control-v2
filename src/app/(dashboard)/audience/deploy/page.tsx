"use client";
import React, { useState } from "react";
import { Rocket, RefreshCw, CloudUpload, AlertTriangle, Check } from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3001";

interface ShopifyTheme { id: number; name: string; role: "main" | "unpublished" | "demo"; created_at: string; updated_at: string; }
interface DeployResult { theme_id: number; deployed: string[]; failed: { key: string; error: string }[]; ok: boolean; }

const CARD = { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "1.25rem" } as const;
const INPUT_STYLE = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#e2e8f0" } as const;

export default function DeployPage() {
  const [themes, setThemes] = useState<ShopifyTheme[]>([]);
  const [selectedThemeId, setSelectedThemeId] = useState<number | null>(null);
  const [loadingThemes, setLoadingThemes] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<DeployResult | null>(null);
  const [error, setError] = useState("");

  const loadThemes = async () => {
    setLoadingThemes(true); setError(""); setDeployResult(null);
    try {
      const res = await fetch(`${BOT_URL}/admin/intelligence/theme/list`);
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to list themes");
      const data = await res.json();
      const list: ShopifyTheme[] = data.themes ?? [];
      setThemes(list);
      const sandbox = list.find(t => t.name.toLowerCase().includes("dynamic sections") || t.name.toLowerCase().includes("intelligence"));
      const fallback = list.find(t => t.role !== "main") ?? list[0];
      setSelectedThemeId((sandbox ?? fallback)?.id ?? null);
    } catch (e: any) { setError(e.message); }
    finally { setLoadingThemes(false); }
  };

  const deployAll = async () => {
    if (!selectedThemeId) return;
    setDeploying(true); setDeployResult(null); setError("");
    try {
      const res = await fetch(`${BOT_URL}/admin/intelligence/theme/deploy`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme_id: selectedThemeId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Deploy failed");
      setDeployResult(data);
    } catch (e: any) { setError(e.message); }
    finally { setDeploying(false); }
  };

  const selectedTheme = themes.find(t => t.id === selectedThemeId);

  return (
    <div>
      <div style={{ ...CARD, marginBottom: "1.5rem", border: "1px solid rgba(167,139,250,0.2)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem", marginBottom: "1rem" }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(167,139,250,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Rocket size={16} color="#a78bfa" />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 800, color: "#e2e8f0", marginBottom: "0.25rem" }}>Deploy Assets to Theme</p>
            <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>
              Pushes <code style={{ color: "#a78bfa" }}>lrb-personalization.js</code>, all snippets, and the two auto-generated embed sections to your theme.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginBottom: "1rem" }}>
          {[
            { step: "1", label: "Deploy All Assets", detail: "Pushes the JS, all snippets, and generates snippets/lrb-template-pool.liquid + sections/lrb-embed.liquid", color: "#a78bfa" },
            { step: "2", label: "Add pool to theme.liquid (once)", detail: "In Shopify → Edit Code → layout/theme.liquid, paste the render tag just before </body>. Do this once.", color: "#38bdf8", code: "{%- render 'lrb-template-pool' -%}" },
            { step: "3", label: "Add lrb-embed section per page", detail: "In the page editor, add the \"LRB Intelligence Embed\" section wherever you want sections to appear. Set its Embed ID to the UUID from Audience → Embeds.", color: "#34d399" },
          ].map(({ step, label, detail, color, code }) => (
            <div key={step} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", padding: "0.6rem 0.75rem", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 8 }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", background: `${color}18`, border: `1px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color }}>{step}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", marginBottom: "0.2rem" }}>{label}</p>
                <p style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>{detail}</p>
                {code && <code style={{ display: "inline-block", marginTop: "0.35rem", fontSize: 11, color: "#38bdf8", background: "rgba(56,189,248,0.07)", border: "1px solid rgba(56,189,248,0.15)", borderRadius: 5, padding: "2px 8px", fontFamily: "monospace" }}>{code}</code>}
              </div>
            </div>
          ))}
        </div>

        {themes.length > 0 && (
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700, display: "block", marginBottom: "0.4rem" }}>Target Theme</label>
            <select value={selectedThemeId ?? ""} onChange={e => setSelectedThemeId(Number(e.target.value))}
              style={{ ...INPUT_STYLE, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "0.5rem 0.75rem", fontSize: 13, width: "100%", cursor: "pointer" }}>
              {themes.map(t => <option key={t.id} value={t.id} style={{ background: "#0f172a" }}>{t.name} {t.role === "main" ? "🟢 LIVE" : ""}</option>)}
            </select>
            {selectedTheme && (
              <p style={{ fontSize: 10, color: "#475569", marginTop: "0.3rem" }}>
                ID: {selectedTheme.id} ·{" "}
                {selectedTheme.role === "main"
                  ? <span style={{ color: "#f43f5e" }}>⚠ This is your live theme — deploying will affect customers</span>
                  : <span style={{ color: "#34d399" }}>Safe sandbox theme</span>}
              </p>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button onClick={loadThemes} disabled={loadingThemes} className="button is-small"
            style={{ background: "rgba(56,189,248,0.1)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.2)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <RefreshCw size={12} className={loadingThemes ? "spin" : ""} />
            {themes.length ? "Refresh Themes" : "List Themes"}
          </button>
          <button onClick={deployAll} disabled={deploying || !selectedThemeId} className="button is-small"
            style={{ background: deploying ? "rgba(167,139,250,0.05)" : "rgba(167,139,250,0.15)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.25)", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <CloudUpload size={13} /> {deploying ? "Deploying..." : "Deploy All Assets"}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ ...CARD, border: "1px solid rgba(244,63,94,0.3)", background: "rgba(244,63,94,0.05)", marginBottom: "1rem", display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
          <AlertTriangle size={16} color="#f43f5e" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12, color: "#f43f5e" }}>{error}</p>
        </div>
      )}

      {deployResult && (
        <div style={{ ...CARD, border: `1px solid ${deployResult.ok ? "rgba(52,211,153,0.3)" : "rgba(244,63,94,0.3)"}`, marginBottom: "1.5rem" }}>
          <p style={{ fontWeight: 700, color: deployResult.ok ? "#34d399" : "#f43f5e", marginBottom: "0.5rem" }}>
            {deployResult.ok ? "✓ Deploy successful" : "⚠ Partial deploy"} — {deployResult.deployed.length} file{deployResult.deployed.length !== 1 ? "s" : ""}
          </p>
          {deployResult.deployed.map(k => <div key={k} style={{ fontSize: 11, color: "#34d399", fontFamily: "monospace", marginBottom: 2 }}>+ {k}</div>)}
          {deployResult.failed.map(f => <div key={f.key} style={{ fontSize: 11, color: "#f43f5e", fontFamily: "monospace", marginBottom: 2 }}>✗ {f.key}: {f.error}</div>)}
        </div>
      )}

      {themes.length > 0 && (
        <div style={CARD}>
          <p style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: "1rem" }}>Installed Themes</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {themes.map(t => (
              <div key={t.id} onClick={() => setSelectedThemeId(t.id)} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem", borderRadius: 8, cursor: "pointer", background: selectedThemeId === t.id ? "rgba(167,139,250,0.06)" : "rgba(255,255,255,0.02)", border: selectedThemeId === t.id ? "1px solid rgba(167,139,250,0.3)" : t.role === "main" ? "1px solid rgba(52,211,153,0.2)" : "1px solid rgba(255,255,255,0.04)", transition: "all 0.15s" }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 700, color: "#e2e8f0", fontSize: 13, marginBottom: 2 }}>{t.name}</p>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: t.role === "main" ? "#34d399" : "#64748b", background: t.role === "main" ? "rgba(52,211,153,0.1)" : "rgba(100,116,139,0.1)", padding: "1px 7px", borderRadius: 10, textTransform: "uppercase" }}>
                      {t.role === "main" ? "Live" : "Unpublished"}
                    </span>
                    <span style={{ fontSize: 10, color: "#334155" }}>ID: {t.id}</span>
                  </div>
                </div>
                {selectedThemeId === t.id && <Check size={14} color="#a78bfa" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {themes.length === 0 && !loadingThemes && (
        <div style={{ ...CARD, textAlign: "center", padding: "2.5rem" }}>
          <Rocket size={28} color="#334155" style={{ margin: "0 auto 0.75rem" }} />
          <p style={{ color: "#475569", fontSize: 13 }}>Click &quot;List Themes&quot; to see your Shopify themes.</p>
          <p style={{ color: "#334155", fontSize: 11, marginTop: "0.4rem" }}>Requires <code>read_themes</code> scope on the Gravity Claw app.</p>
        </div>
      )}
    </div>
  );
}

"use client";
/**
 * SectionLiveKPIs — Live KPI auto-refresh strip
 *
 * Calls POST /admin/live-kpis/:section on mount (with debounce to avoid spam).
 * After the call, SectionMetricsPanel auto-refreshes (via refreshTrigger).
 *
 * Shows a small "live data loading" badge + last-sync timestamp.
 * Gracefully handles errors (missing API keys = shows status card from backend).
 */

import React, { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Zap, CheckCircle, AlertCircle } from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3001";

// Sections that support live KPI prefill
const LIVE_KPI_SECTIONS = new Set(["email", "ads", "products", "orders"]);

interface SectionLiveKPIsProps {
    sectionId: string;
    accentColor: string;
    onRefreshed: () => void; // called after successful data load
}

type Status = "idle" | "loading" | "ok" | "error";

export default function SectionLiveKPIs({ sectionId, accentColor, onRefreshed }: SectionLiveKPIsProps) {
    const [status, setStatus] = useState<Status>("idle");
    const [lastSync, setLastSync] = useState<string | null>(null);
    const [errorCount, setErrorCount] = useState(0);
    const hasLoaded = useRef(false);

    const refresh = useCallback(async (manual = false) => {
        if (status === "loading") return;
        if (!LIVE_KPI_SECTIONS.has(sectionId)) return;

        setStatus("loading");
        try {
            const res = await fetch(`${BOT_URL}/admin/live-kpis/${sectionId}`, {
                method: "POST",
                signal: AbortSignal.timeout(20000),
            });
            const data = await res.json();
            setErrorCount(data.errors?.length ?? 0);
            setLastSync(new Date().toLocaleTimeString());
            setStatus(data.errors?.length > 0 ? "error" : "ok");
            onRefreshed();
        } catch (err: any) {
            setStatus("error");
            setErrorCount(1);
        }
    }, [sectionId, status, onRefreshed]);

    // Auto-refresh on mount (once)
    useEffect(() => {
        if (!hasLoaded.current && LIVE_KPI_SECTIONS.has(sectionId)) {
            hasLoaded.current = true;
            // Small delay to let page settle
            const t = setTimeout(() => refresh(false), 600);
            return () => clearTimeout(t);
        }
    }, [sectionId, refresh]);

    // Don't render for unsupported sections
    if (!LIVE_KPI_SECTIONS.has(sectionId)) return null;

    const StatusIcon = status === "ok" ? CheckCircle : status === "error" ? AlertCircle : Zap;
    const statusColor = status === "ok"
        ? (errorCount > 0 ? "#f59e0b" : "#22c55e")
        : status === "error" ? "#f43f5e"
        : accentColor;
    const statusLabel = status === "idle" ? "Live data"
        : status === "loading" ? "Syncing live data…"
        : status === "ok" && errorCount === 0 ? `Live — synced ${lastSync}`
        : status === "ok" && errorCount > 0 ? `Partial (${errorCount} API key missing)`
        : `Sync issue — check API keys`;

    return (
        <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
                display: "flex", alignItems: "center", gap: 8,
                background: `${statusColor}08`,
                border: `1px solid ${statusColor}18`,
                borderRadius: 8, padding: "5px 10px",
                marginBottom: "0.75rem",
            }}
        >
            <AnimatePresence mode="wait">
                {status === "loading" ? (
                    <motion.div key="spin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <RefreshCw size={10} color={statusColor} style={{ animation: "spin 1s linear infinite" }} />
                    </motion.div>
                ) : (
                    <motion.div key="icon" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <StatusIcon size={10} color={statusColor} />
                    </motion.div>
                )}
            </AnimatePresence>

            <span style={{
                fontSize: 10, fontWeight: 700, color: statusColor,
                letterSpacing: "0.04em", flex: 1,
            }}>
                {statusLabel}
            </span>

            {(status === "ok" || status === "error") && (
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => refresh(true)}
                    aria-label="Refresh live KPIs"
                    style={{
                        background: "none", border: "none", cursor: "pointer",
                        color: "#555", padding: 0, display: "flex", alignItems: "center",
                    }}
                >
                    <RefreshCw size={9} />
                </motion.button>
            )}
        </motion.div>
    );
}

// Add spin keyframe to global styles
// (defined in globals.css or tailwind; if not present, add once)
const style = typeof document !== "undefined" ? (() => {
    if (document.querySelector("[data-spin-kf]")) return;
    const s = document.createElement("style");
    s.setAttribute("data-spin-kf", "1");
    s.textContent = "@keyframes spin { to { transform: rotate(360deg); } }";
    document.head.appendChild(s);
})() : undefined;
void style;

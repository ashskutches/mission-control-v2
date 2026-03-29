"use client";
/**
 * InsightReviewPanel — Human Approval Queue
 *
 * Slide-out panel that shows full insight/draft content and provides
 * content-type-aware action buttons. Agents draft; humans decide.
 *
 * Supported types:
 *   - klaviyo_draft   → shows email body + "Open in Klaviyo" link
 *   - social_draft    → shows caption + "Copy Caption" + "Mark Scheduled"
 *   - review_reply    → shows reply text + "Copy Reply"
 *   - product_change  → shows proposed diff + "Mark Reviewed"
 *   - suggestion      → generic insight + "Mark Done"
 *   - critical_issue  → alert style + "Acknowledge" + "Create Routine"
 *   - integration_request → shows request detail + "Request Access"
 */

import React, { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    X, Mail, Share2, Star, Package, AlertCircle, Lightbulb, Zap,
    ExternalLink, Copy, Check, Clock, ChevronRight, Trash2, RefreshCw,
    Brain, Flag, Shield,
} from "lucide-react";
import { MarkdownMessage } from "@/components/MarkdownMessage";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3000";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Insight {
    id: string;
    type: string;
    title: string;
    body?: string;
    section?: string;
    priority?: number;
    status: string;
    agent_id?: string;
    agent_name?: string;
    created_at: string;
    metadata?: Record<string, any>;
}

interface InsightReviewPanelProps {
    insight: Insight | null;
    onClose: () => void;
    onStatusChange?: (id: string, status: string) => void;
}

// ── Content type config ───────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, {
    icon: React.ElementType;
    color: string;
    label: string;
    badge: string;
}> = {
    klaviyo_draft:       { icon: Mail,         color: "#a78bfa", label: "Email Draft",        badge: "Email Draft" },
    social_draft:        { icon: Share2,        color: "#e879f9", label: "Social Post Draft",  badge: "Social Draft" },
    review_reply:        { icon: Star,          color: "#fbbf24", label: "Review Reply Draft", badge: "Review Reply" },
    product_change:      { icon: Package,       color: "#34d399", label: "Product Proposal",   badge: "Product Change" },
    suggestion:          { icon: Lightbulb,     color: "#f59e0b", label: "Suggestion",         badge: "Suggestion" },
    critical_issue:      { icon: AlertCircle,   color: "#f43f5e", label: "Critical Issue",     badge: "🚨 Critical" },
    integration_request: { icon: Zap,           color: "#38bdf8", label: "Integration Request", badge: "Integration" },
    win:                 { icon: Zap,           color: "#22c55e", label: "Agent Win",          badge: "✅ Win" },
};

function getTypeConfig(type: string) {
    return TYPE_CONFIG[type] ?? TYPE_CONFIG["suggestion"];
}

// ── Action buttons ─────────────────────────────────────────────────────────────

function ActionButton({
    label, icon: Icon, onClick, variant = "default", disabled = false,
}: {
    label: string;
    icon?: React.ElementType;
    onClick: () => void;
    variant?: "default" | "primary" | "danger" | "ghost";
    disabled?: boolean;
}) {
    const colors = {
        default: { bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.1)", text: "#ccc" },
        primary: { bg: "rgba(255,140,0,0.15)",  border: "rgba(255,140,0,0.3)",   text: "#ffa500" },
        danger:  { bg: "rgba(244,63,94,0.1)",   border: "rgba(244,63,94,0.25)",  text: "#f43f5e" },
        ghost:   { bg: "transparent",           border: "transparent",           text: "#555" },
    }[variant];

    return (
        <motion.button
            whileHover={{ scale: disabled ? 1 : 1.02 }}
            whileTap={{ scale: disabled ? 1 : 0.98 }}
            onClick={onClick}
            disabled={disabled}
            style={{
                display: "flex", alignItems: "center", gap: 6,
                background: colors.bg, border: `1px solid ${colors.border}`,
                borderRadius: 8, padding: "7px 12px", cursor: disabled ? "not-allowed" : "pointer",
                color: disabled ? "#444" : colors.text, fontSize: 11, fontWeight: 700,
                letterSpacing: "0.04em", opacity: disabled ? 0.5 : 1,
                fontFamily: "inherit",
            }}
        >
            {Icon && <Icon size={12} />}
            {label}
        </motion.button>
    );
}

// ── Feedback form ─────────────────────────────────────────────────────────────

function RejectForm({ onSubmit, onCancel }: { onSubmit: (reason: string) => void; onCancel: () => void }) {
    const [reason, setReason] = useState("");

    return (
        <div style={{ background: "rgba(244,63,94,0.06)", border: "1px solid rgba(244,63,94,0.15)", borderRadius: 10, padding: 14, marginTop: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#f43f5e", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Rejection Reason (helps agents improve)
            </p>
            <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g. Tone too salesy, image concept off-brand, wrong segment…"
                rows={3}
                style={{
                    width: "100%", resize: "none", background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "8px 10px",
                    color: "#ccc", fontSize: 12, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
                }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <ActionButton label="Submit Rejection" icon={Trash2} onClick={() => onSubmit(reason)} variant="danger" />
                <ActionButton label="Cancel" onClick={onCancel} variant="ghost" />
            </div>
        </div>
    );
}

// ── Content renderers by type ─────────────────────────────────────────────────

function EmailDraftContent({ insight, onAction }: { insight: Insight; onAction: (action: string) => void }) {
    const [copied, setCopied] = useState(false);

    const klaviyoUrl = process.env.NEXT_PUBLIC_KLAVIYO_ACCOUNT_URL ?? "https://www.klaviyo.com/dashboard";

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.15)", borderRadius: 10, padding: 14 }}>
                <p style={{ fontSize: 10, fontWeight: 800, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>Email Body Preview</p>
                <div style={{ fontSize: 12, color: "#ccc", lineHeight: 1.6, maxHeight: 300, overflowY: "auto" }} className="custom-scrollbar">
                    <MarkdownMessage content={insight.body ?? "_No body provided_"} />
                </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <ActionButton
                    label="Open Klaviyo Drafts"
                    icon={ExternalLink}
                    onClick={() => window.open(klaviyoUrl, "_blank")}
                    variant="primary"
                />
                <ActionButton
                    label={copied ? "Copied!" : "Copy Body"}
                    icon={copied ? Check : Copy}
                    onClick={() => {
                        navigator.clipboard.writeText(insight.body ?? "");
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                    }}
                />
                <ActionButton label="Mark Sent" icon={Check} onClick={() => onAction("resolved")} />
            </div>
        </div>
    );
}

function SocialDraftContent({ insight, onAction }: { insight: Insight; onAction: (action: string) => void }) {
    const [copied, setCopied] = useState(false);
    const caption = insight.body ?? "";

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ background: "rgba(232,121,249,0.06)", border: "1px solid rgba(232,121,249,0.15)", borderRadius: 10, padding: 14 }}>
                <p style={{ fontSize: 10, fontWeight: 800, color: "#e879f9", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>Caption / Copy</p>
                <div style={{ fontSize: 12, color: "#ccc", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                    <MarkdownMessage content={caption} />
                </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <ActionButton
                    label={copied ? "Copied!" : "Copy Caption"}
                    icon={copied ? Check : Copy}
                    variant="primary"
                    onClick={() => {
                        navigator.clipboard.writeText(caption);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                    }}
                />
                <ActionButton label="Mark Scheduled" icon={Clock} onClick={() => onAction("resolved")} />
            </div>
        </div>
    );
}

function ReviewReplyContent({ insight, onAction }: { insight: Insight; onAction: (action: string) => void }) {
    const [copied, setCopied] = useState(false);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)", borderRadius: 10, padding: 14 }}>
                <p style={{ fontSize: 10, fontWeight: 800, color: "#fbbf24", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>Draft Reply</p>
                <div style={{ fontSize: 12, color: "#ccc", lineHeight: 1.6 }}>
                    <MarkdownMessage content={insight.body ?? "_No reply provided_"} />
                </div>
            </div>
            <p style={{ fontSize: 10, color: "#555", margin: 0 }}>
                Copy this reply → paste into Yotpo → post manually.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <ActionButton
                    label={copied ? "Copied!" : "Copy Reply"}
                    icon={copied ? Check : Copy}
                    variant="primary"
                    onClick={() => {
                        navigator.clipboard.writeText(insight.body ?? "");
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                    }}
                />
                <ActionButton label="Mark Posted" icon={Check} onClick={() => onAction("resolved")} />
            </div>
        </div>
    );
}

function ProductChangeContent({ insight, onAction }: { insight: Insight; onAction: (action: string) => void }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.15)", borderRadius: 10, padding: 14 }}>
                <p style={{ fontSize: 10, fontWeight: 800, color: "#34d399", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>Proposed Changes</p>
                <div style={{ fontSize: 12, color: "#ccc", lineHeight: 1.6, fontFamily: "monospace", background: "rgba(0,0,0,0.2)", padding: 10, borderRadius: 6, maxHeight: 280, overflowY: "auto" }}>
                    <MarkdownMessage content={insight.body ?? "_No changes specified_"} />
                </div>
            </div>
            <p style={{ fontSize: 10, color: "#f59e0b", margin: 0 }}>
                ⚠️ Review in Shopify Admin before applying. This is a proposal only — no changes have been made.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <ActionButton
                    label="Open Shopify Admin"
                    icon={ExternalLink}
                    onClick={() => window.open(`https://${process.env.NEXT_PUBLIC_SHOPIFY_DOMAIN}/admin/products`, "_blank")}
                    variant="primary"
                />
                <ActionButton label="Mark Reviewed" icon={Check} onClick={() => onAction("resolved")} />
            </div>
        </div>
    );
}

function GenericContent({ insight, onAction }: { insight: Insight; onAction: (action: string) => void }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 13, color: "#ccc", lineHeight: 1.7 }}>
                    <MarkdownMessage content={insight.body ?? "_No additional detail_"} />
                </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <ActionButton label="Mark Done" icon={Check} onClick={() => onAction("resolved")} variant="primary" />
            </div>
        </div>
    );
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export default function InsightReviewPanel({ insight, onClose, onStatusChange }: InsightReviewPanelProps) {
    const [showReject, setShowReject] = useState(false);
    const [isActing, setIsActing] = useState(false);
    const [actionDone, setActionDone] = useState<string | null>(null);

    // Reset state when insight changes
    useEffect(() => {
        setShowReject(false);
        setActionDone(null);
        setIsActing(false);
    }, [insight?.id]);

    const updateStatus = useCallback(async (status: string, feedback?: string) => {
        if (!insight || isActing) return;
        setIsActing(true);
        try {
            await fetch(`${BOT_URL}/admin/insights/${insight.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status, feedback }),
                signal: AbortSignal.timeout(5000),
            });
            setActionDone(status);
            onStatusChange?.(insight.id, status);
            // Auto-close after 1.2s
            setTimeout(onClose, 1200);
        } catch (err: any) {
            console.error("Status update failed:", err.message);
        } finally {
            setIsActing(false);
        }
    }, [insight, isActing, onClose, onStatusChange]);

    const handleAction = useCallback((status: string) => {
        updateStatus(status);
    }, [updateStatus]);

    const handleReject = useCallback((reason: string) => {
        updateStatus("rejected", reason);
        setShowReject(false);
    }, [updateStatus]);

    if (!insight) return null;

    const cfg = getTypeConfig(insight.type);
    const Icon = cfg.icon;
    const priorityColor = (insight.priority ?? 5) >= 8 ? "#f43f5e" : (insight.priority ?? 5) >= 6 ? "#f59e0b" : "#555";

    return (
        <AnimatePresence>
            <motion.div
                key="overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                style={{
                    position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
                    zIndex: 1000, backdropFilter: "blur(4px)",
                }}
            />
            <motion.div
                key="panel"
                initial={{ x: "100%", opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: "100%", opacity: 0 }}
                transition={{ type: "spring", damping: 28, stiffness: 300 }}
                style={{
                    position: "fixed", right: 0, top: 0, bottom: 0,
                    width: "min(520px, 92vw)",
                    background: "linear-gradient(180deg, #111 0%, #0d0d0d 100%)",
                    borderLeft: `1px solid ${cfg.color}22`,
                    zIndex: 1001, overflowY: "auto", display: "flex", flexDirection: "column",
                    boxShadow: `-20px 0 60px rgba(0,0,0,0.6)`,
                }}
                className="custom-scrollbar"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${cfg.color}15`, border: `1px solid ${cfg.color}25`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <Icon size={16} color={cfg.color} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 9, fontWeight: 800, color: cfg.color, background: `${cfg.color}15`, border: `1px solid ${cfg.color}25`, borderRadius: 4, padding: "1px 7px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                                    {cfg.badge}
                                </span>
                                {insight.section && (
                                    <span style={{ fontSize: 9, fontWeight: 800, color: "#555", background: "rgba(255,255,255,0.04)", borderRadius: 4, padding: "1px 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                        {insight.section}
                                    </span>
                                )}
                                {insight.priority !== undefined && (
                                    <span style={{ fontSize: 9, fontWeight: 800, color: priorityColor, marginLeft: "auto" }}>
                                        P{insight.priority}/10
                                    </span>
                                )}
                            </div>
                            <h2 style={{ fontSize: 15, fontWeight: 800, color: "#fff", margin: 0, lineHeight: 1.3 }}>
                                {insight.title}
                            </h2>
                        </div>
                        <button
                            onClick={onClose}
                            style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
                        >
                            <X size={13} color="#666" />
                        </button>
                    </div>

                    {/* Meta */}
                    <div style={{ display: "flex", gap: 12, fontSize: 10, color: "#555" }}>
                        {insight.agent_name && (
                            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <Brain size={9} color="#555" /> {insight.agent_name}
                            </span>
                        )}
                        <span>{new Date(insight.created_at).toLocaleString()}</span>
                        <span style={{ marginLeft: "auto", color: insight.status === "new" ? "#f59e0b" : insight.status === "resolved" ? "#22c55e" : "#555", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                            {insight.status}
                        </span>
                    </div>
                </div>

                {/* Content */}
                <div style={{ flex: 1, padding: "16px 20px", overflowY: "auto" }} className="custom-scrollbar">
                    {/* Success overlay */}
                    <AnimatePresence>
                        {actionDone && (
                            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                                style={{ textAlign: "center", padding: "40px 20px" }}>
                                <Check size={40} color="#22c55e" style={{ margin: "0 auto 12px" }} />
                                <p style={{ fontSize: 14, fontWeight: 800, color: "#22c55e" }}>
                                    {actionDone === "resolved" ? "Marked as done!" : "Rejected with feedback"}
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Content renderers */}
                    {!actionDone && (() => {
                        switch (insight.type) {
                            case "klaviyo_draft":
                                return <EmailDraftContent insight={insight} onAction={handleAction} />;
                            case "social_draft":
                                return <SocialDraftContent insight={insight} onAction={handleAction} />;
                            case "review_reply":
                                return <ReviewReplyContent insight={insight} onAction={handleAction} />;
                            case "product_change":
                                return <ProductChangeContent insight={insight} onAction={handleAction} />;
                            default:
                                return <GenericContent insight={insight} onAction={handleAction} />;
                        }
                    })()}

                    {/* Reject form (shown for all non-win types) */}
                    {!actionDone && insight.type !== "win" && !showReject && (
                        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                            <ActionButton
                                label="Reject & Give Feedback"
                                icon={Trash2}
                                variant="danger"
                                onClick={() => setShowReject(true)}
                            />
                        </div>
                    )}

                    {showReject && (
                        <RejectForm
                            onSubmit={handleReject}
                            onCancel={() => setShowReject(false)}
                        />
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: "12px 20px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <Shield size={11} color="#333" />
                    <p style={{ fontSize: 10, color: "#444", margin: 0 }}>
                        All agent actions are draft-only. Humans approve before anything reaches customers.
                    </p>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}

"use client";
import React, { useEffect, useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import {
    GitBranch,
    CheckCircle,
    XCircle,
    Clock,
    ChevronRight,
    Play,
    Pause,
    Unlock,
    AlertTriangle,
    BarChart3,
    RefreshCw,
    Plus,
    Eye,
    Settings,
    Search,
    Image,
    Bell,
    ShieldCheck,
    FileText,
    Zap,
} from "lucide-react";
import { WorkflowWizard } from "./WorkflowWizard";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3000";

// ─── Types ────────────────────────────────────────────────────────────────────

type WorkflowPattern = "A" | "B" | "C";
type ItemStatus = "draft" | "in-review" | "approved" | "rejected" | "deployed" | "measured";
type StepStatus = "idle" | "running" | "awaiting_approval" | "done" | "failed";
type StepType = "research" | "generate" | "notify" | "approval_gate" | "branch" | "document";
type PhaseConfig = { phase: number; name: string; description: string; enabled: boolean; steps: string[] };

interface WorkflowStep {
    id: string; type: StepType; label: string;
    config: Record<string, unknown>;
    on_success: string | null; on_failure: string | null;
}

interface Workflow {
    id: string;
    name: string;
    pattern: WorkflowPattern;
    description: string;
    active_phase: number;
    phases_config: PhaseConfig[];
    feedback_signal: string;
    enabled: boolean;
    // Pipeline fields
    steps: WorkflowStep[];
    current_step_id: string | null;
    step_status: StepStatus;
    created_at: string;
    updated_at: string;
}

interface WorkflowItem {
    id: string;
    workflow_id: string;
    type: string;
    status: ItemStatus;
    phase: number;
    title: string;
    payload: Record<string, unknown>;
    feedback: Record<string, unknown> | null;
    created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STEP_ICON: Record<StepType, React.ElementType> = {
    research: Search, generate: Image, notify: Bell,
    approval_gate: ShieldCheck, branch: GitBranch, document: FileText,
};
const STEP_COLOR: Record<StepType, string> = {
    research: "#38bdf8", generate: "#a855f7", notify: "#f59e0b",
    approval_gate: "#ff8c00", branch: "#22c55e", document: "#64748b",
};
const STEP_STATUS_COLOR: Record<StepStatus, string> = {
    idle: "#6b7280", running: "#38bdf8", awaiting_approval: "#f59e0b", done: "#22c55e", failed: "#ef4444",
};

const STATUS_META: Record<ItemStatus, { label: string; color: string; icon: React.ElementType }> = {
    "draft":     { label: "Draft",     color: "#6b7280", icon: Clock        },
    "in-review": { label: "In Review", color: "#f59e0b", icon: Eye          },
    "approved":  { label: "Approved",  color: "#22c55e", icon: CheckCircle  },
    "rejected":  { label: "Rejected",  color: "#ef4444", icon: XCircle      },
    "deployed":  { label: "Deployed",  color: "#38bdf8", icon: GitBranch    },
    "measured":  { label: "Measured",  color: "#a855f7", icon: BarChart3    },
};

const PATTERN_LABEL: Record<WorkflowPattern, string> = {
    A: "Content Flywheel",
    B: "Outreach Pipeline",
    C: "Intelligence",
};

const PATTERN_COLOR: Record<WorkflowPattern, string> = {
    A: "#ff8c00",
    B: "#38bdf8",
    C: "#a855f7",
};

// ─── Pipeline View ────────────────────────────────────────────────────────────

function PipelineView({ workflow, onApprove, onReject }: {
    workflow: Workflow;
    onApprove: (wfId: string) => Promise<void>;
    onReject: (wfId: string, feedback: string) => Promise<void>;
}) {
    const [busy, setBusy] = React.useState(false);
    const steps = workflow.steps ?? [];

    if (steps.length === 0) {
        return (
            <div style={{ padding: "0.75rem 0", opacity: 0.4, display: "flex", alignItems: "center", gap: 8 }}>
                <Zap size={12} style={{ color: "#6b7280" }} />
                <span style={{ fontSize: 11, color: "#6b7280" }}>No pipeline steps defined — create a new workflow to add steps.</span>
            </div>
        );
    }

    const statusColor = STEP_STATUS_COLOR[workflow.step_status ?? "idle"];

    return (
        <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <p style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", fontWeight: 700 }}>Pipeline</p>
                <span style={{ fontSize: 9, padding: "1px 7px", borderRadius: 10, background: `${statusColor}15`, color: statusColor, fontWeight: 700, border: `1px solid ${statusColor}30`, textTransform: "uppercase" }}>
                    {(workflow.step_status ?? "idle").replace("_", " ")}
                </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                {steps.map((step, i) => {
                    const Icon = STEP_ICON[step.type] ?? GitBranch;
                    const color = STEP_COLOR[step.type] ?? "#6b7280";
                    const isActive = workflow.current_step_id === step.id;
                    const isApprovalGate = step.type === "approval_gate";
                    const isAwaiting = isActive && workflow.step_status === "awaiting_approval";

                    return (
                        <div key={step.id} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", width: "100%" }}>
                            <div style={{
                                display: "flex", alignItems: "center", gap: 10,
                                padding: "7px 10px", borderRadius: 8, width: "100%", boxSizing: "border-box",
                                background: isActive ? `${color}10` : "rgba(255,255,255,0.02)",
                                border: `1px solid ${isActive ? color + "35" : "rgba(255,255,255,0.05)"}`,
                                transition: "all 0.2s",
                            }}>
                                {/* Step number dot */}
                                <div style={{ width: 20, height: 20, borderRadius: "50%", background: isActive ? `${color}25` : "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: `1px solid ${isActive ? color + "40" : "rgba(255,255,255,0.08)"}` }}>
                                    <span style={{ fontSize: 8, fontWeight: 900, color: isActive ? color : "#4b5563" }}>{i + 1}</span>
                                </div>
                                <Icon size={12} style={{ color: isActive ? color : "#4b5563", flexShrink: 0 }} />
                                <span style={{ fontSize: 12, fontWeight: isActive ? 700 : 500, color: isActive ? "#fff" : "#9ca3af", flex: 1 }}>
                                    {step.label}
                                </span>
                                <span style={{ fontSize: 9, color: isActive ? color : "#4b5563", fontWeight: 700, textTransform: "uppercase" }}>
                                    {step.type.replace("_", " ")}
                                </span>
                                {/* Approve/Reject for awaiting approval gate */}
                                {isAwaiting && (
                                    <div style={{ display: "flex", gap: 5 }}>
                                        <button
                                            disabled={busy}
                                            onClick={async () => { setBusy(true); await onApprove(workflow.id); setBusy(false); }}
                                            style={{ padding: "3px 10px", borderRadius: 5, fontSize: 10, fontWeight: 700, cursor: busy ? "not-allowed" : "pointer", background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }}
                                        >
                                            ✓ Approve
                                        </button>
                                        <button
                                            disabled={busy}
                                            onClick={async () => {
                                                const fb = prompt("Rejection feedback (optional):") ?? "";
                                                setBusy(true);
                                                await onReject(workflow.id, fb);
                                                setBusy(false);
                                            }}
                                            style={{ padding: "3px 10px", borderRadius: 5, fontSize: 10, fontWeight: 700, cursor: busy ? "not-allowed" : "pointer", background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}
                                        >
                                            ✗ Reject
                                        </button>
                                    </div>
                                )}
                            </div>
                            {/* Connector */}
                            {i < steps.length - 1 && (
                                <div style={{ width: 2, height: 10, background: "rgba(255,255,255,0.07)", marginLeft: 19 }} />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}



function StatusBadge({ status }: { status: ItemStatus }) {
    const m = STATUS_META[status];
    const Icon = m.icon;
    return (
        <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.07em",
            background: `${m.color}18`, color: m.color,
            border: `1px solid ${m.color}30`,
        }}>
            <Icon size={10} />
            {m.label}
        </span>
    );
}

// ─── Approval Queue ───────────────────────────────────────────────────────────

function ApprovalQueue({ items, onApprove, onReject }: {
    items: WorkflowItem[];
    onApprove: (id: string) => Promise<void>;
    onReject: (id: string, note: string) => Promise<void>;
}) {
    const [busy, setBusy] = useState<string | null>(null);

    if (items.length === 0) {
        return (
            <div style={{ padding: "2rem", textAlign: "center", opacity: 0.5 }}>
                <CheckCircle size={32} style={{ color: "#22c55e", marginBottom: 8 }} />
                <p style={{ fontSize: 13, color: "#6b7280" }}>Nothing pending approval</p>
            </div>
        );
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map(item => (
                <div key={item.id} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "0.875rem 1rem", borderRadius: 8,
                    background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.15)",
                }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 2 }}>{item.title}</p>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <span style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase" }}>{item.type}</span>
                            <span style={{ fontSize: 10, color: "#6b7280" }}>·</span>
                            <span style={{ fontSize: 10, color: "#6b7280" }}>Phase {item.phase}</span>
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button
                            disabled={busy === item.id}
                            onClick={async () => { setBusy(item.id); await onApprove(item.id); setBusy(null); }}
                            style={{
                                padding: "4px 12px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                                cursor: busy === item.id ? "not-allowed" : "pointer",
                                background: "rgba(34,197,94,0.1)", color: "#22c55e",
                                border: "1px solid rgba(34,197,94,0.3)",
                            }}
                        >
                            {busy === item.id ? "…" : "Approve"}
                        </button>
                        <button
                            disabled={busy === item.id}
                            onClick={async () => {
                                const note = prompt("Rejection note (optional):");
                                setBusy(item.id);
                                await onReject(item.id, note ?? "");
                                setBusy(null);
                            }}
                            style={{
                                padding: "4px 12px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                                cursor: busy === item.id ? "not-allowed" : "pointer",
                                background: "rgba(239,68,68,0.08)", color: "#ef4444",
                                border: "1px solid rgba(239,68,68,0.2)",
                            }}
                        >
                            Reject
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Workflow Card ────────────────────────────────────────────────────────────

function WorkflowCard({
    workflow, items, onEnablePhase, onToggle, onPipelineApprove, onPipelineReject,
}: {
    workflow: Workflow;
    items: WorkflowItem[];
    onEnablePhase: (id: string) => Promise<void>;
    onToggle: (id: string, enabled: boolean) => Promise<void>;
    onPipelineApprove: (wfId: string) => Promise<void>;
    onPipelineReject: (wfId: string, feedback: string) => Promise<void>;
}) {
    const [expanded, setExpanded] = useState(false);
    const [busy, setBusy] = useState(false);
    const color = PATTERN_COLOR[workflow.pattern];

    const counts = {
        inReview:  items.filter(i => i.status === "in-review").length,
        approved:  items.filter(i => i.status === "approved").length,
        deployed:  items.filter(i => i.status === "deployed").length,
        total:     items.length,
    };

    const approvalRate = counts.total > 0
        ? Math.round((counts.approved + counts.deployed) / counts.total * 100)
        : null;

    return (
        <div style={{
            borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(255,255,255,0.02)", overflow: "hidden",
        }}>
            {/* Header */}
            <div
                onClick={() => setExpanded(e => !e)}
                style={{
                    display: "flex", alignItems: "center", gap: 14,
                    padding: "1rem 1.25rem", cursor: "pointer",
                    borderBottom: expanded ? "1px solid rgba(255,255,255,0.06)" : "none",
                    transition: "background 0.15s",
                }}
            >
                {/* Pattern badge */}
                <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: `${color}18`, display: "flex",
                    alignItems: "center", justifyContent: "center",
                    border: `1px solid ${color}30`,
                }}>
                    <GitBranch size={16} style={{ color }} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                        <p style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{workflow.name}</p>
                        {!workflow.enabled && (
                            <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 10, background: "rgba(255,255,255,0.05)", color: "#6b7280", fontWeight: 700, textTransform: "uppercase" }}>
                                Paused
                            </span>
                        )}
                        {/* Pipeline status badge */}
                        {(workflow.steps ?? []).length > 0 && (() => {
                            const sc = STEP_STATUS_COLOR[workflow.step_status ?? "idle"];
                            return (
                                <span style={{ fontSize: 8, padding: "1px 6px", borderRadius: 10, background: `${sc}15`, color: sc, fontWeight: 700, textTransform: "uppercase", border: `1px solid ${sc}25` }}>
                                    {(workflow.step_status ?? "idle").replace("_", " ")}
                                </span>
                            );
                        })()}
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ fontSize: 10, color, fontWeight: 700, textTransform: "uppercase" }}>
                            Pattern {workflow.pattern} · {PATTERN_LABEL[workflow.pattern]}
                        </span>
                        <span style={{ fontSize: 10, color: "#6b7280" }}>· Phase {workflow.active_phase}</span>
                        {counts.inReview > 0 && (
                            <span style={{
                                fontSize: 9, padding: "1px 7px", borderRadius: 10,
                                background: "rgba(245,158,11,0.12)", color: "#f59e0b",
                                fontWeight: 700, border: "1px solid rgba(245,158,11,0.25)",
                            }}>
                                {counts.inReview} need review
                            </span>
                        )}
                    </div>
                </div>

                {/* Stats */}
                <div style={{ display: "flex", gap: 16, flexShrink: 0 }}>
                    {approvalRate !== null && (
                        <div style={{ textAlign: "center" }}>
                            <p style={{ fontSize: 18, fontWeight: 900, color: "#22c55e", margin: 0 }}>{approvalRate}%</p>
                            <p style={{ fontSize: 9, color: "#6b7280", textTransform: "uppercase" }}>Approval</p>
                        </div>
                    )}
                    <div style={{ textAlign: "center" }}>
                        <p style={{ fontSize: 18, fontWeight: 900, color: "#fff", margin: 0 }}>{counts.total}</p>
                        <p style={{ fontSize: 9, color: "#6b7280", textTransform: "uppercase" }}>Items</p>
                    </div>
                </div>

                <ChevronRight size={16} style={{ color: "#6b7280", transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} />
            </div>

            {/* Expanded body */}
            {expanded && (
                <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                    {/* Description */}
                    <p style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.5 }}>{workflow.description}</p>

                    {/* Pipeline visualization */}
                    {(workflow.steps ?? []).length > 0 && (
                        <PipelineView
                            workflow={workflow}
                            onApprove={onPipelineApprove}
                            onReject={onPipelineReject}
                        />
                    )}

                    {/* Phase track */}
                    <div>
                        <p style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>Phases</p>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {(workflow.phases_config ?? []).map(p => (
                                <div key={p.phase} style={{
                                    padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                                    background: p.phase <= workflow.active_phase ? `${color}18` : "rgba(255,255,255,0.03)",
                                    color: p.phase <= workflow.active_phase ? color : "#4b5563",
                                    border: `1px solid ${p.phase <= workflow.active_phase ? color + "30" : "rgba(255,255,255,0.06)"}`,
                                }}>
                                    Phase {p.phase}: {p.name}
                                    {p.phase === workflow.active_phase && " ●"}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Recent items */}
                    {items.length > 0 && (
                        <div>
                            <p style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>Recent Items</p>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {items.slice(0, 5).map(item => (
                                    <div key={item.id} style={{
                                        display: "flex", alignItems: "center", gap: 10,
                                        padding: "6px 10px", borderRadius: 6, background: "rgba(255,255,255,0.02)",
                                    }}>
                                        <StatusBadge status={item.status} />
                                        <span style={{ fontSize: 12, color: "#d1d5db", flex: 1 }}>{item.title}</span>
                                        <span style={{ fontSize: 10, color: "#6b7280" }}>{item.type}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
                        <button
                            disabled={busy}
                            onClick={async () => {
                                setBusy(true);
                                await onEnablePhase(workflow.id);
                                setBusy(false);
                            }}
                            style={{
                                display: "flex", alignItems: "center", gap: 6,
                                padding: "5px 12px", borderRadius: 7, fontSize: 11, fontWeight: 700,
                                cursor: busy ? "not-allowed" : "pointer",
                                background: `${color}12`, color: color,
                                border: `1px solid ${color}30`,
                            }}
                        >
                            <Unlock size={11} /> Enable Next Phase
                        </button>
                        <button
                            disabled={busy}
                            onClick={async () => {
                                setBusy(true);
                                await onToggle(workflow.id, !workflow.enabled);
                                setBusy(false);
                            }}
                            style={{
                                display: "flex", alignItems: "center", gap: 6,
                                padding: "5px 12px", borderRadius: 7, fontSize: 11, fontWeight: 700,
                                cursor: busy ? "not-allowed" : "pointer",
                                background: "rgba(255,255,255,0.04)", color: "#9ca3af",
                                border: "1px solid rgba(255,255,255,0.08)",
                            }}
                        >
                            {workflow.enabled ? <><Pause size={11} /> Pause</> : <><Play size={11} /> Resume</>}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function WorkflowsDashboard() {
    const [workflows, setWorkflows] = useState<Workflow[]>([]);
    const [items, setItems]         = useState<WorkflowItem[]>([]);
    const [loading, setLoading]     = useState(true);
    const [error, setError]         = useState<string | null>(null);
    const [activeView, setActiveView] = useState<"workflows" | "approvals">("workflows");
    const [isWizardOpen, setIsWizardOpen] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [{ data: wf, error: wfErr }, { data: it, error: itErr }] = await Promise.all([
                supabase.from("workflows").select("*").order("created_at", { ascending: false }),
                supabase.from("workflow_items").select("*").order("created_at", { ascending: false }).limit(200),
            ]);
            if (wfErr) throw wfErr;
            if (itErr) throw itErr;
            setWorkflows((wf ?? []) as Workflow[]);
            setItems((it ?? []) as WorkflowItem[]);
        } catch (e: unknown) {
            setError((e as Error)?.message ?? "Failed to load workflows");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const pendingApproval = items.filter(i => i.status === "in-review");

    const handleApprove = async (itemId: string) => {
        await fetch(`${BOT_URL}/admin/workflow-items/${itemId}/approve`, { method: "POST" });
        await load();
    };

    const handleReject = async (itemId: string, note: string) => {
        await fetch(`${BOT_URL}/admin/workflow-items/${itemId}/reject`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ note }),
        });
        await load();
    };

    const handleEnablePhase = async (workflowId: string) => {
        await fetch(`${BOT_URL}/admin/workflows/${workflowId}/enable-phase`, { method: "POST" });
        await load();
    };

    const handleToggle = async (workflowId: string, enabled: boolean) => {
        await supabase.from("workflows").update({ enabled }).eq("id", workflowId);
        await load();
    };

    const handleCreateViaAgent = () => {
        setIsWizardOpen(true);
    };

    const handlePipelineApprove = async (workflowId: string) => {
        await fetch(`${BOT_URL}/admin/workflows/${workflowId}/approve`, { method: "POST" });
        await load();
    };

    const handlePipelineReject = async (workflowId: string, feedback: string) => {
        await fetch(`${BOT_URL}/admin/workflows/${workflowId}/reject`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ feedback }),
        });
        await load();
    };

    // Summary stats
    const totalPending  = pendingApproval.length;
    const totalDeployed = items.filter(i => i.status === "deployed" || i.status === "measured").length;
    const approvalRate  = items.length > 0
        ? Math.round((items.filter(i => ["approved","deployed","measured"].includes(i.status)).length / items.length) * 100)
        : 0;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>

            {/* Header row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div>
                    <p style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 2 }}>
                        Workflow Engine
                    </p>
                    <p style={{ fontSize: 12, color: "#9ca3af" }}>
                        {workflows.length} workflow{workflows.length !== 1 ? "s" : ""} · {totalPending} pending approval
                    </p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={load} style={{
                        display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8,
                        fontSize: 11, fontWeight: 700, cursor: "pointer",
                        background: "rgba(255,255,255,0.04)", color: "#9ca3af",
                        border: "1px solid rgba(255,255,255,0.08)",
                    }}>
                        <RefreshCw size={12} /> Refresh
                    </button>
                    <button onClick={handleCreateViaAgent} style={{
                        display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8,
                        fontSize: 11, fontWeight: 700, cursor: "pointer",
                        background: "rgba(255,140,0,0.12)", color: "#ff8c00",
                        border: "1px solid rgba(255,140,0,0.25)",
                    }}>
                        <Plus size={12} /> New Workflow
                    </button>
                </div>
            </div>

            {/* KPI row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                {[
                    { label: "Active Workflows", value: workflows.filter(w => w.enabled).length, color: "#22c55e", icon: Play },
                    { label: "Pending Approval",  value: totalPending,  color: "#f59e0b", icon: AlertTriangle },
                    { label: "Deployed (all time)", value: totalDeployed, color: "#38bdf8", icon: GitBranch },
                ].map(({ label, value, color, icon: Icon }) => (
                    <div key={label} style={{
                        padding: "1rem 1.25rem", borderRadius: 10,
                        background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                            <div style={{ width: 28, height: 28, borderRadius: 8, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <Icon size={13} style={{ color }} />
                            </div>
                            <span style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.07em" }}>{label}</span>
                        </div>
                        <p style={{ fontSize: 26, fontWeight: 900, color, margin: 0, lineHeight: 1 }}>{value}</p>
                    </div>
                ))}
            </div>

            {/* View tabs */}
            <div style={{ display: "flex", gap: 0, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {(["workflows", "approvals"] as const).map(v => (
                    <button key={v} onClick={() => setActiveView(v)} style={{
                        padding: "8px 16px", fontSize: 11, fontWeight: 700, textTransform: "uppercase",
                        letterSpacing: "0.08em", cursor: "pointer", background: "none", border: "none",
                        color: activeView === v ? "#ff8c00" : "#6b7280",
                        borderBottom: activeView === v ? "2px solid #ff8c00" : "2px solid transparent",
                        marginBottom: -1,
                    }}>
                        {v === "approvals" ? `Pending Approval (${totalPending})` : "All Workflows"}
                    </button>
                ))}
            </div>

            {/* Content */}
            {loading ? (
                <div style={{ textAlign: "center", padding: "3rem", opacity: 0.4 }}>
                    <RefreshCw size={24} style={{ animation: "spin 1s linear infinite", color: "#ff8c00" }} />
                </div>
            ) : error ? (
                <div style={{ padding: "1.5rem", borderRadius: 10, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: 13 }}>
                    <AlertTriangle size={14} style={{ marginRight: 6, verticalAlign: "middle" }} />
                    {error} — workflow tables may not be migrated yet. Check the bot logs.
                </div>
            ) : activeView === "approvals" ? (
                <ApprovalQueue
                    items={pendingApproval}
                    onApprove={handleApprove}
                    onReject={handleReject}
                />
            ) : workflows.length === 0 ? (
                <div style={{ textAlign: "center", padding: "4rem 2rem", opacity: 0.5 }}>
                    <GitBranch size={40} style={{ color: "#ff8c00", marginBottom: 12 }} />
                    <p style={{ color: "#9ca3af", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>No workflows yet</p>
                    <p style={{ color: "#6b7280", fontSize: 12 }}>
                        Click "New Workflow" and describe what you want in plain English.
                    </p>
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {workflows.map(wf => (
                        <WorkflowCard
                            key={wf.id}
                            workflow={wf}
                            items={items.filter(i => i.workflow_id === wf.id)}
                            onEnablePhase={handleEnablePhase}
                            onToggle={handleToggle}
                            onPipelineApprove={handlePipelineApprove}
                            onPipelineReject={handlePipelineReject}
                        />
                    ))}
                </div>
            )}

            {/* Approval rate footer */}
            {items.length > 0 && (
                <div style={{ padding: "0.875rem 1rem", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: "#6b7280" }}>Overall approval rate across all workflows</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: approvalRate >= 70 ? "#22c55e" : approvalRate >= 40 ? "#f59e0b" : "#ef4444" }}>
                        {approvalRate}%
                    </span>
                </div>
            )}

            <WorkflowWizard 
                isOpen={isWizardOpen} 
                onClose={() => setIsWizardOpen(false)} 
                onCreated={() => {
                    setIsWizardOpen(false);
                    load();
                }}
            />
        </div>
    );
}

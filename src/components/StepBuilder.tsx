"use client";
import React, { useState, useCallback } from "react";
import {
    Search, Image, Bell, ShieldCheck, GitBranch, FileText,
    Plus, Trash2, ChevronUp, ChevronDown, X, Zap, Check
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type StepType = "research" | "generate" | "notify" | "approval_gate" | "branch" | "document";
type StepStatus = "idle" | "running" | "awaiting_approval" | "done" | "failed";

interface WorkflowStep {
    id: string;
    type: StepType;
    label: string;
    config: Record<string, unknown>;
    on_success: string | null;
    on_failure: string | null;
}

interface StepBuilderProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated: () => void;
}

// ─── Step Type Metadata ───────────────────────────────────────────────────────

const STEP_TYPES: {
    type: StepType;
    label: string;
    icon: React.ElementType;
    color: string;
    description: string;
}[] = [
    { type: "research",      label: "Research",       icon: Search,      color: "#38bdf8", description: "Call an agent with a prompt" },
    { type: "generate",      label: "Generate",       icon: Image,       color: "#a855f7", description: "Create images or assets" },
    { type: "notify",        label: "Notify",         icon: Bell,        color: "#f59e0b", description: "Send a message to a channel" },
    { type: "approval_gate", label: "Approval Gate",  icon: ShieldCheck, color: "#ff8c00", description: "Pause for human approval" },
    { type: "branch",        label: "Branch",         icon: GitBranch,   color: "#22c55e", description: "Route based on outcome" },
    { type: "document",      label: "Document",       icon: FileText,    color: "#64748b", description: "Create or update a document" },
];

const STEP_META: Record<StepType, typeof STEP_TYPES[0]> = Object.fromEntries(
    STEP_TYPES.map(s => [s.type, s])
) as Record<StepType, typeof STEP_TYPES[0]>;

// ─── Config Forms ─────────────────────────────────────────────────────────────

function ConfigField({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div style={{ marginBottom: "0.875rem" }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>
                {label}
            </label>
            {children}
        </div>
    );
}

const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box",
    padding: "6px 10px", borderRadius: 6, fontSize: 12,
    background: "rgba(255,255,255,0.04)", color: "#e5e7eb",
    border: "1px solid rgba(255,255,255,0.1)", outline: "none",
    fontFamily: "inherit",
};

const textareaStyle: React.CSSProperties = {
    ...inputStyle, minHeight: 80, resize: "vertical" as const,
};

function ResearchConfig({ config, onChange }: { config: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
    return (
        <>
            <ConfigField label="Agent ID">
                <input style={inputStyle} placeholder="e.g. agent-uuid" value={(config.agent_id as string) ?? ""} onChange={e => onChange({ ...config, agent_id: e.target.value })} />
            </ConfigField>
            <ConfigField label="Prompt Template">
                <textarea style={textareaStyle} placeholder="Research prompt…" value={(config.prompt as string) ?? ""} onChange={e => onChange({ ...config, prompt: e.target.value })} />
            </ConfigField>
        </>
    );
}

function GenerateConfig({ config, onChange }: { config: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
    return (
        <>
            <ConfigField label="Count">
                <input style={inputStyle} type="number" min={1} max={50} placeholder="15" value={(config.count as number) ?? 1} onChange={e => onChange({ ...config, count: Number(e.target.value) })} />
            </ConfigField>
            <ConfigField label="Drive Folder Name">
                <input style={inputStyle} placeholder="workflow-assets" value={(config.folder as string) ?? ""} onChange={e => onChange({ ...config, folder: e.target.value })} />
            </ConfigField>
        </>
    );
}

function NotifyConfig({ config, onChange }: { config: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
    return (
        <>
            <ConfigField label="Channel">
                <select style={inputStyle} value={(config.channel as string) ?? "log"} onChange={e => onChange({ ...config, channel: e.target.value })}>
                    <option value="log">Log only</option>
                    <option value="discord">Discord</option>
                    <option value="telegram">Telegram</option>
                </select>
            </ConfigField>
            <ConfigField label="Message">
                <textarea style={textareaStyle} placeholder="Message content…" value={(config.message as string) ?? ""} onChange={e => onChange({ ...config, message: e.target.value })} />
            </ConfigField>
        </>
    );
}

function ApprovalConfig({ config, onChange }: { config: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
    return (
        <ConfigField label="Reviewer (display only)">
            <input style={inputStyle} placeholder="e.g. Robert" value={(config.reviewer as string) ?? ""} onChange={e => onChange({ ...config, reviewer: e.target.value })} />
        </ConfigField>
    );
}

function DocumentConfig({ config, onChange }: { config: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
    return (
        <>
            <ConfigField label="Document Name">
                <input style={inputStyle} placeholder="e.g. Weekly Strategy" value={(config.doc_name as string) ?? ""} onChange={e => onChange({ ...config, doc_name: e.target.value })} />
            </ConfigField>
            <ConfigField label="Agent ID">
                <input style={inputStyle} placeholder="agent-uuid" value={(config.agent_id as string) ?? ""} onChange={e => onChange({ ...config, agent_id: e.target.value })} />
            </ConfigField>
        </>
    );
}

function ConfigPanel({ step, onChange }: { step: WorkflowStep; onChange: (updated: WorkflowStep) => void }) {
    const meta = STEP_META[step.type];
    const Icon = meta.icon;

    const setConfig = (config: Record<string, unknown>) => onChange({ ...step, config });

    return (
        <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 6, background: `${meta.color}18`, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${meta.color}30` }}>
                        <Icon size={12} style={{ color: meta.color }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>{meta.label}</span>
                </div>
                <p style={{ fontSize: 10, color: "#6b7280" }}>{meta.description}</p>
            </div>

            {/* Fields */}
            <div style={{ flex: 1, overflowY: "auto", padding: "1rem 1.25rem" }}>
                <ConfigField label="Label">
                    <input style={inputStyle} value={step.label} onChange={e => onChange({ ...step, label: e.target.value })} />
                </ConfigField>

                {step.type === "research"      && <ResearchConfig  config={step.config} onChange={setConfig} />}
                {step.type === "generate"      && <GenerateConfig  config={step.config} onChange={setConfig} />}
                {step.type === "notify"        && <NotifyConfig    config={step.config} onChange={setConfig} />}
                {step.type === "approval_gate" && <ApprovalConfig  config={step.config} onChange={setConfig} />}
                {step.type === "document"      && <DocumentConfig  config={step.config} onChange={setConfig} />}
                {step.type === "branch" && (
                    <p style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.6 }}>
                        Branch nodes automatically route to the next step on approval and the failure step on rejection. Configure routing via the canvas.
                    </p>
                )}
            </div>
        </div>
    );
}

// ─── Step Card ────────────────────────────────────────────────────────────────

function StepCard({
    step, index, total, isSelected,
    onSelect, onDelete, onMoveUp, onMoveDown,
}: {
    step: WorkflowStep; index: number; total: number; isSelected: boolean;
    onSelect: () => void; onDelete: () => void; onMoveUp: () => void; onMoveDown: () => void;
}) {
    const meta = STEP_META[step.type];
    const Icon = meta.icon;

    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div
                onClick={onSelect}
                style={{
                    width: "100%", padding: "0.75rem 1rem", borderRadius: 10, cursor: "pointer",
                    background: isSelected ? `${meta.color}12` : "rgba(255,255,255,0.03)",
                    border: `1px solid ${isSelected ? meta.color + "50" : "rgba(255,255,255,0.08)"}`,
                    display: "flex", alignItems: "center", gap: 10,
                    transition: "all 0.15s",
                }}
            >
                {/* Step number */}
                <div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, background: `${meta.color}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 9, fontWeight: 900, color: meta.color }}>{index + 1}</span>
                </div>

                {/* Icon + label */}
                <Icon size={13} style={{ color: meta.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {step.label}
                    </p>
                    <p style={{ fontSize: 10, color: "#6b7280" }}>{meta.label}</p>
                </div>

                {/* Controls */}
                <div style={{ display: "flex", gap: 2, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    <button onClick={onMoveUp}   disabled={index === 0}         style={ctrlBtn} title="Move up">   <ChevronUp   size={11} />  </button>
                    <button onClick={onMoveDown} disabled={index === total - 1} style={ctrlBtn} title="Move down"> <ChevronDown size={11} />  </button>
                    <button onClick={onDelete}                                  style={{ ...ctrlBtn, color: "#ef4444" }} title="Delete"> <Trash2 size={11} /> </button>
                </div>
            </div>

            {/* Connector arrow */}
            {index < total - 1 && (
                <div style={{ width: 2, height: 16, background: "rgba(255,255,255,0.1)", margin: "2px 0", position: "relative" }}>
                    <div style={{ position: "absolute", bottom: -4, left: "50%", transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "4px solid transparent", borderRight: "4px solid transparent", borderTop: "5px solid rgba(255,255,255,0.15)" }} />
                </div>
            )}
        </div>
    );
}

const ctrlBtn: React.CSSProperties = {
    width: 22, height: 22, borderRadius: 5, border: "none",
    background: "rgba(255,255,255,0.05)", color: "#6b7280",
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    padding: 0,
};

// ─── StepBuilder Main ─────────────────────────────────────────────────────────

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3000";

let stepCounter = 0;
function makeId() { return `step-${++stepCounter}-${Date.now()}`; }

export function StepBuilder({ isOpen, onClose, onCreated }: StepBuilderProps) {
    const [steps, setSteps]       = useState<WorkflowStep[]>([]);
    const [name, setName]         = useState("");
    const [description, setDesc]  = useState("");
    const [selected, setSelected] = useState<string | null>(null);
    const [busy, setBusy]         = useState(false);
    const [error, setError]       = useState<string | null>(null);

    const selectedStep = steps.find(s => s.id === selected) ?? null;

    const addStep = useCallback((type: StepType) => {
        const meta = STEP_META[type];
        const id = makeId();
        const newStep: WorkflowStep = {
            id,
            type,
            label: `${meta.label} ${steps.length + 1}`,
            config: {},
            on_success: null,
            on_failure: null,
        };

        // Wire on_success pointers: previous last step points to new step
        setSteps(prev => {
            const updated = prev.map((s, i) =>
                i === prev.length - 1 ? { ...s, on_success: id } : s
            );
            return [...updated, newStep];
        });
        setSelected(id);
    }, [steps.length]);

    const updateStep = useCallback((updated: WorkflowStep) => {
        setSteps(prev => prev.map(s => s.id === updated.id ? updated : s));
    }, []);

    const deleteStep = useCallback((id: string) => {
        setSteps(prev => {
            const idx = prev.findIndex(s => s.id === id);
            const next = prev.filter(s => s.id !== id);
            // Re-wire on_success for the item before the deleted one
            if (idx > 0 && next.length > 0) {
                const prevItem = next[idx - 1];
                if (prevItem) {
                    const nextAfter = next[idx] ?? null;
                    next[idx - 1] = { ...prevItem, on_success: nextAfter?.id ?? null };
                }
            }
            return next;
        });
        if (selected === id) setSelected(null);
    }, [selected]);

    const moveStep = useCallback((id: string, dir: -1 | 1) => {
        setSteps(prev => {
            const idx = prev.findIndex(s => s.id === id);
            const swapIdx = idx + dir;
            if (swapIdx < 0 || swapIdx >= prev.length) return prev;
            const next = [...prev];
            [next[idx], next[swapIdx]] = [next[swapIdx]!, next[idx]!];
            // Re-wire
            return next.map((s, i) => ({ ...s, on_success: next[i + 1]?.id ?? null }));
        });
    }, []);

    const handleCreate = async () => {
        if (!name.trim()) { setError("Workflow name is required"); return; }
        if (steps.length === 0) { setError("Add at least one step"); return; }
        setBusy(true);
        setError(null);
        try {
            const res = await fetch(`${BOT_URL}/admin/workflows/wizard/confirm`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name.trim(), description, steps }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Failed to create workflow");
            handleClose();
            onCreated();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setBusy(false);
        }
    };

    const handleClose = () => {
        setSteps([]);
        setName("");
        setDesc("");
        setSelected(null);
        setError(null);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "1.5rem",
        }}>
            <div style={{
                width: "100%", maxWidth: 1000, height: "min(700px, 90vh)",
                background: "#0f1117", borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.08)",
                display: "flex", flexDirection: "column",
                boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
                overflow: "hidden",
            }}>
                {/* ── Modal Header ───────────────────────────────────────── */}
                <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "1rem 1.25rem",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    background: "rgba(255,255,255,0.01)",
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,140,0,0.12)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,140,0,0.25)" }}>
                            <Zap size={14} style={{ color: "#ff8c00" }} />
                        </div>
                        <div>
                            <p style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>Pipeline Builder</p>
                            <p style={{ fontSize: 10, color: "#6b7280" }}>Visual workflow step editor</p>
                        </div>
                    </div>
                    <button onClick={handleClose} style={{ width: 28, height: 28, borderRadius: 7, border: "none", background: "rgba(255,255,255,0.05)", color: "#6b7280", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <X size={13} />
                    </button>
                </div>

                {/* ── 3-Panel Body ───────────────────────────────────────── */}
                <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

                    {/* Panel 1: Node Palette */}
                    <div style={{
                        width: 180, flexShrink: 0, borderRight: "1px solid rgba(255,255,255,0.06)",
                        display: "flex", flexDirection: "column", overflow: "hidden",
                    }}>
                        <p style={{ padding: "0.75rem 1rem 0.5rem", fontSize: 9, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em" }}>Node Palette</p>
                        <div style={{ flex: 1, overflowY: "auto", padding: "0 0.5rem 0.5rem" }}>
                            {STEP_TYPES.map(meta => {
                                const Icon = meta.icon;
                                return (
                                    <button
                                        key={meta.type}
                                        onClick={() => addStep(meta.type)}
                                        style={{
                                            width: "100%", padding: "0.6rem 0.75rem", borderRadius: 8,
                                            display: "flex", alignItems: "center", gap: 8,
                                            background: "transparent", border: "none", cursor: "pointer",
                                            marginBottom: 2, textAlign: "left",
                                            transition: "background 0.12s",
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.background = `${meta.color}10`)}
                                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                                    >
                                        <div style={{ width: 26, height: 26, borderRadius: 7, background: `${meta.color}15`, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${meta.color}25`, flexShrink: 0 }}>
                                            <Icon size={12} style={{ color: meta.color }} />
                                        </div>
                                        <div>
                                            <p style={{ fontSize: 11, fontWeight: 700, color: "#d1d5db" }}>{meta.label}</p>
                                            <p style={{ fontSize: 9, color: "#6b7280", lineHeight: 1.3 }}>{meta.description}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Panel 2: Step Canvas */}
                    <div style={{
                        flex: 1, borderRight: "1px solid rgba(255,255,255,0.06)",
                        display: "flex", flexDirection: "column", overflow: "hidden",
                    }}>
                        <p style={{ padding: "0.75rem 1rem 0.5rem", fontSize: 9, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                            Step Canvas <span style={{ color: "#3f4650", fontWeight: 400 }}>({steps.length} step{steps.length !== 1 ? "s" : ""})</span>
                        </p>
                        <div style={{ flex: 1, overflowY: "auto", padding: "0 1rem 1rem" }}>
                            {steps.length === 0 ? (
                                <div style={{ textAlign: "center", padding: "3rem 1rem", opacity: 0.4 }}>
                                    <Plus size={28} style={{ color: "#6b7280", marginBottom: 8 }} />
                                    <p style={{ fontSize: 12, color: "#6b7280" }}>Click a node type to add steps</p>
                                </div>
                            ) : (
                                steps.map((step, i) => (
                                    <StepCard
                                        key={step.id}
                                        step={step}
                                        index={i}
                                        total={steps.length}
                                        isSelected={selected === step.id}
                                        onSelect={() => setSelected(step.id)}
                                        onDelete={() => deleteStep(step.id)}
                                        onMoveUp={() => moveStep(step.id, -1)}
                                        onMoveDown={() => moveStep(step.id, 1)}
                                    />
                                ))
                            )}
                        </div>
                    </div>

                    {/* Panel 3: Config */}
                    <div style={{ width: 240, flexShrink: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                        {selectedStep ? (
                            <ConfigPanel step={selectedStep} onChange={updateStep} />
                        ) : (
                            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", textAlign: "center" }}>
                                <div style={{ opacity: 0.35 }}>
                                    <p style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.6 }}>Click a step in the canvas to configure it</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Footer ─────────────────────────────────────────────── */}
                <div style={{
                    borderTop: "1px solid rgba(255,255,255,0.06)",
                    padding: "0.875rem 1.25rem",
                    background: "rgba(255,255,255,0.01)",
                    display: "flex", alignItems: "center", gap: 10,
                }}>
                    <input
                        style={{ ...inputStyle, flex: 1, maxWidth: 220 }}
                        placeholder="Workflow name…"
                        value={name}
                        onChange={e => setName(e.target.value)}
                    />
                    <input
                        style={{ ...inputStyle, flex: 2 }}
                        placeholder="Description (optional)"
                        value={description}
                        onChange={e => setDesc(e.target.value)}
                    />
                    {error && <p style={{ fontSize: 11, color: "#ef4444", flexShrink: 0 }}>{error}</p>}
                    <button
                        onClick={handleCreate}
                        disabled={busy}
                        style={{
                            display: "flex", alignItems: "center", gap: 6,
                            padding: "7px 16px", borderRadius: 8, fontSize: 11, fontWeight: 800,
                            cursor: busy ? "not-allowed" : "pointer", flexShrink: 0,
                            background: busy ? "rgba(255,140,0,0.06)" : "rgba(255,140,0,0.14)",
                            color: busy ? "#6b7280" : "#ff8c00",
                            border: busy ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(255,140,0,0.3)",
                            transition: "all 0.15s",
                        }}
                    >
                        {busy ? "Creating…" : <><Check size={12} /> Create Workflow</>}
                    </button>
                </div>
            </div>
        </div>
    );
}

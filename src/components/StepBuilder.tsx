"use client";
import React, { useState, useCallback, useEffect } from "react";
import {
    Search, Image, Bell, ShieldCheck, FileText,
    Plus, Trash2, ChevronUp, ChevronDown, X, Zap, Check,
    User, Bot, BookOpen,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type StepType = "research" | "generate" | "notify" | "approval_gate" | "document" | "update_document";
type StepStatus = "idle" | "running" | "awaiting_approval" | "done" | "failed";

interface WorkflowStep {
    id: string;
    type: StepType;
    label: string;
    config: Record<string, unknown>;
    on_success: string | null;
    on_failure: string | null;
}

interface Agent {
    id: string;
    name: string;
    emoji?: string;
    specialization?: string;
}

interface DiscordMember {
    id: string;
    username: string;
    displayName: string;
    avatar: string;
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
    { type: "research",       label: "Research",         icon: Search,     color: "#38bdf8", description: "Gather info with an AI agent" },
    { type: "generate",       label: "Generate",         icon: Image,      color: "#a855f7", description: "Create images or assets" },
    { type: "notify",         label: "Notify",           icon: Bell,       color: "#f59e0b", description: "Send a message to a channel" },
    { type: "approval_gate",  label: "Approval Gate",   icon: ShieldCheck, color: "#ff8c00", description: "Pause for human approval" },
    { type: "document",       label: "New Document",    icon: FileText,    color: "#64748b", description: "Create a new document" },
    { type: "update_document",label: "Update Document", icon: BookOpen,    color: "#22c55e", description: "Add content to an existing doc" },
];

const STEP_META: Record<StepType, typeof STEP_TYPES[0]> = Object.fromEntries(
    STEP_TYPES.map(s => [s.type, s])
) as Record<StepType, typeof STEP_TYPES[0]>;

// ─── Shared Styles ────────────────────────────────────────────────────────────

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

const ctrlBtn: React.CSSProperties = {
    width: 22, height: 22, borderRadius: 5, border: "none",
    background: "rgba(255,255,255,0.05)", color: "#6b7280",
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    padding: 0,
};

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

// ─── Config Forms ─────────────────────────────────────────────────────────────

function ResearchConfig({ config, onChange, agents }: {
    config: Record<string, unknown>;
    onChange: (c: Record<string, unknown>) => void;
    agents: Agent[];
}) {
    return (
        <>
            <ConfigField label="Agent">
                <select
                    style={inputStyle}
                    value={(config.agent_id as string) ?? ""}
                    onChange={e => onChange({ ...config, agent_id: e.target.value })}
                >
                    <option value="">— Select an agent —</option>
                    {agents.map(a => (
                        <option key={a.id} value={a.id}>
                            {a.emoji ?? "🤖"} {a.name}{a.specialization ? ` · ${a.specialization}` : ""}
                        </option>
                    ))}
                </select>
            </ConfigField>
            <ConfigField label="Research Prompt">
                <textarea
                    style={textareaStyle}
                    placeholder="What should the agent research? Use {topic} to reference context from previous steps."
                    value={(config.prompt as string) ?? ""}
                    onChange={e => onChange({ ...config, prompt: e.target.value })}
                />
            </ConfigField>
        </>
    );
}

const CONTENT_TYPES = [
    { value: "image", label: "🖼️ Image" },
];

function GenerateConfig({ config, onChange }: {
    config: Record<string, unknown>;
    onChange: (c: Record<string, unknown>) => void;
}) {
    return (
        <>
            <ConfigField label="Content Type">
                <select
                    style={inputStyle}
                    value={(config.content_type as string) ?? "image"}
                    onChange={e => onChange({ ...config, content_type: e.target.value })}
                >
                    {CONTENT_TYPES.map(ct => (
                        <option key={ct.value} value={ct.value}>{ct.label}</option>
                    ))}
                </select>
            </ConfigField>
            <ConfigField label="Prompt">
                <textarea
                    style={textareaStyle}
                    placeholder="Describe what to generate and why (e.g. 'Holiday product shot for Instagram — research context will be appended automatically')"
                    value={(config.prompt as string) ?? ""}
                    onChange={e => onChange({ ...config, prompt: e.target.value })}
                />
            </ConfigField>
            <p style={{ fontSize: 10, color: "#4b5563", lineHeight: 1.5, marginTop: -8 }}>
                🔍 Research context is automatically available to this step.
            </p>
        </>
    );
}

function NotifyConfig({ config, onChange, humanLead }: {
    config: Record<string, unknown>;
    onChange: (c: Record<string, unknown>) => void;
    humanLead: DiscordMember | null;
}) {
    return (
        <>
            <ConfigField label="Channel">
                <select style={inputStyle} value={(config.channel as string) ?? "discord"} onChange={e => onChange({ ...config, channel: e.target.value })}>
                    <option value="discord">Discord{humanLead ? ` — @${humanLead.displayName}` : ""}</option>
                    <option disabled value="sms">Text Message (coming soon)</option>
                    <option disabled value="email">Email (coming soon)</option>
                </select>
                {!humanLead && (
                    <p style={{ fontSize: 10, color: "#f59e0b", marginTop: 4 }}>
                        ⚠️ Choose a Human Lead at the top to set Discord target.
                    </p>
                )}
            </ConfigField>
            <ConfigField label="Message">
                <textarea
                    style={textareaStyle}
                    placeholder="Message content… Research context is available here too."
                    value={(config.message as string) ?? ""}
                    onChange={e => onChange({ ...config, message: e.target.value })}
                />
            </ConfigField>
        </>
    );
}

function ApprovalConfig({ humanLead }: { humanLead: DiscordMember | null }) {
    return (
        <div style={{ padding: "0.5rem 0" }}>
            <p style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", fontWeight: 700, marginBottom: 6 }}>Reviewer</p>
            {humanLead ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 7, background: "rgba(255,140,0,0.08)", border: "1px solid rgba(255,140,0,0.2)" }}>
                    <img src={humanLead.avatar} alt="" style={{ width: 20, height: 20, borderRadius: "50%" }} onError={e => (e.currentTarget.style.display = "none")} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#ff8c00" }}>{humanLead.displayName}</span>
                    <span style={{ fontSize: 10, color: "#6b7280" }}>@{humanLead.username}</span>
                </div>
            ) : (
                <div style={{ padding: "6px 10px", borderRadius: 7, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 12, color: "#4b5563", fontStyle: "italic" }}>
                    Choose a Human Lead at the top first
                </div>
            )}
        </div>
    );
}

function DocumentConfig({ config, onChange }: { config: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
    return (
        <>
            <ConfigField label="Document Name">
                <input style={inputStyle} placeholder="e.g. Weekly Strategy" value={(config.doc_name as string) ?? ""} onChange={e => onChange({ ...config, doc_name: e.target.value })} />
            </ConfigField>
            <ConfigField label="Prompt">
                <textarea
                    style={textareaStyle}
                    placeholder="What should this document contain? Research context is automatically available."
                    value={(config.prompt as string) ?? ""}
                    onChange={e => onChange({ ...config, prompt: e.target.value })}
                />
            </ConfigField>
            <p style={{ fontSize: 10, color: "#4b5563", lineHeight: 1.5, marginTop: -8 }}>
                🔍 Research context is automatically available to this step.
            </p>
        </>
    );
}

function UpdateDocumentConfig({ config, onChange, steps, currentStepId }: {
    config: Record<string, unknown>;
    onChange: (c: Record<string, unknown>) => void;
    steps: WorkflowStep[];
    currentStepId: string;
}) {
    // Find all "document" or "update_document" steps that come before this one — those are the docs we can reference
    const currentIdx = steps.findIndex(s => s.id === currentStepId);
    const previousDocSteps = steps
        .slice(0, currentIdx)
        .filter(s => s.type === "document" || s.type === "update_document");

    return (
        <>
            <ConfigField label="Target Document">
                <select
                    style={inputStyle}
                    value={(config.target_step_id as string) ?? ""}
                    onChange={e => onChange({ ...config, target_step_id: e.target.value })}
                >
                    <option value="">— Select a document step —</option>
                    {previousDocSteps.map(s => (
                        <option key={s.id} value={s.id}>
                            {s.type === "document" ? "📄" : "✏️"} {s.label || `Step ${steps.indexOf(s) + 1}`}
                            {s.config.doc_name ? ` — ${s.config.doc_name}` : ""}
                        </option>
                    ))}
                </select>
                {previousDocSteps.length === 0 && (
                    <p style={{ fontSize: 10, color: "#f59e0b", marginTop: 4 }}>
                        ⚠️ Add a "New Document" step earlier in the pipeline first.
                    </p>
                )}
            </ConfigField>
            <ConfigField label="What to Add">
                <textarea
                    style={textareaStyle}
                    placeholder="Describe what to append or add to the document. Research context from all prior steps is automatically available."
                    value={(config.prompt as string) ?? ""}
                    onChange={e => onChange({ ...config, prompt: e.target.value })}
                />
            </ConfigField>
            <p style={{ fontSize: 10, color: "#4b5563", lineHeight: 1.5, marginTop: -8 }}>
                🔍 Research context from all prior steps flows into this step automatically.
            </p>
        </>
    );
}

// ─── Config Panel ─────────────────────────────────────────────────────────────

function ConfigPanel({ step, onChange, agents, humanLead, allSteps }: {
    step: WorkflowStep;
    onChange: (updated: WorkflowStep) => void;
    agents: Agent[];
    humanLead: DiscordMember | null;
    allSteps: WorkflowStep[];
}) {
    const meta = STEP_META[step.type];
    const Icon = meta.icon;
    const setConfig = (config: Record<string, unknown>) => onChange({ ...step, config });

    return (
        <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 6, background: `${meta.color}18`, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${meta.color}30` }}>
                        <Icon size={12} style={{ color: meta.color }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>{meta.label}</span>
                </div>
                <p style={{ fontSize: 10, color: "#6b7280" }}>{meta.description}</p>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "1rem 1.25rem" }}>
                <ConfigField label="Label">
                    <input style={inputStyle} value={step.label} onChange={e => onChange({ ...step, label: e.target.value })} />
                </ConfigField>

                {step.type === "research"       && <ResearchConfig        config={step.config} onChange={setConfig} agents={agents} />}
                {step.type === "generate"       && <GenerateConfig        config={step.config} onChange={setConfig} />}
                {step.type === "notify"         && <NotifyConfig          config={step.config} onChange={setConfig} humanLead={humanLead} />}
                {step.type === "approval_gate"  && <ApprovalConfig        humanLead={humanLead} />}
                {step.type === "document"       && <DocumentConfig        config={step.config} onChange={setConfig} />}
                {step.type === "update_document"&& <UpdateDocumentConfig  config={step.config} onChange={setConfig} steps={allSteps} currentStepId={step.id} />}
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
                <div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, background: `${meta.color}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 9, fontWeight: 900, color: meta.color }}>{index + 1}</span>
                </div>
                <Icon size={13} style={{ color: meta.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {step.label}
                    </p>
                    <p style={{ fontSize: 10, color: "#6b7280" }}>{meta.label}</p>
                </div>
                <div style={{ display: "flex", gap: 2, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    <button onClick={onMoveUp}   disabled={index === 0}         style={ctrlBtn} title="Move up">   <ChevronUp   size={11} />  </button>
                    <button onClick={onMoveDown} disabled={index === total - 1} style={ctrlBtn} title="Move down"> <ChevronDown size={11} />  </button>
                    <button onClick={onDelete}                                  style={{ ...ctrlBtn, color: "#ef4444" }} title="Delete"> <Trash2 size={11} /> </button>
                </div>
            </div>

            {index < total - 1 && (
                <div style={{ width: 2, height: 16, background: "rgba(255,255,255,0.1)", margin: "2px 0", position: "relative" }}>
                    <div style={{ position: "absolute", bottom: -4, left: "50%", transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "4px solid transparent", borderRight: "4px solid transparent", borderTop: "5px solid rgba(255,255,255,0.15)" }} />
                </div>
            )}
        </div>
    );
}

// ─── Lead / Agent Selector Row ────────────────────────────────────────────────

function LeadSelector({ agents, members, agentManagerId, humanLeadId, onAgentChange, onHumanChange }: {
    agents: Agent[];
    members: DiscordMember[];
    agentManagerId: string;
    humanLeadId: string;
    onAgentChange: (id: string) => void;
    onHumanChange: (id: string) => void;
}) {
    return (
        <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
            padding: "0.875rem 1.25rem",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(255,255,255,0.01)",
        }}>
            {/* AI Agent Manager */}
            <div>
                <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 9, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
                    <Bot size={9} style={{ color: "#38bdf8" }} /> AI Agent Manager
                </label>
                <select
                    style={{
                        ...inputStyle,
                        borderColor: !agentManagerId ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.1)",
                    }}
                    value={agentManagerId}
                    onChange={e => onAgentChange(e.target.value)}
                >
                    <option value="">— Choose agent manager —</option>
                    {agents.map(a => (
                        <option key={a.id} value={a.id}>
                            {a.emoji ?? "🤖"} {a.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* Human Lead */}
            <div>
                <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 9, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
                    <User size={9} style={{ color: "#ff8c00" }} /> Human Lead
                </label>
                <select
                    style={{
                        ...inputStyle,
                        borderColor: !humanLeadId ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.1)",
                    }}
                    value={humanLeadId}
                    onChange={e => onHumanChange(e.target.value)}
                >
                    <option value="">— Choose team member —</option>
                    {members.length === 0 && (
                        <option disabled value="">No Discord members found</option>
                    )}
                    {members.map(m => (
                        <option key={m.id} value={m.id}>
                            {m.displayName} (@{m.username})
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}

// ─── StepBuilder Main ─────────────────────────────────────────────────────────

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3000";

let stepCounter = 0;
function makeId() { return `step-${++stepCounter}-${Date.now()}`; }

/** Converts a workflow name to a Drive-compatible folder name */
function toDriveFolderName(name: string): string {
    return name.trim().replace(/[^a-zA-Z0-9\s-_]/g, "").replace(/\s+/g, "-").slice(0, 60) || "workflow";
}

export function StepBuilder({ isOpen, onClose, onCreated }: StepBuilderProps) {
    const [steps, setSteps]             = useState<WorkflowStep[]>([]);
    const [name, setName]               = useState("");
    const [description, setDesc]        = useState("");
    const [selected, setSelected]       = useState<string | null>(null);
    const [busy, setBusy]               = useState(false);
    const [error, setError]             = useState<string | null>(null);

    // Roster data
    const [agents, setAgents]           = useState<Agent[]>([]);
    const [members, setMembers]         = useState<DiscordMember[]>([]);
    const [agentManagerId, setAgentMgr] = useState("");
    const [humanLeadId, setHumanLead]   = useState("");

    const selectedStep  = steps.find(s => s.id === selected) ?? null;
    const humanLead     = members.find(m => m.id === humanLeadId) ?? null;

    // Fetch agents + discord members when modal opens
    useEffect(() => {
        if (!isOpen) return;
        Promise.all([
            fetch(`${BOT_URL}/admin/agents`).then(r => r.json()).catch(() => []),
            fetch(`${BOT_URL}/admin/discord/members`).then(r => r.json()).catch(() => ({ members: [] })),
        ]).then(([agentData, memberData]) => {
            setAgents(Array.isArray(agentData) ? agentData : []);
            setMembers(memberData?.members ?? []);
        });
    }, [isOpen]);

    const addStep = useCallback((type: StepType) => {
        const meta = STEP_META[type];
        const id = makeId();

        // Default configs
        const defaultConfig: Record<string, unknown> = {};
        if (type === "generate") defaultConfig.content_type = "image";
        if (type === "notify") defaultConfig.channel = "discord";

        const newStep: WorkflowStep = {
            id, type,
            label: `${meta.label} ${steps.length + 1}`,
            config: defaultConfig,
            on_success: null,
            on_failure: null,
        };

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
            return next.map((s, i) => ({ ...s, on_success: next[i + 1]?.id ?? null }));
        });
    }, []);

    const handleCreate = async () => {
        if (!agentManagerId) { setError("Choose an AI Agent Manager to continue"); return; }
        if (!humanLeadId)    { setError("Choose a Human Lead to continue"); return; }
        if (!name.trim())    { setError("Workflow name is required"); return; }
        if (steps.length === 0) { setError("Add at least one step"); return; }

        setBusy(true);
        setError(null);

        try {
            const driveFolderName = toDriveFolderName(name);

            // Inject agent manager + human lead into step configs
            const enrichedSteps = steps.map(s => ({
                ...s,
                config: {
                    ...s.config,
                    // All steps get access to the research accumulator context via backend
                    _agent_manager_id: agentManagerId,
                    _human_lead_id: humanLeadId,
                    ...(s.type === "generate" ? { folder: driveFolderName } : {}),
                    ...(s.type === "notify"   ? { discord_user_id: humanLeadId } : {}),
                    ...(s.type === "approval_gate" ? { reviewer_id: humanLeadId } : {}),
                },
            }));

            const res = await fetch(`${BOT_URL}/admin/workflows/wizard/confirm`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    description,
                    steps: enrichedSteps,
                    agent_manager_id: agentManagerId,
                    human_lead_id: humanLeadId,
                    drive_folder: driveFolderName,
                }),
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
        setAgentMgr("");
        setHumanLead("");
        onClose();
    };

    if (!isOpen) return null;

    const canSave = agentManagerId && humanLeadId;

    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "1.5rem",
        }}>
            <div style={{
                width: "100%", maxWidth: 1000, height: "min(760px, 94vh)",
                background: "#0f1117", borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.08)",
                display: "flex", flexDirection: "column",
                boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
                overflow: "hidden",
            }}>
                {/* ── Modal Header ─────────────────────────────────────── */}
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

                {/* ── Lead Selector ────────────────────────────────────── */}
                <LeadSelector
                    agents={agents}
                    members={members}
                    agentManagerId={agentManagerId}
                    humanLeadId={humanLeadId}
                    onAgentChange={setAgentMgr}
                    onHumanChange={setHumanLead}
                />

                {/* ── 3-Panel Body ─────────────────────────────────────── */}
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
                    <div style={{ width: 250, flexShrink: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                        {selectedStep ? (
                            <ConfigPanel
                                step={selectedStep}
                                onChange={updateStep}
                                agents={agents}
                                humanLead={humanLead}
                                allSteps={steps}
                            />
                        ) : (
                            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", textAlign: "center" }}>
                                <div style={{ opacity: 0.35 }}>
                                    <p style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.6 }}>Click a step in the canvas to configure it</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Footer ───────────────────────────────────────────── */}
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
                    {name && (
                        <span style={{ fontSize: 10, color: "#4b5563", flexShrink: 0, whiteSpace: "nowrap" }}>
                            📁 {toDriveFolderName(name)}
                        </span>
                    )}
                    {error && <p style={{ fontSize: 11, color: "#ef4444", flexShrink: 0 }}>{error}</p>}
                    <button
                        onClick={handleCreate}
                        disabled={busy || !canSave}
                        title={!canSave ? "Choose an AI Agent Manager and Human Lead first" : undefined}
                        style={{
                            display: "flex", alignItems: "center", gap: 6,
                            padding: "7px 16px", borderRadius: 8, fontSize: 11, fontWeight: 800,
                            cursor: busy || !canSave ? "not-allowed" : "pointer", flexShrink: 0,
                            background: busy || !canSave ? "rgba(255,140,0,0.05)" : "rgba(255,140,0,0.14)",
                            color: busy || !canSave ? "#4b5563" : "#ff8c00",
                            border: busy || !canSave ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(255,140,0,0.3)",
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

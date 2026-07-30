

/** Shared row shapes for the three item kinds the drawer can display. */

// ── Types ──────────────────────────────────────────────────────────────────────

export type ItemType = "work" | "task" | "agent_task";

export type WorkStatus =
  | "pending"
  | "running"
  | "in_progress"
  | "blocked"
  | "failed"
  | "needs_human"
  | "done"
  | "cancelled";

export type TaskStatus = "pending" | "in_progress" | "done" | "blocked" | "cancelled";
export type AgentTaskStatus = "pending" | "approved" | "rejected" | "cancelled";
export type EffortTier = "quick" | "moderate" | "involved" | "epic";

export interface AgentWork {
  id: string;
  agent_id: string;
  agent_name: string | null;
  title: string;
  description: string | null;
  status: WorkStatus;
  priority: number;
  effort_tier: EffortTier | null;
  estimated_hours: number | null;
  last_progress: string | null;
  completion_report: string | null;
  milestones: { label: string; done?: boolean }[];
  current_milestone: number;
  run_count: number;
  max_runs: number;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface HumanTask {
  id: string;
  title: string;
  description: string | null;
  instructions: string;
  assigned_to: string;
  assigned_username: string | null;
  created_by_agent: string | null;
  status: TaskStatus;
  priority: number;
  effort_tier: EffortTier | null;
  estimated_hours: number | null;
  due_date: string | null;
  followup_count: number;
  completion_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentTask {
  id: string;
  agent_id: string;
  agent_name: string | null;
  section: string;
  title: string;
  body: string | null;          // plain-text description / context
  tool_name: string;            // the tool to be executed
  tool_input: Record<string, unknown>; // tool arguments
  assigned_to: string;
  status: AgentTaskStatus;
  priority: number;
  human_note: string | null;    // rejection/approval note from human
  result: string | null;        // execution result once run
  created_at: string;
  updated_at: string;
}

export interface WorkDetailDrawerProps {
  itemId: string | null;
  itemType: ItemType;
  onClose: () => void;
  onAction?: () => void;
}


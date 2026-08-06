"use client";

/**
 * Support — the only place this section talks to the server.
 *
 * Replaces the old fixtures.ts. Every page imports from here; the shapes are the
 * ones /admin/support returns, snake_case included, so there is no translation
 * layer to drift out of sync.
 */

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BOT_URL}/admin/support${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError(`Can't reach the server at ${BOT_URL}. Is gravity-claw running?`, 0);
  }

  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch {
    // An HTML error page here almost always means the route doesn't exist on the
    // running server — worth saying so rather than "Unexpected token <".
    throw new ApiError(
      res.ok ? "Server returned something that isn't JSON — the deployed API may be older than this page."
             : `HTTP ${res.status}`, res.status);
  }
  if (!res.ok) throw new ApiError(body?.error ?? `HTTP ${res.status}`, res.status);
  return body as T;
}

const qs = (o: Record<string, any>) => {
  const p = new URLSearchParams();
  Object.entries(o).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") p.set(k, String(v)); });
  const s = p.toString();
  return s ? `?${s}` : "";
};

const post = <T,>(path: string, body?: any) =>
  req<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) });
const put = <T,>(path: string, body?: any) =>
  req<T>(path, { method: "PUT", body: JSON.stringify(body ?? {}) });

// ── Reads ───────────────────────────────────────────────────────────────────

export const getSummary   = () => req<any>("/summary");
export const getMetrics   = (days = 7) => req<any>(`/metrics${qs({ days })}`);
export const getSettings  = () => req<any>("/settings");
export const getSignature = () => req<any>("/signature");
export const saveSignature = (p: any) => put<any>("/signature", p);
export const getCategories = () => req<any[]>("/categories");
/** Agents with a Gmail account connected — the options for "which mailbox". */
export const getMailboxes = () => req<{
  agentId: string; email: string; name: string; orphaned: boolean; connectedAt: string;
}[]>("/mailboxes");

export const getTickets = (o: {
  status?: string; category?: string; q?: string; limit?: number; outcome?: string;
} = {}) => req<{ total: number; tickets: any[] }>(`/tickets${qs(o)}`);

export const getTicket = (id: string) => req<any>(`/tickets/${id}`);

/**
 * The action / outcome vocabularies, fetched rather than hardcoded.
 *
 * The server validates against the same list, so a copy here would fail on
 * submit the first time either side changed.
 */
export interface ActionTypeDef {
  key: string; label: string; external: boolean; system: string | null;
}
export const getVocabulary = () => req<{
  actionGroups: { group: string; actions: ActionTypeDef[] }[];
  outcomes: string[];
  reasonCodes: string[];
}>("/vocabulary");

/** Open operational work across every ticket. */
export const getFollowups = (o: { owner?: string; overdue?: string } = {}) =>
  req<{ total: number; overdue: number; followups: any[] }>(`/followups${qs(o)}`);

export const getDocs = (kind?: string, includeArchived = false) =>
  req<any[]>(`/docs${qs({ kind, all: includeArchived ? "1" : undefined })}`);
/** Exactly which docs the agent loads for a category, and the token bill. */
export const getDocPreview = (category?: string) =>
  req<{ category: string | null; totalTokens: number; docs: any[] }>(`/docs/preview${qs({ category })}`);
export const getDocVersions = (id: string) => req<any[]>(`/docs/${id}/versions`);

export const getObservations = (o: { kind?: string; status?: string } = {}) =>
  req<any[]>(`/observations${qs(o)}`);

export const getCorrections = (o: { category?: string; reasonCode?: string } = {}) =>
  req<any[]>(`/corrections${qs(o)}`);

// ── Writes ──────────────────────────────────────────────────────────────────

export const generateDraft = (id: string, hint?: string) => post<any>(`/tickets/${id}/draft`, { hint });

/**
 * What the rep did, in the shape the server takes.
 *
 * `status: "planned"` makes it a follow-up task and then `owner` is required —
 * unfinished work with nobody's name on it is the row that rots in the queue.
 */
export interface ActionPayload {
  actionType: string;
  detail?: string;
  status?: "done" | "planned";
  externalSystem?: string | null;
  owner?: string | null;
  dueAt?: string | null;
}

/** Carried by approve, reject and resolve alike — one shape, one form. */
export interface ResolutionPayload {
  actions?: ActionPayload[];
  followups?: (ActionPayload & { owner: string })[];
  outcome?: string | null;
  resolutionSummary?: string | null;
  close?: boolean;
}

export const approveTicket = (id: string, p: {
  body?: string; reasonCode?: string; reasonNote?: string; severity?: number;
} & ResolutionPayload) => post<any>(`/tickets/${id}/approve`, p);

export const rejectTicket = (id: string, p: {
  reasonCode: string; reasonNote: string; humanBody: string; severity?: number;
} & ResolutionPayload) => post<any>(`/tickets/${id}/reject`, p);

/** Close the ticket out: outcome + summary + whatever was done. */
export const resolveTicket = (id: string, p: ResolutionPayload) =>
  post<any>(`/tickets/${id}/resolve`, p);

/** Resolved outside Mission Control. The explanation is mandatory server-side. */
export const handledElsewhere = (id: string, p: ResolutionPayload & { resolutionSummary: string }) =>
  post<any>(`/tickets/${id}/handled-elsewhere`, p);

/** Log work without touching the conversation or closing anything. */
export const logActions = (id: string, p: ResolutionPayload) =>
  post<any>(`/tickets/${id}/actions`, p);

export const completeAction = (actionId: string, note?: string) =>
  post<any>(`/actions/${actionId}/complete`, { note });
export const cancelAction = (actionId: string, reason: string) =>
  post<any>(`/actions/${actionId}/cancel`, { reason });

/** Retry a reply that was written but never delivered. */
export const resendReply = (id: string) => post<any>(`/tickets/${id}/resend`);

export const escalateTicket = (id: string, p: { note: string; owner?: string; dueAt?: string }) =>
  post<any>(`/tickets/${id}/escalate`, p);
export const setTicketStatus = (id: string, status: string) => post<any>(`/tickets/${id}/status`, { status });

export const createDoc = (p: { title: string; kind?: string; content?: string; scope?: string[]; folder?: string }) =>
  post<any>("/docs", p);
export const saveDoc = (id: string, p: {
  content?: string; title?: string; scope?: string[]; kind?: string; note?: string;
  force?: boolean; isActive?: boolean; reviewNote?: string | null; needsReview?: boolean;
  folder?: string | null;
}) => put<any>(`/docs/${id}`, p);
/** Archive by default (recoverable); purge is permanent. */
export const deleteDoc = (id: string, purge = false) =>
  req<any>(`/docs/${id}${purge ? "?purge=1" : ""}`, { method: "DELETE" });
export const revertDoc = (id: string, version: number) => post<any>(`/docs/${id}/revert`, { version });

export const acceptObservation  = (id: string) => post<any>(`/observations/${id}/accept`);
export const dismissObservation = (id: string, reason?: string) => post<any>(`/observations/${id}/dismiss`, { reason });
export const answerObservation  = (id: string, answer: string, docId?: string | null) =>
  post<any>(`/observations/${id}/answer`, { answer, docId });

export const runReflection = () => post<any>("/reflect");
export const runIngest     = () => post<any>("/ingest");

export const saveSettings = (p: {
  mailAgentId?: string; sendEnabled?: boolean; ingestEnabled?: boolean; mailQuery?: string;
}) => put<any>("/settings", p);
export const saveAssumption = (p: { key: string; value: number; basis: string; unit?: string }) =>
  put<any>("/assumptions", p);

// ── Display helpers ─────────────────────────────────────────────────────────

export const REASON_LABELS: Record<string, string> = {
  wrong_facts: "Wrong facts",
  missed_the_question: "Missed the question",
  wrong_tone: "Wrong tone",
  too_long: "Too long",
  too_short: "Too short",
  policy_violation: "Policy violation",
  needs_human_judgment: "Needed a human",
  missing_context: "Missing context",
  formatting: "Formatting",
  missed_an_action: "Missed an action",
  other: "Other",
};
export const REASON_CODES = Object.keys(REASON_LABELS);

/** What we decided about what the customer asked for — the second axis. */
export const OUTCOME_LABELS: Record<string, string> = {
  answered: "Answered",
  granted: "Granted",
  partially_granted: "Partly granted",
  denied: "Denied",
  no_action_needed: "No action needed",
  handled_elsewhere: "Handled elsewhere",
  spam: "Spam",
};

export const OUTCOME_COLOR: Record<string, string> = {
  answered: "#4a9eff",
  granted: "#22c55e",
  partially_granted: "#f5a840",
  denied: "#f43f5e",
  no_action_needed: "#6b7280",
  handled_elsewhere: "#a78bfa",
  spam: "#6b7280",
};

/** Whether the back-office work is finished — the third axis. */
export const OPS_LABELS: Record<string, string> = {
  none: "No ops work",
  pending: "Work outstanding",
  done: "Ops complete",
};

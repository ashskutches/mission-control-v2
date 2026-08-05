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

// ── Reads ───────────────────────────────────────────────────────────────────

export const getSummary   = () => req<any>("/summary");
export const getMetrics   = (days = 7) => req<any>(`/metrics${qs({ days })}`);
export const getSettings  = () => req<any>("/settings");
export const getCategories = () => req<any[]>("/categories");
/** Agents with a Gmail account connected — the options for "which mailbox". */
export const getMailboxes = () => req<{
  agentId: string; email: string; name: string; orphaned: boolean; connectedAt: string;
}[]>("/mailboxes");

export const getTickets = (o: { status?: string; category?: string; q?: string; limit?: number } = {}) =>
  req<{ total: number; tickets: any[] }>(`/tickets${qs(o)}`);

export const getTicket = (id: string) => req<any>(`/tickets/${id}`);

export const getDocs = (kind?: string) => req<any[]>(`/docs${qs({ kind })}`);
export const getDocVersions = (id: string) => req<any[]>(`/docs/${id}/versions`);

export const getObservations = (o: { kind?: string; status?: string } = {}) =>
  req<any[]>(`/observations${qs(o)}`);

export const getCorrections = (o: { category?: string; reasonCode?: string } = {}) =>
  req<any[]>(`/corrections${qs(o)}`);

// ── Writes ──────────────────────────────────────────────────────────────────

const post = <T>(path: string, body?: any) =>
  req<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) });
const put = <T>(path: string, body?: any) =>
  req<T>(path, { method: "PUT", body: JSON.stringify(body ?? {}) });

export const generateDraft = (id: string, hint?: string) => post<any>(`/tickets/${id}/draft`, { hint });

export const approveTicket = (id: string, p: {
  body?: string; reasonCode?: string; reasonNote?: string; severity?: number;
}) => post<any>(`/tickets/${id}/approve`, p);

export const rejectTicket = (id: string, p: {
  reasonCode: string; reasonNote: string; humanBody: string; severity?: number;
}) => post<any>(`/tickets/${id}/reject`, p);

export const escalateTicket = (id: string, note?: string) => post<any>(`/tickets/${id}/escalate`, { note });
export const setTicketStatus = (id: string, status: string) => post<any>(`/tickets/${id}/status`, { status });

export const createDoc = (p: { title: string; kind?: string; content?: string; scope?: string[] }) =>
  post<any>("/docs", p);
export const saveDoc = (id: string, p: {
  content?: string; title?: string; scope?: string[]; kind?: string; note?: string; force?: boolean;
}) => put<any>(`/docs/${id}`, p);
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
  other: "Other",
};
export const REASON_CODES = Object.keys(REASON_LABELS);

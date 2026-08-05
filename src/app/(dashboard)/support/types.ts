// Support platform — shared types.
//
// These mirror the planned Supabase schema (`support_*` tables) 1:1 on purpose.
// When the backend lands, the fixtures file is deleted and these types stay put —
// wiring up becomes "replace the import with a fetch", not a rewrite.
//
// Spec: gravity-claw/docs/CUSTOMER_SUPPORT_PLAN.md

export type TicketStatus =
  | "new"
  | "triaged"
  | "awaiting_approval"
  | "sent"
  | "awaiting_customer"
  | "escalated"
  | "resolved"
  | "needs_human_only"
  | "spam";

export type Priority = "low" | "normal" | "high" | "urgent";
export type Sentiment = "positive" | "neutral" | "frustrated" | "angry";

/** Reason codes for a rejected or edited draft. A small enum on purpose —
 *  free-text-only reasons don't cluster, and clustering is the point. */
export type ReasonCode =
  | "wrong_facts"
  | "missed_the_question"
  | "wrong_tone"
  | "too_long"
  | "too_short"
  | "policy_violation"
  | "needs_human_judgment"
  | "missing_context"
  | "formatting"
  | "other";

export const REASON_LABELS: Record<ReasonCode, string> = {
  wrong_facts:         "Wrong facts",
  missed_the_question: "Missed the question",
  wrong_tone:          "Wrong tone",
  too_long:            "Too long",
  too_short:           "Too short",
  policy_violation:    "Policy violation",
  needs_human_judgment:"Needed a human",
  missing_context:     "Missing context",
  formatting:          "Formatting",
  other:               "Other",
};

export interface Message {
  id:        string;
  direction: "inbound" | "outbound";
  author:    "customer" | "ai" | "human";
  body:      string;
  sentAt:    string;
  fromAddr:  string;
}

export interface Draft {
  id:            string;
  ticketId:      string;
  subject:       string;
  body:          string;
  model:         string;
  confidence:    number;          // 0–1, the agent's own
  reasoning:     string;          // why it wrote what it wrote — shown to the reviewer
  citedDocIds:   string[];
  status:        "pending" | "approved" | "approved_with_edits" | "rejected" | "superseded" | "sent";
  generatedAt:   string;
  costCents:     number;
}

export interface Ticket {
  id:              string;
  ref:             string;         // human-facing "#847"
  subject:         string;
  customerName:    string;
  customerEmail:   string;
  category:        string;         // slug from the fixed taxonomy
  status:          TicketStatus;
  priority:        Priority;
  sentiment:       Sentiment;
  orderRef:        string | null;
  firstInboundAt:  string;
  awaitingMinutes: number;
  messages:        Message[];
  draft:           Draft | null;
  tags:            string[];
}

/** A training pair. The heart of the whole feature. */
export interface Correction {
  id:          string;
  ticketId:    string;
  ticketRef:   string;
  subject:     string;
  /** `edited_on_approve` is the majority case by volume — approving with three
   *  words changed is the same signal at lower severity. */
  kind:        "rejected" | "edited_on_approve";
  aiBody:      string;
  humanBody:   string;
  reasonCode:  ReasonCode;
  reasonNote:  string;
  severity:    1 | 2 | 3 | 4 | 5;
  category:    string;
  reflectedAt: string | null;
  createdAt:   string;
  createdBy:   string;
}

export type ObservationKind = "observation" | "question" | "doc_proposal" | "category_proposal";

/** Topic taxonomy for what the agent got confused about. */
export type ObservationTopic =
  | "missing_kb_article"
  | "policy_ambiguity"
  | "low_confidence_pattern"
  | "intent_unclear"
  | "escalation_rule_unclear"
  | "tone_drift";

export interface Observation {
  id:            string;
  kind:          ObservationKind;
  topic:         ObservationTopic;
  title:         string;
  body:          string;
  /** Must be non-empty — enforced at write time server-side. The agent doesn't get
   *  to have opinions about its own performance that aren't tied to real corrections. */
  evidenceIds:   string[];
  evidenceCount: number;
  confidence:    number;
  status:        "open" | "accepted" | "answered" | "dismissed";
  answer:        string | null;
  proposedDocId:      string | null;
  proposedDocTitle:   string | null;
  proposedDocDiff:    string | null;
  createdAt:     string;
  runId:         string;
}

export type DocKind = "reference" | "learned" | "voice";

export interface SupportDoc {
  id:            string;
  slug:          string;
  title:         string;
  kind:          DocKind;
  source:        "human" | "reflection";
  content:       string;
  version:       number;
  isActive:      boolean;
  scope:         string[];        // category slugs; empty = always loaded
  tokenEstimate: number;
  usedInDrafts:  number;          // how many drafts cited it — makes a bad doc findable
  updatedAt:     string;
  updatedBy:     string;
}

export interface CategoryStat {
  slug:    string;
  label:   string;
  count:   number;
  pctOfTotal: number;
  trendPct: number | null;        // null = no comparable prior period
}

export interface MoneyBasis {
  label: string;
  value: string;
  basis: string;                  // REQUIRED. A dollar figure with no stated
                                  // calculation is decoration.
}

export interface DashboardMetrics {
  rangeLabel:  string;
  ticketsIn:   number;
  ticketsInTrend: number;
  volumeSeries: number[];

  automationRate:      number | null;   // clean approvals ÷ drafts generated
  automationRateTrend: number | null;
  fcrRate:             number | null;   // resolved on first reply, no customer follow-up
  fcrRateTrend:        number | null;
  medianFirstResponseMinutes: number | null;
  medianFirstResponseTrend:   number | null;
  csat:                number | null;   // null = not measured, NOT zero

  moneySavedTotal:   string;
  moneySavedTrend:   number | null;
  moneySavedBreakdown: MoneyBasis[];

  revenueAttributed:  string | null;    // null = not attributable
  revenueBasis:       string;

  reviewQueueDepth:  number;
  oldestWaitingMinutes: number;

  topIssues:   CategoryStat[];
}

// ─────────────────────────────────────────────────────────────────────────────
//  SAMPLE DATA — NOTHING HERE IS REAL.
//
//  This file exists so the interface can be reviewed and agreed on before any
//  backend is built. Every page imports from here and nowhere else.
//
//  When the API lands: delete this file, replace each `import { x } from
//  "../fixtures"` with a fetch against /admin/support/*. The types in ./types.ts
//  are the contract and do not change.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  Ticket, Correction, Observation, SupportDoc, DashboardMetrics, CategoryStat,
} from "./types";

export const IS_SAMPLE_DATA = true;

/** The fixed taxonomy. The classifier picks FROM this list — it may not invent
 *  a label, or "top 5 issues" becomes 40 categories of one. New categories
 *  arrive as a `category_proposal` observation a human accepts. */
export const CATEGORIES: { slug: string; label: string }[] = [
  { slug: "shipping-delay",     label: "Shipping delay"      },
  { slug: "order-status",       label: "Order status"        },
  { slug: "damaged-on-arrival", label: "Damaged on arrival"  },
  { slug: "assembly-help",      label: "Assembly & setup"    },
  { slug: "bungee-fit",         label: "Bungee fit & tension"},
  { slug: "return-request",     label: "Return request"      },
  { slug: "refund-status",      label: "Refund status"       },
  { slug: "warranty-claim",     label: "Warranty claim"      },
  { slug: "product-question",   label: "Product question"    },
  { slug: "billing-issue",      label: "Billing issue"       },
  { slug: "cancel-order",       label: "Cancel order"        },
  { slug: "wholesale-inquiry",  label: "Wholesale inquiry"   },
  { slug: "other",              label: "Other"               },
];

export const categoryLabel = (slug: string) =>
  CATEGORIES.find(c => c.slug === slug)?.label ?? slug;

// ── Dashboard ────────────────────────────────────────────────────────────────

const TOP_ISSUES: CategoryStat[] = [
  { slug: "shipping-delay",     label: "Shipping delay",       count: 34, pctOfTotal: 21.4, trendPct:  8 },
  { slug: "bungee-fit",         label: "Bungee fit & tension", count: 27, pctOfTotal: 17.0, trendPct: 14 },
  { slug: "order-status",       label: "Order status",         count: 21, pctOfTotal: 13.2, trendPct: -3 },
  { slug: "assembly-help",      label: "Assembly & setup",     count: 18, pctOfTotal: 11.3, trendPct:  0 },
  { slug: "refund-status",      label: "Refund status",        count: 12, pctOfTotal:  7.5, trendPct: -6 },
];

export const METRICS: DashboardMetrics = {
  rangeLabel: "Last 7 days",
  ticketsIn: 159,
  ticketsInTrend: 12,
  volumeSeries: [18, 24, 21, 29, 26, 22, 19],

  automationRate: 0.61,
  automationRateTrend: 5,
  fcrRate: 0.74,
  fcrRateTrend: -2,
  medianFirstResponseMinutes: 14,
  medianFirstResponseTrend: -31,
  csat: null,                       // no survey exists yet — shows as "not measured"

  moneySavedTotal: "$3,180",
  moneySavedTrend: 18,
  moneySavedBreakdown: [
    {
      label: "Drafting time avoided",
      value: "$2,410",
      basis: "97 clean approvals × (11.4 min measured baseline − 1.9 min median review) × $38/hr loaded rate",
    },
    {
      label: "Escalations avoided",
      value: "$540",
      basis: "18 tickets resolved at tier 1 that historically escalated × $30 measured escalation cost",
    },
    {
      label: "Faster first response",
      value: "$230",
      basis: "Median FRT 20.3 min → 14.0 min. Modelled, not observed — treat as the softest of the three.",
    },
  ],

  revenueAttributed: "$1,240",
  revenueBasis:
    "2 cancellations retained ($740) + 1 warranty replacement that re-ordered within 14 days ($500). " +
    "Only ticket-linked orders with a verified outcome are counted. Everything else reads “not attributable”, never $0.",

  reviewQueueDepth: 7,
  oldestWaitingMinutes: 43,

  topIssues: TOP_ISSUES,
};

// ── Tickets ──────────────────────────────────────────────────────────────────

export const TICKETS: Ticket[] = [
  {
    id: "t-847", ref: "#847",
    subject: "Bungee cord feels way too tight",
    customerName: "Jane Alvarez", customerEmail: "jane.alvarez@example.com",
    category: "bungee-fit", status: "awaiting_approval", priority: "normal",
    sentiment: "neutral", orderRef: "#LR-20418",
    firstInboundAt: "2026-08-04T14:22:00Z", awaitingMinutes: 43,
    tags: ["first-purchase"],
    messages: [{
      id: "m-1", direction: "inbound", author: "customer",
      fromAddr: "jane.alvarez@example.com", sentAt: "2026-08-04T14:22:00Z",
      body:
        "The bungee cords on my mini trampoline are really tight — I can barely get them " +
        "hooked onto the frame and it took two of us. Is this normal or did I get a " +
        "defective set? I don't want to force it and snap something.",
    }],
    draft: {
      id: "d-847", ticketId: "t-847",
      subject: "Re: Bungee cord feels way too tight",
      body:
        "Hi Jane,\n\n" +
        "Thanks for reaching out! Tight bungees are completely normal on a new rebounder — " +
        "they're built with extra tension so they break in rather than sag.\n\n" +
        "A few things that help:\n" +
        "1. Work opposite sides of the frame rather than going around in a circle\n" +
        "2. Use the tensioning tool that shipped in the box\n" +
        "3. They loosen noticeably after about 5 sessions\n\n" +
        "If they still feel wrong after a week of use, send us a photo and we'll take a look.\n\n" +
        "— The Leaps & Rebounds Team",
      model: "claude-sonnet-4-5", confidence: 0.68,
      reasoning:
        "Matched to the assembly reference doc. Confidence held down because the customer " +
        "raised a possible defect and I have no way to confirm the unit's batch — I did not " +
        "promise a replacement.",
      citedDocIds: ["doc-assembly", "doc-voice"],
      status: "pending", generatedAt: "2026-08-04T14:24:00Z", costCents: 3,
    },
  },
  {
    id: "t-846", ref: "#846",
    subject: "Where's my tracking number?",
    customerName: "Bob Nkemelu", customerEmail: "bnkemelu@example.com",
    category: "order-status", status: "awaiting_approval", priority: "normal",
    sentiment: "neutral", orderRef: "#LR-20390",
    firstInboundAt: "2026-08-04T14:51:00Z", awaitingMinutes: 14,
    tags: [],
    messages: [{
      id: "m-2", direction: "inbound", author: "customer",
      fromAddr: "bnkemelu@example.com", sentAt: "2026-08-04T14:51:00Z",
      body: "Ordered 6 days ago and still no tracking email. Has it shipped?",
    }],
    draft: {
      id: "d-846", ticketId: "t-846",
      subject: "Re: Where's my tracking number?",
      body:
        "Hi Bob,\n\n" +
        "Good news — order #LR-20390 shipped yesterday afternoon. Tracking is " +
        "1Z999AA10123456784 (UPS Ground), currently showing an estimated delivery of " +
        "Thursday.\n\n" +
        "The tracking email may have landed in spam — worth a quick check.\n\n" +
        "— The Leaps & Rebounds Team",
      model: "claude-sonnet-4-5", confidence: 0.91,
      reasoning: "Pulled fulfilment status and tracking directly from the linked Shopify order. High confidence — this is a lookup, not a judgement.",
      citedDocIds: ["doc-shipping", "doc-voice"],
      status: "pending", generatedAt: "2026-08-04T14:52:00Z", costCents: 2,
    },
  },
  {
    id: "t-845", ref: "#845",
    subject: "Frame arrived bent — very disappointed",
    customerName: "Alice Chen", customerEmail: "alice.chen@example.com",
    category: "damaged-on-arrival", status: "awaiting_approval", priority: "high",
    sentiment: "angry", orderRef: "#LR-20355",
    firstInboundAt: "2026-08-04T13:10:00Z", awaitingMinutes: 115,
    tags: ["repeat-customer", "photo-attached"],
    messages: [{
      id: "m-3", direction: "inbound", author: "customer",
      fromAddr: "alice.chen@example.com", sentAt: "2026-08-04T13:10:00Z",
      body:
        "This is my second rebounder from you and the frame arrived visibly bent on one " +
        "side. Photo attached. I've already waited three weeks for this. I want a " +
        "replacement shipped today or a full refund, and I shouldn't have to pay return " +
        "shipping on something that arrived broken.",
    }],
    draft: {
      id: "d-845", ticketId: "t-845",
      subject: "Re: Frame arrived bent — very disappointed",
      body:
        "Hi Alice,\n\n" +
        "I'm really sorry — that's not the experience we want, especially on a second " +
        "purchase. I've flagged this for a replacement and you won't pay return shipping " +
        "on a damaged arrival.\n\n" +
        "Someone will confirm the replacement shipment within one business day.\n\n" +
        "— The Leaps & Rebounds Team",
      model: "claude-sonnet-4-5", confidence: 0.44,
      reasoning:
        "Low confidence. The reference docs cover damaged-on-arrival returns but do not " +
        "state whether I can commit to a same-day replacement, and the customer asked for " +
        "one specifically. I have hedged rather than promised. Recommend a human reads this.",
      citedDocIds: ["doc-returns"],
      status: "pending", generatedAt: "2026-08-04T13:12:00Z", costCents: 4,
    },
  },
  {
    id: "t-844", ref: "#844",
    subject: "Do you offer bulk pricing for gyms?",
    customerName: "Marcus Webb", customerEmail: "m.webb@fitcollective.example",
    category: "wholesale-inquiry", status: "escalated", priority: "normal",
    sentiment: "positive", orderRef: null,
    firstInboundAt: "2026-08-04T11:02:00Z", awaitingMinutes: 0,
    tags: ["b2b"],
    messages: [{
      id: "m-4", direction: "inbound", author: "customer",
      fromAddr: "m.webb@fitcollective.example", sentAt: "2026-08-04T11:02:00Z",
      body: "We're outfitting three studio locations, looking at 40–50 units. Who do I talk to about pricing?",
    }],
    draft: null,
  },
  {
    id: "t-843", ref: "#843",
    subject: "Refund still not showing on my card",
    customerName: "Priya Raman", customerEmail: "praman@example.com",
    category: "refund-status", status: "sent", priority: "normal",
    sentiment: "frustrated", orderRef: "#LR-20201",
    firstInboundAt: "2026-08-04T09:30:00Z", awaitingMinutes: 0,
    tags: [],
    messages: [
      {
        id: "m-5", direction: "inbound", author: "customer",
        fromAddr: "praman@example.com", sentAt: "2026-08-04T09:30:00Z",
        body: "You told me the refund was processed on the 28th. It's the 4th and there's nothing on my statement.",
      },
      {
        id: "m-6", direction: "outbound", author: "human",
        fromAddr: "support@leapsandrebounds.com", sentAt: "2026-08-04T09:52:00Z",
        body:
          "Hi Priya,\n\nYou're right to chase this. The refund was issued on the 28th on our " +
          "side (ref RF-88210), but card issuers routinely take 5–10 business days to post it. " +
          "That puts you at the outer edge of normal, not past it.\n\n" +
          "If it hasn't appeared by Friday the 8th, reply here and I'll open a trace with our " +
          "payment processor and stay on it until it's resolved.\n\n— Sam, Leaps & Rebounds",
      },
    ],
    draft: null,
  },
  {
    id: "t-842", ref: "#842",
    subject: "Replacement bungees — which size?",
    customerName: "Tom Ridley", customerEmail: "tridley@example.com",
    category: "product-question", status: "resolved", priority: "low",
    sentiment: "neutral", orderRef: "#LR-19877",
    firstInboundAt: "2026-08-03T16:40:00Z", awaitingMinutes: 0,
    tags: [],
    messages: [{
      id: "m-7", direction: "inbound", author: "customer",
      fromAddr: "tridley@example.com", sentAt: "2026-08-03T16:40:00Z",
      body: "Need to order replacement bungees. How do I know which size I need?",
    }],
    draft: null,
  },
];

// ── Corrections — the training pairs ─────────────────────────────────────────

export const CORRECTIONS: Correction[] = [
  {
    id: "c-1", ticketId: "t-830", ticketRef: "#830",
    subject: "When will my backordered unit ship?",
    kind: "rejected", severity: 4, category: "shipping-delay",
    reasonCode: "wrong_facts",
    reasonNote:
      "Quoted the standard 3–5 business day window on a backordered item. That item is " +
      "on a 4–6 week vendor lead time and the customer would have been furious in a week.",
    aiBody:
      "Hi Dana,\n\nThanks for checking in! Your order is on its way and should arrive within " +
      "3–5 business days. You'll get tracking as soon as it leaves our warehouse.\n\n" +
      "— The Leaps & Rebounds Team",
    humanBody:
      "Hi Dana,\n\nStraight answer: this one's on backorder, and the current vendor estimate " +
      "is 4–6 weeks from your order date, so mid-September.\n\nI know that's not what you " +
      "wanted to hear. Two options — sit tight and I'll email you the moment it ships, or I " +
      "can move you to the 40\" model which is in stock now and refund the difference. Just " +
      "say the word.\n\n— Sam, Leaps & Rebounds",
    reflectedAt: "2026-08-03T02:00:00Z",
    createdAt: "2026-08-02T15:20:00Z", createdBy: "Sam",
  },
  {
    id: "c-2", ticketId: "t-828", ticketRef: "#828",
    subject: "Bungee snapped after 3 weeks",
    kind: "rejected", severity: 5, category: "warranty-claim",
    reasonCode: "policy_violation",
    reasonNote:
      "Offered a full refund plus a free replacement set. We do one or the other, never " +
      "both. This would have cost us the unit price if I'd sent it.",
    aiBody:
      "Hi Chris,\n\nThat should absolutely not happen. I've processed a full refund and I'm " +
      "sending a replacement bungee set out today at no charge.\n\n— The Leaps & Rebounds Team",
    humanBody:
      "Hi Chris,\n\nA bungee failing at three weeks is a warranty defect — covered, no " +
      "question.\n\nI'm sending a replacement set today, free, no return needed on the old " +
      "one. If you'd rather have the money back instead of the replacement, say so and I'll " +
      "refund the full unit price instead.\n\n— Sam, Leaps & Rebounds",
    reflectedAt: "2026-08-03T02:00:00Z",
    createdAt: "2026-08-02T11:05:00Z", createdBy: "Sam",
  },
  {
    id: "c-3", ticketId: "t-835", ticketRef: "#835",
    subject: "Is the 40\" too big for a small apartment?",
    kind: "edited_on_approve", severity: 2, category: "product-question",
    reasonCode: "too_long",
    reasonNote: "Six paragraphs for a yes/no question. Cut it to three lines and it reads better.",
    aiBody:
      "Hi Nina,\n\nGreat question! Apartment sizing is something we get asked about a lot, and " +
      "there are a few factors to weigh up...\n\n[four further paragraphs on ceiling height, " +
      "floor protection, downstairs neighbours, and folding storage]",
    humanBody:
      "Hi Nina,\n\nThe 40\" needs about a 4×4 ft footprint and 7 ft of ceiling clearance for " +
      "most people. If you've got that, it fits fine — it folds flat against a wall when " +
      "you're done.\n\nIf your ceilings are under 7 ft, go with the 36\".\n\n— Sam, Leaps & Rebounds",
    reflectedAt: "2026-08-03T02:00:00Z",
    createdAt: "2026-08-02T17:44:00Z", createdBy: "Sam",
  },
  {
    id: "c-4", ticketId: "t-839", ticketRef: "#839",
    subject: "Cancel my order please",
    kind: "rejected", severity: 3, category: "cancel-order",
    reasonCode: "missed_the_question",
    reasonNote:
      "Customer asked to cancel. The draft explained the return policy instead of actually " +
      "answering whether it could still be cancelled before dispatch.",
    aiBody:
      "Hi Owen,\n\nOur return window is 30 days from delivery. To start a return, just reply " +
      "with your order number and we'll send you a prepaid label.\n\n— The Leaps & Rebounds Team",
    humanBody:
      "Hi Owen,\n\nYes — it hasn't dispatched yet, so I've cancelled it. Your refund of " +
      "$249.00 is on its way back to the card you paid with; it'll take 5–10 business days " +
      "to show up.\n\nNothing else you need to do.\n\n— Sam, Leaps & Rebounds",
    reflectedAt: null,
    createdAt: "2026-08-04T08:15:00Z", createdBy: "Sam",
  },
  {
    id: "c-5", ticketId: "t-841", ticketRef: "#841",
    subject: "Third email about this — nobody has replied",
    kind: "rejected", severity: 4, category: "other",
    reasonCode: "wrong_tone",
    reasonNote:
      "Opened with \"Thanks for reaching out!\" on someone's third unanswered email. Reads " +
      "like we hadn't read it. Acknowledge the failure first, cheerfulness second.",
    aiBody:
      "Hi Rachel,\n\nThanks for reaching out! I'd be happy to help you with your enquiry. " +
      "Could you provide your order number so I can look into this for you?\n\n" +
      "— The Leaps & Rebounds Team",
    humanBody:
      "Hi Rachel,\n\nThree emails and no reply — that's on us, and I'm sorry.\n\nI've found " +
      "your order (#LR-20144) so you don't need to dig it out again. Here's where it actually " +
      "stands: [...]\n\nI'm handling this one personally from here.\n\n— Sam, Leaps & Rebounds",
    reflectedAt: null,
    createdAt: "2026-08-04T10:30:00Z", createdBy: "Sam",
  },
  {
    id: "c-6", ticketId: "t-836", ticketRef: "#836",
    subject: "Does it come with a warranty?",
    kind: "edited_on_approve", severity: 1, category: "product-question",
    reasonCode: "formatting",
    reasonNote: "Signature was wrong — used the generic team sign-off on a named thread.",
    aiBody: "Hi Leo,\n\nYes — 2 years on the frame and 1 year on the bungees.\n\n— The Leaps & Rebounds Team",
    humanBody: "Hi Leo,\n\nYes — 2 years on the frame and 1 year on the bungees.\n\n— Sam, Leaps & Rebounds",
    reflectedAt: null,
    createdAt: "2026-08-04T12:02:00Z", createdBy: "Sam",
  },
];

// ── Observations & questions ─────────────────────────────────────────────────

export const OBSERVATIONS: Observation[] = [
  {
    id: "o-1", kind: "question", topic: "policy_ambiguity",
    title: "Which refund window is correct for warranty claims — 30, 60 or 90 days?",
    body:
      "Across three corrections this month, three different humans quoted three different " +
      "warranty refund windows. The reference doc says 30 days; Sam wrote 60 on #828 and 90 " +
      "on #812. I don't know which is right, so I've stopped quoting a number at all — which " +
      "means those replies now need a human every time.",
    evidenceIds: ["c-2"], evidenceCount: 3, confidence: 0.88,
    status: "open", answer: null,
    proposedDocId: "doc-returns", proposedDocTitle: "Returns, refunds & warranty", proposedDocDiff: null,
    createdAt: "2026-08-03T02:00:00Z", runId: "r-12",
  },
  {
    id: "o-2", kind: "observation", topic: "missing_kb_article",
    title: "Every `wrong_facts` rejection this week was a backordered item quoted at 3–5 days",
    body:
      "Four rejections, all the same shape: the customer asks about delivery, I read the " +
      "standard shipping doc, and I quote 3–5 business days without checking whether the line " +
      "item is actually in stock. The shipping doc doesn't mention backorders at all, so I " +
      "have nothing telling me to look.\n\n" +
      "This is the single biggest cause of rejection in the pool right now.",
    evidenceIds: ["c-1"], evidenceCount: 4, confidence: 0.94,
    status: "open", answer: null,
    proposedDocId: "doc-shipping", proposedDocTitle: "Shipping times & carriers",
    proposedDocDiff:
      "+ ## Backordered items\n" +
      "+ Before quoting any delivery estimate, check the line item's inventory status.\n" +
      "+ If the item is backordered, the standard 3–5 day window does NOT apply — quote the\n" +
      "+ vendor lead time on the product record and say the word \"backorder\" explicitly.\n" +
      "+ Never give a date you cannot source from the order record.",
    createdAt: "2026-08-03T02:00:00Z", runId: "r-12",
  },
  {
    id: "o-3", kind: "observation", topic: "tone_drift",
    title: "\"Thanks for reaching out!\" is wrong on any thread where we already failed",
    body:
      "Two corrections tagged `wrong_tone`, both on threads where the customer had already " +
      "been ignored or let down. The stock cheerful opener reads as if nobody read the " +
      "message. The humans both opened by naming the failure instead.\n\n" +
      "Proposed rule for the voice doc: if the thread contains a prior unanswered inbound, or " +
      "the sentiment is frustrated or angry, acknowledge before anything else. No exclamation " +
      "marks in the first line.",
    evidenceIds: ["c-5"], evidenceCount: 2, confidence: 0.81,
    status: "open", answer: null,
    proposedDocId: "doc-voice", proposedDocTitle: "Brand voice & signature",
    proposedDocDiff:
      "+ ## When we've already dropped the ball\n" +
      "+ If the thread has a prior inbound we never answered, or sentiment is frustrated/angry:\n" +
      "+ name the failure in the first sentence. No \"Thanks for reaching out!\", no exclamation\n" +
      "+ marks in the opener. Apologise once, specifically, then get straight to the substance.",
    createdAt: "2026-08-03T02:00:00Z", runId: "r-12",
  },
  {
    id: "o-4", kind: "category_proposal", topic: "intent_unclear",
    title: "Propose a new category: \"noise & downstairs neighbours\"",
    body:
      "Six tickets in the last fortnight are about impact noise and apartment neighbours. " +
      "They're currently landing in `product-question` and `other`, which is why neither shows " +
      "the real pattern. I can't create a category myself — asking.",
    evidenceIds: ["c-3"], evidenceCount: 6, confidence: 0.72,
    status: "open", answer: null,
    proposedDocId: null, proposedDocTitle: null, proposedDocDiff: null,
    createdAt: "2026-08-03T02:00:00Z", runId: "r-12",
  },
  {
    id: "o-5", kind: "question", topic: "escalation_rule_unclear",
    title: "At what order value should I stop drafting and escalate?",
    body:
      "The wholesale enquiry (#844, 40–50 units) I escalated on instinct. I don't have a rule " +
      "for this. Is there a dollar threshold, a unit count, or a customer type where I should " +
      "never draft?",
    evidenceIds: ["c-4"], evidenceCount: 1, confidence: 0.65,
    status: "open", answer: null,
    proposedDocId: null, proposedDocTitle: null, proposedDocDiff: null,
    createdAt: "2026-08-03T02:00:00Z", runId: "r-12",
  },
  {
    id: "o-6", kind: "observation", topic: "low_confidence_pattern",
    title: "Length is the most common edit and it correlates with confidence, not category",
    body:
      "Every `too_long` correction came from a draft with confidence above 0.85. When I'm " +
      "sure, I over-explain. Suggested guardrail: cap replies at 120 words unless the customer " +
      "asked a multi-part question.",
    evidenceIds: ["c-3"], evidenceCount: 5, confidence: 0.77,
    status: "accepted", answer: null,
    proposedDocId: "doc-voice", proposedDocTitle: "Brand voice & signature", proposedDocDiff: null,
    createdAt: "2026-07-27T02:00:00Z", runId: "r-11",
  },
];

// ── Knowledge base ───────────────────────────────────────────────────────────

export const DOCS: SupportDoc[] = [
  {
    id: "doc-shipping", slug: "shipping-times", title: "Shipping times & carriers",
    kind: "reference", source: "human", version: 4, isActive: true,
    scope: ["shipping-delay", "order-status"], tokenEstimate: 780, usedInDrafts: 412,
    updatedAt: "2026-07-19T00:00:00Z", updatedBy: "Sam",
    content:
      "## Standard shipping\n\nIn-stock orders dispatch within 1 business day and arrive in " +
      "3–5 business days via UPS Ground (contiguous US).\n\n## Alaska, Hawaii & PR\n\n" +
      "7–10 business days. Surcharge applies and is shown at checkout.\n\n## Tracking\n\n" +
      "Tracking emails go out automatically on dispatch. If a customer hasn't received one, " +
      "check spam before assuming a fulfilment problem.",
  },
  {
    id: "doc-returns", slug: "returns-refunds-warranty", title: "Returns, refunds & warranty",
    kind: "reference", source: "human", version: 7, isActive: true,
    scope: ["return-request", "refund-status", "warranty-claim", "damaged-on-arrival"],
    tokenEstimate: 1140, usedInDrafts: 288,
    updatedAt: "2026-07-30T00:00:00Z", updatedBy: "Sam",
    content:
      "## Return window\n\n30 days from delivery, unused and in original packaging. Customer " +
      "pays return shipping.\n\n## Damaged on arrival\n\nWe pay return shipping. Photo required. " +
      "Replacement or refund — **one or the other, never both**.\n\n## Warranty\n\n2 years " +
      "frame, 1 year bungees. Defects are covered; wear from use is not.\n\n## Refund timing\n\n" +
      "Issued same day on our side. Card issuers take a further 5–10 business days to post.",
  },
  {
    id: "doc-assembly", slug: "assembly-and-setup", title: "Assembly & first-use setup",
    kind: "reference", source: "human", version: 2, isActive: true,
    scope: ["assembly-help", "bungee-fit"], tokenEstimate: 960, usedInDrafts: 197,
    updatedAt: "2026-06-11T00:00:00Z", updatedBy: "Sam",
    content:
      "## Bungee tension\n\nNew bungees are deliberately tight — they break in rather than sag. " +
      "Fit opposite sides of the frame in sequence, not around the circle. Use the tensioning " +
      "tool in the box.\n\nThey loosen noticeably after ~5 sessions. Persistent difficulty " +
      "after a week of use is worth a photo.",
  },
  {
    id: "doc-voice", slug: "brand-voice", title: "Brand voice & signature",
    kind: "voice", source: "human", version: 5, isActive: true,
    scope: [], tokenEstimate: 420, usedInDrafts: 1104,
    updatedAt: "2026-07-22T00:00:00Z", updatedBy: "Sam",
    content:
      "Warm, direct, never corporate. Lead with the answer, then the reasoning.\n\n" +
      "**Never:** \"I apologise for any inconvenience this may have caused\", \"per our policy\", " +
      "\"unfortunately\" as an opener.\n\n**Sign-off:** a named human where one is handling it " +
      "(\"— Sam, Leaps & Rebounds\"), otherwise \"— The Leaps & Rebounds Team\".",
  },
  {
    id: "doc-backorder-learned", slug: "backorder-lead-times", title: "Backordered items — check before quoting",
    kind: "learned", source: "reflection", version: 1, isActive: true,
    scope: ["shipping-delay", "order-status"], tokenEstimate: 210, usedInDrafts: 34,
    updatedAt: "2026-07-27T02:00:00Z", updatedBy: "Reflection run r-11",
    content:
      "Learned from 4 corrections. Never quote a delivery window without first checking the " +
      "line item's inventory status. Backordered items run 4–6 weeks and must be described as " +
      "backordered explicitly — customers forgive a long wait far more readily than a wrong date.",
  },
  {
    id: "doc-tone-learned", slug: "openers-when-we-failed", title: "Openers on threads where we failed",
    kind: "learned", source: "reflection", version: 2, isActive: true,
    scope: [], tokenEstimate: 180, usedInDrafts: 51,
    updatedAt: "2026-07-27T02:00:00Z", updatedBy: "Reflection run r-11",
    content:
      "Learned from 2 corrections. If the customer has written before without a reply, the " +
      "first sentence acknowledges that. Cheerful openers on a neglected thread read as if " +
      "nobody looked at the history.",
  },
];

export const OPEN_QUESTION_COUNT = OBSERVATIONS.filter(o => o.kind === "question" && o.status === "open").length;
export const PENDING_APPROVAL_COUNT = TICKETS.filter(t => t.status === "awaiting_approval").length;
export const UNREFLECTED_COUNT = CORRECTIONS.filter(c => !c.reflectedAt).length;

export const LAST_REFLECTION = {
  runId: "r-12",
  finishedAt: "2026-08-03T02:04:00Z",
  trigger: "cron" as const,
  correctionsConsidered: 9,
  observationsCreated: 3,
  questionsCreated: 2,
  docProposalsCreated: 3,
  costCents: 41,
};

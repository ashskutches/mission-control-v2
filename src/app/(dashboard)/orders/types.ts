/**
 * Shapes returned by /admin/orders on gravity-claw.
 * Keep in sync with gravity-claw/src/routes/orders.ts.
 */

export interface Money {
  amount:       string;
  currencyCode: string;
}

/** Why an order is in the queue. `detail` is the sentence the UI shows. */
export interface OrderException {
  code:     string;
  label:    string;
  severity: number;   // 0-100; the order inherits the max
  detail:   string;
}

export interface QueueLineItem {
  id:                  string;
  name:                string;
  quantity:            number;
  sku:                 string | null;
  variantTitle:        string | null;
  unfulfilledQuantity: number;
  unitPrice:           Money;
}

export interface QueueFulfillment {
  id:                  string;
  displayStatus:       string | null;
  createdAt:           string | null;
  updatedAt:           string | null;
  estimatedDeliveryAt: string | null;
  deliveredAt:         string | null;
  inTransitAt:         string | null;
  trackingNumber:      string | null;
  trackingUrl:         string | null;
  carrier:             string | null;
}

export interface QueueOrder {
  id:                string;
  legacyId:          string;
  name:              string;
  createdAt:         string;
  ageDays:           number;
  tags:              string[];
  note:              string | null;
  financialStatus:   string;
  fulfillmentStatus: string;
  returnStatus:      string;
  total:             Money;
  customer: {
    id: string; firstName: string | null; lastName: string | null;
    email: string | null; phone: string | null; orderCount: number | null;
  } | null;
  phone:            string | null;
  city:             string | null;
  region:           string | null;
  itemCount:        number;
  unfulfilledCount: number;
  lineItems:        QueueLineItem[];
  fulfillments:     QueueFulfillment[];
  alreadyTexted:    boolean;
  exceptions:       OrderException[];
  severity:         number;
}

/** A bucket that failed or was truncated. If non-empty the queue is INCOMPLETE. */
export interface DegradedBucket {
  bucket: string;
  label:  string;
  error:  string;
}

export interface QueueResponse {
  orders:   QueueOrder[];
  total:    number;
  counts:   Record<string, number>;
  degraded: DegradedBucket[];
  scanned:  number;
  params:   { days: number; slaDays: number; stalledDays: number; highValue: number; since: string; code: string | null };
  complete: boolean;
}

export interface TrackingEvent {
  id:         string;
  status:     string | null;
  message:    string | null;
  happenedAt: string;
}

export interface DetailFulfillment extends QueueFulfillment {
  events: TrackingEvent[];
}

export interface Address {
  name?: string | null; address1?: string | null; address2?: string | null;
  city?: string | null; provinceCode?: string | null; zip?: string | null;
  country?: string | null; phone?: string | null;
}

export interface OrderDetail {
  id:           string;
  legacyId:     string;
  name:         string;
  createdAt:    string;
  processedAt:  string | null;
  cancelledAt:  string | null;
  cancelReason: string | null;
  ageDays:      number;
  tags:         string[];
  note:         string | null;
  email:        string | null;
  phone:        string | null;
  financialStatus:   string;
  fulfillmentStatus: string;
  returnStatus:      string;
  totals: { subtotal: Money; shipping: Money; tax: Money; total: Money; refunded: Money };
  shippingMethod: string | null;
  customer: {
    id: string; firstName: string | null; lastName: string | null;
    email: string | null; phone: string | null; orderCount: number | null;
    lifetimeSpend: Money | null; since: string | null; tags: string[];
  } | null;
  shippingAddress: Address | null;
  billingAddress:  Address | null;
  lineItems: (QueueLineItem & { imageUrl: string | null; lineTotal: Money })[];
  fulfillments: DetailFulfillment[];
  payment: {
    brand: string | null; number: string | null; wallet: string | null;
    gateway: string | null; paidAt: string | null; amount: Money;
  } | null;
  transactions: {
    id: string; kind: string; status: string; gateway: string | null;
    processedAt: string | null; amount: Money;
    cardNumber: string | null; cardBrand: string | null; wallet: string | null;
  }[];
  exceptions: OrderException[];
  severity:   number;
  adminUrl:   string;
}

// ── Shared display helpers ────────────────────────────────────────────────────

/**
 * Severity → colour. Deliberately NOT the palette from the research report:
 * #e98d20 on white is 2.5:1 and #D1D1D1 on white is 1.5:1, both well under the
 * 4.5:1 that same report asks for. These are the dashboard's existing tokens.
 */
export function severityColor(severity: number): string {
  if (severity >= 90) return "#f43f5e";  // rose — money lost or carrier failed
  if (severity >= 75) return "#fb923c";  // orange — late, needs action today
  if (severity >= 60) return "#fbbf24";  // amber — watch it
  return "#64748b";                       // slate — informational
}

export function money(m: Money | null | undefined): string {
  if (!m) return "—";
  const n = Number(m.amount);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: m.currencyCode || "USD",
  }).format(n);
}

/** Pull a message off an unknown thrown value without reaching for `any`. */
export function errMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function statusLabel(s: string | null | undefined): string {
  if (!s) return "—";
  return s.replace(/_/g, " ").toLowerCase().replace(/^\w/, c => c.toUpperCase());
}

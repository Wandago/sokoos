/* Platform-operator domain.
 *
 * Deliberately separate from `lib/types.ts`: that file is one merchant's own
 * business, this one is the platform that hosts thousands of them. Keeping
 * them apart is what lets the console be lifted into its own deployment
 * later without dragging the seller app's model along.
 */

export type Plan = "starter" | "growth" | "scale";

export type MerchantStatus = "active" | "trial" | "past_due" | "suspended" | "churned";

export type Region =
  | "Nairobi"
  | "Mombasa"
  | "Kisumu"
  | "Nakuru"
  | "Eldoret"
  | "Thika"
  | "Machakos";

export interface Merchant {
  id: string;
  business: string;
  owner: string;
  email: string;
  phone: string;
  region: Region;
  plan: Plan;
  status: MerchantStatus;
  slug: string;
  category: string;
  joinedAt: string;
  lastActiveAt: string;
  /** Gross merchandise value they have transacted, in KES. */
  gmv30d: number;
  gmvPrev30d: number;
  orders30d: number;
  products: number;
  riders: number;
  /** What SokoOS bills them per month, in KES. */
  mrr: number;
  storefrontPublished: boolean;
  /** Set when an operator has restricted the account. */
  suspendedReason?: string;
}

export type ReportReason =
  | "counterfeit"
  | "prohibited"
  | "misleading"
  | "spam"
  | "payment_dispute";

export type ReportStatus = "open" | "reviewing" | "upheld" | "dismissed";

export interface StorefrontReport {
  id: string;
  merchantId: string;
  reason: ReportReason;
  status: ReportStatus;
  detail: string;
  reportedAt: string;
  reporter: string;
}

export type TicketPriority = "low" | "normal" | "high" | "urgent";
export type TicketStatus = "open" | "pending" | "solved";

export interface Ticket {
  id: string;
  merchantId: string;
  subject: string;
  preview: string;
  priority: TicketPriority;
  status: TicketStatus;
  openedAt: string;
  /** Hours until the first-response target is missed. Negative means breached. */
  slaHours: number;
  assignee?: string;
}

export type IncidentSeverity = "sev1" | "sev2" | "sev3";

export interface Incident {
  id: string;
  title: string;
  severity: IncidentSeverity;
  startedAt: string;
  resolvedAt?: string;
  component: string;
  note: string;
}

export interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  /** Percentage of merchants the flag is on for. */
  rollout: number;
  owner: string;
}

export interface ServiceHealth {
  name: string;
  status: "operational" | "degraded" | "down";
  latencyMs: number;
  uptime30d: number;
}

export interface AdminDatabase {
  version: number;
  merchants: Merchant[];
  reports: StorefrontReport[];
  tickets: Ticket[];
  incidents: Incident[];
  flags: FeatureFlag[];
  services: ServiceHealth[];
}

export const planLabel: Record<Plan, string> = {
  starter: "Starter",
  growth: "Growth",
  scale: "Scale",
};

/** What SokoOS charges per month, in KES. */
export const planPrice: Record<Plan, number> = {
  starter: 0,
  growth: 1500,
  scale: 4500,
};

export const statusLabel: Record<MerchantStatus, string> = {
  active: "Active",
  trial: "Trial",
  past_due: "Past due",
  suspended: "Suspended",
  churned: "Churned",
};

export const reasonLabel: Record<ReportReason, string> = {
  counterfeit: "Counterfeit goods",
  prohibited: "Prohibited item",
  misleading: "Misleading listing",
  spam: "Spam",
  payment_dispute: "Payment dispute",
};

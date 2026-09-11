import { query } from "../db/pool.js";

/**
 * Reports raised against a merchant's public storefront.
 *
 * Filed by whoever is looking at the shop, which is why this reaches the
 * database the same way the storefront route itself does — a plain query, no
 * tenant session, because a customer reporting a shop has never signed in and
 * is not the tenant they are reporting.
 */

export type ReportReason = "counterfeit" | "scam" | "offensive" | "impersonation" | "other";
export type ReportStatus = "open" | "reviewing" | "upheld" | "dismissed";

const REASONS: ReportReason[] = ["counterfeit", "scam", "offensive", "impersonation", "other"];

export class NoSuchShop extends Error {
  constructor() {
    super("No shop at that address.");
    this.name = "NoSuchShop";
  }
}

export class NoSuchReport extends Error {
  constructor() {
    super("No report with that id.");
    this.name = "NoSuchReport";
  }
}

export async function fileReport(
  slug: string,
  input: { reason?: string; detail: string; reporterContact?: string },
) {
  const { rows } = await query<{ id: string }>(
    `select id from tenants where slug = $1 and suspended_at is null`,
    [slug],
  );
  const tenant = rows[0];
  if (!tenant) throw new NoSuchShop();

  const reason: ReportReason = REASONS.includes(input.reason as ReportReason)
    ? (input.reason as ReportReason)
    : "other";

  await query(
    `insert into moderation_reports (tenant_id, reason, detail, reporter_contact)
     values ($1, $2, $3, $4)`,
    [tenant.id, reason, input.detail.trim(), input.reporterContact?.trim() || null],
  );
}

export interface AdminReport {
  id: string;
  reason: ReportReason;
  detail: string;
  reporterContact: string | null;
  status: ReportStatus;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  merchant: { id: string; name: string; slug: string };
  /** How many other reports this same business has, settled or not. */
  priorReports: number;
}

/** Every report, newest first, with enough about the merchant to act on it. */
export async function listReports(): Promise<AdminReport[]> {
  const { rows } = await query<Record<string, unknown>>(`
    select
      r.id, r.reason, r.detail, r.reporter_contact, r.status,
      r.created_at, r.resolved_at, r.resolved_by,
      t.id as tenant_id, t.name as merchant_name, t.slug as merchant_slug,
      (select count(*)::int from moderation_reports r2
        where r2.tenant_id = r.tenant_id and r2.id <> r.id) as prior_reports
    from moderation_reports r
    join tenants t on t.id = r.tenant_id
    order by r.created_at desc
    limit 500
  `);

  return rows.map((row) => ({
    id: row.id as string,
    reason: row.reason as ReportReason,
    detail: row.detail as string,
    reporterContact: (row.reporter_contact as string | null) ?? null,
    status: row.status as ReportStatus,
    createdAt: row.created_at as string,
    resolvedAt: (row.resolved_at as string | null) ?? null,
    resolvedBy: (row.resolved_by as string | null) ?? null,
    merchant: {
      id: row.tenant_id as string,
      name: row.merchant_name as string,
      slug: row.merchant_slug as string,
    },
    priorReports: row.prior_reports as number,
  }));
}

async function assertReportExists(id: string) {
  const { rows } = await query("select 1 from moderation_reports where id = $1", [id]);
  if (!rows.length) throw new NoSuchReport();
}

/** Returns the merchant a report belongs to, for the caller to decide whether upholding suspends it. */
export async function setReportStatus(
  id: string,
  status: ReportStatus,
  actor: string,
): Promise<{ tenantId: string }> {
  await assertReportExists(id);
  const settled = status === "upheld" || status === "dismissed";
  const { rows } = await query<{ tenant_id: string }>(
    `update moderation_reports
        set status = $2,
            resolved_at = case when $3 then now() else null end,
            resolved_by = case when $3 then $4 else null end
      where id = $1
      returning tenant_id`,
    [id, status, settled, actor],
  );
  return { tenantId: rows[0]!.tenant_id };
}

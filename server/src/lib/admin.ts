import { query } from "../db/pool.js";

/**
 * What the operator console is allowed to see: every tenant, not one.
 *
 * Every function here uses the pool directly rather than `withTenant`,
 * because `withTenant` exists to *enforce* row-level security for a single
 * business, and reading across all of them is exactly the power this console
 * is meant to have. That power is only acceptable because every read that
 * matters is unremarkable — merchant metadata, not a customer's individual
 * orders — and every write is logged to `admin_audit`, which nothing here
 * ever deletes from.
 */

export class NoSuchMerchant extends Error {
  constructor() {
    super("No business with that id.");
    this.name = "NoSuchMerchant";
  }
}

export interface PlatformOverview {
  merchants: number;
  newThisWeek: number;
  newThisMonth: number;
  suspended: number;
  activeThisWeek: number;
  tillsConnected: number;
  tillsRegistered: number;
}

export async function overview(): Promise<PlatformOverview> {
  const { rows: tenantRows } = await query<{
    total: number;
    new_7d: number;
    new_30d: number;
    suspended: number;
  }>(`
    select
      count(*)::int as total,
      count(*) filter (where created_at > now() - interval '7 days')::int as new_7d,
      count(*) filter (where created_at > now() - interval '30 days')::int as new_30d,
      count(*) filter (where suspended_at is not null)::int as suspended
    from tenants
  `);

  const { rows: activeRows } = await query<{ n: number }>(`
    select count(distinct tenant_id)::int as n
      from records where updated_at > now() - interval '7 days'
  `);

  const { rows: tillRows } = await query<{ connected: number; registered: number }>(`
    select count(*)::int as connected,
           count(*) filter (where registered_at is not null)::int as registered
      from mpesa_accounts
  `);

  const t = tenantRows[0]!;
  return {
    merchants: t.total,
    newThisWeek: t.new_7d,
    newThisMonth: t.new_30d,
    suspended: t.suspended,
    activeThisWeek: activeRows[0]?.n ?? 0,
    tillsConnected: tillRows[0]?.connected ?? 0,
    tillsRegistered: tillRows[0]?.registered ?? 0,
  };
}

export interface AdminMerchant {
  id: string;
  slug: string;
  name: string;
  industry: string | null;
  createdAt: string;
  suspendedAt: string | null;
  owner: { name: string; phone: string; email: string | null } | null;
  till: { shortcode: string; kind: string; registeredAt: string | null } | null;
  lastActivityAt: string | null;
}

/** One row per business, plus the one signal that actually says who runs it and whether it's alive. */
const MERCHANT_LIST_SQL = `
  select
    t.id, t.slug, t.name, t.industry, t.created_at, t.suspended_at,
    a.name as owner_name, a.phone as owner_phone, a.email as owner_email,
    m.shortcode as till_shortcode, m.kind as till_kind, m.registered_at as till_registered_at,
    r.last_activity_at
  from tenants t
  left join lateral (
    -- The founding membership, not just any of them: the person who created
    -- the business is who this console should show as its owner.
    select mem.account_id from memberships mem
     where mem.tenant_id = t.id order by mem.created_at asc limit 1
  ) owner_mem on true
  left join accounts a on a.id = owner_mem.account_id
  left join mpesa_accounts m on m.tenant_id = t.id
  left join lateral (
    select max(updated_at) as last_activity_at from records where tenant_id = t.id
  ) r on true
`;

function toMerchant(row: Record<string, unknown>): AdminMerchant {
  return {
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    industry: (row.industry as string | null) ?? null,
    createdAt: row.created_at as string,
    suspendedAt: (row.suspended_at as string | null) ?? null,
    owner: row.owner_name
      ? {
          name: row.owner_name as string,
          phone: row.owner_phone as string,
          email: (row.owner_email as string | null) ?? null,
        }
      : null,
    till: row.till_shortcode
      ? {
          shortcode: row.till_shortcode as string,
          kind: row.till_kind as string,
          registeredAt: (row.till_registered_at as string | null) ?? null,
        }
      : null,
    lastActivityAt: (row.last_activity_at as string | null) ?? null,
  };
}

export async function listMerchants(): Promise<AdminMerchant[]> {
  const { rows } = await query<Record<string, unknown>>(
    `${MERCHANT_LIST_SQL} order by t.created_at desc`,
  );
  return rows.map(toMerchant);
}

export interface MerchantDetail extends AdminMerchant {
  ownerJoinedAt: string | null;
  till: (AdminMerchant["till"] & { environment: string; lastEventAt: string | null }) | null;
  /** How many of each kind of record this business has, e.g. `{ order: 42, product: 6 }`. */
  recordCounts: Record<string, number>;
}

export async function merchantDetail(id: string): Promise<MerchantDetail | null> {
  const { rows } = await query<Record<string, unknown>>(
    `select
       t.id, t.slug, t.name, t.industry, t.created_at, t.suspended_at,
       a.name as owner_name, a.phone as owner_phone, a.email as owner_email,
       a.created_at as owner_joined_at,
       m.shortcode as till_shortcode, m.kind as till_kind, m.environment as till_environment,
       m.registered_at as till_registered_at, m.last_event_at as till_last_event_at,
       r.last_activity_at
     from tenants t
     left join lateral (
       select mem.account_id from memberships mem
        where mem.tenant_id = t.id order by mem.created_at asc limit 1
     ) owner_mem on true
     left join accounts a on a.id = owner_mem.account_id
     left join mpesa_accounts m on m.tenant_id = t.id
     left join lateral (
       select max(updated_at) as last_activity_at from records where tenant_id = t.id
     ) r on true
     where t.id = $1`,
    [id],
  );
  const row = rows[0];
  if (!row) return null;

  const { rows: counts } = await query<{ kind: string; n: number }>(
    `select kind, count(*)::int as n from records
      where tenant_id = $1 and deleted_at is null
      group by kind`,
    [id],
  );

  const base = toMerchant(row);
  return {
    ...base,
    ownerJoinedAt: (row.owner_joined_at as string | null) ?? null,
    till: base.till
      ? {
          ...base.till,
          environment: row.till_environment as string,
          lastEventAt: (row.till_last_event_at as string | null) ?? null,
        }
      : null,
    recordCounts: Object.fromEntries(counts.map((c) => [c.kind, c.n])),
  };
}

async function assertMerchantExists(id: string) {
  const { rows } = await query("select 1 from tenants where id = $1", [id]);
  if (!rows.length) throw new NoSuchMerchant();
}

export async function suspendMerchant(id: string, actor: string, reason?: string) {
  await assertMerchantExists(id);
  await query(`update tenants set suspended_at = now() where id = $1`, [id]);
  await query(
    `insert into admin_audit (actor, action, tenant_id, detail) values ($1, 'suspend', $2, $3)`,
    [actor, id, reason ? JSON.stringify({ reason }) : null],
  );
}

export async function reinstateMerchant(id: string, actor: string) {
  await assertMerchantExists(id);
  await query(`update tenants set suspended_at = null where id = $1`, [id]);
  await query(`insert into admin_audit (actor, action, tenant_id) values ($1, 'reinstate', $2)`, [
    actor,
    id,
  ]);
}

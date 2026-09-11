import { query } from "../db/pool.js";

/**
 * Support tickets a seller raises about their own business.
 *
 * Filed by a signed-in seller, so unlike a storefront report this is written
 * through the tenant-scoped route — but stored the same way as mpesa_accounts:
 * a plain, tenant-keyed table reached only through this file and the admin
 * console, not through the generic `records` sync stream. A ticket is
 * something SokoOS's own staff act on, not something that belongs on a
 * seller's other devices.
 */

export type TicketPriority = "urgent" | "high" | "normal" | "low";
export type TicketStatus = "open" | "pending" | "solved";

const PRIORITIES: TicketPriority[] = ["urgent", "high", "normal", "low"];

export class NoSuchTicket extends Error {
  constructor() {
    super("No ticket with that id.");
    this.name = "NoSuchTicket";
  }
}

export async function fileTicket(
  tenantId: string,
  input: { subject: string; message: string; priority?: string },
  accountId?: string,
) {
  const priority: TicketPriority = PRIORITIES.includes(input.priority as TicketPriority)
    ? (input.priority as TicketPriority)
    : "normal";

  const { rows } = await query<{ id: string }>(
    `insert into support_tickets (tenant_id, account_id, subject, message, priority)
     values ($1, $2, $3, $4, $5)
     returning id`,
    [tenantId, accountId ?? null, input.subject.trim(), input.message.trim(), priority],
  );
  return { id: rows[0]!.id };
}

export interface AdminTicket {
  id: string;
  subject: string;
  message: string;
  priority: TicketPriority;
  status: TicketStatus;
  assignee: string | null;
  createdAt: string;
  updatedAt: string;
  merchant: { id: string; name: string; slug: string };
}

/** Open and pending first, oldest first within each — the ones closest to breaching a first response. */
export async function listTickets(): Promise<AdminTicket[]> {
  const { rows } = await query<Record<string, unknown>>(`
    select
      tk.id, tk.subject, tk.message, tk.priority, tk.status, tk.assignee,
      tk.created_at, tk.updated_at,
      t.id as tenant_id, t.name as merchant_name, t.slug as merchant_slug
    from support_tickets tk
    join tenants t on t.id = tk.tenant_id
    order by (tk.status = 'solved') asc, tk.created_at asc
    limit 500
  `);

  return rows.map((row) => ({
    id: row.id as string,
    subject: row.subject as string,
    message: row.message as string,
    priority: row.priority as TicketPriority,
    status: row.status as TicketStatus,
    assignee: (row.assignee as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    merchant: {
      id: row.tenant_id as string,
      name: row.merchant_name as string,
      slug: row.merchant_slug as string,
    },
  }));
}

async function assertTicketExists(id: string) {
  const { rows } = await query("select 1 from support_tickets where id = $1", [id]);
  if (!rows.length) throw new NoSuchTicket();
}

export async function setTicketStatus(id: string, status: TicketStatus) {
  await assertTicketExists(id);
  await query(`update support_tickets set status = $2, updated_at = now() where id = $1`, [
    id,
    status,
  ]);
}

export async function assignTicket(id: string, assignee: string) {
  await assertTicketExists(id);
  await query(`update support_tickets set assignee = $2, updated_at = now() where id = $1`, [
    id,
    assignee,
  ]);
}

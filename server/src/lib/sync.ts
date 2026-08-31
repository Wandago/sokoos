import { withTenant, type Client } from "../db/pool.js";

/**
 * Sync.
 *
 * The phone is the source of truth. Every screen writes locally first and keeps
 * working with no signal; this exchanges those local writes for everyone else's
 * in the background. That ordering is the whole design — a seller in a matatu
 * should never see a spinner because a tower is busy.
 *
 * The protocol is deliberately small:
 *
 *   pull(since)  → every record whose seq is greater than `since`, plus the new
 *                  cursor. One indexed range scan.
 *   push(ops)    → apply a batch of local writes, return the new cursor.
 *
 * Conflicts are resolved last-write-wins on the client's `updatedAt`, not on
 * arrival order. That matters: a phone that was offline for a day must not
 * clobber newer edits made on a second device when it finally reconnects.
 *
 * Last-write-wins is enough here and it is worth saying why rather than
 * reaching for something cleverer. These are single-operator businesses. Two
 * devices editing the same order within the same second is not a scenario that
 * happens; a lost update in that case costs one re-tap. Merge semantics would
 * cost weeks and be wrong in ways nobody could explain to a seller.
 */

export interface SyncOp {
  kind: string;
  id: string;
  /** Absent on a delete. */
  doc?: unknown;
  /** ISO timestamp from the writing device. Decides conflicts. */
  updatedAt: string;
  deleted?: boolean;
}

export interface PushResult {
  cursor: number;
  applied: number;
  /** Ops the server already had a newer version of, so they were not applied. */
  skipped: { kind: string; id: string; reason: "stale" }[];
  /** True when this exact batch had already been applied. */
  replayed: boolean;
}

export interface PullResult {
  cursor: number;
  records: {
    kind: string;
    id: string;
    doc: unknown | null;
    updatedAt: string;
    deleted: boolean;
    seq: number;
  }[];
  /** True when the page was capped and another pull should follow immediately. */
  more: boolean;
}

/** One page of a pull. Big enough to be one round trip for a normal business. */
const PAGE = 500;

/** Guards a single request from a device that has been offline for months. */
const MAX_OPS_PER_PUSH = 1_000;

export class TooManyOps extends Error {
  constructor(count: number) {
    super(`Too many operations in one batch: ${count}. Split it.`);
    this.name = "TooManyOps";
  }
}

export async function pull(tenantId: string, since = 0, limit = PAGE): Promise<PullResult> {
  const size = Math.min(Math.max(1, limit), PAGE);

  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{
      kind: string;
      id: string;
      doc: unknown;
      updated_at: string;
      deleted_at: string | null;
      seq: number;
    }>(
      `select kind, id, doc, updated_at, deleted_at, seq
         from records
        where tenant_id = $1 and seq > $2
        order by seq
        limit $3`,
      [tenantId, since, size + 1],
    );

    // One extra row was asked for purely to answer "is there more?" without a
    // second count query.
    const more = rows.length > size;
    const page = more ? rows.slice(0, size) : rows;

    return {
      cursor: page.length ? page[page.length - 1]!.seq : since,
      more,
      records: page.map((row) => ({
        kind: row.kind,
        id: row.id,
        // A tombstone carries no document; sending one would leak deleted data.
        doc: row.deleted_at ? null : row.doc,
        updatedAt: row.updated_at,
        deleted: Boolean(row.deleted_at),
        seq: row.seq,
      })),
    };
  });
}

export async function push(
  tenantId: string,
  batchId: string,
  ops: SyncOp[],
  deviceId?: string,
): Promise<PushResult> {
  if (ops.length > MAX_OPS_PER_PUSH) throw new TooManyOps(ops.length);

  return withTenant(tenantId, async (client) => {
    // A phone on a bad connection retries batches it already delivered. Without
    // this check the retry double-applies and the cursor jumps for no reason.
    const { rows: seen } = await client.query<{ result: PushResult }>(
      `select result from applied_batches where tenant_id = $1 and batch_id = $2`,
      [tenantId, batchId],
    );
    if (seen[0]) return { ...seen[0].result, replayed: true };

    // Lock the tenant's cursor row for the length of the transaction. Two
    // devices pushing at once would otherwise both read the same last_seq and
    // write colliding sequence numbers.
    const { rows: cursorRows } = await client.query<{ last_seq: number }>(
      `insert into tenant_cursors (tenant_id) values ($1)
       on conflict (tenant_id) do update set last_seq = tenant_cursors.last_seq
       returning last_seq`,
      [tenantId],
    );
    let seq = cursorRows[0]!.last_seq;

    const skipped: PushResult["skipped"] = [];
    let applied = 0;

    for (const op of ops) {
      if (!op || typeof op.kind !== "string" || typeof op.id !== "string") continue;
      if (!op.updatedAt) continue;

      seq += 1;

      // The `where` is the conflict rule, expressed once, in the database. An
      // op older than what is already stored changes nothing and costs one
      // round of no rows — which is how it is detected as stale.
      const { rowCount } = await client.query(
        `insert into records (tenant_id, kind, id, doc, updated_at, deleted_at, seq, device_id)
         values ($1, $2, $3, $4, $5, $6, $7, $8)
         on conflict (tenant_id, kind, id) do update
            set doc        = excluded.doc,
                updated_at = excluded.updated_at,
                deleted_at = excluded.deleted_at,
                seq        = excluded.seq,
                device_id  = excluded.device_id,
                server_at  = now()
          where records.updated_at <= excluded.updated_at`,
        [
          tenantId,
          op.kind,
          op.id,
          // A tombstone stores an empty document rather than the last known
          // one, so deleting really does remove the data.
          op.deleted ? {} : (op.doc ?? {}),
          op.updatedAt,
          op.deleted ? op.updatedAt : null,
          seq,
          deviceId ?? null,
        ],
      );

      if (rowCount === 0) {
        skipped.push({ kind: op.kind, id: op.id, reason: "stale" });
        // Nothing was written, so the number is handed back rather than burnt.
        seq -= 1;
      } else {
        applied += 1;
      }
    }

    await client.query(`update tenant_cursors set last_seq = $2 where tenant_id = $1`, [
      tenantId,
      seq,
    ]);

    const result: PushResult = { cursor: seq, applied, skipped, replayed: false };
    await client.query(
      `insert into applied_batches (tenant_id, batch_id, result) values ($1, $2, $3)
       on conflict do nothing`,
      [tenantId, batchId, result],
    );
    return result;
  });
}

/** The current cursor, for a client deciding whether it needs to pull at all. */
export async function cursorFor(tenantId: string): Promise<number> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{ last_seq: number }>(
      `select last_seq from tenant_cursors where tenant_id = $1`,
      [tenantId],
    );
    return rows[0]?.last_seq ?? 0;
  });
}

/** Counts by kind. Used by the client to show a seller what is stored. */
export async function summary(tenantId: string) {
  return withTenant(tenantId, async (client: Client) => {
    const { rows } = await client.query<{ kind: string; n: number }>(
      `select kind, count(*)::int as n from records
        where tenant_id = $1 and deleted_at is null
        group by kind order by kind`,
      [tenantId],
    );
    return Object.fromEntries(rows.map((r) => [r.kind, r.n]));
  });
}

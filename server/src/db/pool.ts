import pg from "pg";

/**
 * The connection pool, and the one rule that governs every query in this
 * service: nothing touches a business's records except inside `withTenant`.
 *
 * Row-level security is enforced by Postgres, but it has to be told which
 * tenant the current transaction belongs to. Doing that in exactly one place
 * means a new endpoint cannot forget it — the only way to get a client that
 * can read `records` at all is to ask for one scoped to a tenant.
 */

// Timestamps come back as strings rather than JS Dates, so an ISO value written
// on a phone in Nairobi survives the round trip byte for byte.
pg.types.setTypeParser(1114, (v) => v);
pg.types.setTypeParser(1184, (v) => v);
// bigint as a JS number: the sync cursor will not approach 2^53 in this
// lifetime, and a string cursor would need parsing everywhere it is compared.
pg.types.setTypeParser(20, (v) => Number(v));

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? "postgres://postgres@localhost:5432/sokoos",
  max: Number(process.env.PG_POOL_MAX ?? 10),
  idleTimeoutMillis: 30_000,
  // A query that has not answered in ten seconds is not going to.
  statement_timeout: 10_000,
});

export type Client = pg.PoolClient;

/** A query with no tenant scope. Only for accounts, sessions and login codes. */
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
) {
  return pool.query<T>(text, params);
}

/**
 * Runs a function inside a transaction scoped to one tenant.
 *
 * `set_config(..., true)` is transaction-scoped, so the setting cannot leak to
 * the next caller that borrows this connection from the pool — which is the
 * failure mode that makes hand-rolled tenant context dangerous.
 */
export async function withTenant<T>(
  tenantId: string,
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select set_config('sokoos.tenant_id', $1, true)", [tenantId]);
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/** The same, for sign-in, where the account is known but no tenant is yet. */
export async function withAccount<T>(
  accountId: string,
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select set_config('sokoos.account_id', $1, true)", [accountId]);
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool() {
  await pool.end();
}

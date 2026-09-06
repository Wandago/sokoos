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

const connectionString =
  process.env.DATABASE_URL ?? "postgres://postgres@localhost:5432/sokoos";

/**
 * TLS, decided from the host rather than asked for.
 *
 * Every managed Postgres — Supabase, Neon, RDS, Fly — refuses an unencrypted
 * connection, and `pg` does not turn TLS on by itself. The failure is a
 * confusing one ("no pg_hba.conf entry ... no encryption") that reads like a
 * credentials problem, so this decides from the host: anything that is not
 * local gets TLS, and localhost does not, because a local Postgres usually has
 * no certificate at all.
 *
 * `DATABASE_SSL=off` forces it off for the rare local server on a LAN address;
 * `DATABASE_CA` supplies a certificate to verify against.
 *
 * Without a CA the certificate is not verified. That is worth being plain
 * about: it protects the connection from passive eavesdropping but not from an
 * active attacker who can redirect it. It is also what every managed provider's
 * own quickstart does, because their certificates are signed by private CAs you
 * have to go and fetch. For production, fetch it — Supabase publishes theirs in
 * the dashboard under Database → SSL Configuration — and set DATABASE_CA.
 */
function sslFor(url: string): pg.ClientConfig["ssl"] {
  if (process.env.DATABASE_SSL === "off") return undefined;

  const ca = process.env.DATABASE_CA;
  if (ca) return { ca, rejectUnauthorized: true };

  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    // An unparseable URL is the connection's problem to report, not this
    // function's; assume local and let the driver say what is wrong.
    return undefined;
  }

  const local =
    host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local");
  if (local) return undefined;

  return { rejectUnauthorized: false };
}

/* A serverless instance is not a server.
 *
 * It handles one request at a time and is then frozen mid-memory, so a pool of
 * ten connections means nine held open by a process that is not running —
 * multiplied by every warm instance, which is how a small amount of traffic
 * exhausts a database's connection limit while doing almost no work.
 *
 * One connection, released quickly. The multiplexing that a pool would have
 * done is Supabase's Supavisor doing it instead, which is what a transaction
 * pooler is for. */
const serverless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

export const pool = new pg.Pool({
  connectionString,
  ssl: sslFor(connectionString),
  max: Number(process.env.PG_POOL_MAX ?? (serverless ? 1 : 10)),
  idleTimeoutMillis: serverless ? 5_000 : 30_000,
  // A query that has not answered in ten seconds is not going to. Matches the
  // function's own timeout: a request that outlives its query has nothing left
  // to wait for.
  statement_timeout: 10_000,
  /* `idleTimeoutMillis` only fires on a running event loop, and a serverless
   * instance is frozen mid-memory between requests — the very thing `max: 1`
   * above is written for. So a connection can go stale on the database's own
   * side (Supavisor recycling it, a network blip) while this process is
   * frozen, and the pool has no way to know: it hands the same dead socket to
   * the next request, which then waits forever, because a query that never
   * reaches the server never triggers `statement_timeout` either.
   *
   * `query_timeout` is the client-side backstop: if a query hasn't answered
   * in eight seconds, `pg` gives up, errors out, and discards that
   * connection — so whatever connects next gets a fresh one instead of
   * inheriting the same hang. Left under `maxDuration` in vercel.json so a
   * dead connection still returns a real error instead of a Vercel timeout
   * page. `connectionTimeoutMillis` does the same for the connect step
   * itself, and `keepAlive` makes a dead socket more likely to be caught by
   * the OS before either timeout is needed. */
  connectionTimeoutMillis: 8_000,
  query_timeout: 8_000,
  keepAlive: true,
});

/* An idle client that the database hangs up on — a pooler recycling it, a
 * deploy, a network blip — emits an error with nothing listening, and an
 * unhandled 'error' event on an EventEmitter takes the process down. On a
 * container that is a restart; on serverless it is a failed request for
 * whoever arrives next. */
pool.on("error", (error) => {
  console.error("[db] idle client error", error.message);
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

    /* Drop to the unprivileged role for the rest of this transaction.
     *
     * Without this the policies in 002 do nothing. The service connects as the
     * owner, which on most installs is a superuser, and a superuser bypasses
     * row-level security unconditionally — `force row level security` makes
     * policies apply to the owner, not to a superuser. So the isolation looked
     * enabled in every catalogue view and was not in effect for a single query.
     *
     * `set local` reverts on commit or rollback, so the connection goes back to
     * the pool with its normal privileges and nothing leaks between requests. */
    await client.query("set local role sokoos_app");

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

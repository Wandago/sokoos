/**
 * Proves a database is usable, before anything is trusted to it.
 *
 *   DATABASE_URL="postgres://..." npm run db:check
 *
 * Written for the moment you paste a connection string from Supabase (or Neon,
 * or RDS) and want to know whether it actually works — not whether it connects,
 * which is the easy half, but whether the thing this service depends on for
 * safety is really switched on at the other end.
 *
 * That last part is the reason this exists. Row-level security is what stops
 * one shop reading another's books, and it fails silently: a policy that did
 * not apply looks exactly like a policy that did, right up until the day a
 * query forgets its tenant clause and quietly returns somebody else's takings.
 * So this does not check that the policies are *listed*. It creates two
 * tenants, writes a record to each, and tries to read one from inside the
 * other. If that read returns anything, the check fails loudly.
 *
 * Everything it creates, it removes.
 */
import { query, withTenant, closePool } from "../src/db/pool.js";
import { migrate } from "../src/db/migrate.js";

const ok = (line: string) => console.log(`\x1b[32m ok \x1b[0m ${line}`);
const bad = (line: string) => console.log(`\x1b[31mFAIL\x1b[0m ${line}`);
const step = (line: string) => console.log(`\n\x1b[1m${line}\x1b[0m`);

let failures = 0;
const check = (label: string, passed: boolean, detail?: unknown) => {
  if (passed) ok(label);
  else {
    failures++;
    bad(`${label}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
};

/**
 * Which of Supabase's three connection strings this is.
 *
 * Their dashboard has moved this control more than once and offers all three
 * side by side, so the reliable way to tell them apart is the shape of the
 * string itself rather than where in the UI it was copied from:
 *
 *   pooler host + port 6543  → transaction pooler, what serverless wants
 *   pooler host + port 5432  → session pooler, IPv4 and workable
 *   db.<ref>.supabase.co     → direct, IPv6-only on the free tier
 *
 * Said before connecting rather than after failing, because "ENETUNREACH" is a
 * confusing way to learn you picked the wrong tab.
 */
function describe(url: string): string {
  let host = "";
  let port = "";
  try {
    const parsed = new URL(url);
    host = parsed.hostname;
    port = parsed.port;
  } catch {
    return "\x1b[33mThat does not parse as a connection string.\x1b[0m";
  }

  if (host.endsWith("pooler.supabase.com")) {
    return port === "6543"
      ? "Supabase transaction pooler — the right one for serverless."
      : `Supabase session pooler (port ${port}). Workable, but the transaction pooler on 6543 suits a function better.`;
  }

  if (host.endsWith("db.supabase.co") || /^db\..*\.supabase\.co$/.test(host)) {
    return (
      "\x1b[33mThis is Supabase's DIRECT connection, which is IPv6-only on the free\n" +
      "     tier and will usually fail. Look for the string with `pooler.supabase.com`\n" +
      "     in it instead.\x1b[0m"
    );
  }

  if (host === "localhost" || host === "127.0.0.1") return "Local Postgres.";
  return `Host ${host}${port ? `:${port}` : ""}.`;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("Set DATABASE_URL to the database you want to check.");
    process.exit(1);
  }

  // Never print the password back at somebody who may be sharing their screen.
  const shown = url.replace(/:\/\/([^:]+):[^@]+@/, "://$1:••••@");
  console.log(`\nChecking ${shown}`);
  console.log(`     ${describe(url)}\n`);

  step("Connecting");
  const started = Date.now();
  const { rows: version } = await query<{ v: string }>("select version() as v");
  const took = Date.now() - started;
  ok(`connected in ${took}ms`);
  console.log(`     ${version[0]!.v.split(",")[0]}`);

  /* Round-trip latency matters more than it looks. Every sync push is a
   * transaction, and a database on another continent turns a fast phone into a
   * slow one. Over ~250ms from wherever the API runs is worth knowing early. */
  if (took > 250) {
    console.log(
      `     \x1b[33mNote:\x1b[0m that is slow enough to feel. Check the database is in a\n` +
        `     region near wherever the API will run.`,
    );
  }

  step("Applying migrations");
  const applied = await migrate((line) => console.log(`     ${line}`));
  ok(applied.length ? `${applied.length} applied` : "already up to date");

  step("Checking the schema arrived");
  const { rows: tables } = await query<{ table_name: string }>(
    `select table_name from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'`,
  );
  const names = new Set(tables.map((t) => t.table_name));
  for (const needed of ["tenants", "accounts", "records", "sessions", "mpesa_accounts"]) {
    check(`${needed} exists`, names.has(needed));
  }

  step("Checking row-level security is really on");
  const { rows: rls } = await query<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(
    `select relname, relrowsecurity, relforcerowsecurity
       from pg_class where relname in ('records', 'tenant_cursors', 'applied_batches')`,
  );
  for (const row of rls) {
    check(`${row.relname} has RLS enabled`, row.relrowsecurity, row);
    check(`${row.relname} forces it on the owner too`, row.relforcerowsecurity, row);
  }

  const { rows: policies } = await query<{ tablename: string }>(
    `select tablename from pg_policies where schemaname = 'public'`,
  );
  check("policies exist", policies.length >= 4, policies.map((p) => p.tablename));

  /* ---- The one that matters ------------------------------------------- *
   * Everything above can be true while isolation is broken. This writes to
   * two tenants and tries to read across. */
  step("Proving one business cannot read another");

  const suffix = Date.now();
  const { rows: made } = await query<{ id: string }>(
    `insert into tenants (slug, name) values ($1, $2), ($3, $4) returning id`,
    [`dbcheck-a-${suffix}`, "Check A", `dbcheck-b-${suffix}`, "Check B"],
  );
  const [a, b] = made.map((r) => r.id);

  try {
    for (const [tenant, label] of [
      [a!, "A"],
      [b!, "B"],
    ] as const) {
      await withTenant(tenant, async (client) => {
        await client.query(
          `insert into records (tenant_id, kind, id, doc, updated_at, seq)
           values ($1, 'order', $2, $3, now(), 1)`,
          [tenant, `ord_${label}`, JSON.stringify({ secret: `books of ${label}` })],
        );
      });
    }
    ok("wrote one record to each");

    const ownView = await withTenant(a!, (client) =>
      client.query(`select id from records`).then((r) => r.rows),
    );
    check("a business sees its own record", ownView.length === 1, ownView);
    check("and only its own", ownView[0]?.id === "ord_A", ownView);

    // The read that must come back empty. Asked for by primary key, so a
    // non-empty answer cannot be explained by anything but broken isolation.
    const crossView = await withTenant(a!, (client) =>
      client
        .query(`select id, doc from records where tenant_id = $1`, [b!])
        .then((r) => r.rows),
    );
    check(
      "and cannot read the other business at all",
      crossView.length === 0,
      crossView,
    );

    // Writing into somebody else's tenant must be refused by the policy's
    // WITH CHECK clause, not merely discouraged by the application.
    let refused = false;
    try {
      await withTenant(a!, (client) =>
        client.query(
          `insert into records (tenant_id, kind, id, doc, updated_at, seq)
           values ($1, 'order', 'ord_forged', '{}', now(), 2)`,
          [b!],
        ),
      );
    } catch {
      refused = true;
    }
    check("nor write into it", refused);
  } finally {
    // Cascades to the records.
    await query(`delete from tenants where id = any($1)`, [[a, b]]);
    ok("cleaned up");
  }

  console.log(
    failures
      ? `\n\x1b[31m${failures} problem${failures === 1 ? "" : "s"}. Do not put real records in this database yet.\x1b[0m\n`
      : "\n\x1b[32mThis database is ready.\x1b[0m\n",
  );
  process.exit(failures ? 1 : 0);
}

main()
  .catch((error) => {
    console.error(`\n\x1b[31m${error instanceof Error ? error.message : error}\x1b[0m`);

    const message = String(error);
    // The three failures people actually hit, each with the fix rather than
    // the stack trace.
    if (message.includes("no encryption") || message.includes("SSL")) {
      console.error(
        "\nThat host wants TLS. This should be automatic for any non-local host —\n" +
          "if DATABASE_SSL=off is set, remove it.",
      );
    } else if (message.includes("ENOTFOUND") || message.includes("ENETUNREACH")) {
      console.error(
        "\nCould not reach that host. On Supabase's free tier the direct connection\n" +
          "is IPv6-only: use the Session or Transaction pooler string instead — the\n" +
          "one with `pooler.supabase.com` in it.",
      );
    } else if (message.includes("password authentication failed")) {
      console.error(
        "\nWrong password. In Supabase it is the database password set when the\n" +
          "project was created, not your account password — reset it under\n" +
          "Settings → Database if you no longer have it.",
      );
    }
    process.exitCode = 1;
  })
  .finally(closePool);

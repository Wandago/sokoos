import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pool, closePool } from "./pool.js";

/**
 * Migrations, applied in filename order and recorded so they run once.
 *
 * Deliberately dependency-free: a migration tool is one more thing to keep
 * working, and this is forty lines that anyone can read before trusting it
 * with a production database.
 */
const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, "../../migrations");

export async function migrate(log = console.log) {
  await pool.query(`
    create table if not exists schema_migrations (
      name       text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const { rows } = await pool.query<{ name: string }>("select name from schema_migrations");
  const done = new Set(rows.map((r: { name: string }) => r.name));

  for (const file of files) {
    if (done.has(file)) continue;
    const sql = await readFile(join(dir, file), "utf8");
    const client = await pool.connect();
    try {
      // Each migration is one transaction, so a failure leaves nothing behind.
      await client.query("begin");
      await client.query(sql);
      await client.query("insert into schema_migrations (name) values ($1)", [file]);
      await client.query("commit");
      log(`applied ${file}`);
    } catch (error) {
      await client.query("rollback").catch(() => {});
      throw new Error(`migration ${file} failed: ${(error as Error).message}`);
    } finally {
      client.release();
    }
  }
  return files.filter((f) => !done.has(f));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  migrate()
    .then((applied) => console.log(applied.length ? "done" : "already up to date"))
    .catch((e) => {
      console.error(e.message);
      process.exitCode = 1;
    })
    .finally(closePool);
}

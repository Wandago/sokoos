import { serve } from "@hono/node-server";
import { app } from "./index.js";
import { pool } from "./db/pool.js";
import { migrate } from "./db/migrate.js";
import { readConfig } from "./config.js";

/**
 * Running the API as a long-lived process — a container, or a laptop.
 *
 * Separate from `index.ts` so that importing the app never starts a server.
 * That is not tidiness: on a serverless host the function imports the app on
 * every cold start, and a module that binds a port as a side effect of being
 * imported either crashes or leaks a listener each time. Building the app and
 * deciding to run it are two different jobs, so they are two files.
 *
 * Boot order fails cheapest first: config, then the database, then migrations,
 * then listening. A missing environment variable should cost a second and a
 * clear message; it should not cost a deploy that comes up, passes its health
 * check, and breaks on the first payment because nothing looked at
 * ENCRYPTION_KEY until a seller's credentials needed decrypting.
 */
async function main() {
  const config = readConfig();

  // Fails immediately and loudly if the database is unreachable, rather than
  // on whichever request happens to arrive first.
  await pool.query("select 1");

  /* Migrations run here rather than as a separate deploy step because the two
   * cannot be allowed to drift: a container running code that expects a column
   * its database does not have is a worse failure than a slightly slower start.
   * On serverless there is no single boot to hang this on, so that deployment
   * runs them from its build command instead. */
  await migrate((line) => console.log(`[migrate] ${line}`));

  serve({ fetch: app.fetch, port: config.port }, (info) => {
    console.log(`SokoOS API on port ${info.port}`);
    if (config.publicUrl) console.log(`Callbacks will be built from ${config.publicUrl}`);
  });
}

main().catch((error) => {
  // The message is the product here: whoever reads this is configuring a
  // deploy and needs to know what to change, not where it threw.
  console.error(`\n${error instanceof Error ? error.message : error}`);
  process.exit(1);
});

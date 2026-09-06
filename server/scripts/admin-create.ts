/**
 * Creates or updates an operator-console admin, directly against the database.
 *
 *   DATABASE_URL="postgres://..." npm run admin:create -- \
 *     --email you@sokoos.app --password "a real passphrase" --name "Louis"
 *
 * There is no signup endpoint for this on purpose — see the comment in
 * migrations/005_admin.sql. Running this script is the entire access-control
 * model: whoever can run it against the production database can make
 * themselves an admin, which is the same trust a shell on the server already
 * implies.
 */
import { query, closePool } from "../src/db/pool.js";
import { hashPassword } from "../src/lib/password.js";

function arg(name: string): string | undefined {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  return index !== -1 ? process.argv[index + 1] : undefined;
}

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  const password = arg("password");
  const name = arg("name")?.trim() || email?.split("@")[0] || "Admin";

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error("Pass --email with a real address.");
  }
  if (!password || password.length < 12) {
    throw new Error("Pass --password with at least 12 characters.");
  }

  const passwordHash = hashPassword(password);
  const { rows } = await query<{ id: string }>(
    `insert into admin_users (email, password_hash, name)
     values ($1, $2, $3)
     on conflict (email) do update
        set password_hash = excluded.password_hash,
            name = excluded.name
     returning id`,
    [email, passwordHash, name],
  );

  console.log(`\x1b[32mok\x1b[0m  ${email} (${rows[0]!.id}) can now sign in to /admin/login`);
}

main()
  .catch((error) => {
    console.error(`\n\x1b[31m${error instanceof Error ? error.message : error}\x1b[0m`);
    process.exitCode = 1;
  })
  .finally(closePool);

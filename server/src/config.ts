/**
 * Configuration, checked once at boot.
 *
 * The failure this exists to prevent: a server that starts, answers its health
 * check, accepts sign-ins, and then throws the first time somebody's customer
 * pays — because `ENCRYPTION_KEY` was never set and nothing looked until a
 * seller's credentials needed decrypting. By then the deploy is hours old,
 * looks fine on every dashboard, and the person finding out is a shopkeeper at
 * a counter.
 *
 * So every setting the service cannot work without is read here, on the way up,
 * and a missing one stops the process with an error that says what to do about
 * it. A server that will not start is a page in a deploy log. A server that
 * starts broken is a support call from somebody losing money.
 */

export interface Config {
  databaseUrl: string;
  port: number;
  /** Base64 32 bytes, for sellers' M-Pesa credentials. */
  encryptionKey: string;
  /** Where Safaricom should call back. Must be reachable from the internet. */
  publicUrl?: string;
  allowedOrigins: string[];
  smsWebhookUrl?: string;
  isProduction: boolean;
}

class ConfigError extends Error {
  constructor(problems: string[]) {
    super(
      `SokoOS cannot start. ${problems.length} configuration ${
        problems.length === 1 ? "problem" : "problems"
      }:\n\n${problems.map((p) => `  • ${p}`).join("\n")}\n`,
    );
    this.name = "ConfigError";
  }
}

/**
 * Reads and checks the environment.
 *
 * Collects every problem rather than throwing on the first, so somebody
 * configuring a new deploy fixes all of it in one pass instead of discovering
 * the next missing variable after each restart.
 */
export function readConfig(env = process.env): Config {
  const problems: string[] = [];
  const isProduction = env.NODE_ENV === "production";

  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    problems.push("DATABASE_URL is not set. It is the Postgres connection string.");
  }

  const encryptionKey = env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    problems.push(
      "ENCRYPTION_KEY is not set. Sellers' M-Pesa credentials are encrypted with it.\n" +
        "    Generate one with: openssl rand -base64 32\n" +
        "    Keep it outside the database, and keep a copy — losing it means every\n" +
        "    connected till has to be reconnected by hand.",
    );
  } else if (Buffer.from(encryptionKey, "base64").length !== 32) {
    /* Accepted at runtime — the crypto module hashes a short value to length —
     * but flagged here, because a passphrase where a key belongs is nearly
     * always a mistake somebody wants to know about before going live. */
    problems.push(
      "ENCRYPTION_KEY is not 32 bytes of base64. It will still work, but a real\n" +
        "    key is stronger: openssl rand -base64 32",
    );
  }

  const port = Number(env.PORT ?? 8787);
  if (!Number.isFinite(port) || port <= 0) {
    problems.push(`PORT is not a usable port number (got ${env.PORT}).`);
  }

  const publicUrl = env.PUBLIC_URL?.replace(/\/$/, "");
  if (isProduction) {
    /* In production the callback URL is not a convenience. Safaricom has to
     * reach it, and behind a load balancer the request's own host header is
     * often the internal one — so a guessed URL means payments that arrive
     * nowhere, silently. */
    if (!publicUrl) {
      problems.push(
        "PUBLIC_URL is not set. Safaricom callbacks are built from it, and a\n" +
          "    guess from request headers is wrong behind most load balancers.\n" +
          "    Set it to the address the internet uses, e.g. https://api.sokoos.app",
      );
    } else if (!publicUrl.startsWith("https://")) {
      problems.push(`PUBLIC_URL must be https in production (got ${publicUrl}).`);
    }

    if (!env.ALLOWED_ORIGINS) {
      problems.push(
        "ALLOWED_ORIGINS is not set. It defaults to localhost, which means the\n" +
          "    deployed front end cannot talk to this API.",
      );
    }

    if (!env.SMS_WEBHOOK_URL) {
      /* Not fatal: a deploy without SMS is a real intermediate state while an
       * aggregator account is being approved. But nobody can sign in, and that
       * should be a decision rather than a surprise. */
      console.warn(
        "[config] SMS_WEBHOOK_URL is not set: login codes will only be written to\n" +
          "         the log, so nobody can sign in without reading it.",
      );
    }
  }

  if (problems.length) throw new ConfigError(problems);

  return {
    databaseUrl: databaseUrl!,
    port,
    encryptionKey: encryptionKey!,
    publicUrl,
    allowedOrigins: (env.ALLOWED_ORIGINS ?? "http://localhost:3000").split(",").map((o) => o.trim()),
    smsWebhookUrl: env.SMS_WEBHOOK_URL,
    isProduction,
  };
}

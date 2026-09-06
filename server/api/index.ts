import { handle } from "hono/vercel";
import { app } from "../src/index.js";

/**
 * The API as a Vercel function.
 *
 * The same Hono app the container runs — `vercel.json` rewrites every path
 * here, so routing stays in one place rather than being half in the framework
 * and half in a platform config.
 *
 * The Node runtime, not Edge, and not by preference: `pg` opens a TCP socket
 * and the Edge runtime has none. Anything that talks to Postgres directly has
 * to run here.
 *
 * Migrations do not run on this path. A serverless function has no single boot
 * to hang them on — every cold start would race every other one — so they run
 * from the build command instead, once per deploy, before any function serves
 * a request.
 */
export const config = { runtime: "nodejs" };

/**
 * Named per HTTP method, not a default export.
 *
 * A default export is invoked with Node's classic `(req, res)` signature,
 * which is not what it looks like: Vercel's builder decides the calling
 * convention from which export shape is present, not from what the function
 * actually does. Handed a plain Node request instead of a Web-standard one,
 * Hono's own request wrapper breaks on the first header lookup — every
 * request timed out here without a single one reaching a route, migrations
 * included. Naming the export by method is what tells Vercel to call this
 * the way `handle()` actually expects: `(request: Request) => Response`.
 */
const handler = handle(app);

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;

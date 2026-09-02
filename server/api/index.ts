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

export default handle(app);

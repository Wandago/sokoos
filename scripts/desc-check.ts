import { parseStatement, sampleStatement } from "../lib/statements";
import { createSeedDatabase } from "../lib/seed";
parseStatement(sampleStatement(createSeedDatabase())).rows.forEach(r =>
  console.log(`${(r.code||"—").padEnd(11)} ${r.direction.padEnd(6)} ${String(r.amount).padStart(8)}  "${r.description}"`));

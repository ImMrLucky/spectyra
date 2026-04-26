/**
 * Copies the bundled provider catalog into `pricing_registry_snapshots` (DB).
 * Run from CI or cron: `DATABASE_URL=... pnpm --filter api run pricing:ingest-bundled`
 */
import "dotenv/config";
import { initDb } from "../src/services/storage/db.js";
import { ensurePricingRegistrySchema } from "../src/services/storage/ensurePricingRegistrySchema.js";
import { insertPricingSnapshot } from "../src/services/pricing/pricingRegistryRepo.js";
import { getBundledProviderPricingSnapshot } from "../src/services/pricing/bundledPricingSnapshot.js";

initDb();
await ensurePricingRegistrySchema();
const snap = getBundledProviderPricingSnapshot(undefined);
await insertPricingSnapshot(snap, snap.ttlSeconds, "scheduled_bundled_copy");
console.log("OK ingested pricing snapshot", snap.version, "entries", snap.entries.length);
process.exit(0);

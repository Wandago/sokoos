import type { Database } from "../types";

/**
 * Turning a business into records, and back.
 *
 * The app holds one `Database` object: a handful of singletons and fifteen
 * arrays. The server holds rows keyed by (kind, id). This file is the only
 * place that knows how to go between the two, so adding a collection is one
 * line here rather than a change in three places.
 *
 * Everything is pure — no network, no storage — because this is the part that
 * decides what gets sent, and a mistake here quietly loses a seller's data.
 */

/** Collections that live as arrays of records with an `id`. */
export const COLLECTIONS = [
  "customers",
  "products",
  "orders",
  "payments",
  "riders",
  "deliveries",
  "ledger",
  "conversations",
  "captures",
  "ingredients",
  "services",
  "staff",
  "lots",
  "serials",
  "imports",
] as const satisfies readonly (keyof Database)[];

export type Collection = (typeof COLLECTIONS)[number];

/**
 * The one-of-a-kind records. They are stored the same way as everything else so
 * the sync protocol has exactly one shape, with the field name as the id.
 */
export const SINGLETONS = ["business", "storefront", "account"] as const;
export type Singleton = (typeof SINGLETONS)[number];

/** The singular record kind for each collection: "orders" holds an "order". */
const KIND: Record<Collection, string> = {
  customers: "customer",
  products: "product",
  orders: "order",
  payments: "payment",
  riders: "rider",
  deliveries: "delivery",
  ledger: "ledger_entry",
  conversations: "conversation",
  captures: "capture",
  ingredients: "ingredient",
  services: "service",
  staff: "staff",
  lots: "lot",
  serials: "serial",
  imports: "import",
};

const COLLECTION_FOR_KIND = Object.fromEntries(
  (Object.entries(KIND) as [Collection, string][]).map(([collection, kind]) => [kind, collection]),
) as Record<string, Collection>;

export interface SyncOp {
  kind: string;
  id: string;
  doc?: unknown;
  updatedAt: string;
  deleted?: boolean;
}

interface Identified {
  id: string;
}

/**
 * Everything a business owns, as ops. Used once, on first sign-in, to push what
 * is already sitting in a seller's browser rather than overwriting it with an
 * empty account — which is the single most damaging thing this could get wrong.
 */
export function snapshotOps(db: Database, at = new Date().toISOString()): SyncOp[] {
  const ops: SyncOp[] = [];

  for (const singleton of SINGLETONS) {
    const doc = db[singleton];
    if (doc) ops.push({ kind: singleton, id: singleton, doc, updatedAt: at });
  }

  for (const collection of COLLECTIONS) {
    for (const record of db[collection] as Identified[]) {
      ops.push({ kind: KIND[collection], id: record.id, doc: record, updatedAt: at });
    }
  }

  return ops;
}

/**
 * What changed between two states of the database.
 *
 * The store updates immutably, so an untouched record keeps its object
 * identity. Comparing by reference is therefore both correct and cheap: a
 * seller with two thousand orders who edits one produces exactly one op, not
 * two thousand comparisons of deep equality.
 */
export function diffOps(
  previous: Database,
  next: Database,
  at = new Date().toISOString(),
): SyncOp[] {
  const ops: SyncOp[] = [];

  for (const singleton of SINGLETONS) {
    if (previous[singleton] !== next[singleton] && next[singleton]) {
      ops.push({ kind: singleton, id: singleton, doc: next[singleton], updatedAt: at });
    }
  }

  for (const collection of COLLECTIONS) {
    const before = previous[collection] as Identified[];
    const after = next[collection] as Identified[];
    if (before === after) continue;

    const kind = KIND[collection];
    const seen = new Map<string, Identified>();

    for (const record of after) {
      seen.set(record.id, record);
    }

    const byId = new Map(before.map((record) => [record.id, record]));

    for (const [id, record] of seen) {
      // Reference equality is the whole trick: unchanged records are skipped.
      if (byId.get(id) !== record) {
        ops.push({ kind, id, doc: record, updatedAt: at });
      }
    }

    // A record that was there and is not any more has to travel as a tombstone,
    // or it comes back the next time another device syncs.
    for (const id of byId.keys()) {
      if (!seen.has(id)) ops.push({ kind, id, updatedAt: at, deleted: true });
    }
  }

  return ops;
}

export interface PulledRecord {
  kind: string;
  id: string;
  doc: unknown | null;
  updatedAt: string;
  deleted: boolean;
  seq: number;
}

/**
 * Folds records pulled from the server into the local database.
 *
 * The server has already decided who wins — it only sends what it accepted —
 * so this applies rather than arbitrates. Returns the same object when nothing
 * changed, so React does no work on an empty sync.
 */
export function applyPulled(db: Database, records: PulledRecord[]): Database {
  if (!records.length) return db;

  let changed = false;
  const next: Database = { ...db };
  // Collections are copied lazily, so a pull touching one of them does not
  // create fifteen new arrays and invalidate every list on screen.
  const touched = new Map<Collection, Map<string, unknown>>();

  const indexOf = (collection: Collection) => {
    let index = touched.get(collection);
    if (!index) {
      index = new Map((db[collection] as Identified[]).map((r) => [r.id, r]));
      touched.set(collection, index);
    }
    return index;
  };

  for (const record of records) {
    if (SINGLETONS.includes(record.kind as Singleton)) {
      if (!record.deleted && record.doc) {
        next[record.kind as Singleton] = record.doc as never;
        changed = true;
      }
      continue;
    }

    const collection = COLLECTION_FOR_KIND[record.kind];
    // An unknown kind is from a newer client version. Ignoring it is right:
    // this device cannot render it, and dropping it locally does not delete it
    // from the server, so nothing is lost.
    if (!collection) continue;

    const index = indexOf(collection);
    if (record.deleted) {
      if (index.delete(record.id)) changed = true;
    } else if (record.doc) {
      index.set(record.id, record.doc);
      changed = true;
    }
  }

  if (!changed) return db;

  for (const [collection, index] of touched) {
    next[collection] = [...index.values()] as never;
  }
  return next;
}

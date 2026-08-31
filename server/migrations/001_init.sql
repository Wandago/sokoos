-- SokoOS, first migration.
--
-- Two ideas run through this schema and everything else follows from them.
--
-- One: the phone is the source of truth. The app already works offline and
-- writes locally before it writes anywhere else, and that is the property that
-- makes it usable on a matatu with no signal. The server's job is to be a
-- durable copy and a way to reach a second device — not to become the thing
-- every screen waits for.
--
-- Two: a business's records are stored as documents rather than as thirty
-- typed tables. That is a deliberate trade, not laziness. The domain model is
-- still moving (this build has changed shape four times), the client owns the
-- shape, and a sync log over a uniform row is a hundred lines instead of a
-- thousand. What it costs is referential integrity and easy ad-hoc SQL — so
-- where the server genuinely needs to query inside a record, there is an
-- expression index for exactly that, and no more.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tenants and people
-- ---------------------------------------------------------------------------

-- One business. Everything a seller owns hangs off this, and every query in
-- the application is scoped by it.
create table tenants (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  name         text not null,
  -- The trade, which decides the starting catalogue and how stock is counted.
  industry     text,
  created_at   timestamptz not null default now(),
  -- Set rather than deleted: a suspended business must still be able to export.
  suspended_at timestamptz
);

-- A person who signs in. Phone-first, because that is the identity people here
-- actually have and remember; email is optional and never the key.
create table accounts (
  id           uuid primary key default gen_random_uuid(),
  -- E.164, normalised on the way in so 0722…, +254722… and 254722… are one row.
  phone        text unique not null,
  name         text not null,
  email        text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz
);

-- Which people can act for which business, and as what. A seller may
-- eventually have staff; the join table exists now so that is a row rather
-- than a migration.
create table memberships (
  tenant_id  uuid not null references tenants(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  role       text not null default 'owner' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, account_id)
);

create index memberships_by_account on memberships (account_id);

-- ---------------------------------------------------------------------------
-- Sign-in
-- ---------------------------------------------------------------------------

-- A one-time code, hashed. Storing the code itself would mean anyone with read
-- access to this table could sign in as anybody, which is the whole point of
-- the table being here rather than in memory.
create table login_codes (
  id           uuid primary key default gen_random_uuid(),
  phone        text not null,
  code_hash    text not null,
  expires_at   timestamptz not null,
  -- Counted so a code cannot be brute-forced in the sixty seconds it lives.
  attempts     int not null default 0,
  consumed_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index login_codes_by_phone on login_codes (phone, created_at desc);

-- Sessions are opaque random tokens, hashed at rest for the same reason.
create table sessions (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references accounts(id) on delete cascade,
  token_hash    text not null unique,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  last_used_at  timestamptz,
  revoked_at    timestamptz,
  -- Only ever used to show a seller their own sessions and let them end one.
  user_agent    text
);

create index sessions_by_account on sessions (account_id) where revoked_at is null;

-- ---------------------------------------------------------------------------
-- The sync spine
-- ---------------------------------------------------------------------------

-- Every business record, whatever kind. The primary key is (tenant, kind, id)
-- because the client generates ids that are unique within a business but make
-- no promise across businesses — and they should not have to.
create table records (
  tenant_id   uuid not null references tenants(id) on delete cascade,
  kind        text not null,
  id          text not null,
  doc         jsonb not null,

  -- Last-write-wins is decided on this, not on arrival order, so a phone that
  -- was offline for a day does not clobber newer edits when it reconnects.
  updated_at  timestamptz not null,
  -- Tombstone. Deletes have to travel, so a deleted row stays and is marked.
  deleted_at  timestamptz,

  -- The cursor. Monotonic per tenant, assigned by the server on every write,
  -- which is what makes "give me everything since X" a single indexed scan.
  seq         bigint not null,

  -- Which device wrote it last. Only for support: "your other phone did that".
  device_id   text,
  server_at   timestamptz not null default now(),

  primary key (tenant_id, kind, id)
);

-- The one index the sync endpoint actually uses.
create index records_by_seq on records (tenant_id, seq);

-- The public mini site is served by the server, so it needs to find a
-- business's active products without loading everything it owns.
create index records_storefront on records (tenant_id, kind)
  where kind in ('product', 'service', 'storefront') and deleted_at is null;

-- Per-tenant sequence. A single global sequence would leak how many writes
-- other businesses are doing, and would make a tenant's cursor jump for
-- reasons that have nothing to do with them.
create table tenant_cursors (
  tenant_id uuid primary key references tenants(id) on delete cascade,
  last_seq  bigint not null default 0
);

-- Idempotency for push. A phone on a bad connection will retry a batch it
-- already delivered; without this, retries double-apply.
create table applied_batches (
  tenant_id  uuid not null references tenants(id) on delete cascade,
  batch_id   text not null,
  applied_at timestamptz not null default now(),
  result     jsonb not null,
  primary key (tenant_id, batch_id)
);

-- ---------------------------------------------------------------------------
-- Staff access to merchant data, recorded
-- ---------------------------------------------------------------------------

-- The operator console can read any business. That power is only acceptable if
-- every use of it is written down, so this table is append-only by convention
-- and there is no code path that deletes from it.
create table admin_audit (
  id          bigserial primary key,
  actor       text not null,
  action      text not null,
  tenant_id   uuid references tenants(id) on delete set null,
  detail      jsonb,
  at          timestamptz not null default now()
);

create index admin_audit_by_tenant on admin_audit (tenant_id, at desc);

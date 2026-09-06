-- The operator console's own sign-in.
--
-- Deliberately not a seller account and not self-service: there is no
-- endpoint that creates one. An admin who can suspend any business on the
-- platform is provisioned by someone with direct database access, running
-- `npm run admin:create` — the same trust boundary as gaining shell access to
-- the server itself, which is the right boundary for this amount of power.

create table admin_users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  password_hash text not null,
  name          text not null,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz
);

create table admin_sessions (
  id           uuid primary key default gen_random_uuid(),
  admin_id     uuid not null references admin_users(id) on delete cascade,
  token_hash   text not null unique,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  last_used_at timestamptz,
  revoked_at   timestamptz
);

create index admin_sessions_by_admin on admin_sessions (admin_id) where revoked_at is null;

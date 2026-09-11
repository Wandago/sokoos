-- Two queues the operator console needs and never had: a way for a customer to
-- flag a storefront, and a way for a seller to reach a human. Both were built
-- as sample data on the admin pages before there was anywhere real for a
-- report or a ticket to come from.
--
-- Kept tenant-keyed and reached only through the application layer, the same
-- pattern as mpesa_accounts: a report is filed by someone who has never signed
-- in (the whole point of it), and a ticket is filed by a seller for their own
-- business only, so there is nothing here for row-level security to arbitrate
-- between two tenants the way there is for `records`.

create table moderation_reports (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,

  reason            text not null check (reason in
    ('counterfeit', 'scam', 'offensive', 'impersonation', 'other')),
  detail            text not null,
  -- However the reporter wants to be reached back. Never required: most
  -- people flagging a shop will not leave one, and the report still matters.
  reporter_contact  text,

  status            text not null default 'open' check (status in
    ('open', 'reviewing', 'upheld', 'dismissed')),
  created_at        timestamptz not null default now(),
  resolved_at       timestamptz,
  resolved_by       text
);

create index moderation_reports_by_tenant on moderation_reports (tenant_id);
create index moderation_reports_open on moderation_reports (status)
  where status in ('open', 'reviewing');

create table support_tickets (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  -- Who filed it, when it was a signed-in seller rather than something raised
  -- on their behalf. Set null on delete rather than cascaded: the ticket is
  -- the business's history, not the account's.
  account_id   uuid references accounts(id) on delete set null,

  subject      text not null,
  message      text not null,
  priority     text not null default 'normal' check (priority in
    ('urgent', 'high', 'normal', 'low')),
  status       text not null default 'open' check (status in
    ('open', 'pending', 'solved')),
  assignee     text,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index support_tickets_by_tenant on support_tickets (tenant_id);
create index support_tickets_open on support_tickets (status)
  where status <> 'solved';

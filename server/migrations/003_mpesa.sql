-- M-Pesa, read-only by design.
--
-- The decision that shapes this whole file: money never flows through SokoOS.
-- Every seller keeps their own Paybill or Till, the customer pays that
-- shortcode directly, and this service is only ever *told* that it happened.
--
-- That is not a technical preference. Holding other people's money in Kenya
-- makes you a payment service provider under Central Bank licensing, with
-- capital requirements and an audit regime — a different company with a
-- different balance sheet. Reading a seller's own till keeps SokoOS a
-- bookkeeping tool, and keeps the seller's money exactly where it already is:
-- in their account, instantly, with no float and nothing to reconcile against
-- an intermediary.

-- One seller's own Daraja credentials. Never SokoOS's own.
create table mpesa_accounts (
  tenant_id      uuid primary key references tenants(id) on delete cascade,

  -- Paybill or Till, and the number the customer actually pays.
  kind           text not null check (kind in ('paybill', 'till')),
  shortcode      text not null,

  /* Daraja credentials belonging to the seller's own app. Encrypted with a
   * server-held key rather than stored plainly, because a database dump must
   * not be enough to transact on a seller's shortcode. They are write-only
   * from the API's point of view: no endpoint ever returns them. */
  consumer_key_enc    text not null,
  consumer_secret_enc text not null,
  -- Only needed for STK push, which asks a customer's phone for payment.
  passkey_enc         text,

  environment    text not null default 'sandbox' check (environment in ('sandbox', 'production')),

  /* The unguessable half of this seller's callback URL.
   *
   * Daraja does not sign its callbacks — there is no HMAC to verify — so the
   * URL itself has to carry the secret. This is generated, never chosen, and
   * a seller can roll it if they think it has leaked. Every payload is checked
   * against the shortcode too, so a leaked URL alone cannot invent income for
   * a different business. */
  callback_secret text not null unique,

  -- Set once Safaricom confirms the C2B URLs are registered.
  registered_at  timestamptz,
  last_event_at  timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index mpesa_accounts_by_shortcode on mpesa_accounts (shortcode);

/* Every callback, exactly as it arrived.
 *
 * Kept raw and forever for three reasons: a seller disputing a figure needs
 * the original, a parser bug needs something to replay against, and money that
 * arrived but failed to post has to be recoverable rather than lost. */
create table mpesa_events (
  id            bigserial primary key,
  tenant_id     uuid not null references tenants(id) on delete cascade,

  /* The M-Pesa receipt code. The same primitive the statement importer already
   * dedupes on — unique per transaction across all of Safaricom — so a
   * callback delivered twice cannot post income twice. */
  trans_id      text not null,

  kind          text not null default 'c2b',
  amount        numeric(14, 2),
  msisdn        text,
  payer_name    text,
  bill_ref      text,
  short_code    text,
  trans_time    timestamptz,

  payload       jsonb not null,
  received_at   timestamptz not null default now(),

  -- The payment record this became, once it was written into the sync stream.
  payment_id    text,
  matched_order text,
  -- Set when the payload could not be understood, with the reason.
  error         text,

  unique (tenant_id, trans_id)
);

create index mpesa_events_by_tenant on mpesa_events (tenant_id, received_at desc);
-- Unposted events are the ones that need a human; make them cheap to find.
create index mpesa_events_unposted on mpesa_events (tenant_id)
  where payment_id is null;

alter table mpesa_events enable row level security;
alter table mpesa_events force row level security;

create policy tenant_isolation on mpesa_events
  using (tenant_id = current_tenant())
  with check (tenant_id = current_tenant());

-- The accounts table is read by the callback route *before* a tenant is known
-- — the secret in the URL is what identifies the tenant — so it is scoped by
-- the application layer rather than by a policy that could not yet apply.

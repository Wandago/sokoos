# SokoOS API

The server half. Deliberately small: the client already holds every rule about
how money works, tested on its own, and duplicating that here would give it two
places to disagree with itself. This does the four things a browser cannot —
remember who someone is, store their records durably, hand them to a second
device, and serve the public mini site to people who have never signed in.

## Running it

```bash
createdb sokoos
export DATABASE_URL="postgres://user@localhost:5432/sokoos"
npm install
npm run migrate
npm start          # http://localhost:8787
npm test           # 49 checks against a real Postgres
```

`npm test` truncates every table, so point `DATABASE_URL` at a scratch database.

## The design, in three decisions

**The phone is the source of truth.** Every screen writes to localStorage and
carries on; sync exchanges those writes in the background. Nothing on screen
waits for a network call, which is why the app works on a matatu — and the
server is a durable copy and a route to a second device, not a gatekeeper.

**Records are stored as documents, not thirty typed tables.** A deliberate
trade. The domain model is still moving, the client owns the shape, and a sync
log over a uniform row is a hundred lines instead of a thousand. What it costs
is referential integrity and easy ad-hoc SQL, so where the server genuinely
needs to look inside a record — the public storefront — there is an index for
exactly that and no more.

**Conflicts are last-write-wins on the client's timestamp.** Not arrival order,
so a phone that was offline for a day cannot clobber newer edits from another
device. These are single-operator businesses; two devices editing the same
order in the same second is not a real scenario, and a lost update there costs
one re-tap. Merge semantics would cost weeks and be wrong in ways nobody could
explain to a seller.

## Tenant isolation

**This was broken, and that is worth reading before trusting it.** The policies
below were written against a role without BYPASSRLS, on the stated assumption
that the application connects as that role. It never did — it connected as the
owner, a superuser on most installs, and a superuser bypasses row-level
security unconditionally. `force row level security` does not help: it makes
policies apply to the *owner*, not to a superuser.

So the isolation was decorative. `pg_policies` listed it, `pg_class` reported
it enabled and forced, and a query that forgot its tenant clause would have
returned another business's books. Nothing leaked, because the application
always did scope its queries — which is precisely the problem. A protection
that silently is not there is indistinguishable from one that is, until the day
it is needed.

`withTenant` now issues `set local role sokoos_app` after setting the tenant,
dropping privileges for the transaction and reverting on commit. `npm run
db:check` proves it against any database by writing to two tenants and trying
to read across; the suite asserts the same on every run.


Every read and write is scoped twice. The application layer only hands out a
database client through `withTenant`, and Postgres row-level security refuses
anything that arrives without a matching tenant. The second one exists because
the day someone writes a query that forgets the tenant clause — and on a long
enough timeline someone will — the database should refuse rather than quietly
return another business's books.

The test suite attacks both: one seller tries to read and write another's
records through the API, and a direct query bypassing the route is checked too.

## The protocol

```
GET  /health
POST /auth/code            { phone }                → sends a six-digit code
POST /auth/verify          { phone, code, name? }   → { token, tenants }
GET  /me
POST /tenants              { name, industry? }      → creates a business
GET  /tenants/:id/sync?since=N                      → records after cursor N
POST /tenants/:id/sync     { batchId, ops[] }       → applies a batch
GET  /tenants/:id/cursor
GET  /store/:slug                                   → the public mini site

GET  /tenants/:id/mpesa                             → till status, never secrets
POST /tenants/:id/mpesa    { kind, shortcode, … }   → connect a seller's own till
POST /tenants/:id/mpesa/register                    → register C2B URLs with Safaricom
POST /tenants/:id/mpesa/request { phone, amount }   → STK push, asks a phone to pay
GET  /tenants/:id/mpesa/unmatched                   → money in, order unknown

POST /mpesa/c2b/:secret/confirmation                → Safaricom, on payment
POST /mpesa/c2b/:secret/validation                  → Safaricom, before payment
POST /mpesa/stk/:secret                             → Safaricom, STK push outcome
```

Auth is closed by default: `PUBLIC_PATHS` in `src/index.ts` is the entire list
of routes that work without a session. A route added anywhere, in any order,
needs a token unless it is named there.

## M-Pesa, read not held

Money never moves through this service. Every seller keeps their own Paybill or
Till, the customer pays that shortcode directly, and the API is only ever *told*
that it happened.

That is a licensing decision before it is a technical one. Holding other
people's money in Kenya makes you a payment service provider under Central Bank
rules, with capital requirements and an audit regime attached — a different
company with a different balance sheet. Reading a seller's own till keeps
SokoOS a bookkeeping tool, and keeps the seller's money where it already is:
in their account, instantly, with no float and nothing to reconcile against an
intermediary.

**Credentials belong to the seller.** A seller connects the Daraja app for their
own shortcode. The consumer key, secret and passkey are encrypted with
AES-256-GCM under `ENCRYPTION_KEY` before they touch a column, and no endpoint
returns them — `GET /tenants/:id/mpesa` answers with a mask. A database dump is
therefore not enough to transact on anyone's till.

**The callback URL is the credential.** Daraja does not sign its callbacks;
there is no HMAC to check. So each seller gets an unguessable secret inside
their own URL, generated rather than chosen, and every payload is checked
against that account's shortcode as well — a leaked URL alone cannot invent
income for a different business.

**A callback always answers `ResultCode: 0`.** Even one this service rejects or
cannot parse. A non-zero answer makes Safaricom retry forever, and, worse, can
put a failure in front of a customer standing at a counter whose money has
already left their phone. Every payload is written to `mpesa_events` raw, so a
rejection is recoverable rather than lost.

**Deduped on the receipt code.** `(tenant_id, trans_id)` is unique — the same
primitive the statement importer already uses — so a callback delivered twice
cannot post income twice.

**A match explains itself.** The payment written into the sync stream carries
`matchReasons` alongside its confidence — "The order number was entered on
M-Pesa", "Paid from this customer's number" — because those signals exist only
here, and a seller confirming a suggestion should see the evidence rather than a
number.

**Matching is cautious on purpose.** An incoming payment is scored against open
orders on the account reference, the paying phone and the amount, matched
against what the *seller receives* rather than what the customer paid (with an
independent boda, the delivery fee never reaches the till). Only a decisive
match — 0.9 and above — settles an order. Anything weaker is recorded as a
suggestion the seller confirms, and if two open orders share the amount, nothing
is suggested at all: a wrong match hides money under the wrong customer, which
is worse than no match. Whatever is left shows up in `/mpesa/unmatched`.

## What is deliberately not here

**SMS delivery.** `deliverCode` logs the code and posts to `SMS_WEBHOOK_URL` if
one is set. Wiring an aggregator is one function, and it needs an account this
build does not have.

**Admin authorization.** The console's staff sign-in is still navigation rather
than authorization. The `admin_audit` table exists, ready, and is not yet
written to.

## Pointing it at Supabase

Supabase is managed Postgres, which is exactly what this service wants — so it
is a connection string, not a rewrite. Nothing in `src/` knows or cares.

1. Create a project at supabase.com. Note the database password; it is not your
   account password and it is shown once.
2. **Settings → Database → Connection string → Transaction pooler.** Take that
   one, not the direct connection: on the free tier the direct host is
   IPv6-only, which fails from most laptops and a good many hosts. The pooler
   string has `pooler.supabase.com` in it.
3. Check it before trusting it with anything:

```bash
cd server
DATABASE_URL="postgres://postgres.abcxyz:PASSWORD@aws-0-eu-central-1.pooler.supabase.com:6543/postgres" \
  npm run db:check
```

That connects, applies the migrations, and then does the part worth doing: it
creates two businesses, writes a record to each, and tries to read one from
inside the other. If that read returns anything it fails loudly — because
row-level security failing silently is the whole risk, and a policy that did
not apply looks exactly like one that did.

TLS is turned on automatically for any non-local host. For production, download
Supabase's certificate (Database → SSL Configuration) and set `DATABASE_CA`, so
the connection is verified rather than merely encrypted.

**Region matters more than it looks.** Every sync push is a transaction, so a
database on another continent turns a fast phone into a slow one. `db:check`
prints the round trip and says so when it is far.

## Deploying it

The image builds from this directory and runs on any host that takes a
container. Everything it needs is in the environment; see `.env.example`.

```bash
docker build -t sokoos-api server
docker run -p 8787:8787 \
  -e DATABASE_URL=... \
  -e ENCRYPTION_KEY="$(openssl rand -base64 32)" \
  -e PUBLIC_URL=https://api.sokoos.app \
  -e ALLOWED_ORIGINS=https://sokoos.app \
  -e NODE_ENV=production \
  sokoos-api
```

**Migrations run on boot.** Not as a separate deploy step, because the two
cannot be allowed to drift: a container running code that expects a column its
database does not have is a worse failure than a slightly slower start. An
empty database becomes a working one on the first launch.

**A misconfigured server refuses to start.** Every required setting is read on
the way up and a missing one stops the process with a message saying what to do
about it. The failure this prevents is the expensive one: a deploy that comes
up, passes its health check, accepts sign-ins, and then throws the first time
somebody's customer pays — because nothing looked at `ENCRYPTION_KEY` until a
seller's credentials needed decrypting. A server that will not start is a line
in a deploy log; a server that starts broken is a shopkeeper at a counter
losing a sale.

CI builds the image and runs it against an empty Postgres on every push, so
both of those stay true.

**Before anyone else uses it:** wire `SMS_WEBHOOK_URL` to an aggregator.
Without it, login codes go to the log only, and nobody can sign in.

## Configuration

| Variable | Meaning |
| --- | --- |
| `DATABASE_URL` | Postgres connection string. Required. |
| `PORT` | Defaults to 8787. |
| `ALLOWED_ORIGINS` | Comma-separated. The static front end is always cross-origin. |
| `SMS_WEBHOOK_URL` | Where login codes are posted. Logged if unset — which means nobody can sign in. |
| `ENCRYPTION_KEY` | Base64 32 bytes, for sellers' M-Pesa credentials. `openssl rand -base64 32`. |
| `PUBLIC_URL` | This API's public address, used to build callback URLs for Daraja. |
| `NODE_ENV` | `production` stops login codes being returned in the response. |

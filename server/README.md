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
```

Auth is closed by default: `PUBLIC_PATHS` in `src/index.ts` is the entire list
of routes that work without a session. A route added anywhere, in any order,
needs a token unless it is named there.

## What is deliberately not here

**SMS delivery.** `deliverCode` logs the code and posts to `SMS_WEBHOOK_URL` if
one is set. Wiring an aggregator is one function, and it needs an account this
build does not have.

**M-Pesa.** Reading a seller's till through Daraja belongs here and is not
written. Note that money must not flow *through* this service — that would make
the business a payment service provider under Central Bank licensing, which is
a different company.

**Admin authorization.** The console's staff sign-in is still navigation rather
than authorization. The `admin_audit` table exists, ready, and is not yet
written to.

## Configuration

| Variable | Meaning |
| --- | --- |
| `DATABASE_URL` | Postgres connection string. Required. |
| `PORT` | Defaults to 8787. |
| `ALLOWED_ORIGINS` | Comma-separated. The static front end is always cross-origin. |
| `SMS_WEBHOOK_URL` | Where login codes are posted. Logged if unset. |
| `NODE_ENV` | `production` stops login codes being returned in the response. |

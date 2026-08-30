# SokoOS

**The operating system for businesses that sell everywhere.**

A mobile-first, installable PWA for Kenyan social-commerce businesses — the ones
selling through Instagram, TikTok, WhatsApp, phone calls and referrals. It turns
scattered conversations and M-Pesa messages into a structured business
operation: orders, payments, delivery, and a ledger that balances itself.

Discovery → Conversation → Order → Payment → Delivery → Reconciliation → Business intelligence

## What's in it

| Module | What it does |
| --- | --- |
| **Dashboard** | Today's takings, open orders, what needs attention, one smart insight |
| **Orders** | The full lifecycle — new → confirmed → packed → out for delivery → delivered |
| **Inbox** | Instagram, TikTok, WhatsApp and Facebook conversations in one place, each convertible to an order |
| **Customers** | Order history, lifetime spend, and what each person still owes |
| **Products** | Prices, cost, margin per item, and low-stock warnings |
| **Payments** | M-Pesa, cash and bank payments, with suggested matches for anything unreconciled |
| **Deliveries** | Riders, zones, and what is on the road right now |
| **Ledger** | Money in and out, with cost of goods and rider payouts posted automatically |
| **Smart Capture** | Photograph a receipt or M-Pesa message; the fields are extracted, reviewed, then filed |
| **Analytics** | Revenue trend, which channel sells, best sellers, top customers |
| **Settings** | Business details, light/dark/system theme, demo data reset |

Plus three screens outside the app chrome:

| Route | What it is |
| --- | --- |
| `/welcome` | The onboarding flow — six swipeable cards a first-time visitor meets before the dashboard. Replayable from Settings. |
| `/landing` | The marketing page: hero with a live-styled phone mock, how it works, features, offline, three steps, pricing. |
| `/ads` | The ad kit — twelve 9:16 story creatives, each openable at full size to screenshot into a story slot. |
| `/login`, `/signup` | Sign in, and a three-step sign up that ends by creating the seller's mini site. |
| `/store` | The seller's public mini site — what their customers see. |
| `/storefront` | The editor for that site: template, palette, copy, which products appear, and a live phone preview. |
| `/admin/*` | The operator console — see below. |

## The operator console

`/admin` is staff software for running the platform, not for running a shop.
Different audience, so a different register: desktop-first, dense tables, and
lime used to mean "this needs you" rather than as decoration.

| Route | What it does |
| --- | --- |
| `/admin` | Platform KPIs, sign-ups per week, plan mix, GMV by region, top merchants |
| `/admin/merchants` | Searchable, filterable table of every account, with a detail panel that can change plan or suspend |
| `/admin/revenue` | MRR against GMV, revenue by plan, accounts past due |
| `/admin/storefronts` | Moderation queue — uphold a report and the merchant is suspended |
| `/admin/support` | Ticket queue, ordered by how close each is to missing its SLA |
| `/admin/system` | Service health, incidents, and feature flags with rollout percentages |

Its data lives in `lib/admin/`, deliberately apart from `lib/types.ts`: that
file is one merchant's business, this one is the platform hosting thousands.
Keeping them separate is what lets the console be lifted into its own
deployment later.

**Two things to know before this ships.**

*The sign-in does not authenticate anyone.* It checks the shape of what you
type and sets a flag. Anyone can read the bundle and set the same flag. Access
has to be enforced on the server that holds the data — the UI can only ever
hide things, never protect them. The sign-in screen says so on the screen.

*The console currently ships inside the seller bundle.* That is fine for a
demo and wrong for production: staff code should not be downloadable by every
merchant. The routes are self-contained (own layout, own store, own frame) so
extracting them into a separate deployment is a move, not a rewrite. The
service worker already refuses to cache anything under `/admin`, and the
console is marked `noindex`.

All of the merchant data in it is synthetic, generated from a fixed seed. No
figure in there describes a real business.

## Accounts, and what "sign in" means here

This build has no server, so an account is a **local profile**: signing up writes
your name, email and phone to this device and nothing leaves it. The forms are
real — validation, multi-step, the lot — and when a backend exists they post to
it unchanged.

**No password is ever stored.** Sign-up asks for one, checks its shape, and
drops it. Keeping it in `localStorage` would put a secret on disk in the clear
and buy nothing without a server to verify it against, so `Account` has no
password field at all. There is a test that dumps storage and fails if a
password ever appears in it.

*Explore with the demo business* on the sign-in screen creates the demo profile
in one tap, so the app stays instantly explorable.

## The mini site

Every account gets a storefront the moment it is created — the two are not
useful apart. It pulls the same products the app already holds, so adding stock
in **Products** puts it on the site.

Four templates, each a real layout rather than a colour swap:

| Template | Shape | Best for |
| --- | --- | --- |
| **Spotlight** | Big hero, one product blown up, grid below | Fashion and beauty |
| **Catalogue** | Straight into a dense, price-forward grid | Volume sellers |
| **Story** | Editorial rows that alternate, room to explain | Handmade, slow fashion |
| **Link in bio** | One column: avatar, links, products as rows | Instagram and TikTok first |

Five palettes (Lime, Forest, Cream, Ink, Clay). Each carries **two** accents —
one for the page, one for the band — because a single accent cannot serve both:
a dark button vanishes on a dark hero, a light one vanishes on a light page.

Checkout is a WhatsApp deep link with the order already written out. That is
deliberate: these sellers already close in the chat, and a card checkout would
be a second system to reconcile.

## Running it

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # static export into ./out
npm run lint
```

`npm run build` produces a fully static site in `out/` — 22 routes, each a real
`index.html`, about 3 MB in total. There is no server, no database and no
serverless function anywhere in it.

## Deploying it

Any static host works, and none of them need a SPA fallback because every route
is a real file.

| Host | What to do |
| --- | --- |
| **Vercel** | Import the repo. It detects Next.js and the static export; no settings to change. |
| **Netlify** | Import the repo. `netlify.toml` already sets the build command, publish directory and the no-cache headers for `sw.js`. |
| **Cloudflare Pages** | Import the repo, build command `npm run build`, output directory `out`. |
| **Anything else** | `npm run build`, then upload `out/`. |

Serve `sw.js` and `manifest.webmanifest` with `Cache-Control: no-cache` — a
stale service worker can pin an old app shell for the life of the cache.
`netlify.toml` does this already.

**Install prompts and offline need HTTPS**, which all of the above give you.
On a bare `http://` origin the app still runs, just without the service worker.

GitHub Pages is the one host that needs code changes, because it serves from
`/<repo>/` rather than the root — that means a `basePath`, and a service worker
scoped to the subpath. Worth avoiding unless you specifically want it.

## Installing it on a phone

1. Open the deployed URL in the phone's browser.
2. **Android / Chrome** — an *Install SokoOS* prompt appears; or use the browser
   menu → *Install app*.
3. **iOS / Safari** — tap Share, then *Add to Home Screen*.

Once installed it launches standalone, without browser chrome, and works with no
network: the service worker precaches every screen, and business data is read
from the device.

Installability needs HTTPS (or `localhost`), so the service worker is registered
only in production builds.

## How the data works

This build is **local-first**. Everything — orders, customers, payments, the
ledger — lives in `localStorage` under `sokoos.db.v1` and never leaves the
device. The app ships seeded with a working Nairobi fashion business (Zawadi
Collection) so every screen has real numbers in it; *Settings → Reset demo data*
restores it.

`lib/store.tsx` is the only thing that touches storage. It exposes the domain
actions (`createOrder`, `recordPayment`, `matchPayment`, `confirmCapture`, …)
through a React context, so swapping the persistence layer for an API means
rewriting one file.

## Design system

Tokens live in `app/globals.css` — a semantic layer (`--surface`, `--text`,
`--brand`, `--panel`, `--ai`, `--delivery`, plus the financial states) that every
component reads, which is what makes light and dark mode a token swap rather
than a per-component chore.

The shell is a forest header — logo, search, alerts, avatar — with the light
content sheet rounding up over it, and a floating forest pill for navigation
whose active tab expands into a lime label.

- **Primary** — electric lime (`#C3F53C`). It is a *fill*, never a text colour:
  `--brand` is the surface and `--brand-ink` (`#06160D`) is what sits on it.
  Text that needs to read as brand on white uses `--brand-text` instead.
- **Forest** — the dark counterweight (`--panel`, `#0C2917`). Balance card,
  bottom nav, spending card, Smart Capture hero.
- **Supporting hues** — one per concern: violet for AI, cyan for delivery, amber
  for pending, red for failed. Used as accents, never as whole screens.
- **Neutrals** — faintly green-tinted ink, never pure grey or pure black.
- **Type** — Plus Jakarta Sans for headings, Inter for everything else, with
  tabular numerals wherever money appears. Money compacts only above 10,000, so
  `KES 4,021` never rounds away to `KES 4K`.
- **Metric cards** — label with an explainer, a tinted icon badge, the number,
  what it moved against, and a signed delta pill that goes neutral when a period
  is flat and inverts its colour for measures where a rise is bad.
- **Illustration** — flat spot drawings in `components/spot.tsx`: heavy outlines,
  two flat fills, a ground shadow, all inside a 200×200 box. They draw straight
  onto the card, never into a white panel, and carry a palette per surface
  (`surface="forest" | "lime" | "cream" | "paper"`) so the whole card stays one
  solid colour: cream line art on forest, dark outlines with light fills on
  lime. Each composition is nudged so its ink, not its box, sits on the centre
  lines. The onboarding, the ad kit and the landing page draw from the same
  seven.
- **Charts** — hand-rolled inline SVG/CSS. Lime is too light to carry a series
  alone on white, so columns pair lime companions with a near-black emphasis
  mark and every column keeps a visible label. Axis ticks are built from a clean
  step (0 / 20k / 40k), never by slicing the maximum. The readout is a pill that
  inverts against its surface, so it reads on a white card and a forest one
  alike. Paired series keep fixed roles across themes: money in is always the
  lime one.

Financial states are always visually distinct and never carried by colour alone:
Paid, Part paid, Unpaid, Cash on delivery, Pending, Failed, Needs review.

## Stack

Next.js 16 (App Router, static export) · React 19 · TypeScript · Tailwind CSS v4
· lucide-react. No backend, no chart library, no UI kit.

## Layout

```
app/                 one route per module, all client-rendered
app/welcome/         first-run onboarding cards
app/landing/         marketing page
app/ads/             ad kit
components/ui/       the design system (button, card, badge, sheet, chart, …)
components/          app frame, install prompt, order row, brand mark
components/spot.tsx  flat spot illustrations
lib/onboarding.tsx   onboarding card content and card themes
lib/types.ts         the domain model
lib/seed.ts          the seeded demo business
lib/store.tsx        local-first store + domain actions
lib/selectors.ts     derived business metrics
public/sw.js         service worker (app-shell precache, offline fallback)
```

## Where it goes next

The architecture is web-first and API-driven by intent. Customers should never
need to download anything — they interact through order links, web checkout,
WhatsApp and social channels. The seller app is this PWA; a native seller app
and rider app can follow later against the same API.

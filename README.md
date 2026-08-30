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
| **Deliveries** | Riders, zones, what is on the road, the handover moment, and cash a rider is still holding |
| **Ledger** | Money in and out, with cost of goods and rider payouts posted automatically |
| **Smart Capture** | Point the camera at a receipt, or say the transaction out loud; credit or debit is decided from the words and the reasoning is shown |
| **Statement import** | Paste or upload an M-Pesa or bank statement for any period; anything already in the books is recognised by transaction code and skipped |
| **Your CFO** | The brief: what the business kept, where it went, and what needs dealing with — every figure showing its workings |
| **Stock** | Counted the way your trade counts it — recipes for anything you make, lots for anything bought as a bale, serials for anything with an IMEI, plain counts for the rest |
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

```bash
npm run typecheck
npm run check   # the money logic, checked without a browser — see scripts/README.md
```

`npm run build` produces a fully static site in `out/` — 33 routes, each a real
`index.html`. There is no server, no database and no serverless function
anywhere in it.

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

## One app, several trades

A bakery, a thrift stall and a phone shop do not track stock the same way, and
software that assumes one of them fits none of the others. So the way stock is
counted lives on the product, not on the app, and a shop doing two of these at
once gets the right answer for each line.

| Mode | Who it is for | How cost is worked out |
| --- | --- | --- |
| **Recipe** | Bakery, restaurant, anything made | From the bill of materials — 400 g of flour, 6 eggs, a box and a board — with wastage on the lines where trim and spillage are real |
| **Lot** | Thrift bales, cartons, sacks, crates | A share of the landed cost: what you paid, plus transport, duty, sorting and mending |
| **Serial** | Phones, electronics, anything with an IMEI | The real cost of the real unit, with its own warranty clock. Stock is counted from units, never typed |
| **Simple** | Most resale | What you paid the supplier |
| **Service** | Salons, repairs, consulting | Nothing bought in |

Only the modes a business actually uses appear as tabs on the Stock screen. The
business type in Settings sets sensible starting points; it never locks anything
away.

### Why a bale is not divided by the piece count

A trader pays KES 38,000 for a bale, KES 1,800 to get it to the shop and KES
3,100 to sort, press and mend it. That KES 42,900 has to be spread across the
105 pieces that came out — 28 Grade A dresses that sell at 2,200, 41 Grade B at
1,100 and 36 Grade C at 400.

Dividing evenly gives every piece a cost of 409, which says a Grade C top cost
the same as a Grade A dress. It makes the good stock look barely profitable and
the bad stock look like a loss, and a trader following those numbers would stop
buying the very thing paying for the bale.

So the landed cost is allocated by **relative sales value** — the standard
treatment for a joint cost across outputs of unequal worth. Grade A carries 779
per piece, Grade B 390, Grade C 142, and every grade shows the same 65% margin,
which is the honest answer: they all came out of the same bale. An even split is
still offered, because when a carton holds 48 identical jars it is the right one.

## The rider, and whose money the delivery fee is

Someone sees a dress on TikTok, calls the number in the bio, and says they are in
Westlands. The dress is 2,200. The boda to Westlands is 200 — and that 200 goes
to the rider, not to the seller. The rider is an independent operator with a
working relationship, not an employee: he carries the goods, waits while the
seller confirms the customer's M-Pesa has landed, hands over, and collects his
own fare separately.

Counting that 200 as the seller's revenue overstates the business. Counting it as
their expense overstates it too. Doing both, which is the easy mistake, produces
a business that looks bigger and busier than it is. So settlement is modelled
explicitly, per order:

| Arrangement | Customer pays | Seller receives | Seller owes the rider |
| --- | --- | --- | --- |
| **Customer pays the rider** (the default) | 2,400 | 2,200 | — |
| **Seller charges and settles** | 2,400 | 2,400 | 200 |
| **Rider collects everything** | 2,400 | 2,400 | — (the rider owes 2,400 until they remit) |
| **Free delivery** | 2,200 | 2,200 | 200 |

Every order sheet shows **what the customer pays** and **what you receive** as two
separate lines, because whenever the rider is paid at the door they are different
numbers.

Two things follow from this that nothing else in the app would show:

- **The handover.** A delivery can sit in *waiting for payment* — the rider is
  with the customer and cannot hand over until the seller confirms the money
  landed. It is the thirty seconds every Kenyan delivery turns on, so it sits
  above everything else on the Deliveries screen.
- **The rider float.** When a rider collects on the seller's behalf, that cash is
  the seller's money in someone else's pocket. The order reads as paid, so
  nothing would otherwise tell them it has not arrived. It is counted per rider,
  per trip, and the CFO raises it.

## Money, and what the app will not pretend

Four of these modules touch money directly, so it is worth being exact about
what each one actually does.

**Duplicate detection is a set operation, not a judgement.** Every M-Pesa and
bank transaction carries a unique code. The importer collects every code already
in the books — ledger references, payment references, past captures — and asks
whether each incoming row's code is in that set. Import the same August
statement twice and the second pass files nothing. Rows with no code at all
(cash entries, some bank narrations) are marked *needs review* and left
unticked; they are never silently merged on a date-and-amount guess.

**Credit or debit is decided from words, and shows its reasoning.** A statement
with separate *Paid In* and *Withdrawn* columns settles it outright — the column
is the answer. Failing that, `lib/direction.ts` matches the narration against
weighted phrase lists and returns the phrase it turned on, so the seller sees
*"'paid to' means money out"* rather than a verdict with no account of itself.
When nothing decides it, the app says so and files it as money out at low
confidence rather than guessing confidently.

**The camera really opens; it does not really read.** `getUserMedia` gives a
live viewfinder, the frame is captured to a canvas and kept on the device. What
the app does not do is claim to have read the numbers off the photo — OCR needs
a server, and there is no server. So the seller types the amount, and the app
does the part it can do honestly.

**Speech is the real Web Speech API where the browser has it.** Where it does
not, the same sentence can be typed; the parsing that follows is identical
either way, which is why it is testable. "I received three thousand five hundred
from Grace" becomes KES 3,500, credit, Grace, Sales.

**Cost is worked out the way the trade works it out.** A recipe costs from
ingredients, a bale from its share of the landed cost, a serialised unit from
what that exact unit cost. Change the price of butter and every cake reprices
itself; change a grade's price and every piece in the bale recosts. Stock comes
off when an order is marked delivered, so the count stays true without a
separate stocktake.

**A delivery fee the seller never touched is not in their books.** Neither as
revenue nor as expense. The ledger posts a rider payout only when the seller is
the one paying it.

**The CFO brief is arithmetic on the seller's own books.** Each finding carries
the numbers it was derived from. When nothing is wrong it says so rather than
manufacturing a worry to look useful.

### Social DMs

TikTok, Instagram and Facebook message capture is deliberately not built. TikTok
has no public DM API at all; Meta's requires a business account, app review and a
server holding webhook subscriptions and long-lived tokens. None of that is
possible in a static, local-first app, and a mock inbox pretending otherwise
would be worse than its absence. The Inbox screen models conversations from
those channels, and says plainly that they are entered rather than synced.

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
lib/statements.ts    statement parsing and duplicate detection
lib/direction.ts     credit or debit, decided from words, with its reasoning
lib/speech.ts        a spoken sentence into an amount, a party and a direction
lib/costing.ts       recipe costing, and one cost answer per stock mode
lib/lots.ts          bale and carton costing, allocated by sales value
lib/serials.ts       serialised units, stock counts and warranty clocks
lib/cfo.ts           the CFO brief
scripts/             verification scripts for all of the above
public/sw.js         service worker (app-shell precache, offline fallback)
```

## Where it goes next

The architecture is web-first and API-driven by intent. Customers should never
need to download anything — they interact through order links, web checkout,
WhatsApp and social channels. The seller app is this PWA; a native seller app
and rider app can follow later against the same API.

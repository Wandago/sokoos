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

## Running it

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # static export into ./out
npm run lint
```

`npm run build` produces a fully static site in `out/`, so it can be hosted on
any static host — Vercel, Netlify, Cloudflare Pages, GitHub Pages, or an S3
bucket. There is no server and no database to run.

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
components/ui/       the design system (button, card, badge, sheet, chart, …)
components/          app frame, install prompt, order row, brand mark
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

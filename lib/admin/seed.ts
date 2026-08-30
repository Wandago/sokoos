import type {
  AdminDatabase,
  Incident,
  Merchant,
  MerchantStatus,
  Plan,
  Region,
  StorefrontReport,
  Ticket,
} from "./types";
import { planPrice } from "./types";

export const ADMIN_DB_VERSION = 1;

/**
 * Synthetic platform data.
 *
 * None of this describes a real business or a real person: it is generated
 * from a fixed seed so the console looks the same on every machine, and so a
 * screenshot of it can never leak anyone's actual trading figures.
 */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function at(daysAgo: number, hour = 12) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

const firstNames = [
  "Wanjiku", "Otieno", "Achieng", "Kamau", "Njeri", "Mutua", "Chebet", "Kariuki",
  "Hassan", "Wairimu", "Kimani", "Atieno", "Muthoni", "Ochieng", "Barasa", "Nyambura",
  "Kiptoo", "Adhiambo", "Mwangi", "Cherono", "Omondi", "Wafula", "Kilonzo", "Naliaka",
];
const secondNames = [
  "Grace", "Brian", "Faith", "Kevin", "Sharon", "Dennis", "Zainab", "Peter",
  "Cynthia", "Samuel", "Mercy", "Collins", "Tabitha", "Musa", "Winnie", "Elias",
];

// Enough distinct names to cover the whole roster: a console full of
// "Asili Home 2" reads as filler rather than a customer base.
const shopWords = [
  ["Zawadi", "Collection"], ["Sokoni", "Threads"], ["Rafiki", "Beauty"],
  ["Pendo", "Boutique"], ["Asili", "Home"], ["Kazi", "Supplies"],
  ["Neema", "Fashions"], ["Baraka", "Electronics"], ["Tumaini", "Kids"],
  ["Imani", "Naturals"], ["Malaika", "Styles"], ["Safiri", "Bags"],
  ["Chapa", "Prints"], ["Mvua", "Outerwear"], ["Jua", "Kali Tools"],
  ["Tamu", "Bakes"], ["Kioo", "Optics"], ["Nuru", "Candles"],
  ["Simba", "Sportswear"], ["Ziwa", "Swim"], ["Mlima", "Coffee"],
  ["Bahari", "Linens"], ["Shamba", "Fresh"], ["Kesho", "Stationery"],
  ["Furaha", "Gifts"], ["Anga", "Interiors"], ["Upepo", "Activewear"],
  ["Mavuno", "Grocers"], ["Taji", "Jewellery"], ["Nia", "Skincare"],
  ["Bidii", "Workwear"], ["Kito", "Ceramics"], ["Amani", "Textiles"],
  ["Zuri", "Hair"], ["Habari", "Books"], ["Msingi", "Hardware"],
  ["Pwani", "Sandals"], ["Njia", "Luggage"], ["Wimbo", "Audio"],
  ["Dhahabu", "Accessories"], ["Rehema", "Maternity"], ["Sanaa", "Prints"],
  ["Tandao", "Mobile"], ["Mkate", "Bakery"], ["Chai", "House"],
  ["Kilele", "Outdoors"], ["Bustani", "Plants"], ["Tabasamu", "Dental"],
  ["Mzalendo", "Merch"], ["Lulu", "Bridal"], ["Kibanda", "Snacks"],
  ["Ngoma", "Instruments"], ["Sindano", "Tailoring"], ["Feza", "Perfumes"],
  ["Jasho", "Fitness"], ["Mwanga", "Lighting"], ["Kikapu", "Baskets"],
  ["Nyota", "Toys"], ["Barafu", "Frozen"], ["Ufundi", "Repairs"],
  ["Mchoro", "Art"], ["Salama", "Safety"], ["Twiga", "Furniture"],
  ["Kaskazi", "Sailing"], ["Rangi", "Paints"], ["Mkoba", "Leather"],
];

const categories = [
  "Fashion", "Beauty", "Electronics", "Home", "Food", "Kids", "Accessories", "Wellness",
];

const regions: Region[] = [
  "Nairobi", "Nairobi", "Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret", "Thika", "Machakos",
];

function buildMerchants(count: number): Merchant[] {
  const random = mulberry32(760215);
  const merchants: Merchant[] = [];

  for (let i = 0; i < count; i++) {
    const words = shopWords[i % shopWords.length];
    const suffix = i >= shopWords.length ? ` ${Math.floor(i / shopWords.length) + 1}` : "";
    const business = `${words[0]} ${words[1]}${suffix}`;
    const owner = `${firstNames[Math.floor(random() * firstNames.length)]} ${
      secondNames[Math.floor(random() * secondNames.length)]
    }`;

    // Most merchants sit on the free plan; a long tail pays.
    const planRoll = random();
    const plan: Plan = planRoll > 0.88 ? "scale" : planRoll > 0.58 ? "growth" : "starter";

    const statusRoll = random();
    const status: MerchantStatus =
      statusRoll > 0.96
        ? "suspended"
        : statusRoll > 0.9
          ? "churned"
          : statusRoll > 0.84
            ? "past_due"
            : statusRoll > 0.72
              ? "trial"
              : "active";

    const scale = plan === "scale" ? 5.5 : plan === "growth" ? 2.2 : 1;
    const dormant = status === "churned" || status === "suspended";
    const gmv30d = dormant ? 0 : Math.round((40000 + random() * 380000) * scale);
    const drift = 0.72 + random() * 0.6;
    const orders30d = dormant ? 0 : Math.round(gmv30d / (2400 + random() * 2600));

    // Squaring the roll clusters sign-ups near the present, which is what a
    // growing platform actually looks like.
    const joinedDays = Math.floor(random() ** 2 * 420) + 2;
    const lastActiveDays = dormant
      ? Math.floor(random() * 60) + 14
      : Math.floor(random() * 4);

    merchants.push({
      id: `mch_${1000 + i}`,
      business,
      owner,
      email: `${business.toLowerCase().replace(/[^a-z0-9]+/g, ".")}@example.co.ke`,
      phone: `07${Math.floor(random() * 9)}${Math.floor(random() * 9)} ${String(
        Math.floor(random() * 900) + 100,
      )} ${String(Math.floor(random() * 900) + 100)}`,
      region: regions[Math.floor(random() * regions.length)],
      plan,
      status,
      slug: business.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      category: categories[Math.floor(random() * categories.length)],
      joinedAt: at(joinedDays),
      lastActiveAt: at(lastActiveDays, 9 + Math.floor(random() * 9)),
      gmv30d,
      gmvPrev30d: Math.round(gmv30d * drift),
      orders30d,
      products: Math.floor(random() * 60) + 4,
      riders: Math.floor(random() * 6),
      mrr: status === "churned" || status === "suspended" ? 0 : planPrice[plan],
      storefrontPublished: random() > 0.18,
      suspendedReason:
        status === "suspended"
          ? ["Repeated counterfeit reports", "Payment fraud investigation", "Prohibited listings"][
              Math.floor(random() * 3)
            ]
          : undefined,
    });
  }

  return merchants;
}

function buildReports(merchants: Merchant[]): StorefrontReport[] {
  const random = mulberry32(31337);
  const reasons = ["counterfeit", "prohibited", "misleading", "spam", "payment_dispute"] as const;
  const details: Record<(typeof reasons)[number], string> = {
    counterfeit: "Listing uses a brand name the seller has no licence for.",
    prohibited: "Item falls outside what the platform allows to be listed.",
    misleading: "Photographs do not match the item described.",
    spam: "Duplicate listings posted repeatedly across categories.",
    payment_dispute: "Customer paid but says the order was never sent.",
  };

  return Array.from({ length: 14 }, (_, i) => {
    const merchant = merchants[Math.floor(random() * merchants.length)];
    const reason = reasons[Math.floor(random() * reasons.length)];
    const roll = random();
    return {
      id: `rep_${200 + i}`,
      merchantId: merchant.id,
      reason,
      status: (roll > 0.78
        ? "upheld"
        : roll > 0.62
          ? "dismissed"
          : roll > 0.3
            ? "reviewing"
            : "open") as StorefrontReport["status"],
      detail: details[reason],
      reportedAt: at(Math.floor(random() * 21), 8 + Math.floor(random() * 10)),
      reporter: roll > 0.5 ? "Customer report" : "Automated scan",
    };
  }).sort((a, b) => +new Date(b.reportedAt) - +new Date(a.reportedAt));
}

function buildTickets(merchants: Merchant[]): Ticket[] {
  const random = mulberry32(90210);
  const subjects: [string, string][] = [
    ["M-Pesa payments not matching", "Three payments from yesterday are still showing unmatched."],
    ["Can't publish my mini site", "The publish button does nothing on my phone."],
    ["Rider assignment stuck", "Order shows assigned but the rider never got it."],
    ["Upgrade to Growth", "I want the extra Smart Capture volume before Friday."],
    ["Duplicate charge", "I was billed twice for October."],
    ["Products not syncing to the site", "Added five items, only two show online."],
    ["Statement import failed", "The bank statement PDF comes back empty."],
    ["Change of till number", "We moved to a new till and orders still show the old one."],
    ["Refund a customer", "Customer returned the dress, how do I record it?"],
    ["Account locked", "I can't sign in since yesterday evening."],
    ["Export my ledger", "Need last quarter as a spreadsheet for my accountant."],
    ["Delivery fees wrong", "Fees default to 200 even for Karen deliveries."],
  ];
  const assignees = ["Aisha", "Tom", "Njoki", "Victor"];

  return subjects
    .map(([subject, preview], i) => {
      const merchant = merchants[Math.floor(random() * merchants.length)];
      const roll = random();
      const status = roll > 0.72 ? "solved" : roll > 0.42 ? "pending" : "open";
      const priority = roll > 0.88 ? "urgent" : roll > 0.66 ? "high" : roll > 0.3 ? "normal" : "low";
      return {
        id: `tkt_${500 + i}`,
        merchantId: merchant.id,
        subject,
        preview,
        priority,
        status,
        openedAt: at(Math.floor(random() * 9), 7 + Math.floor(random() * 11)),
        slaHours: Math.round((random() * 14 - 4) * 10) / 10,
        assignee: status === "open" ? undefined : assignees[Math.floor(random() * assignees.length)],
      } as Ticket;
    })
    .sort((a, b) => +new Date(b.openedAt) - +new Date(a.openedAt));
}

const incidents: Incident[] = [
  {
    id: "inc_31",
    title: "M-Pesa callback delays",
    severity: "sev2",
    startedAt: at(3, 14),
    resolvedAt: at(3, 16),
    component: "Payments",
    note: "Upstream confirmations queued for ~40 minutes. No payments lost; matching caught up on retry.",
  },
  {
    id: "inc_30",
    title: "Smart Capture extraction backlog",
    severity: "sev3",
    startedAt: at(9, 10),
    resolvedAt: at(9, 12),
    component: "Smart Capture",
    note: "Queue depth passed 4k during a promo. Added workers; no documents dropped.",
  },
  {
    id: "inc_29",
    title: "Storefront images slow in Mombasa",
    severity: "sev3",
    startedAt: at(17, 19),
    resolvedAt: at(17, 21),
    component: "Storefronts",
    note: "Edge cache miss rate spiked at one POP. Rebalanced.",
  },
];

export function createAdminDatabase(): AdminDatabase {
  const merchants = buildMerchants(64);
  return {
    version: ADMIN_DB_VERSION,
    merchants,
    reports: buildReports(merchants),
    tickets: buildTickets(merchants),
    incidents,
    flags: [
      {
        key: "smart_capture_v2",
        name: "Smart Capture v2",
        description: "New extraction model with per-field confidence.",
        enabled: true,
        rollout: 35,
        owner: "Payments",
      },
      {
        key: "storefront_templates",
        name: "Storefront templates",
        description: "Lets merchants switch mini-site layouts.",
        enabled: true,
        rollout: 100,
        owner: "Growth",
      },
      {
        key: "rider_marketplace",
        name: "Rider marketplace",
        description: "Shared rider pool across merchants in a region.",
        enabled: false,
        rollout: 0,
        owner: "Logistics",
      },
      {
        key: "bank_statement_import",
        name: "Bank statement import",
        description: "Parse full bank statements, not just M-Pesa.",
        enabled: true,
        rollout: 12,
        owner: "Payments",
      },
      {
        key: "offline_orders_v3",
        name: "Offline order queue v3",
        description: "Conflict resolution when a device reconnects.",
        enabled: false,
        rollout: 5,
        owner: "Core",
      },
    ],
    services: [
      { name: "API", status: "operational", latencyMs: 128, uptime30d: 99.98 },
      { name: "M-Pesa gateway", status: "degraded", latencyMs: 612, uptime30d: 99.41 },
      { name: "Smart Capture", status: "operational", latencyMs: 940, uptime30d: 99.87 },
      { name: "Storefronts", status: "operational", latencyMs: 86, uptime30d: 99.99 },
      { name: "Notifications", status: "operational", latencyMs: 204, uptime30d: 99.93 },
    ],
  };
}

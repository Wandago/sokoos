import type { BusinessType, PriceMode, StockMode, Unit } from "./types";

/**
 * Trades, and what each one actually needs.
 *
 * "Small business" is not a category — it is a hundred different trades that
 * happen to be small. A salon books hours and buys relaxer by the litre. A
 * phone shop tracks IMEIs and honours warranties. A mama mboga buys a sack of
 * potatoes and sells them by the kilo. Handing all of them the same empty
 * Products screen makes every one of them do the translating.
 *
 * So each trade brings its own vocabulary, its own default way of counting, and
 * a starter list of the things that trade really sells — priced roughly at
 * Nairobi rates so the first screen is recognisable rather than blank. None of
 * it is locked: every business can add anything, and most of them sell both
 * goods and work.
 */

export interface StarterProduct {
  name: string;
  price: number;
  cost: number;
  category: string;
  emoji: string;
  stockMode: StockMode;
}

export interface StarterService {
  name: string;
  price: number;
  durationMinutes: number;
  bufferMinutes?: number;
  category: string;
  emoji: string;
  priceMode: PriceMode;
  depositPercent?: number;
}

export interface Industry {
  type: BusinessType;
  id: string;
  label: string;
  /** What this trade calls itself, in one line. */
  blurb: string;
  emoji: string;
  /** How this trade counts by default. */
  defaultStockMode: StockMode;
  /** The ways of counting worth offering here. */
  stockModes: StockMode[];
  /** Units that make sense on this counter. */
  units: Unit[];
  /** What to call the catalogue, since "products" is wrong for half of them. */
  sellsLabel: string;
  worksLabel: string;
  /** Typical goods and typical work, at rough Nairobi prices. */
  products: StarterProduct[];
  services: StarterService[];
  /** Most of these trades are one person. Say so rather than assuming a team. */
  usuallySolo: boolean;
}

export const industries: Industry[] = [
  {
    type: "fashion",
    id: "fashion",
    label: "Clothes and thrift",
    blurb: "New pieces, mtumba bales, shoes and accessories.",
    emoji: "👗",
    defaultStockMode: "simple",
    stockModes: ["simple", "lot", "service"],
    units: ["piece", "kg"],
    sellsLabel: "Pieces",
    worksLabel: "Alterations",
    usuallySolo: true,
    products: [
      { name: "Dress", price: 2500, cost: 1200, category: "Dresses", emoji: "👗", stockMode: "simple" },
      { name: "Two-piece set", price: 3500, cost: 1800, category: "Sets", emoji: "🧵", stockMode: "simple" },
      { name: "Bale — mixed ladies'", price: 0, cost: 38000, category: "Thrift", emoji: "🧺", stockMode: "lot" },
    ],
    services: [
      { name: "Hem and take in", price: 800, durationMinutes: 45, bufferMinutes: 10, category: "Alterations", emoji: "✂️", priceMode: "fixed" },
      { name: "Custom piece", price: 8500, durationMinutes: 300, bufferMinutes: 30, category: "Bespoke", emoji: "🪡", priceMode: "quote", depositPercent: 50 },
    ],
  },
  {
    type: "food",
    id: "bakery",
    label: "Bakery and home kitchen",
    blurb: "Cakes, snacks and orders made to request.",
    emoji: "🎂",
    defaultStockMode: "recipe",
    stockModes: ["recipe", "simple", "service"],
    units: ["kg", "g", "l", "ml", "piece"],
    sellsLabel: "What you bake",
    worksLabel: "Orders to request",
    usuallySolo: true,
    products: [
      { name: "Celebration cake", price: 3500, cost: 0, category: "Cakes", emoji: "🎂", stockMode: "recipe" },
      { name: "Mandazi (6 pack)", price: 250, cost: 0, category: "Snacks", emoji: "🥯", stockMode: "recipe" },
      { name: "Cupcakes (12)", price: 1200, cost: 0, category: "Cakes", emoji: "🧁", stockMode: "recipe" },
    ],
    services: [
      { name: "Cake consultation", price: 1000, durationMinutes: 45, category: "Bespoke", emoji: "📋", priceMode: "fixed" },
      { name: "Event catering", price: 0, durationMinutes: 240, bufferMinutes: 60, category: "Events", emoji: "🍽️", priceMode: "quote", depositPercent: 50 },
    ],
  },
  {
    type: "food",
    id: "restaurant",
    label: "Restaurant or food stall",
    blurb: "Plates costed from what goes in the pot.",
    emoji: "🍲",
    defaultStockMode: "recipe",
    stockModes: ["recipe", "simple"],
    units: ["kg", "g", "l", "ml", "piece"],
    sellsLabel: "The menu",
    worksLabel: "Bookings",
    usuallySolo: false,
    products: [
      { name: "Pilau plate", price: 350, cost: 0, category: "Mains", emoji: "🍛", stockMode: "recipe" },
      { name: "Chapati (2)", price: 60, cost: 0, category: "Sides", emoji: "🫓", stockMode: "recipe" },
      { name: "Soda 500ml", price: 80, cost: 55, category: "Drinks", emoji: "🥤", stockMode: "simple" },
    ],
    services: [
      { name: "Outside catering", price: 0, durationMinutes: 300, category: "Events", emoji: "🍽️", priceMode: "quote", depositPercent: 50 },
    ],
  },
  {
    type: "beauty",
    id: "salon",
    label: "Salon and barber",
    blurb: "Hours in a chair, plus what you sell over the counter.",
    emoji: "💇🏾‍♀️",
    defaultStockMode: "service",
    stockModes: ["service", "simple"],
    units: ["ml", "l", "piece"],
    sellsLabel: "Products",
    worksLabel: "Services",
    usuallySolo: true,
    products: [
      { name: "Hair food 250ml", price: 450, cost: 220, category: "Retail", emoji: "🧴", stockMode: "simple" },
      { name: "Braiding hair pack", price: 350, cost: 180, category: "Retail", emoji: "🎀", stockMode: "simple" },
    ],
    services: [
      { name: "Wash and blow-dry", price: 800, durationMinutes: 60, bufferMinutes: 10, category: "Hair", emoji: "💆🏾‍♀️", priceMode: "fixed" },
      { name: "Box braids", price: 3500, durationMinutes: 240, bufferMinutes: 20, category: "Hair", emoji: "💇🏾‍♀️", priceMode: "fixed", depositPercent: 30 },
      { name: "Gel manicure", price: 1200, durationMinutes: 60, bufferMinutes: 10, category: "Nails", emoji: "💅🏾", priceMode: "fixed" },
      { name: "Haircut", price: 400, durationMinutes: 30, bufferMinutes: 5, category: "Barber", emoji: "✂️", priceMode: "fixed" },
    ],
  },
  {
    type: "electronics",
    id: "electronics",
    label: "Phones and electronics",
    blurb: "Units tracked by IMEI, warranties, and repairs.",
    emoji: "📱",
    defaultStockMode: "serial",
    stockModes: ["serial", "simple", "service"],
    units: ["piece"],
    sellsLabel: "Stock",
    worksLabel: "Repairs",
    usuallySolo: true,
    products: [
      { name: "Smartphone", price: 18500, cost: 15200, category: "Phones", emoji: "📱", stockMode: "serial" },
      { name: "Power bank 20,000 mAh", price: 3400, cost: 2050, category: "Accessories", emoji: "🔋", stockMode: "serial" },
      { name: "Charging cable", price: 350, cost: 140, category: "Accessories", emoji: "🔌", stockMode: "simple" },
    ],
    services: [
      { name: "Screen replacement", price: 4500, durationMinutes: 90, bufferMinutes: 15, category: "Repairs", emoji: "🔧", priceMode: "fixed" },
      { name: "Software reflash", price: 1500, durationMinutes: 60, category: "Repairs", emoji: "💾", priceMode: "fixed" },
    ],
  },
  {
    type: "grocery",
    id: "grocery",
    label: "Grocery and fresh produce",
    blurb: "Bought by the sack or crate, sold by the kilo.",
    emoji: "🥬",
    defaultStockMode: "lot",
    stockModes: ["lot", "simple"],
    units: ["kg", "g", "piece"],
    sellsLabel: "Produce",
    worksLabel: "Deliveries",
    usuallySolo: true,
    products: [
      { name: "Potatoes — per kg", price: 90, cost: 0, category: "Vegetables", emoji: "🥔", stockMode: "lot" },
      { name: "Tomatoes — per kg", price: 130, cost: 0, category: "Vegetables", emoji: "🍅", stockMode: "lot" },
      { name: "Sukuma bunch", price: 30, cost: 15, category: "Vegetables", emoji: "🥬", stockMode: "simple" },
    ],
    services: [
      { name: "Weekly veg box run", price: 500, durationMinutes: 90, category: "Delivery", emoji: "🚲", priceMode: "fixed" },
    ],
  },
  {
    type: "hardware",
    id: "hardware",
    label: "Hardware and building supplies",
    blurb: "Counted and costed simply, sold by the piece or the bag.",
    emoji: "🔩",
    defaultStockMode: "simple",
    stockModes: ["simple", "lot", "service"],
    units: ["piece", "kg", "l"],
    sellsLabel: "Stock",
    worksLabel: "Jobs",
    usuallySolo: false,
    products: [
      { name: "Cement — 50 kg bag", price: 850, cost: 720, category: "Building", emoji: "🧱", stockMode: "simple" },
      { name: "Paint 4L — white", price: 2400, cost: 1750, category: "Paint", emoji: "🪣", stockMode: "simple" },
      { name: "Nails — per kg", price: 220, cost: 150, category: "Fixings", emoji: "🔩", stockMode: "simple" },
    ],
    services: [
      { name: "Site delivery", price: 1500, durationMinutes: 120, category: "Delivery", emoji: "🚚", priceMode: "quote" },
    ],
  },
  {
    type: "services",
    id: "trades",
    label: "Fundi and repairs",
    blurb: "Plumbing, electrical, welding — priced by the job.",
    emoji: "🔧",
    defaultStockMode: "service",
    stockModes: ["service", "simple"],
    units: ["piece", "l", "kg"],
    sellsLabel: "Parts",
    worksLabel: "Jobs",
    usuallySolo: true,
    products: [
      { name: "Tap and fittings", price: 1800, cost: 1150, category: "Parts", emoji: "🚰", stockMode: "simple" },
      { name: "Socket and switch", price: 650, cost: 380, category: "Parts", emoji: "🔌", stockMode: "simple" },
    ],
    services: [
      { name: "Call-out and diagnosis", price: 1000, durationMinutes: 45, bufferMinutes: 30, category: "Jobs", emoji: "🧰", priceMode: "fixed" },
      { name: "Half-day job", price: 4000, durationMinutes: 240, bufferMinutes: 30, category: "Jobs", emoji: "🔧", priceMode: "fixed", depositPercent: 30 },
    ],
  },
  {
    type: "services",
    id: "creative",
    label: "Photo, video and design",
    blurb: "Shoots, edits and deliverables, usually with a deposit.",
    emoji: "📸",
    defaultStockMode: "service",
    stockModes: ["service", "simple"],
    units: ["piece"],
    sellsLabel: "Prints and extras",
    worksLabel: "Shoots",
    usuallySolo: true,
    products: [
      { name: "Printed album", price: 6500, cost: 3200, category: "Prints", emoji: "📔", stockMode: "simple" },
    ],
    services: [
      { name: "Portrait session", price: 8000, durationMinutes: 120, bufferMinutes: 60, category: "Shoots", emoji: "📸", priceMode: "fixed", depositPercent: 50 },
      { name: "Event coverage — half day", price: 25000, durationMinutes: 300, bufferMinutes: 120, category: "Shoots", emoji: "🎥", priceMode: "quote", depositPercent: 50 },
      { name: "Edit and delivery", price: 5000, durationMinutes: 180, category: "Post", emoji: "🖥️", priceMode: "hourly" },
    ],
  },
  {
    type: "services",
    id: "wellness",
    label: "Fitness, tutoring and coaching",
    blurb: "Sessions sold by the hour, one to one or in a group.",
    emoji: "🏋🏾",
    defaultStockMode: "service",
    stockModes: ["service", "simple"],
    units: ["piece"],
    sellsLabel: "What you sell",
    worksLabel: "Sessions",
    usuallySolo: true,
    products: [],
    services: [
      { name: "One-to-one session", price: 1500, durationMinutes: 60, bufferMinutes: 10, category: "Sessions", emoji: "🏋🏾", priceMode: "hourly" },
      { name: "Group class", price: 500, durationMinutes: 60, category: "Sessions", emoji: "👥", priceMode: "fixed" },
      { name: "Monthly plan", price: 8000, durationMinutes: 60, category: "Plans", emoji: "🗓️", priceMode: "fixed", depositPercent: 100 },
    ],
  },
  {
    type: "general",
    id: "general",
    label: "A bit of everything",
    blurb: "Start empty and add whatever you actually sell.",
    emoji: "🧾",
    defaultStockMode: "simple",
    stockModes: ["simple", "recipe", "lot", "serial", "service"],
    units: ["piece", "kg", "g", "l", "ml"],
    sellsLabel: "Products",
    worksLabel: "Services",
    usuallySolo: true,
    products: [],
    services: [],
  },
];

export function industryById(id?: string) {
  return industries.find((industry) => industry.id === id);
}

/** Falls back to the broadest fit when only the coarse type is known. */
export function industryFor(type?: BusinessType, id?: string): Industry {
  return (
    industryById(id) ??
    industries.find((industry) => industry.type === type) ??
    industries[industries.length - 1]
  );
}

/** What this trade calls the two halves of a catalogue. */
export function catalogueLabels(industry: Industry) {
  return { sells: industry.sellsLabel, works: industry.worksLabel };
}

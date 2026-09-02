/* Domain model for SokoOS — the social commerce operating system.
 *
 * The shape follows the transaction lifecycle the product is built around:
 * Discovery -> Conversation -> Order -> Payment -> Delivery -> Reconciliation.
 */

export type Channel =
  | "instagram"
  | "tiktok"
  | "whatsapp"
  | "facebook"
  | "call"
  | "referral"
  | "walk-in";

export type OrderStatus =
  | "new"
  | "confirmed"
  | "packed"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export type PaymentStatus = "unpaid" | "partial" | "paid" | "cod" | "refunded";

export type PaymentMethod = "mpesa" | "cash" | "bank" | "card";

/** Financial states are visually distinct throughout the product. */
export type PaymentState = "received" | "pending" | "failed" | "review";

export type DeliveryStatus =
  | "assigned"
  | "picked"
  | "in_transit"
  /** The rider is with the customer, waiting for the seller to confirm payment. */
  | "awaiting_payment"
  | "delivered"
  | "failed"
  | "returned";

export type RiderStatus = "available" | "on_delivery" | "off";

/**
 * Who the delivery fee belongs to.
 *
 * The common Kenyan arrangement is that the rider is an independent boda
 * operator with a working relationship, not an employee. The customer pays the
 * seller for the goods and pays the rider separately for the trip. That fee is
 * therefore neither the seller's revenue nor their expense, and counting it as
 * either overstates the business — which is why it is modelled explicitly
 * rather than assumed.
 */
export type DeliverySettlement =
  /** Customer pays the rider directly. Never enters the seller's books. */
  | "customer_pays_rider"
  /** Seller charges the customer and pays the rider. Revenue and expense both. */
  | "business_pays_rider"
  /** Rider collects the goods money too and remits it to the seller. */
  | "rider_collects"
  /** Seller absorbs the trip and charges nothing. Expense only. */
  | "free";

/** How a business actually tracks what it has. */
export type BusinessType =
  | "fashion"
  | "food"
  | "electronics"
  | "beauty"
  | "grocery"
  | "hardware"
  | "services"
  | "general";

/**
 * How a product's stock and cost are worked out.
 *
 * A bakery costs a cake from flour and eggs. A thrift shop buys a bale for one
 * price and splits it across grades. A phone shop tracks each handset by its
 * IMEI. None of these is more correct than the others — they are different
 * trades — so the mode lives on the product rather than the app.
 */
export type StockMode =
  /** A count of units with one cost price. */
  | "simple"
  /** Made from ingredients — cost comes from the bill of materials. */
  | "recipe"
  /** Bought in bulk as a bale or carton and split into sellable units. */
  | "lot"
  /** Each unit individually identified by serial or IMEI. */
  | "serial"
  /** Nothing to count. */
  | "service";

export type CaptureKind =
  | "receipt"
  | "mpesa_message"
  | "mpesa_statement"
  | "bank_statement"
  | "invoice";

export type CaptureStatus = "processing" | "needs_review" | "confirmed";

/** Money in or money out. The single most important thing to get right. */
export type Direction = "credit" | "debit";

/** How a capture reached the app. */
export type CaptureVia = "camera" | "voice" | "upload" | "statement";

export interface Customer {
  id: string;
  name: string;
  phone: string;
  channel: Channel;
  location: string;
  joinedAt: string;
  notes?: string;
  tags: string[];
}

/** What a recipe is measured in. Everything converts to the base unit. */
export type Unit = "kg" | "g" | "l" | "ml" | "piece";

/** The base unit each measure is priced and stocked in. */
export const baseUnit: Record<Unit, Unit> = {
  kg: "kg",
  g: "kg",
  l: "l",
  ml: "l",
  piece: "piece",
};

/** How many base units one of this unit is worth. 1 g = 0.001 kg. */
export const unitFactor: Record<Unit, number> = {
  kg: 1,
  g: 0.001,
  l: 1,
  ml: 0.001,
  piece: 1,
};

export interface Ingredient {
  id: string;
  name: string;
  /** The unit stock and cost are held in — always a base unit. */
  unit: Unit;
  /** Cost of one base unit, in KES. */
  costPerUnit: number;
  stock: number;
  lowStockAt: number;
  supplier?: string;
}

/** One line of a product's bill of materials. */
export interface RecipeLine {
  ingredientId: string;
  /** Quantity in `unit`, which may be finer than the ingredient's base unit. */
  qty: number;
  unit: Unit;
  /** Wastage, trim or spillage, as a percentage on top of qty. */
  wastagePercent?: number;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  cost: number;
  stock: number;
  lowStockAt: number;
  category: string;
  /** Stand-in for product photography in the offline demo. */
  swatch: string;
  emoji: string;
  active: boolean;
  /** How this product's stock and cost are worked out. Defaults to simple. */
  stockMode?: StockMode;
  /**
   * What one unit of this product is made of. Present for anything produced
   * rather than resold, which is what lets the app cost a cake to the gram.
   */
  recipe?: RecipeLine[];
  /** For lot-tracked goods: which lot and grade these units came out of. */
  lotId?: string;
  gradeId?: string;
  /** For serialised goods: how long the unit is covered after sale. */
  warrantyMonths?: number;
}

/* ------------------------------------------------------------------ *
 * Lots — goods bought as one lump and split into sellable units.
 *
 * A thrift trader buys a bale for KES 25,000, pays transport and duty, opens
 * it, and sorts what comes out into grades that sell for very different money.
 * The cost of one Grade A dress is not the bale price divided by the count: it
 * is a share of the landed cost, and the defensible way to split a joint cost
 * across outputs of unequal value is by their relative sales value.
 * ------------------------------------------------------------------ */

export interface LotCost {
  label: string;
  amount: number;
}

/** Even splits the landed cost per unit; by_value splits it by sales value. */
export type LotAllocation = "even" | "by_value";

export interface LotGrade {
  id: string;
  label: string;
  /** The product these units are sold as, once sorted. */
  productId?: string;
  units: number;
  unitPrice: number;
  sold: number;
}

export interface Lot {
  id: string;
  reference: string;
  name: string;
  supplier: string;
  purchasedAt: string;
  purchasePrice: number;
  /** Transport, duty, clearing, sorting — everything before it can be sold. */
  extraCosts: LotCost[];
  allocation: LotAllocation;
  grades: LotGrade[];
  /** Set once the lot has been opened and counted. */
  openedAt?: string;
  note?: string;
}

/* ------------------------------------------------------------------ *
 * Serialised units — goods where each individual item is identified.
 * ------------------------------------------------------------------ */

export type SerialStatus = "in_stock" | "sold" | "returned" | "faulty";

export interface SerialUnit {
  id: string;
  productId: string;
  /** IMEI, serial number, engine number — whatever identifies this one item. */
  serial: string;
  cost: number;
  status: SerialStatus;
  receivedAt: string;
  soldAt?: string;
  orderId?: string;
  warrantyMonths?: number;
  note?: string;
}

/* ------------------------------------------------------------------ *
 * Services.
 *
 * Not every business sells a thing. A salon sells two hours of a stylist's
 * time; a tailor sells an alteration; a photographer sells a Saturday. What is
 * scarce is not stock on a shelf but hours in the day, and what a job costs is
 * mostly the labour plus whatever it consumes along the way.
 *
 * A booking is still an order — it has a customer, a price, payments and a
 * place in the ledger — so it is modelled as one, with the time and the person
 * attached. That way payments, statement import and the CFO keep working
 * without knowing anything about diaries.
 * ------------------------------------------------------------------ */

/** Fixed price, charged by the hour, or quoted job by job. */
export type PriceMode = "fixed" | "hourly" | "quote";

export interface Service {
  id: string;
  name: string;
  /** How long the job takes, in minutes. The thing actually being sold. */
  durationMinutes: number;
  price: number;
  priceMode: PriceMode;
  category: string;
  /** Turnaround and clean-up between jobs, which is real time and often unpaid. */
  bufferMinutes?: number;
  /** Who can do this job. Empty means anyone. */
  staffIds?: string[];
  /** What the job uses up — thread, dye, extensions, fuel. */
  materials?: RecipeLine[];
  swatch: string;
  emoji: string;
  active: boolean;
  /** Usually taken up front to hold the slot. */
  depositPercent?: number;
}

export interface StaffMember {
  id: string;
  name: string;
  phone: string;
  role: string;
  /**
   * Whether this person's hours are money leaving the business.
   *
   * Most businesses here are one person who does everything — cuts the cloth,
   * posts the photo, answers the DM, delivers it. Charging that person's own
   * hour against a job as a cost would say their own profit is an expense,
   * which is how an agency thinks about billable staff and is simply wrong for
   * a sole trader. An owner's time is not a cost. It is the whole capacity of
   * the business, and what it earns is the question worth asking.
   */
  kind: "owner" | "employee";
  /**
   * What an hour of this person's time costs the business. Zero for an owner —
   * they are paid out of what is left, not before it.
   */
  hourlyCost: number;
  /** Days worked, 0 = Sunday, and the hours they are on. */
  workingDays: number[];
  startHour: number;
  endHour: number;
  active: boolean;
}

export type BookingState =
  | "enquiry"
  | "booked"
  | "in_progress"
  | "done"
  | "no_show"
  | "cancelled";

/** Where the work happens — and, if you travel, who pays to get you there. */
export type BookingPlace = "at_us" | "at_them" | "remote";

export interface Booking {
  serviceId: string;
  staffId?: string;
  startsAt: string;
  durationMinutes: number;
  state: BookingState;
  place: BookingPlace;
  /** Held to secure the slot, and set against the total when the job is done. */
  deposit?: number;
  depositPaidAt?: string;
  startedAt?: string;
  finishedAt?: string;
  note?: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  qty: number;
  /** What was agreed — the price the customer actually paid. */
  price: number;
  /**
   * What the item was listed at, when it was bargained down.
   *
   * Absent on everything sold at the asking price, which keeps the common case
   * free of a field that repeats `price`. Its presence is what makes a sale a
   * negotiated one, and what lets the books say later how much haggling cost.
   */
  listPrice?: number;
}

export interface Order {
  id: string;
  code: string;
  customerId: string;
  items: OrderItem[];
  deliveryFee: number;
  /**
   * Who the delivery fee belongs to. Absent on older records, which are read
   * as business_pays_rider — the behaviour before this was modelled.
   */
  deliverySettlement?: DeliverySettlement;
  discount: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  channel: Channel;
  address: string;
  riderId?: string;
  /**
   * Present when this order is a job rather than goods. Its presence is what
   * makes the order a booking — there is no separate entity to keep in step.
   */
  booking?: Booking;
  note?: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  orderId?: string;
  /**
   * An order this payment probably belongs to, when the evidence was not strong
   * enough to say so outright. A lead for the seller to confirm — never treated
   * as settled, because a wrong match hides money under the wrong customer.
   */
  suggestedOrderId?: string;
  customerId?: string;
  customerName: string;
  method: PaymentMethod;
  amount: number;
  /** M-Pesa confirmation code, bank ref, or blank for cash. */
  reference: string;
  state: PaymentState;
  receivedAt: string;
  /** Reconciled against an order in the ledger. */
  matched: boolean;
  source: "manual" | "capture" | "mpesa";
  /** AI confidence when the payment came in via Smart Capture. */
  confidence?: number;
  /**
   * Why the match was suggested, in the seller's words. The evidence for an
   * M-Pesa match — the account reference a customer typed, the number they paid
   * from — only exists on the server, so the reasoning travels with the record
   * rather than being guessed at again on the phone.
   */
  matchReasons?: string[];
}

export interface Rider {
  id: string;
  name: string;
  phone: string;
  vehicle: "boda" | "car" | "van";
  zones: string[];
  rating: number;
  status: RiderStatus;
  deliveriesToday: number;
  /**
   * Independent riders are the norm: they work with the business, not for it,
   * and are usually paid by the customer at the door.
   */
  relationship?: "independent" | "in_house";
  /** What this rider charges to each zone they cover. */
  zoneRates?: { zone: string; fee: number }[];
}

export interface Delivery {
  id: string;
  orderId: string;
  riderId: string;
  status: DeliveryStatus;
  /** What the rider charges for this trip. */
  fee: number;
  settlement?: DeliverySettlement;
  address: string;
  assignedAt: string;
  deliveredAt?: string;
  /** When the seller confirmed payment so the rider could hand over. */
  paymentConfirmedAt?: string;
  /** Goods money the rider took on the seller's behalf and still owes them. */
  cashCollected?: number;
  remittedAt?: string;
}

export interface LedgerEntry {
  id: string;
  date: string;
  type: "income" | "expense";
  category: string;
  description: string;
  amount: number;
  source: "order" | "capture" | "manual";
  reference: string;
  reconciled: boolean;
}

export interface Message {
  id: string;
  from: "customer" | "business";
  text: string;
  at: string;
}

export interface Conversation {
  id: string;
  customerId?: string;
  customerName: string;
  channel: Channel;
  handle: string;
  unread: number;
  messages: Message[];
  /** Set once the conversation has produced an order. */
  orderId?: string;
}

export interface ExtractedFields {
  amount?: number;
  date?: string;
  merchant?: string;
  customer?: string;
  transactionId?: string;
  method?: PaymentMethod;
  category?: string;
  items?: { name: string; qty: number; price: number }[];
  tax?: number;
}

export interface Capture {
  id: string;
  kind: CaptureKind;
  fileName: string;
  uploadedAt: string;
  status: CaptureStatus;
  /** 0–1. Drives the "needs review" vs "auto-confirmed" split. */
  confidence: number;
  extracted: ExtractedFields;
  matchedOrderId?: string;
  note?: string;
  /** Credit is money in, debit is money out. */
  direction?: Direction;
  via?: CaptureVia;
  /** What the classifier keyed on, so the seller can check its reasoning. */
  directionReason?: string;
  /** The spoken sentence, when the capture came from the microphone. */
  transcript?: string;
}

/** A parsed statement row, before it is committed to the ledger. */
export type StatementRowState =
  | "new"
  | "already_imported"
  | "duplicate_in_file"
  | "needs_review";

export interface StatementRow {
  /** The provider's unique code. The whole dedupe rests on this. */
  code: string;
  date: string;
  description: string;
  amount: number;
  direction: Direction;
  balance?: number;
  state: StatementRowState;
  /** Why a row was flagged, in plain words. */
  note?: string;
}

export interface StatementImport {
  id: string;
  source: "mpesa" | "bank";
  fileName: string;
  importedAt: string;
  periodStart: string;
  periodEnd: string;
  rowsParsed: number;
  rowsImported: number;
  rowsDuplicate: number;
  rowsReview: number;
}

export interface Business {
  name: string;
  owner: string;
  phone: string;
  tillNumber: string;
  location: string;
  currency: "KES";
  defaultDeliveryFee: number;
  /** What trade this is, which decides how stock is tracked and what is shown. */
  type?: BusinessType;
  /** The specific trade, finer than the type — "salon" rather than "beauty". */
  industry?: string;
  /** The arrangement this business normally has with its riders. */
  defaultSettlement?: DeliverySettlement;
}

/**
 * The signed-in seller.
 *
 * There is no password field, and there never should be one here: this build
 * has no backend, so a password would sit in localStorage in the clear and buy
 * nothing. The sign-up form asks for one, checks its shape, and drops it. When
 * a real auth service exists, it verifies the password and this record holds
 * only the profile it hands back.
 */
export interface Account {
  name: string;
  email: string;
  phone: string;
  createdAt: string;
}

export type StorefrontTemplate = "spotlight" | "catalogue" | "story" | "linkinbio";

export type StorefrontPalette = "lime" | "forest" | "cream" | "ink" | "clay";

/** The seller's public mini site — their own brand, not SokoOS's. */
export interface Storefront {
  /** The public address: sokoos.app/store/<slug>. */
  slug: string;
  template: StorefrontTemplate;
  palette: StorefrontPalette;
  headline: string;
  tagline: string;
  about: string;
  /** Where "Order on WhatsApp" goes. Digits only, country code included. */
  whatsapp: string;
  instagram: string;
  tiktok: string;
  location: string;
  deliveryNote: string;
  /** Blown up at the top of the templates that have room for it. */
  featuredProductId?: string;
  /** Products the seller has taken off the site without deleting them. */
  hiddenProductIds: string[];
  showPrices: boolean;
  published: boolean;
}

export interface Database {
  version: number;
  /** Absent until someone signs up on this device. */
  account?: Account;
  business: Business;
  storefront: Storefront;
  customers: Customer[];
  products: Product[];
  orders: Order[];
  payments: Payment[];
  riders: Rider[];
  deliveries: Delivery[];
  ledger: LedgerEntry[];
  conversations: Conversation[];
  captures: Capture[];
  ingredients: Ingredient[];
  services: Service[];
  staff: StaffMember[];
  lots: Lot[];
  serials: SerialUnit[];
  imports: StatementImport[];
}

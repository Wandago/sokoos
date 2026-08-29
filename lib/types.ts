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
  | "delivered"
  | "failed";

export type RiderStatus = "available" | "on_delivery" | "off";

export type CaptureKind =
  | "receipt"
  | "mpesa_message"
  | "mpesa_statement"
  | "bank_statement"
  | "invoice";

export type CaptureStatus = "processing" | "needs_review" | "confirmed";

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
}

export interface OrderItem {
  productId: string;
  name: string;
  qty: number;
  price: number;
}

export interface Order {
  id: string;
  code: string;
  customerId: string;
  items: OrderItem[];
  deliveryFee: number;
  discount: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  channel: Channel;
  address: string;
  riderId?: string;
  note?: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  orderId?: string;
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
}

export interface Delivery {
  id: string;
  orderId: string;
  riderId: string;
  status: DeliveryStatus;
  fee: number;
  address: string;
  assignedAt: string;
  deliveredAt?: string;
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
}

export interface Business {
  name: string;
  owner: string;
  phone: string;
  tillNumber: string;
  location: string;
  currency: "KES";
  defaultDeliveryFee: number;
}

export interface Database {
  version: number;
  business: Business;
  customers: Customer[];
  products: Product[];
  orders: Order[];
  payments: Payment[];
  riders: Rider[];
  deliveries: Delivery[];
  ledger: LedgerEntry[];
  conversations: Conversation[];
  captures: Capture[];
}

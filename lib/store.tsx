"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import { createSeedDatabase, DB_VERSION } from "./seed";
import { ingredientDraw, toBaseQty } from "./costing";
import { industryFor } from "./industries";
import { recordChange } from "./sync/client";
import { categorise } from "./statements";
import { riderOwed, sellerReceives, settlementOf } from "./selectors";
import type {
  Business,
  Capture,
  Database,
  Delivery,
  LedgerEntry,
  Order,
  OrderItem,
  OrderStatus,
  Payment,
  PaymentMethod,
  Product,
  Customer,
  Channel,
  Storefront,
  DeliverySettlement,
  Lot,
  SerialUnit,
  Booking,
  BookingState,
  Service,
  StaffMember,
  Ingredient,
  RecipeLine,
  StatementImport,
  StatementRow,
} from "./types";

const STORAGE_KEY = "sokoos.db.v1";

/* The database lives outside React and is read through useSyncExternalStore,
 * so the prerendered markup (seed data) and the hydrated client (whatever is
 * in localStorage) never disagree. */

const serverSnapshot: Database = createSeedDatabase();
let clientSnapshot: Database | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Database {
  if (clientSnapshot === null) clientSnapshot = loadDatabase();
  return clientSnapshot;
}

function getServerSnapshot(): Database {
  return serverSnapshot;
}

function persist(db: Database) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // Storage full or blocked (private mode). The app still works in memory.
  }
}

function setDb(update: Database | ((previous: Database) => Database)) {
  const previous = getSnapshot();
  const next = typeof update === "function" ? update(previous) : update;
  if (next === previous) return;
  clientSnapshot = next;
  persist(next);
  /* Every mutation in the app funnels through here, so this is the one place
   * that needs to know about sync. What changed is queued for the server and
   * delivered when there is signal; with no API configured it does nothing at
   * all and the app behaves exactly as it always has. */
  recordChange(previous, next);
  listeners.forEach((listener) => listener());
}

/** Applies records pulled from another device. Bypasses the outbox, since
 *  echoing the server's own changes back to it would loop forever. */
export function applyRemote(next: Database) {
  const previous = getSnapshot();
  if (next === previous) return;
  clientSnapshot = next;
  persist(next);
  listeners.forEach((listener) => listener());
}

const alwaysTrue = () => true;
const alwaysFalse = () => false;

function loadDatabase(): Database {
  if (typeof window === "undefined") return createSeedDatabase();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createSeedDatabase();
    const parsed = JSON.parse(raw) as Database;
    // A version bump means the demo data shape changed — reseed rather than
    // trying to migrate a throwaway local dataset.
    if (parsed.version !== DB_VERSION) return createSeedDatabase();
    return parsed;
  } catch {
    return createSeedDatabase();
  }
}

/** "Zawadi Collection" -> "zawadi-collection", the public address. */
export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** 0722 000 145 -> 254722000145, the shape wa.me expects. */
export function toWhatsApp(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  return digits;
}

function id(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Stock is held in base units, so keep it to the gram and drop float dust. */
function round3(value: number) {
  return Math.round(value * 1000) / 1000;
}

export interface NewOrderInput {
  customerId: string;
  items: OrderItem[];
  deliveryFee: number;
  /** Who the fee belongs to. Defaults to the business's usual arrangement. */
  deliverySettlement?: DeliverySettlement;
  address: string;
  channel: Channel;
  note?: string;
}

export interface NewBookingInput {
  customerId: string;
  serviceId: string;
  staffId?: string;
  startsAt: string;
  /** Overrides the service's own duration for a quoted job. */
  durationMinutes?: number;
  price?: number;
  place?: Booking["place"];
  note?: string;
}

export interface SignUpInput {
  name: string;
  email: string;
  phone: string;
  businessName: string;
  tillNumber: string;
  location: string;
  /** The trade, which decides the starting catalogue and how stock is counted. */
  industryId?: string;
}

interface StoreValue {
  db: Database;
  /** False during the first client render, before localStorage is read. */
  ready: boolean;
  createOrder: (input: NewOrderInput) => Order;
  setOrderStatus: (orderId: string, status: OrderStatus) => void;
  assignRider: (orderId: string, riderId: string) => void;
  recordPayment: (input: {
    orderId?: string;
    customerId?: string;
    customerName: string;
    method: PaymentMethod;
    amount: number;
    reference?: string;
  }) => void;
  matchPayment: (paymentId: string, orderId: string) => void;
  dismissPayment: (paymentId: string) => void;
  addCustomer: (input: Omit<Customer, "id" | "joinedAt" | "tags"> & { tags?: string[] }) => Customer;
  saveProduct: (product: Product) => void;
  addProduct: (input: Omit<Product, "id">) => void;
  addCapture: (capture: Capture) => void;
  confirmCapture: (captureId: string) => void;
  addLedgerEntry: (entry: Omit<LedgerEntry, "id">) => void;
  sendMessage: (conversationId: string, text: string) => void;
  markConversationRead: (conversationId: string) => void;
  linkConversationOrder: (conversationId: string, orderId: string) => void;
  updateBusiness: (patch: Partial<Business>) => void;
  /** Creates the local profile and seeds a storefront from the business. */
  signUp: (input: SignUpInput) => void;
  signIn: (email: string) => void;
  signOut: () => void;
  updateStorefront: (patch: Partial<Storefront>) => void;
  toggleStorefrontProduct: (productId: string) => void;
  /**
   * The rider is at the door and the seller has seen the money land. This is
   * the moment the goods change hands, so it is a step of its own.
   */
  /** Books a job into the diary. It is an order, so it pays and posts like one. */
  createBooking: (input: NewBookingInput) => Order;
  setBookingState: (orderId: string, state: BookingState) => void;
  /** Records the deposit that holds the slot. */
  payDeposit: (orderId: string) => void;
  saveService: (service: Service) => void;
  confirmDeliveryPayment: (deliveryId: string) => void;
  /** Cash the rider took on the seller's behalf, now handed over. */
  remitRiderCash: (deliveryId: string) => void;
  setDeliverySettlement: (orderId: string, settlement: DeliverySettlement) => void;
  saveLot: (lot: Lot) => void;
  addSerialUnit: (unit: Omit<SerialUnit, "id">) => void;
  setSerialStatus: (serialId: string, status: SerialUnit["status"], note?: string) => void;
  saveIngredient: (ingredient: Ingredient) => void;
  addIngredient: (input: Omit<Ingredient, "id">) => void;
  /** Positive to restock, negative to write off. */
  adjustIngredientStock: (ingredientId: string, delta: number) => void;
  saveRecipe: (productId: string, recipe: RecipeLine[]) => void;
  /** Writes only the rows the seller kept, and records the import itself. */
  commitStatementImport: (input: {
    source: "mpesa" | "bank";
    fileName: string;
    rows: StatementRow[];
    parsed: number;
  }) => StatementImport;
  resetDemoData: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const db = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ready = useSyncExternalStore(subscribe, alwaysTrue, alwaysFalse);

  /**
   * What the seller actually takes for an order. The delivery fee only counts
   * when the seller is the one charging it — with an independent boda paid by
   * the customer at the door, that money never passes through the business.
   */
  const orderTotal = useCallback(
    (items: OrderItem[], deliveryFee: number, settlement: DeliverySettlement = "business_pays_rider") => {
      const goods = items.reduce((sum, it) => sum + it.price * it.qty, 0);
      const collectsFee = settlement === "business_pays_rider" || settlement === "rider_collects";
      return goods + (collectsFee ? deliveryFee : 0);
    },
    [],
  );

  const createOrder = useCallback<StoreValue["createOrder"]>(
    (input) => {
      const codeNumber =
        Math.max(
          10510,
          ...(db.orders.map((o) => Number(o.code.replace("#", ""))).filter(Number.isFinite) as number[]),
        ) + 1;
      const order: Order = {
        id: `ord_${codeNumber}`,
        code: `#${codeNumber}`,
        customerId: input.customerId,
        items: input.items,
        deliveryFee: input.deliveryFee,
        deliverySettlement:
          input.deliverySettlement ?? db.business.defaultSettlement ?? "customer_pays_rider",
        discount: 0,
        status: "new",
        paymentStatus: "unpaid",
        channel: input.channel,
        address: input.address,
        note: input.note,
        createdAt: new Date().toISOString(),
      };
      setDb((prev) => ({
        ...prev,
        orders: [order, ...prev.orders],
        // Selling stock reduces stock. The ledger waits for delivery.
        products: prev.products.map((p) => {
          const line = input.items.find((it) => it.productId === p.id);
          return line ? { ...p, stock: Math.max(0, p.stock - line.qty) } : p;
        }),
      }));
      return order;
    },
    [db.orders, db.business.defaultSettlement],
  );

  const setOrderStatus = useCallback<StoreValue["setOrderStatus"]>((orderId, status) => {
    setDb((prev) => {
      const order = prev.orders.find((o) => o.id === orderId);
      if (!order) return prev;

      const ledger = [...prev.ledger];
      const alreadyPosted = ledger.some((e) => e.reference === order.code && e.type === "income");
      if (status === "delivered" && !alreadyPosted) {
        const customer = prev.customers.find((c) => c.id === order.customerId);
        ledger.unshift({
          id: id("led"),
          date: new Date().toISOString(),
          type: "income",
          category: "Sales",
          description: `Order ${order.code} — ${customer?.name ?? "Customer"}`,
          amount: sellerReceives(order),
          source: "order",
          reference: order.code,
          reconciled: order.paymentStatus === "paid",
        });
      }

      // Only a fee the seller is paying is an expense of the business. When the
      // customer settles with the boda at the door, nothing is posted at all.
      const owed = riderOwed(order);
      if (status === "delivered" && !alreadyPosted && order.riderId && owed > 0) {
        const rider = prev.riders.find((r) => r.id === order.riderId);
        ledger.unshift({
          id: id("led"),
          date: new Date().toISOString(),
          type: "expense",
          category: "Delivery",
          description: `Rider payout ${rider?.name ?? ""} — ${order.code}`.trim(),
          amount: owed,
          source: "order",
          reference: `RID-${order.code.replace("#", "")}`,
          reconciled: true,
        });
      }

      // A delivered order has actually consumed its ingredients, so the
      // stocktake moves with the till rather than waiting for a count.
      let ingredients = prev.ingredients;
      if (status === "delivered" && !alreadyPosted) {
        const drawn = new Map<string, number>();
        order.items.forEach((item) => {
          const product = prev.products.find((p) => p.id === item.productId);
          if (!product) return;
          ingredientDraw(product, item.qty).forEach((draw) => {
            drawn.set(draw.ingredientId, (drawn.get(draw.ingredientId) ?? 0) + draw.baseQty);
          });
        });
        if (drawn.size) {
          ingredients = prev.ingredients.map((ing) =>
            drawn.has(ing.id)
              ? { ...ing, stock: Math.max(0, round3(ing.stock - (drawn.get(ing.id) ?? 0))) }
              : ing,
          );
        }
      }

      return {
        ...prev,
        ledger,
        ingredients,
        orders: prev.orders.map((o) => (o.id === orderId ? { ...o, status } : o)),
        deliveries: prev.deliveries.map((d) =>
          d.orderId === orderId
            ? {
                ...d,
                status:
                  status === "delivered"
                    ? "delivered"
                    : status === "out_for_delivery"
                      ? "in_transit"
                      : d.status,
                deliveredAt: status === "delivered" ? new Date().toISOString() : d.deliveredAt,
              }
            : d,
        ),
      };
    });
  }, []);

  const assignRider = useCallback<StoreValue["assignRider"]>((orderId, riderId) => {
    setDb((prev) => {
      const order = prev.orders.find((o) => o.id === orderId);
      if (!order) return prev;
      const existing = prev.deliveries.find((d) => d.orderId === orderId);
      const settlement = settlementOf(order);
      const delivery: Delivery = existing
        ? { ...existing, riderId, status: "assigned", settlement, assignedAt: new Date().toISOString() }
        : {
            id: id("dlv"),
            orderId,
            riderId,
            status: "assigned",
            fee: order.deliveryFee,
            settlement,
            address: order.address,
            assignedAt: new Date().toISOString(),
          };
      return {
        ...prev,
        orders: prev.orders.map((o) =>
          o.id === orderId
            ? { ...o, riderId, status: o.status === "new" ? "confirmed" : o.status }
            : o,
        ),
        deliveries: existing
          ? prev.deliveries.map((d) => (d.orderId === orderId ? delivery : d))
          : [delivery, ...prev.deliveries],
        riders: prev.riders.map((r) =>
          r.id === riderId ? { ...r, status: "on_delivery", deliveriesToday: r.deliveriesToday + 1 } : r,
        ),
      };
    });
  }, []);

  const recordPayment = useCallback<StoreValue["recordPayment"]>((input) => {
    setDb((prev) => {
      const payment: Payment = {
        id: id("pay"),
        orderId: input.orderId,
        customerId: input.customerId,
        customerName: input.customerName,
        method: input.method,
        amount: input.amount,
        reference: input.reference ?? "",
        state: "received",
        receivedAt: new Date().toISOString(),
        matched: Boolean(input.orderId),
        source: "manual",
      };

      let orders = prev.orders;
      if (input.orderId) {
        orders = prev.orders.map((o) => {
          if (o.id !== input.orderId) return o;
          const total = orderTotal(o.items, o.deliveryFee, settlementOf(o));
          const paid = prev.payments
            .filter((p) => p.orderId === o.id && p.state === "received")
            .reduce((s, p) => s + p.amount, 0) + input.amount;
          return { ...o, paymentStatus: paid >= total ? "paid" : "partial" };
        });
      }

      return { ...prev, payments: [payment, ...prev.payments], orders };
    });
  }, [orderTotal]);

  const matchPayment = useCallback<StoreValue["matchPayment"]>((paymentId, orderId) => {
    setDb((prev) => {
      const payment = prev.payments.find((p) => p.id === paymentId);
      const order = prev.orders.find((o) => o.id === orderId);
      if (!payment || !order) return prev;
      const total = orderTotal(order.items, order.deliveryFee, settlementOf(order));
      return {
        ...prev,
        payments: prev.payments.map((p) =>
          p.id === paymentId
            ? { ...p, matched: true, state: "received", orderId, customerId: order.customerId }
            : p,
        ),
        orders: prev.orders.map((o) =>
          o.id === orderId
            ? { ...o, paymentStatus: payment.amount >= total ? "paid" : "partial" }
            : o,
        ),
        ledger: prev.ledger.map((e) =>
          e.reference === order.code ? { ...e, reconciled: true } : e,
        ),
      };
    });
  }, [orderTotal]);

  const dismissPayment = useCallback<StoreValue["dismissPayment"]>((paymentId) => {
    setDb((prev) => ({
      ...prev,
      payments: prev.payments.filter((p) => p.id !== paymentId),
    }));
  }, []);

  const addCustomer = useCallback<StoreValue["addCustomer"]>((input) => {
    const customer: Customer = {
      ...input,
      id: id("cus"),
      joinedAt: new Date().toISOString(),
      tags: input.tags ?? [],
    };
    setDb((prev) => ({ ...prev, customers: [customer, ...prev.customers] }));
    return customer;
  }, []);

  const saveProduct = useCallback<StoreValue["saveProduct"]>((product) => {
    setDb((prev) => ({
      ...prev,
      products: prev.products.map((p) => (p.id === product.id ? product : p)),
    }));
  }, []);

  const addProduct = useCallback<StoreValue["addProduct"]>((input) => {
    setDb((prev) => ({ ...prev, products: [{ ...input, id: id("prd") }, ...prev.products] }));
  }, []);

  const addCapture = useCallback<StoreValue["addCapture"]>((capture) => {
    setDb((prev) => ({ ...prev, captures: [capture, ...prev.captures] }));
  }, []);

  const confirmCapture = useCallback<StoreValue["confirmCapture"]>((captureId) => {
    setDb((prev) => {
      const capture = prev.captures.find((c) => c.id === captureId);
      if (!capture || capture.status === "confirmed") return prev;

      const amount = capture.extracted.amount ?? 0;
      // A classified capture already knows which way the money went; fall back
      // to the document type only when nothing decided it.
      const isIncome = capture.direction
        ? capture.direction === "credit"
        : capture.kind === "mpesa_message" || capture.extracted.category === "Sales";
      const entry: LedgerEntry = {
        id: id("led"),
        date: capture.extracted.date ?? capture.uploadedAt,
        type: isIncome ? "income" : "expense",
        category: capture.extracted.category ?? (isIncome ? "Sales" : "General"),
        description:
          capture.extracted.merchant ??
          capture.extracted.customer ??
          capture.fileName.replace(/\.[a-z]+$/i, ""),
        amount,
        source: "capture",
        reference: capture.extracted.transactionId ?? capture.id.toUpperCase(),
        reconciled: true,
      };

      return {
        ...prev,
        captures: prev.captures.map((c) =>
          c.id === captureId ? { ...c, status: "confirmed" } : c,
        ),
        ledger: [entry, ...prev.ledger],
      };
    });
  }, []);

  const addLedgerEntry = useCallback<StoreValue["addLedgerEntry"]>((entry) => {
    setDb((prev) => ({ ...prev, ledger: [{ ...entry, id: id("led") }, ...prev.ledger] }));
  }, []);

  const sendMessage = useCallback<StoreValue["sendMessage"]>((conversationId, text) => {
    setDb((prev) => ({
      ...prev,
      conversations: prev.conversations.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              unread: 0,
              messages: [
                ...c.messages,
                { id: id("msg"), from: "business", text, at: new Date().toISOString() },
              ],
            }
          : c,
      ),
    }));
  }, []);

  const markConversationRead = useCallback<StoreValue["markConversationRead"]>((conversationId) => {
    setDb((prev) => ({
      ...prev,
      conversations: prev.conversations.map((c) =>
        c.id === conversationId ? { ...c, unread: 0 } : c,
      ),
    }));
  }, []);

  const linkConversationOrder = useCallback<StoreValue["linkConversationOrder"]>(
    (conversationId, orderId) => {
      setDb((prev) => ({
        ...prev,
        conversations: prev.conversations.map((c) =>
          c.id === conversationId ? { ...c, orderId } : c,
        ),
      }));
    },
    [],
  );

  const updateBusiness = useCallback<StoreValue["updateBusiness"]>((patch) => {
    setDb((prev) => ({ ...prev, business: { ...prev.business, ...patch } }));
  }, []);

  const signUp = useCallback<StoreValue["signUp"]>((input) => {
    const industry = industryFor(undefined, input.industryId);

    /* A blank Products screen is where most of these apps die: the seller opens
     * it, sees nothing, and never comes back. So the trade brings its own
     * starting list, at rough Nairobi prices, for them to correct rather than
     * invent. Everything here is editable and deletable. */
    const starterProducts: Product[] = industry.products.map((item, i) => ({
      id: `prd_start_${i + 1}`,
      name: item.name,
      sku: `${industry.id.slice(0, 3).toUpperCase()}-${String(i + 1).padStart(2, "0")}`,
      price: item.price,
      cost: item.cost,
      stock: 0,
      lowStockAt: 3,
      category: item.category,
      swatch: "#1d4ed8",
      emoji: item.emoji,
      active: true,
      stockMode: item.stockMode,
    }));

    const starterServices: Service[] = industry.services.map((item, i) => ({
      id: `svc_start_${i + 1}`,
      name: item.name,
      durationMinutes: item.durationMinutes,
      bufferMinutes: item.bufferMinutes,
      price: item.price,
      priceMode: item.priceMode,
      category: item.category,
      swatch: "#0f766e",
      emoji: item.emoji,
      active: true,
      depositPercent: item.depositPercent,
    }));

    /* The owner is the first and usually the only member of the team. Their
     * hours are the capacity of the business, never a cost it pays. */
    const owner: StaffMember = {
      id: "stf_owner",
      name: input.name.trim(),
      phone: input.phone.trim(),
      role: "Owner",
      kind: "owner",
      hourlyCost: 0,
      workingDays: [1, 2, 3, 4, 5, 6],
      startHour: 9,
      endHour: 18,
      active: true,
    };

    setDb((prev) => ({
      ...prev,
      products: starterProducts,
      services: starterServices,
      staff: [owner],
      // A fresh business has no history, so none of the demo's is kept.
      orders: [],
      payments: [],
      deliveries: [],
      ledger: [],
      captures: [],
      imports: [],
      lots: [],
      serials: [],
      ingredients: [],
      account: {
        name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        phone: input.phone.trim(),
        createdAt: new Date().toISOString(),
      },
      business: {
        ...prev.business,
        name: input.businessName.trim(),
        owner: input.name.trim(),
        phone: input.phone.trim(),
        tillNumber: input.tillNumber.trim(),
        location: input.location.trim() || prev.business.location,
        type: industry.type,
        industry: industry.id,
        defaultSettlement: "customer_pays_rider",
      },
      // The mini site exists the moment the account does — the seller only
      // has to decide how it looks.
      storefront: {
        ...prev.storefront,
        slug: slugify(input.businessName) || prev.storefront.slug,
        headline: input.businessName.trim(),
        whatsapp: toWhatsApp(input.phone),
        location: input.location.trim() || prev.storefront.location,
      },
    }));
  }, []);

  const signIn = useCallback<StoreValue["signIn"]>((email) => {
    setDb((prev) => ({
      ...prev,
      account: prev.account ?? {
        name: prev.business.owner,
        email: email.trim().toLowerCase(),
        phone: prev.business.phone,
        createdAt: new Date().toISOString(),
      },
    }));
  }, []);

  const signOut = useCallback(() => {
    setDb((prev) => ({ ...prev, account: undefined }));
  }, []);

  const updateStorefront = useCallback<StoreValue["updateStorefront"]>((patch) => {
    setDb((prev) => ({ ...prev, storefront: { ...prev.storefront, ...patch } }));
  }, []);

  const toggleStorefrontProduct = useCallback<StoreValue["toggleStorefrontProduct"]>(
    (productId) => {
      setDb((prev) => {
        const hidden = prev.storefront.hiddenProductIds.includes(productId);
        return {
          ...prev,
          storefront: {
            ...prev.storefront,
            hiddenProductIds: hidden
              ? prev.storefront.hiddenProductIds.filter((id) => id !== productId)
              : [...prev.storefront.hiddenProductIds, productId],
            featuredProductId:
              !hidden && prev.storefront.featuredProductId === productId
                ? undefined
                : prev.storefront.featuredProductId,
          },
        };
      });
    },
    [],
  );

  const createBooking = useCallback<StoreValue["createBooking"]>(
    (input) => {
      const service = db.services.find((s) => s.id === input.serviceId);
      const codeNumber =
        Math.max(
          12500,
          ...(db.orders
            .map((o) => Number(o.code.replace("#", "")))
            .filter(Number.isFinite) as number[]),
        ) + 1;
      const price = input.price ?? service?.price ?? 0;
      const deposit = service?.depositPercent
        ? Math.round((price * service.depositPercent) / 100 / 50) * 50
        : 0;

      const order: Order = {
        id: `ord_${codeNumber}`,
        code: `#${codeNumber}`,
        customerId: input.customerId,
        items: [
          { productId: input.serviceId, name: service?.name ?? "Service", qty: 1, price },
        ],
        // Nobody rides anywhere for a job done at the shop.
        deliveryFee: 0,
        deliverySettlement: "free",
        discount: 0,
        status: "confirmed",
        paymentStatus: "unpaid",
        channel: db.customers.find((c) => c.id === input.customerId)?.channel ?? "call",
        address: input.place === "at_them" ? "At the customer" : "At the shop",
        booking: {
          serviceId: input.serviceId,
          staffId: input.staffId,
          startsAt: input.startsAt,
          durationMinutes: input.durationMinutes ?? service?.durationMinutes ?? 60,
          state: "booked",
          place: input.place ?? "at_us",
          deposit: deposit || undefined,
          note: input.note,
        },
        note: input.note,
        createdAt: new Date().toISOString(),
      };

      // A booking consumes no stock — it consumes a slot. Nothing is decremented.
      setDb((prev) => ({ ...prev, orders: [order, ...prev.orders] }));
      return order;
    },
    [db.orders, db.services, db.customers],
  );

  const setBookingState = useCallback<StoreValue["setBookingState"]>((orderId, state) => {
    setDb((prev) => {
      const order = prev.orders.find((o) => o.id === orderId);
      if (!order?.booking) return prev;

      const now = new Date().toISOString();
      const booking: Booking = {
        ...order.booking,
        state,
        startedAt: state === "in_progress" ? (order.booking.startedAt ?? now) : order.booking.startedAt,
        finishedAt: state === "done" ? (order.booking.finishedAt ?? now) : order.booking.finishedAt,
      };

      const ledger = [...prev.ledger];
      const posted = ledger.some((e) => e.reference === order.code && e.type === "income");
      // A finished job is earned revenue, whether or not it has been paid for.
      if (state === "done" && !posted) {
        const service = prev.services.find((s) => s.id === booking.serviceId);
        const customer = prev.customers.find((c) => c.id === order.customerId);
        ledger.unshift({
          id: id("led"),
          date: now,
          type: "income",
          category: "Services",
          description: `${service?.name ?? "Service"} — ${customer?.name ?? "Customer"}`,
          amount: order.items.reduce((sum, it) => sum + it.price * it.qty, 0) - order.discount,
          source: "order",
          reference: order.code,
          reconciled: order.paymentStatus === "paid",
        });
      }

      // The job also uses up whatever it consumes, once it is actually done.
      let ingredients = prev.ingredients;
      if (state === "done" && !posted) {
        const service = prev.services.find((s) => s.id === booking.serviceId);
        if (service?.materials?.length) {
          const drawn = new Map<string, number>();
          service.materials.forEach((line) => {
            drawn.set(line.ingredientId, (drawn.get(line.ingredientId) ?? 0) + toBaseQty(line));
          });
          ingredients = prev.ingredients.map((ing) =>
            drawn.has(ing.id)
              ? { ...ing, stock: Math.max(0, round3(ing.stock - (drawn.get(ing.id) ?? 0))) }
              : ing,
          );
        }
      }

      return {
        ...prev,
        ledger,
        ingredients,
        orders: prev.orders.map((o) =>
          o.id === orderId
            ? {
                ...o,
                booking,
                status:
                  state === "done"
                    ? "delivered"
                    : state === "cancelled"
                      ? "cancelled"
                      : o.status,
              }
            : o,
        ),
      };
    });
  }, []);

  const payDeposit = useCallback<StoreValue["payDeposit"]>((orderId) => {
    setDb((prev) => {
      const order = prev.orders.find((o) => o.id === orderId);
      if (!order?.booking?.deposit || order.booking.depositPaidAt) return prev;
      const customer = prev.customers.find((c) => c.id === order.customerId);
      const now = new Date().toISOString();

      return {
        ...prev,
        orders: prev.orders.map((o) =>
          o.id === orderId && o.booking
            ? { ...o, booking: { ...o.booking, depositPaidAt: now }, paymentStatus: "partial" }
            : o,
        ),
        payments: [
          {
            id: id("pay"),
            orderId,
            customerId: order.customerId,
            customerName: customer?.name ?? "Customer",
            method: "mpesa" as const,
            amount: order.booking.deposit,
            reference: "",
            state: "received" as const,
            receivedAt: now,
            matched: true,
            source: "manual" as const,
          },
          ...prev.payments,
        ],
      };
    });
  }, []);

  const saveService = useCallback<StoreValue["saveService"]>((service) => {
    setDb((prev) => ({
      ...prev,
      services: prev.services.some((s) => s.id === service.id)
        ? prev.services.map((s) => (s.id === service.id ? service : s))
        : [service, ...prev.services],
    }));
  }, []);

  const confirmDeliveryPayment = useCallback<StoreValue["confirmDeliveryPayment"]>(
    (deliveryId) => {
      setDb((prev) => ({
        ...prev,
        deliveries: prev.deliveries.map((d) =>
          d.id === deliveryId
            ? { ...d, status: "awaiting_payment", paymentConfirmedAt: new Date().toISOString() }
            : d,
        ),
      }));
    },
    [],
  );

  const remitRiderCash = useCallback<StoreValue["remitRiderCash"]>((deliveryId) => {
    setDb((prev) => {
      const delivery = prev.deliveries.find((d) => d.id === deliveryId);
      if (!delivery || !delivery.cashCollected || delivery.remittedAt) return prev;
      const order = prev.orders.find((o) => o.id === delivery.orderId);
      const rider = prev.riders.find((r) => r.id === delivery.riderId);

      return {
        ...prev,
        deliveries: prev.deliveries.map((d) =>
          d.id === deliveryId ? { ...d, remittedAt: new Date().toISOString() } : d,
        ),
        // The money was always the seller's; this records it arriving, not a sale.
        payments: [
          {
            id: id("pay"),
            orderId: delivery.orderId,
            customerId: order?.customerId,
            customerName: `${rider?.name ?? "Rider"} (remittance)`,
            method: "cash" as const,
            amount: delivery.cashCollected,
            reference: "",
            state: "received" as const,
            receivedAt: new Date().toISOString(),
            matched: true,
            source: "manual" as const,
          },
          ...prev.payments,
        ],
      };
    });
  }, []);

  const setDeliverySettlement = useCallback<StoreValue["setDeliverySettlement"]>(
    (orderId, settlement) => {
      setDb((prev) => ({
        ...prev,
        orders: prev.orders.map((o) =>
          o.id === orderId ? { ...o, deliverySettlement: settlement } : o,
        ),
        deliveries: prev.deliveries.map((d) => (d.orderId === orderId ? { ...d, settlement } : d)),
      }));
    },
    [],
  );

  const saveLot = useCallback<StoreValue["saveLot"]>((lot) => {
    setDb((prev) => ({
      ...prev,
      lots: prev.lots.some((l) => l.id === lot.id)
        ? prev.lots.map((l) => (l.id === lot.id ? lot : l))
        : [lot, ...prev.lots],
    }));
  }, []);

  const addSerialUnit = useCallback<StoreValue["addSerialUnit"]>((unit) => {
    setDb((prev) => {
      const serials = [{ ...unit, id: id("srl") }, ...prev.serials];
      return {
        ...prev,
        serials,
        // Stock follows the units, so it can never drift from what is on the shelf.
        products: prev.products.map((p) =>
          p.id === unit.productId
            ? {
                ...p,
                stock: serials.filter((u) => u.productId === p.id && u.status === "in_stock").length,
              }
            : p,
        ),
      };
    });
  }, []);

  const setSerialStatus = useCallback<StoreValue["setSerialStatus"]>((serialId, status, note) => {
    setDb((prev) => {
      const target = prev.serials.find((u) => u.id === serialId);
      if (!target) return prev;
      const serials = prev.serials.map((u) =>
        u.id === serialId
          ? {
              ...u,
              status,
              note: note ?? u.note,
              soldAt: status === "sold" ? (u.soldAt ?? new Date().toISOString()) : u.soldAt,
            }
          : u,
      );
      return {
        ...prev,
        serials,
        products: prev.products.map((p) =>
          p.id === target.productId
            ? {
                ...p,
                stock: serials.filter((u) => u.productId === p.id && u.status === "in_stock").length,
              }
            : p,
        ),
      };
    });
  }, []);

  const saveIngredient = useCallback<StoreValue["saveIngredient"]>((ingredient) => {
    setDb((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((i) => (i.id === ingredient.id ? ingredient : i)),
    }));
  }, []);

  const addIngredient = useCallback<StoreValue["addIngredient"]>((input) => {
    setDb((prev) => ({
      ...prev,
      ingredients: [...prev.ingredients, { ...input, id: id("ing") }],
    }));
  }, []);

  const adjustIngredientStock = useCallback<StoreValue["adjustIngredientStock"]>(
    (ingredientId, delta) => {
      setDb((prev) => ({
        ...prev,
        ingredients: prev.ingredients.map((i) =>
          i.id === ingredientId ? { ...i, stock: Math.max(0, round3(i.stock + delta)) } : i,
        ),
      }));
    },
    [],
  );

  const saveRecipe = useCallback<StoreValue["saveRecipe"]>((productId, recipe) => {
    setDb((prev) => ({
      ...prev,
      products: prev.products.map((p) =>
        p.id === productId ? { ...p, recipe: recipe.length ? recipe : undefined } : p,
      ),
    }));
  }, []);

  const commitStatementImport = useCallback<StoreValue["commitStatementImport"]>((input) => {
    const kept = input.rows;
    const dates = kept.map((r) => +new Date(r.date)).sort((a, b) => a - b);
    const record: StatementImport = {
      id: id("imp"),
      source: input.source,
      fileName: input.fileName,
      importedAt: new Date().toISOString(),
      periodStart: new Date(dates[0] ?? Date.now()).toISOString(),
      periodEnd: new Date(dates[dates.length - 1] ?? Date.now()).toISOString(),
      rowsParsed: input.parsed,
      rowsImported: kept.length,
      rowsDuplicate: input.parsed - kept.length,
      rowsReview: kept.filter((r) => r.state === "needs_review").length,
    };

    setDb((prev) => ({
      ...prev,
      imports: [record, ...prev.imports],
      ledger: [
        ...kept.map<LedgerEntry>((row) => ({
          id: id("led"),
          date: row.date,
          type: row.direction === "credit" ? "income" : "expense",
          category: categorise(row.description, row.direction),
          description: row.description,
          amount: row.amount,
          source: "capture",
          reference: row.code || `IMP-${record.id.toUpperCase()}`,
          reconciled: true,
        })),
        ...prev.ledger,
      ],
    }));

    return record;
  }, []);

  const resetDemoData = useCallback(() => {
    setDb(createSeedDatabase());
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      db,
      ready,
      createOrder,
      setOrderStatus,
      assignRider,
      recordPayment,
      matchPayment,
      dismissPayment,
      addCustomer,
      saveProduct,
      addProduct,
      addCapture,
      confirmCapture,
      addLedgerEntry,
      sendMessage,
      markConversationRead,
      linkConversationOrder,
      updateBusiness,
      signUp,
      signIn,
      signOut,
      updateStorefront,
      toggleStorefrontProduct,
      createBooking,
      setBookingState,
      payDeposit,
      saveService,
      confirmDeliveryPayment,
      remitRiderCash,
      setDeliverySettlement,
      saveLot,
      addSerialUnit,
      setSerialStatus,
      saveIngredient,
      addIngredient,
      adjustIngredientStock,
      saveRecipe,
      commitStatementImport,
      resetDemoData,
    }),
    [
      db,
      ready,
      createOrder,
      setOrderStatus,
      assignRider,
      recordPayment,
      matchPayment,
      dismissPayment,
      addCustomer,
      saveProduct,
      addProduct,
      addCapture,
      confirmCapture,
      addLedgerEntry,
      sendMessage,
      markConversationRead,
      linkConversationOrder,
      updateBusiness,
      signUp,
      signIn,
      signOut,
      updateStorefront,
      toggleStorefrontProduct,
      createBooking,
      setBookingState,
      payDeposit,
      saveService,
      confirmDeliveryPayment,
      remitRiderCash,
      setDeliverySettlement,
      saveLot,
      addSerialUnit,
      setSerialStatus,
      saveIngredient,
      addIngredient,
      adjustIngredientStock,
      saveRecipe,
      commitStatementImport,
      resetDemoData,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}

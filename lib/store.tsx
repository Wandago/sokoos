"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import { createSeedDatabase, DB_VERSION } from "./seed";
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

export interface NewOrderInput {
  customerId: string;
  items: OrderItem[];
  deliveryFee: number;
  address: string;
  channel: Channel;
  note?: string;
}

export interface SignUpInput {
  name: string;
  email: string;
  phone: string;
  businessName: string;
  tillNumber: string;
  location: string;
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
  resetDemoData: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const db = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ready = useSyncExternalStore(subscribe, alwaysTrue, alwaysFalse);

  const orderTotal = useCallback(
    (items: OrderItem[], deliveryFee: number) =>
      items.reduce((sum, it) => sum + it.price * it.qty, 0) + deliveryFee,
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
    [db.orders],
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
          amount: orderTotal(order.items, order.deliveryFee),
          source: "order",
          reference: order.code,
          reconciled: order.paymentStatus === "paid",
        });
      }

      return {
        ...prev,
        ledger,
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
  }, [orderTotal]);

  const assignRider = useCallback<StoreValue["assignRider"]>((orderId, riderId) => {
    setDb((prev) => {
      const order = prev.orders.find((o) => o.id === orderId);
      if (!order) return prev;
      const existing = prev.deliveries.find((d) => d.orderId === orderId);
      const delivery: Delivery = existing
        ? { ...existing, riderId, status: "assigned", assignedAt: new Date().toISOString() }
        : {
            id: id("dlv"),
            orderId,
            riderId,
            status: "assigned",
            fee: order.deliveryFee,
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
          const total = orderTotal(o.items, o.deliveryFee);
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
      const total = orderTotal(order.items, order.deliveryFee);
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
      const isIncome = capture.kind === "mpesa_message" || capture.extracted.category === "Sales";
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
    setDb((prev) => ({
      ...prev,
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

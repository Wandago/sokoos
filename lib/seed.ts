import type {
  Capture,
  Conversation,
  Customer,
  Database,
  Delivery,
  LedgerEntry,
  Order,
  OrderStatus,
  Payment,
  PaymentStatus,
  Product,
  Rider,
  Channel,
} from "./types";

export const DB_VERSION = 1;

/** ISO timestamp `days` ago at a given wall-clock time. */
function isToday(iso: string) {
  return new Date(iso).toDateString() === new Date().toDateString();
}

function at(days: number, hour: number, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/** M-Pesa style confirmation code, e.g. QK73H2MN9P. */
function mpesaRef(seed: number) {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "0123456789";
  let out = "";
  for (let i = 0; i < 10; i++) {
    const pool = i % 3 === 1 ? digits : letters;
    out += pool[(seed * (i + 7) * 31 + i * 13) % pool.length];
  }
  return out;
}

const customerRows: [string, string, Channel, string, number, string[]][] = [
  ["Jane Wanjiku", "0722 418 903", "instagram", "Kilimani", 96, ["Repeat", "VIP"]],
  ["Brian Otieno", "0710 552 187", "whatsapp", "South B", 74, ["Repeat"]],
  ["Achieng Odhiambo", "0733 908 214", "tiktok", "Westlands", 61, ["Repeat"]],
  ["Faith Kamau", "0725 173 640", "instagram", "Lavington", 58, ["VIP"]],
  ["Mercy Njeri", "0718 340 552", "whatsapp", "Kasarani", 47, []],
  ["Kevin Mutua", "0729 661 038", "facebook", "Embakasi", 44, []],
  ["Sharon Chebet", "0701 224 795", "tiktok", "Ruaka", 39, ["Repeat"]],
  ["Dennis Kariuki", "0736 815 402", "call", "Ngong Road", 33, []],
  ["Zainab Hassan", "0712 507 913", "instagram", "Parklands", 28, ["VIP"]],
  ["Grace Wairimu", "0740 336 128", "referral", "Buruburu", 24, ["Repeat"]],
  ["Peter Kimani", "0727 049 561", "whatsapp", "Thika Road", 19, []],
  ["Cynthia Atieno", "0715 872 304", "tiktok", "Donholm", 14, []],
  ["Tabitha Muthoni", "0703 619 447", "instagram", "Karen", 9, []],
  ["Samuel Ochieng", "0731 285 076", "walk-in", "Umoja", 4, []],
];

const productRows: [string, string, number, number, number, string, string, string][] = [
  ["Ankara Wrap Dress", "ZC-DR-01", 3800, 2100, 14, "Dresses", "#c2410c", "👗"],
  ["Two-Piece Linen Set", "ZC-SET-02", 4500, 2600, 8, "Sets", "#0f766e", "🧵"],
  ["Oversized Denim Jacket", "ZC-JK-03", 5200, 3000, 5, "Outerwear", "#1e40af", "🧥"],
  ["Satin Head Wrap", "ZC-AC-04", 900, 380, 42, "Accessories", "#a21caf", "🧣"],
  ["Shea Butter Cream 250ml", "ZC-BT-05", 1200, 520, 26, "Beauty", "#b45309", "🧴"],
  ["Beaded Leather Sandals", "ZC-SH-06", 2800, 1500, 11, "Footwear", "#78350f", "👡"],
  ["Kitenge Tote Bag", "ZC-BG-07", 2200, 1000, 3, "Bags", "#065f46", "👜"],
  ["Gold Hoop Earrings", "ZC-JW-08", 1500, 600, 19, "Jewellery", "#a16207", "💍"],
  ["Silk Bonnet", "ZC-AC-09", 1100, 450, 0, "Accessories", "#4c1d95", "🎀"],
  ["Maasai Beaded Bracelet", "ZC-JW-10", 750, 280, 33, "Jewellery", "#be123c", "📿"],
  ["Cotton Lounge Set", "ZC-SET-11", 3400, 1900, 9, "Sets", "#3f6212", "🩳"],
  ["Vitamin C Serum 30ml", "ZC-BT-12", 2600, 1150, 7, "Beauty", "#c2410c", "💧"],
];

const riderRows: [string, string, "boda" | "car" | "van", string[], number, number][] = [
  ["Musa Abdi", "0722 908 331", "boda", ["Westlands", "Kilimani", "Lavington", "Parklands"], 4.9, 6],
  ["Collins Barasa", "0715 447 802", "boda", ["Kasarani", "Thika Road", "Roysambu", "Ruaka"], 4.7, 4],
  ["Wycliffe Juma", "0733 219 574", "car", ["Karen", "Langata", "Ngong Road", "Rongai"], 4.8, 2],
  ["Hassan Ali", "0708 663 190", "boda", ["Embakasi", "Donholm", "Umoja", "Buruburu"], 4.6, 3],
];

/** Deterministic PRNG — the demo business must look identical on every device. */
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

/* [daysAgo, hour, customerIdx, items, status, paymentStatus, riderIdx] */
type OrderRow = [
  number,
  number,
  number,
  [number, number][],
  OrderStatus,
  PaymentStatus,
  number | null,
];

const orderRows: OrderRow[] = [
  // ---- Today ------------------------------------------------------------
  [0, 8, 0, [[0, 1]], "delivered", "paid", 0],
  [0, 8, 4, [[4, 2], [9, 1]], "delivered", "paid", 1],
  [0, 9, 2, [[1, 1]], "delivered", "paid", 0],
  [0, 9, 7, [[3, 3]], "delivered", "paid", 2],
  [0, 10, 1, [[5, 1], [7, 1]], "delivered", "paid", 3],
  [0, 10, 9, [[11, 1]], "delivered", "paid", 3],
  [0, 11, 3, [[2, 1]], "delivered", "paid", 0],
  [0, 11, 12, [[10, 1], [4, 1]], "delivered", "paid", 2],
  [0, 12, 5, [[6, 1]], "delivered", "cod", 3],
  [0, 12, 8, [[0, 1], [3, 1]], "delivered", "paid", 0],
  [0, 13, 6, [[7, 2]], "delivered", "paid", 1],
  [0, 13, 10, [[4, 1]], "delivered", "paid", 1],
  [0, 14, 11, [[1, 1], [9, 2]], "out_for_delivery", "paid", 1],
  [0, 15, 13, [[5, 1]], "out_for_delivery", "cod", 3],
  [0, 16, 0, [[11, 1], [4, 1]], "packed", "paid", null],
  [0, 16, 2, [[10, 2]], "confirmed", "unpaid", null],
  [0, 17, 4, [[0, 1]], "confirmed", "partial", null],
  [0, 18, 5, [[2, 1], [7, 1]], "new", "unpaid", null],
];

/**
 * Trading history. Real volume matters here: with only a handful of orders on
 * past days every trend line and percentage in Analytics reads as nonsense.
 */
function historyRows(days = 30): OrderRow[] {
  const random = mulberry32(20260829);
  const rows: OrderRow[] = [];

  for (let day = days; day >= 1; day--) {
    // Weekends sell harder than midweek.
    const weekday = new Date(Date.now() - day * 86400000).getDay();
    const busy = weekday === 0 || weekday === 5 || weekday === 6;
    const count = Math.floor(random() * 5) + (busy ? 11 : 8);

    for (let i = 0; i < count; i++) {
      const hour = 8 + Math.floor(random() * 11);
      const customerIdx = Math.floor(random() * customerRows.length);
      const lines: [number, number][] = [
        [Math.floor(random() * productRows.length), random() > 0.85 ? 2 : 1],
      ];
      if (random() > 0.6) {
        lines.push([Math.floor(random() * productRows.length), 1]);
      }

      const roll = random();
      const status: OrderStatus = roll > 0.97 ? "cancelled" : "delivered";
      const paymentStatus: PaymentStatus =
        status === "cancelled" ? "refunded" : roll > 0.82 ? "cod" : "paid";

      rows.push([
        day,
        hour,
        customerIdx,
        lines,
        status,
        paymentStatus,
        status === "cancelled" ? null : Math.floor(random() * riderRows.length),
      ]);
    }
  }

  return rows;
}

function buildDatabase(): Database {
  const customers: Customer[] = customerRows.map(
    ([name, phone, channel, location, joined, tags], i) => ({
      id: `cus_${i + 1}`,
      name,
      phone,
      channel,
      location,
      joinedAt: at(joined, 11),
      tags,
    }),
  );

  const products: Product[] = productRows.map(
    ([name, sku, price, cost, stock, category, swatch, emoji], i) => ({
      id: `prd_${i + 1}`,
      name,
      sku,
      price,
      cost,
      stock,
      lowStockAt: 5,
      category,
      swatch,
      emoji,
      active: true,
    }),
  );

  const riders: Rider[] = riderRows.map(
    ([name, phone, vehicle, zones, rating, deliveriesToday], i) => ({
      id: `rdr_${i + 1}`,
      name,
      phone,
      vehicle,
      zones,
      rating,
      status: i === 2 ? "available" : "on_delivery",
      deliveriesToday,
    }),
  );

  const cogsByDay = new Map<number, number>();
  const riderFeesByDay = new Map<number, number>();

  const orders: Order[] = [];
  const payments: Payment[] = [];
  const deliveries: Delivery[] = [];
  const ledger: LedgerEntry[] = [];

  // Oldest first, so order numbers climb with time the way a real book does.
  const rows = [...historyRows(), ...orderRows].sort((a, b) => {
    const byDay = b[0] - a[0];
    return byDay !== 0 ? byDay : a[1] - b[1];
  });

  rows.forEach((row, i) => {
    const [days, hour, customerIdx, items, status, paymentStatus, riderIdx] = row;
    const customer = customers[customerIdx];
    const code = 10200 + i;
    const orderId = `ord_${code}`;
    const createdAt = at(days, hour, (i * 7) % 60);
    const deliveryFee = customer.location === "Karen" || customer.location === "Ruaka" ? 350 : 200;

    const orderItems = items.map(([productIdx, qty]) => {
      const p = products[productIdx];
      return { productId: p.id, name: p.name, qty, price: p.price };
    });
    if (status !== "cancelled") {
      const cogs = items.reduce(
        (sum, [productIdx, qty]) => sum + productRows[productIdx][3] * qty,
        0,
      );
      cogsByDay.set(days, (cogsByDay.get(days) ?? 0) + cogs);
      if (riderIdx !== null) {
        // Riders keep most of the delivery fee.
        riderFeesByDay.set(days, (riderFeesByDay.get(days) ?? 0) + Math.round(deliveryFee * 0.75));
      }
    }
    const subtotal = orderItems.reduce((sum, it) => sum + it.price * it.qty, 0);
    const total = subtotal + deliveryFee;

    orders.push({
      id: orderId,
      code: `#${code}`,
      customerId: customer.id,
      items: orderItems,
      deliveryFee,
      discount: 0,
      status,
      paymentStatus,
      channel: customer.channel,
      address: `${customer.location}, Nairobi`,
      riderId: riderIdx === null ? undefined : riders[riderIdx].id,
      createdAt,
    });

    // Payment record
    if (paymentStatus === "paid" || paymentStatus === "partial") {
      const amount = paymentStatus === "partial" ? Math.round(total / 2) : total;
      payments.push({
        id: `pay_${code}`,
        orderId,
        customerId: customer.id,
        customerName: customer.name,
        method: i % 9 === 4 ? "cash" : "mpesa",
        amount,
        reference: i % 9 === 4 ? "" : mpesaRef(code),
        state: "received",
        receivedAt: at(days, hour, ((i * 7) % 60) + 3),
        matched: true,
        source: "mpesa",
      });
    }

    // Delivery record
    if (riderIdx !== null) {
      const delivered = status === "delivered";
      deliveries.push({
        id: `dlv_${code}`,
        orderId,
        riderId: riders[riderIdx].id,
        status: delivered ? "delivered" : status === "out_for_delivery" ? "in_transit" : "assigned",
        fee: deliveryFee,
        address: `${customer.location}, Nairobi`,
        assignedAt: at(days, hour, ((i * 7) % 60) + 10),
        deliveredAt: delivered ? at(days, hour + 2, (i * 7) % 60) : undefined,
      });
    }

    // Ledger: delivered + settled orders become income
    if (status === "delivered" && paymentStatus !== "refunded") {
      ledger.push({
        id: `led_o_${code}`,
        date: at(days, hour + 2, (i * 7) % 60),
        type: "income",
        category: "Sales",
        description: `Order #${code} — ${customer.name}`,
        amount: total,
        source: "order",
        reference: `#${code}`,
        reconciled: paymentStatus === "paid",
      });
    }
  });

  // ---- Payments that arrived without an order attached --------------------
  // These are the ones Smart Capture and reconciliation exist to solve.
  payments.push(
    {
      id: "pay_u1",
      customerName: "Unknown — 0724 118 ***",
      method: "mpesa",
      amount: 3800,
      reference: mpesaRef(771),
      state: "review",
      receivedAt: at(0, 15, 42),
      matched: false,
      source: "mpesa",
      confidence: 0.72,
    },
    {
      id: "pay_u2",
      customerName: "Grace Wairimu",
      customerId: "cus_10",
      method: "mpesa",
      amount: 2400,
      reference: mpesaRef(913),
      state: "review",
      receivedAt: at(1, 19, 8),
      matched: false,
      source: "capture",
      confidence: 0.94,
    },
    {
      id: "pay_u3",
      customerName: "Peter Kimani",
      customerId: "cus_11",
      method: "mpesa",
      amount: 1500,
      reference: mpesaRef(455),
      state: "pending",
      receivedAt: at(0, 17, 25),
      matched: false,
      source: "mpesa",
    },
    {
      id: "pay_u4",
      customerName: "Cynthia Atieno",
      customerId: "cus_12",
      method: "mpesa",
      amount: 2950,
      reference: mpesaRef(288),
      state: "failed",
      receivedAt: at(2, 12, 3),
      matched: false,
      source: "mpesa",
    },
  );

  // ---- Cost of goods and rider payouts, day by day ------------------------
  [...cogsByDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .forEach(([days, amount]) => {
      ledger.push({
        id: `led_cogs_${days}`,
        date: at(days, 20, 10),
        type: "expense",
        category: "Stock",
        description: "Stock sold — cost of goods",
        amount,
        source: "order",
        reference: `COGS-${days}`,
        reconciled: true,
      });
      const payout = riderFeesByDay.get(days);
      if (payout) {
        ledger.push({
          id: `led_rider_${days}`,
          date: at(days, 20, 20),
          type: "expense",
          category: "Delivery",
          description: "Rider payouts",
          amount: payout,
          source: "manual",
          reference: `RID-${days}`,
          reconciled: true,
        });
      }
    });

  // ---- Business expenses --------------------------------------------------
  const expenses: [number, string, string, number, LedgerEntry["source"]][] = [
    [0, "Packaging", "Branded bags & tissue — Biashara St", 2600, "capture"],
    [1, "Stock", "Restock: Ankara fabric — Gikomba", 18500, "capture"],
    [6, "Marketing", "Instagram ads", 4500, "capture"],
    [8, "Salaries", "Assistant — part time", 15000, "manual"],
    [14, "Rent", "Studio rent", 25000, "manual"],
    [20, "Marketing", "Influencer collaboration", 8000, "capture"],
    [22, "Salaries", "Assistant — part time", 15000, "manual"],
    [3, "Marketing", "TikTok promotion boost", 3000, "capture"],
    [4, "Airtime & data", "Safaricom bundles", 1000, "manual"],
    [5, "Stock", "Beauty restock — Nairobi CBD", 12400, "capture"],
    [7, "Rent", "Studio rent — October", 25000, "manual"],
    [12, "Packaging", "Shipping boxes", 3200, "capture"],
  ];
  expenses.forEach(([days, category, description, amount, source], i) => {
    ledger.push({
      id: `led_e_${i + 1}`,
      date: at(days, 18, i * 5),
      type: "expense",
      category,
      description,
      amount,
      source,
      reference: source === "capture" ? `CAP-${1200 + i}` : `EXP-${1200 + i}`,
      reconciled: true,
    });
  });

  // Newest first everywhere the UI reads these lists.
  orders.reverse();
  payments.sort((a, b) => +new Date(b.receivedAt) - +new Date(a.receivedAt));
  deliveries.sort((a, b) => +new Date(b.assignedAt) - +new Date(a.assignedAt));
  ledger.sort((a, b) => +new Date(b.date) - +new Date(a.date));

  // ---- Inbox --------------------------------------------------------------
  const conversations: Conversation[] = [
    {
      id: "cnv_1",
      customerId: "cus_6",
      customerName: "Kevin Mutua",
      channel: "facebook",
      handle: "Kevin Mutua",
      unread: 2,
      messages: [
        { id: "m1", from: "customer", text: "Hi, is the denim jacket still available in large?", at: at(0, 18, 2) },
        { id: "m2", from: "business", text: "Yes it is. KES 5,200 plus delivery.", at: at(0, 18, 9) },
        { id: "m3", from: "customer", text: "Sawa. I'll take it, plus the gold hoops.", at: at(0, 18, 21) },
        { id: "m4", from: "customer", text: "Deliver to Embakasi, near Taj Mall.", at: at(0, 18, 22) },
      ],
    },
    {
      id: "cnv_2",
      customerName: "@shiro_styles",
      channel: "instagram",
      handle: "@shiro_styles",
      unread: 1,
      messages: [
        { id: "m1", from: "customer", text: "Hey! Do you have the wrap dress in navy?", at: at(0, 17, 40) },
        { id: "m2", from: "business", text: "We have navy and rust. Which size?", at: at(0, 17, 52) },
        { id: "m3", from: "customer", text: "Medium. How much with delivery to Syokimau?", at: at(0, 18, 44) },
      ],
    },
    {
      id: "cnv_3",
      customerId: "cus_4",
      customerName: "Faith Kamau",
      channel: "whatsapp",
      handle: "0725 173 640",
      unread: 0,
      messages: [
        { id: "m1", from: "customer", text: "Received the dress, it's beautiful 😍", at: at(0, 14, 12) },
        { id: "m2", from: "business", text: "So glad you love it! Thank you Faith.", at: at(0, 14, 30) },
      ],
    },
    {
      id: "cnv_4",
      customerName: "@bella.ke",
      channel: "tiktok",
      handle: "@bella.ke",
      unread: 3,
      messages: [
        { id: "m1", from: "customer", text: "Price for the lounge set?", at: at(0, 16, 5) },
        { id: "m2", from: "customer", text: "And do you deliver to Nakuru?", at: at(0, 16, 6) },
        { id: "m3", from: "customer", text: "Hello?", at: at(0, 19, 1) },
      ],
    },
    {
      id: "cnv_5",
      customerId: "cus_11",
      customerName: "Peter Kimani",
      channel: "whatsapp",
      handle: "0727 049 561",
      unread: 1,
      messages: [
        { id: "m1", from: "customer", text: "I've sent 1,500 via M-Pesa, confirm?", at: at(0, 17, 26) },
      ],
    },
    {
      id: "cnv_6",
      customerId: "cus_1",
      customerName: "Jane Wanjiku",
      channel: "instagram",
      handle: "@janew_",
      unread: 0,
      messages: [
        { id: "m1", from: "customer", text: "Restocking the tote bags any time soon?", at: at(1, 9, 15) },
        { id: "m2", from: "business", text: "Next week Tuesday. I'll reserve one for you.", at: at(1, 9, 40) },
        { id: "m3", from: "customer", text: "Perfect, asante!", at: at(1, 9, 42) },
      ],
    },
  ];

  // Link the two conversations that produced an order today.
  const kevinOrder = orders.find((o) => o.customerId === "cus_6" && o.status === "new");
  const faithOrder = orders.find(
    (o) => o.customerId === "cus_4" && isToday(o.createdAt) && o.status === "delivered",
  );
  const kevinConversation = conversations.find((c) => c.id === "cnv_1");
  const faithConversation = conversations.find((c) => c.id === "cnv_3");
  if (kevinConversation) kevinConversation.orderId = kevinOrder?.id;
  if (faithConversation) faithConversation.orderId = faithOrder?.id;

  // ---- Smart Capture ------------------------------------------------------
  const captures: Capture[] = [
    {
      id: "cap_1",
      kind: "mpesa_message",
      fileName: "mpesa-confirmation.jpg",
      uploadedAt: at(0, 15, 44),
      status: "needs_review",
      confidence: 0.72,
      extracted: {
        amount: 3800,
        date: at(0, 15, 42),
        customer: "0724 118 ***",
        transactionId: mpesaRef(771),
        method: "mpesa",
        category: "Sales",
      },
      note: "Sender name is partly cut off in the screenshot.",
    },
    {
      id: "cap_2",
      kind: "receipt",
      fileName: "biashara-packaging.pdf",
      uploadedAt: at(0, 18, 12),
      status: "confirmed",
      confidence: 0.97,
      extracted: {
        amount: 2600,
        date: at(0, 17, 30),
        merchant: "Biashara Street Packaging",
        transactionId: "RCT-88421",
        method: "cash",
        category: "Packaging",
        items: [
          { name: "Branded paper bags (100)", qty: 1, price: 1800 },
          { name: "Tissue wrap (5 packs)", qty: 5, price: 160 },
        ],
        tax: 358,
      },
    },
    {
      id: "cap_3",
      kind: "mpesa_statement",
      fileName: "mpesa-statement-oct.pdf",
      uploadedAt: at(1, 20, 5),
      status: "needs_review",
      confidence: 0.88,
      extracted: {
        amount: 47200,
        date: at(1, 20, 0),
        merchant: "Safaricom M-Pesa",
        category: "Statement",
        method: "mpesa",
      },
      note: "38 transactions found. 12 already match orders, 3 need review.",
    },
    {
      id: "cap_4",
      kind: "receipt",
      fileName: "gikomba-fabric.jpg",
      uploadedAt: at(1, 19, 2),
      status: "confirmed",
      confidence: 0.93,
      extracted: {
        amount: 18500,
        date: at(1, 15, 20),
        merchant: "Gikomba Fabrics",
        category: "Stock",
        method: "mpesa",
        transactionId: mpesaRef(620),
      },
    },
    {
      id: "cap_5",
      kind: "bank_statement",
      fileName: "equity-statement.pdf",
      uploadedAt: at(3, 21, 30),
      status: "confirmed",
      confidence: 0.91,
      extracted: {
        amount: 96400,
        date: at(3, 21, 0),
        merchant: "Equity Bank",
        category: "Statement",
        method: "bank",
      },
    },
  ];

  return {
    version: DB_VERSION,
    business: {
      name: "Zawadi Collection",
      owner: "Louis Wandago",
      phone: "0722 000 145",
      tillNumber: "5240119",
      location: "Nairobi, Kenya",
      currency: "KES",
      defaultDeliveryFee: 200,
    },
    customers,
    products,
    orders,
    payments,
    riders,
    deliveries,
    ledger,
    conversations,
    captures,
  };
}

export function createSeedDatabase(): Database {
  return buildDatabase();
}

import type {
  Booking,
  BookingState,
  DeliverySettlement,
  Service,
  StaffMember,
  Lot,
  SerialUnit,
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
  Storefront,
  Ingredient,
  RecipeLine,
} from "./types";

export const DB_VERSION = 5;

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
 * Trading history. Volume matters here twice over: with only a handful of
 * orders per day every trend line reads as nonsense, and with less than two
 * months of it the month-on-month deltas compare against an empty window.
 */
function historyRows(days = 75): OrderRow[] {
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
      // Boda riders in town work with the business, not for it.
      relationship: i === 3 ? "in_house" : "independent",
      zoneRates: zones.map((zone) => ({
        zone,
        fee: zone === "Karen" || zone === "Ruaka" || zone === "Runda" ? 350 : 200,
      })),
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
    /* How this trip is settled. Most of the time the customer pays the boda
     * directly at the door and the seller never touches that money; sometimes
     * the seller charges it and settles with the rider; occasionally the rider
     * collects the goods money too and remits it later. */
    const settlement: DeliverySettlement =
      riderIdx === null
        ? "free"
        : i % 10 === 3 || i % 10 === 7
          ? "business_pays_rider"
          : i % 17 === 5
            ? "rider_collects"
            : "customer_pays_rider";

    if (status !== "cancelled") {
      const cogs = items.reduce(
        (sum, [productIdx, qty]) => sum + productRows[productIdx][3] * qty,
        0,
      );
      cogsByDay.set(days, (cogsByDay.get(days) ?? 0) + cogs);
      // Only a fee the seller is actually paying is an expense of the business.
      if (riderIdx !== null && settlement === "business_pays_rider") {
        riderFeesByDay.set(days, (riderFeesByDay.get(days) ?? 0) + deliveryFee);
      }
    }
    const subtotal = orderItems.reduce((sum, it) => sum + it.price * it.qty, 0);
    const collectsFee = settlement === "business_pays_rider" || settlement === "rider_collects";
    // What lands in the seller's account, which is what a payment record is for.
    const total = subtotal + (collectsFee ? deliveryFee : 0);

    orders.push({
      id: orderId,
      code: `#${code}`,
      customerId: customer.id,
      items: orderItems,
      deliveryFee,
      deliverySettlement: settlement,
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
      // A rider who collected on the seller's behalf owes that money until they
      // remit it. The most recent few have not settled up yet, which is exactly
      // the float a seller loses track of.
      const collecting = settlement === "rider_collects" && delivered;
      const remitted = collecting && days > 2;
      deliveries.push({
        id: `dlv_${code}`,
        orderId,
        riderId: riders[riderIdx].id,
        status: delivered
          ? "delivered"
          : status === "out_for_delivery"
            ? i % 6 === 1
              ? "awaiting_payment"
              : "in_transit"
            : "assigned",
        fee: deliveryFee,
        settlement,
        address: `${customer.location}, Nairobi`,
        assignedAt: at(days, hour, ((i * 7) % 60) + 10),
        deliveredAt: delivered ? at(days, hour + 2, (i * 7) % 60) : undefined,
        paymentConfirmedAt: delivered ? at(days, hour + 2, ((i * 7) % 60) - 4) : undefined,
        cashCollected: collecting ? subtotal + deliveryFee : undefined,
        remittedAt: remitted ? at(days - 1, 9, 15) : undefined,
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

  // A seller who bakes needs costing to the gram, not a flat "cost price".
  const ingredients: Ingredient[] = [
    ["Plain flour", "kg", 145, 48, 10, "Gikomba Millers"],
    ["Caster sugar", "kg", 190, 26, 6, "Gikomba Millers"],
    ["Butter", "kg", 980, 9, 3, "Brookside"],
    ["Eggs", "piece", 22, 240, 60, "Kienyeji Farm"],
    ["Fresh milk", "l", 78, 34, 8, "Brookside"],
    ["Baking powder", "kg", 620, 3, 1, "Gikomba Millers"],
    ["Vanilla essence", "l", 2400, 1.4, 0.5, "Chandarana"],
    ["Cocoa powder", "kg", 1350, 4.5, 1, "Chandarana"],
    ["Icing sugar", "kg", 260, 12, 4, "Gikomba Millers"],
    ["Cooking oil", "l", 320, 18, 5, "Bidco"],
    ["Cake box", "piece", 45, 120, 40, "Biashara Packaging"],
    ["Cake board", "piece", 30, 150, 50, "Biashara Packaging"],
    ["Thread and notions", "kg", 3200, 1.8, 0.5, "Biashara Fabrics"],
    ["Zips and fastenings", "piece", 90, 64, 20, "Biashara Fabrics"],
    ["Lining and fabric", "kg", 1450, 22, 6, "Gikomba Fabrics"],
  ].map(([name, unit, costPerUnit, stock, lowStockAt, supplier], i) => ({
    id: `ing_${i + 1}`,
    name: name as string,
    unit: unit as Ingredient["unit"],
    costPerUnit: costPerUnit as number,
    stock: stock as number,
    lowStockAt: lowStockAt as number,
    supplier: supplier as string,
  }));

  // Bills of materials for the products that are actually produced. Wastage is
  // on the lines where trim and spillage are real.
  const recipes: Record<string, RecipeLine[]> = {
    prd_13: [
      { ingredientId: "ing_1", qty: 400, unit: "g" },
      { ingredientId: "ing_2", qty: 320, unit: "g" },
      { ingredientId: "ing_3", qty: 250, unit: "g", wastagePercent: 4 },
      { ingredientId: "ing_4", qty: 6, unit: "piece" },
      { ingredientId: "ing_5", qty: 180, unit: "ml" },
      { ingredientId: "ing_6", qty: 12, unit: "g" },
      { ingredientId: "ing_7", qty: 8, unit: "ml" },
      { ingredientId: "ing_9", qty: 180, unit: "g", wastagePercent: 8 },
      { ingredientId: "ing_11", qty: 1, unit: "piece" },
      { ingredientId: "ing_12", qty: 1, unit: "piece" },
    ],
    prd_14: [
      { ingredientId: "ing_1", qty: 380, unit: "g" },
      { ingredientId: "ing_2", qty: 300, unit: "g" },
      { ingredientId: "ing_3", qty: 220, unit: "g", wastagePercent: 4 },
      { ingredientId: "ing_4", qty: 5, unit: "piece" },
      { ingredientId: "ing_5", qty: 200, unit: "ml" },
      { ingredientId: "ing_8", qty: 90, unit: "g", wastagePercent: 5 },
      { ingredientId: "ing_6", qty: 10, unit: "g" },
      { ingredientId: "ing_9", qty: 160, unit: "g", wastagePercent: 8 },
      { ingredientId: "ing_11", qty: 1, unit: "piece" },
      { ingredientId: "ing_12", qty: 1, unit: "piece" },
    ],
    prd_15: [
      { ingredientId: "ing_1", qty: 120, unit: "g" },
      { ingredientId: "ing_2", qty: 70, unit: "g" },
      { ingredientId: "ing_4", qty: 1, unit: "piece" },
      { ingredientId: "ing_5", qty: 60, unit: "ml" },
      { ingredientId: "ing_10", qty: 25, unit: "ml", wastagePercent: 12 },
    ],
  };

  const storefront: Storefront = {
    slug: "zawadi-collection",
    template: "spotlight",
    palette: "lime",
    headline: "Zawadi Collection",
    tagline: "Ankara, linen and everyday pieces, made in Nairobi.",
    about:
      "We started on Instagram in 2023 with one wrap dress and a lot of hope. Everything is cut and finished in Nairobi, and we deliver across the city the same day.",
    whatsapp: "254722000145",
    instagram: "zawadi.collection",
    tiktok: "zawadicollection",
    location: "Nairobi, Kenya",
    deliveryNote: "Same-day delivery in Nairobi from KES 200. Countrywide by courier.",
    featuredProductId: "prd_1",
    hiddenProductIds: [],
    showPrices: true,
    published: true,
  };

  // Three produced lines, so the costing screen has something real to chew on.
  products.push(
    {
      id: "prd_13",
      name: "Vanilla Celebration Cake",
      sku: "ZC-CK-13",
      price: 3500,
      cost: 0,
      stock: 6,
      lowStockAt: 2,
      category: "Bakery",
      swatch: "#d97706",
      emoji: "🎂",
      active: true,
      stockMode: "recipe",
      recipe: recipes.prd_13,
    },
    {
      id: "prd_14",
      name: "Chocolate Fudge Cake",
      sku: "ZC-CK-14",
      price: 4200,
      cost: 0,
      stock: 4,
      lowStockAt: 2,
      category: "Bakery",
      swatch: "#7c2d12",
      emoji: "🍫",
      active: true,
      stockMode: "recipe",
      recipe: recipes.prd_14,
    },
    {
      id: "prd_15",
      name: "Mandazi (6 pack)",
      sku: "ZC-MD-15",
      price: 250,
      cost: 0,
      stock: 30,
      lowStockAt: 10,
      category: "Bakery",
      swatch: "#b45309",
      emoji: "🥯",
      active: true,
      stockMode: "recipe",
      recipe: recipes.prd_15,
    },
  );

  /* Goods bought as a lot.
   *
   * A thrift trader buys a bale for one price, pays to get it here, opens it,
   * and finds three grades inside that sell for very different money. Splitting
   * the landed cost evenly across the pieces would say a Grade C top cost the
   * same as a Grade A dress, which is not true of anything except the scale. So
   * the cost is allocated by relative sales value, the way joint costs are. */
  const lots: Lot[] = [
    {
      id: "lot_1",
      reference: "BALE-014",
      name: "Mixed ladies' dresses — 45 kg bale",
      supplier: "Gikomba Bale Traders",
      purchasedAt: at(23, 8, 30),
      purchasePrice: 38000,
      extraCosts: [
        { label: "Transport from Gikomba", amount: 1800 },
        { label: "Sorting and pressing", amount: 2200 },
        { label: "Mending", amount: 900 },
      ],
      allocation: "by_value",
      openedAt: at(22, 10, 0),
      grades: [
        { id: "grd_1a", label: "Grade A — shop floor", productId: "prd_16", units: 28, unitPrice: 2200, sold: 19 },
        { id: "grd_1b", label: "Grade B — needs pressing", productId: "prd_17", units: 41, unitPrice: 1100, sold: 30 },
        { id: "grd_1c", label: "Grade C — sold by weight", productId: "prd_18", units: 36, unitPrice: 400, sold: 31 },
      ],
      note: "Fourteenth bale from this supplier. Grade A share is holding up.",
    },
    {
      id: "lot_2",
      reference: "CTN-007",
      name: "Shea butter 250ml — carton of 48",
      supplier: "Nakuru Naturals",
      purchasedAt: at(9, 11, 15),
      purchasePrice: 21600,
      extraCosts: [{ label: "Courier", amount: 1200 }],
      // One product, one price: an even split is the honest answer here.
      allocation: "even",
      openedAt: at(9, 16, 0),
      grades: [{ id: "grd_2a", label: "Shea Butter Cream 250ml", productId: "prd_5", units: 48, unitPrice: 1200, sold: 14 }],
    },
  ];

  products.push(
    {
      id: "prd_16",
      name: "Bale Grade A Dress",
      sku: "ZC-BL-16",
      price: 2200,
      cost: 0,
      stock: 9,
      lowStockAt: 4,
      category: "Thrift",
      swatch: "#9d174d",
      emoji: "👚",
      active: true,
      stockMode: "lot",
      lotId: "lot_1",
      gradeId: "grd_1a",
    },
    {
      id: "prd_17",
      name: "Bale Grade B Dress",
      sku: "ZC-BL-17",
      price: 1100,
      cost: 0,
      stock: 11,
      lowStockAt: 5,
      category: "Thrift",
      swatch: "#7e22ce",
      emoji: "👕",
      active: true,
      stockMode: "lot",
      lotId: "lot_1",
      gradeId: "grd_1b",
    },
    {
      id: "prd_18",
      name: "Bale Grade C Bundle",
      sku: "ZC-BL-18",
      price: 400,
      cost: 0,
      stock: 5,
      lowStockAt: 5,
      category: "Thrift",
      swatch: "#0e7490",
      emoji: "🧺",
      active: true,
      stockMode: "lot",
      lotId: "lot_1",
      gradeId: "grd_1c",
    },
    /* Electronics, where the unit is the thing that matters: a phone shop does
     * not have "four power banks", it has four specific power banks, each with
     * its own IMEI or serial and its own warranty clock. */
    {
      id: "prd_19",
      name: "20,000 mAh Power Bank",
      sku: "ZC-EL-19",
      price: 3400,
      cost: 2050,
      stock: 0,
      lowStockAt: 2,
      category: "Electronics",
      swatch: "#1e293b",
      emoji: "🔋",
      active: true,
      stockMode: "serial",
      warrantyMonths: 6,
    },
    {
      id: "prd_20",
      name: "Wireless Earbuds Pro",
      sku: "ZC-EL-20",
      price: 4800,
      cost: 2900,
      stock: 0,
      lowStockAt: 2,
      category: "Electronics",
      swatch: "#334155",
      emoji: "🎧",
      active: true,
      stockMode: "serial",
      warrantyMonths: 12,
    },
  );

  // Each unit, individually. Stock is the count of these, never a typed number.
  const serials: SerialUnit[] = [
    ["prd_19", "PB20K-4471028", 2050, "in_stock", 12],
    ["prd_19", "PB20K-4471035", 2050, "in_stock", 12],
    ["prd_19", "PB20K-4471042", 2050, "sold", 26],
    ["prd_19", "PB20K-4471059", 2100, "sold", 18],
    ["prd_19", "PB20K-4471066", 2100, "faulty", 20],
    ["prd_20", "EBP-88213004", 2900, "in_stock", 8],
    ["prd_20", "EBP-88213011", 2900, "in_stock", 8],
    ["prd_20", "EBP-88213028", 2900, "sold", 15],
    ["prd_20", "EBP-88213035", 2950, "sold", 31],
    ["prd_20", "EBP-88213042", 2950, "returned", 24],
  ].map(([productId, serial, cost, status, days], i) => ({
    id: `srl_${i + 1}`,
    productId: productId as string,
    serial: serial as string,
    cost: cost as number,
    status: status as SerialUnit["status"],
    receivedAt: at(days as number, 10, 0),
    soldAt: status === "sold" ? at((days as number) - 6, 14, 30) : undefined,
    warrantyMonths: productId === "prd_19" ? 6 : 12,
    note:
      status === "faulty"
        ? "Will not hold charge past 40%. Held for the supplier."
        : status === "returned"
          ? "Customer returned it within the week. Resealed and back on the shelf."
          : undefined,
  }));

  /* The workroom.
   *
   * Almost every clothes seller in Nairobi also takes in alterations, and a
   * good number do custom pieces. It is not a sideline: it is often the better
   * margin, because the customer is paying for skill rather than for stock. It
   * also has nothing to do with shelves — what limits it is how many hours
   * Mercy and Alice have between them this week. */
  const staff: StaffMember[] = [
    {
      id: "stf_1",
      name: "Mercy Auma",
      phone: "0721 445 908",
      role: "Head tailor",
      // What an hour of her time costs the business, not what she is worth.
      hourlyCost: 520,
      workingDays: [1, 2, 3, 4, 5, 6],
      startHour: 9,
      endHour: 18,
      active: true,
    },
    {
      id: "stf_2",
      name: "Alice Nyambura",
      phone: "0733 210 774",
      role: "Tailor and finisher",
      hourlyCost: 380,
      workingDays: [1, 2, 3, 4, 5],
      startHour: 9,
      endHour: 17,
      active: true,
    },
    {
      id: "stf_3",
      name: "Louis Wandago",
      phone: "0722 000 145",
      role: "Styling and fittings",
      hourlyCost: 600,
      workingDays: [2, 4, 6],
      startHour: 10,
      endHour: 16,
      active: true,
    },
  ];

  const services: Service[] = [
    {
      id: "svc_1",
      name: "Hem and take in",
      durationMinutes: 45,
      bufferMinutes: 10,
      price: 800,
      priceMode: "fixed",
      category: "Alterations",
      staffIds: ["stf_1", "stf_2"],
      materials: [{ ingredientId: "ing_13", qty: 40, unit: "g" }],
      swatch: "#0f766e",
      emoji: "✂️",
      active: true,
    },
    {
      id: "svc_2",
      name: "Zip or lining replacement",
      durationMinutes: 60,
      bufferMinutes: 10,
      price: 1200,
      priceMode: "fixed",
      category: "Alterations",
      staffIds: ["stf_1", "stf_2"],
      materials: [
        { ingredientId: "ing_13", qty: 30, unit: "g" },
        { ingredientId: "ing_14", qty: 1, unit: "piece" },
      ],
      swatch: "#7c3aed",
      emoji: "🧵",
      active: true,
    },
    {
      id: "svc_3",
      name: "Custom dress — made to measure",
      durationMinutes: 300,
      bufferMinutes: 30,
      price: 7800,
      priceMode: "fixed",
      category: "Bespoke",
      staffIds: ["stf_1"],
      materials: [
        { ingredientId: "ing_15", qty: 3.2, unit: "kg", wastagePercent: 8 },
        { ingredientId: "ing_13", qty: 180, unit: "g" },
        { ingredientId: "ing_14", qty: 1, unit: "piece" },
      ],
      swatch: "#be123c",
      emoji: "👗",
      active: true,
      depositPercent: 50,
    },
    {
      id: "svc_4",
      name: "Bridal fitting session",
      durationMinutes: 120,
      bufferMinutes: 20,
      price: 4500,
      priceMode: "fixed",
      category: "Bespoke",
      staffIds: ["stf_1", "stf_3"],
      swatch: "#a16207",
      emoji: "💍",
      active: true,
      depositPercent: 40,
    },
    {
      id: "svc_5",
      name: "Personal styling hour",
      durationMinutes: 60,
      price: 3000,
      priceMode: "hourly",
      category: "Styling",
      staffIds: ["stf_3"],
      swatch: "#1d4ed8",
      emoji: "🪞",
      active: true,
    },
    {
      id: "svc_6",
      name: "Wardrobe edit at your place",
      durationMinutes: 180,
      bufferMinutes: 45,
      price: 9000,
      priceMode: "quote",
      category: "Styling",
      staffIds: ["stf_3"],
      swatch: "#0891b2",
      emoji: "🏠",
      active: true,
      depositPercent: 30,
    },
  ];

  /* The diary.
   *
   * Bookings are orders, so they carry payments and land in the ledger exactly
   * like a dress does. What makes one a booking is that it has a time and a
   * person attached — and an hour that goes unbooked is gone, which is the
   * whole reason a service business needs a different screen. */
  const bookingPlan: [number, number, number, string, string, BookingState, number | null][] = [
    // days ago, hour, minute, serviceId, staffId, state, deposit paid (null = none due)
    [26, 10, 0, "svc_1", "stf_2", "done", null],
    [26, 14, 30, "svc_3", "stf_1", "done", 4250],
    [24, 9, 30, "svc_2", "stf_1", "done", null],
    [24, 11, 0, "svc_1", "stf_2", "done", null],
    [23, 10, 0, "svc_5", "stf_3", "done", null],
    [22, 9, 0, "svc_3", "stf_1", "done", 4250],
    [21, 15, 0, "svc_4", "stf_3", "done", 1800],
    [19, 10, 30, "svc_1", "stf_2", "done", null],
    [19, 13, 0, "svc_2", "stf_2", "done", null],
    [18, 9, 0, "svc_6", "stf_3", "done", 2700],
    [17, 11, 0, "svc_1", "stf_1", "done", null],
    [16, 10, 0, "svc_3", "stf_1", "done", 4250],
    [15, 14, 0, "svc_5", "stf_3", "done", null],
    [14, 9, 30, "svc_2", "stf_2", "done", null],
    [12, 10, 0, "svc_4", "stf_1", "done", 1800],
    [12, 15, 0, "svc_1", "stf_2", "done", null],
    [11, 9, 0, "svc_3", "stf_1", "done", 4250],
    [10, 11, 30, "svc_1", "stf_2", "done", null],
    [9, 10, 0, "svc_5", "stf_3", "done", null],
    [8, 9, 0, "svc_2", "stf_1", "done", null],
    [8, 14, 0, "svc_1", "stf_2", "no_show", null],
    [7, 10, 0, "svc_6", "stf_3", "done", 2700],
    [5, 9, 30, "svc_3", "stf_1", "done", 4250],
    [4, 11, 0, "svc_1", "stf_2", "done", null],
    [3, 10, 0, "svc_4", "stf_3", "done", 1800],
    [2, 9, 0, "svc_2", "stf_2", "done", null],
    [1, 10, 30, "svc_1", "stf_1", "done", null],
    // Today and ahead: this is what the diary screen is actually for.
    [0, 9, 0, "svc_1", "stf_2", "done", null],
    [0, 10, 30, "svc_3", "stf_1", "in_progress", 4250],
    [0, 14, 0, "svc_2", "stf_2", "booked", null],
    [0, 16, 0, "svc_5", "stf_3", "booked", null],
    [-1, 9, 30, "svc_4", "stf_1", "booked", 1800],
    [-1, 13, 0, "svc_1", "stf_2", "booked", null],
    // Held without the deposit that was meant to hold it.
    [-2, 10, 0, "svc_3", "stf_1", "booked", null],
    [-2, 15, 0, "svc_6", "stf_3", "enquiry", null],
    [-4, 11, 0, "svc_4", "stf_3", "booked", 1800],
  ];

  /* Nobody books a fitting on a day the tailor is not in. Snap each slot onto
   * the nearest day that person actually works — backwards for what has
   * already happened, forwards for what is still to come. */
  const onWorkingDay = (days: number, hour: number, minute: number, staffId: string) => {
    const person = staff.find((p) => p.id === staffId)!;
    const step = days > 0 ? 1 : -1;
    for (let shift = 0; shift < 7; shift++) {
      const candidate = new Date();
      candidate.setDate(candidate.getDate() - (days + shift * step));
      candidate.setHours(hour, minute, 0, 0);
      if (person.workingDays.includes(candidate.getDay())) return candidate.toISOString();
    }
    return at(days, hour, minute);
  };

  bookingPlan.forEach((row, i) => {
    const [days, hour, minute, serviceId, staffId, state, depositPaid] = row;
    const service = services.find((sv) => sv.id === serviceId)!;
    const customer = customers[(i * 5 + 3) % customers.length];
    const code = 12400 + i;
    const orderId = `ord_${code}`;
    const startsAt = onWorkingDay(days, hour, minute, staffId);
    const deposit = service.depositPercent
      ? Math.round((service.price * service.depositPercent) / 100 / 50) * 50
      : 0;
    const finished = state === "done";
    // A wardrobe edit happens at the customer's place; everything else here.
    const place = serviceId === "svc_6" ? "at_them" : "at_us";

    const booking: Booking = {
      serviceId,
      staffId,
      startsAt,
      durationMinutes: service.durationMinutes,
      state,
      place,
      deposit: deposit || undefined,
      depositPaidAt: depositPaid ? at(days + 3, 12, 0) : undefined,
      startedAt: finished || state === "in_progress" ? startsAt : undefined,
      finishedAt: finished
        ? new Date(+new Date(startsAt) + service.durationMinutes * 60000).toISOString()
        : undefined,
    };

    const paymentStatus =
      state === "done" ? "paid" : depositPaid ? "partial" : "unpaid";

    orders.push({
      id: orderId,
      code: `#${code}`,
      customerId: customer.id,
      items: [{ productId: serviceId, name: service.name, qty: 1, price: service.price }],
      deliveryFee: 0,
      // Nobody rides anywhere for a fitting in the shop.
      deliverySettlement: "free",
      discount: 0,
      status: finished ? "delivered" : state === "cancelled" ? "cancelled" : "confirmed",
      paymentStatus,
      channel: customer.channel,
      address: place === "at_them" ? `${customer.location}, Nairobi` : "At the shop",
      booking,
      createdAt: at(days + 4, 9, 0),
    });

    if (state === "done") {
      payments.push({
        id: `pay_${code}`,
        orderId,
        customerId: customer.id,
        customerName: customer.name,
        method: i % 7 === 3 ? "cash" : "mpesa",
        amount: service.price,
        reference: i % 7 === 3 ? "" : mpesaRef(code),
        state: "received",
        receivedAt: booking.finishedAt ?? startsAt,
        matched: true,
        source: "mpesa",
      });

      ledger.unshift({
        id: `led_svc_${code}`,
        date: booking.finishedAt ?? startsAt,
        type: "income",
        category: "Services",
        description: `${service.name} — ${customer.name}`,
        amount: service.price,
        source: "order",
        reference: `#${code}`,
        reconciled: true,
      });
    }
  });

  // Serialised stock is derived, never typed: it is the count of units on hand.
  products.forEach((product) => {
    if (product.stockMode !== "serial") return;
    product.stock = serials.filter(
      (unit) => unit.productId === product.id && unit.status === "in_stock",
    ).length;
  });

  return {
    version: DB_VERSION,
    storefront,
    ingredients,
    services,
    staff,
    lots,
    serials,
    imports: [],
    business: {
      name: "Zawadi Collection",
      owner: "Louis Wandago",
      phone: "0722 000 145",
      tillNumber: "5240119",
      location: "Nairobi, Kenya",
      currency: "KES",
      defaultDeliveryFee: 200,
      type: "fashion",
      // The usual arrangement: the boda is paid by the customer at the door.
      defaultSettlement: "customer_pays_rider",
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

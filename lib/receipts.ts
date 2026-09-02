import type { Business, Customer, Database, Order, Payment, PaymentMethod } from "./types";
import { customerPays, goodsTotal, orderSubtotal, riderOwed, settlementOf } from "./selectors";
import { fullDate, clockTime, money } from "./format";

/**
 * Receipts.
 *
 * A receipt is a claim: this money reached this business. The question that
 * shapes every decision below is what makes that claim worth anything to the
 * person holding it.
 *
 * The answer, in Kenya, is already in their pocket. An M-Pesa payment produces
 * a confirmation code, sent by Safaricom to both phones, unique across the
 * whole network. A receipt quoting that code can be checked in seconds against
 * a message the customer already has, from a party neither of us controls.
 * That is real verification, and it costs nothing to offer.
 *
 * So: where a transaction code exists, it *is* the receipt number, and the
 * receipt tells the customer exactly what to compare it against. Where one does
 * not exist — cash across a counter — the receipt says plainly that it is the
 * seller's own record and nothing more. It never dresses a cash sale up in a
 * reference number designed to look like a bank's.
 *
 * The alternative, minting an official-looking code for every sale, would make
 * every receipt look equally trustworthy while making none of them checkable.
 * That is worse than useless: it teaches customers that a code means nothing.
 */

/* ------------------------------------------------------------------ *
 * What can be checked, and what cannot
 * ------------------------------------------------------------------ */

/**
 * The shape of an M-Pesa confirmation code.
 *
 * Ten characters, letters and digits, starting with a letter — TFA4K21LMN.
 * Checked rather than assumed, because a "reference" typed into the app by hand
 * might be an order number, a nickname or a note, and quoting that back as if
 * Safaricom had issued it would be exactly the lie this module exists to avoid.
 */
export function looksLikeMpesaCode(reference: string) {
  return /^[A-Z][A-Z0-9]{9}$/.test(reference.trim().toUpperCase());
}

export type ProofKind = "mpesa" | "bank" | "none";

export interface ReceiptProof {
  kind: ProofKind;
  /** The transaction code, when there is a real one. */
  code?: string;
  /** Whether the holder can verify this against a record we do not control. */
  checkable: boolean;
  /** What to tell them, in their words, not ours. */
  line: string;
}

function proofFor(payment: Payment, business: Business): ReceiptProof {
  const reference = (payment.reference ?? "").trim();

  if (payment.method === "mpesa" && looksLikeMpesaCode(reference)) {
    const code = reference.toUpperCase();
    const till = business.tillNumber ? ` to Till ${business.tillNumber}` : "";
    return {
      kind: "mpesa",
      code,
      checkable: true,
      line: `Check ${code} against the M-Pesa message on your phone. It should show ${money(payment.amount)}${till}.`,
    };
  }

  /* An M-Pesa payment whose reference is not a Safaricom code — typed from
   * memory, or a note where a code should be. Treated as unverifiable, because
   * telling someone to check a code that does not exist wastes their time and
   * costs us the one thing this feature is for. */
  if (payment.method === "mpesa") {
    return {
      kind: "none",
      code: reference || undefined,
      checkable: false,
      line: reference
        ? `Recorded as M-Pesa with reference ${reference}, which is not a Safaricom confirmation code. This is the seller's own record.`
        : "Recorded as M-Pesa without a confirmation code. This is the seller's own record.",
    };
  }

  if (payment.method === "bank" && reference) {
    return {
      kind: "bank",
      code: reference,
      checkable: true,
      line: `Check reference ${reference} against your bank statement for ${money(payment.amount)}.`,
    };
  }

  const how = payment.method === "cash" ? "Cash, handed over in person" : "Recorded by the seller";
  return {
    kind: "none",
    code: reference || undefined,
    checkable: false,
    line: `${how}. There is no transaction code to check this against — it is the seller's own record of the sale.`,
  };
}

/* ------------------------------------------------------------------ *
 * The receipt number
 * ------------------------------------------------------------------ */

/**
 * A stable number for a receipt with nothing to anchor it.
 *
 * Derived from the payment's id rather than counted, so reprinting a receipt
 * next year gives the same number as today, and importing an old statement does
 * not renumber everything issued since. Deliberately shaped so nobody mistakes
 * it for a Safaricom code: a prefix, a dash, eight characters.
 */
function derivedNumber(paymentId: string) {
  // FNV-1a. Not a security primitive and not used as one — it only has to be
  // deterministic and spread evenly enough that two payments do not collide.
  let hash = 0x811c9dc5;
  for (let i = 0; i < paymentId.length; i++) {
    hash ^= paymentId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // no I, L, O, U — misread on paper
  let out = "";
  let n = hash;
  for (let i = 0; i < 8; i++) {
    out += alphabet[n % 32];
    n = Math.floor(n / 32) + (i === 3 ? hash % 977 : 0);
  }
  return `SK-${out}`;
}

/* ------------------------------------------------------------------ *
 * The receipt
 * ------------------------------------------------------------------ */

export interface ReceiptLine {
  label: string;
  qty: number;
  unitPrice: number;
  total: number;
  /** What it was listed at, when the customer talked it down. */
  listPrice?: number;
}

export interface Receipt {
  /** The transaction code where there is one, otherwise a derived number. */
  number: string;
  /** True when `number` is the transaction code itself. */
  numberIsTransactionCode: boolean;
  issuedAt: string;
  paidAt: string;
  business: Business;
  payerName: string;
  payerPhone?: string;
  orderCode?: string;
  lines: ReceiptLine[];
  goods: number;
  discount: number;
  /** Only when the business actually charged it. */
  deliveryCharged: number;
  /** Paid straight to the rider at the door, and therefore not receipted here. */
  riderPaidSeparately: number;
  /**
   * What came off the asking price.
   *
   * Shown because the customer negotiated it and will want to see it, and
   * because a receipt quietly dropping the number invites the question of
   * whether the right price was charged at all.
   */
  bargained: number;
  /** What this receipt is for: money that reached the business. */
  total: number;
  paid: number;
  balance: number;
  method: PaymentMethod;
  proof: ReceiptProof;
}

const methodLabel: Record<PaymentMethod, string> = {
  mpesa: "M-Pesa",
  cash: "Cash",
  bank: "Bank transfer",
  card: "Card",
};

export function methodName(method: PaymentMethod) {
  return methodLabel[method];
}

/**
 * Whether this payment can be receipted at all.
 *
 * Money that has not arrived does not get a receipt. A pending STK push and a
 * failed transfer are both states where a piece of paper saying "received"
 * would be false — and a customer who has one will reasonably expect their
 * goods.
 */
export function receiptable(payment: Payment) {
  return payment.state === "received";
}

export function buildReceipt(db: Database, payment: Payment): Receipt {
  const order = payment.orderId ? db.orders.find((o) => o.id === payment.orderId) : undefined;
  const customer: Customer | undefined = payment.customerId
    ? db.customers.find((c) => c.id === payment.customerId)
    : undefined;

  const lines: ReceiptLine[] = order
    ? order.items.map((item) => ({
        label: item.name,
        qty: item.qty,
        unitPrice: item.price,
        total: item.price * item.qty,
        ...(item.listPrice !== undefined && item.listPrice > item.price
          ? { listPrice: item.listPrice }
          : {}),
      }))
    : [];

  /* With no order behind it, the payment is the whole story: one line for the
   * amount, rather than a blank table implying items nobody recorded. */
  if (!lines.length) {
    lines.push({
      label: order ? "Order total" : "Payment received",
      qty: 1,
      unitPrice: payment.amount,
      total: payment.amount,
    });
  }

  const goods = order ? orderSubtotal(order) : payment.amount;
  const discount = order?.discount ?? 0;

  /* The delivery fee only belongs on this receipt when the business is the one
   * charging it. Where an independent boda is paid at the door — the ordinary
   * arrangement — that money never touched the business, and receipting it
   * would be the seller signing for cash they never held. It is shown, clearly
   * marked, so the customer's total still adds up to what they spent. */
  const settlement = order ? settlementOf(order) : "customer_pays_rider";
  const businessCharges =
    order && (settlement === "business_pays_rider" || settlement === "rider_collects");
  const deliveryCharged = businessCharges ? order.deliveryFee : 0;
  const riderPaidSeparately =
    order && settlement === "customer_pays_rider" ? order.deliveryFee : 0;

  const total = order ? goodsTotal(order) + deliveryCharged : payment.amount;
  const paid = payment.amount;

  const bargained = lines.reduce(
    (sum, line) => sum + (line.listPrice ? (line.listPrice - line.unitPrice) * line.qty : 0),
    0,
  );

  const proof = proofFor(payment, db.business);
  const code = proof.checkable ? proof.code : undefined;

  return {
    number: code ?? derivedNumber(payment.id),
    numberIsTransactionCode: Boolean(code),
    issuedAt: new Date().toISOString(),
    paidAt: payment.receivedAt,
    business: db.business,
    payerName: customer?.name ?? payment.customerName,
    payerPhone: customer?.phone,
    orderCode: order?.code,
    lines,
    goods,
    discount,
    deliveryCharged,
    riderPaidSeparately,
    bargained,
    total,
    paid,
    balance: Math.max(0, total - paid),
    method: payment.method,
    proof,
  };
}

/* ------------------------------------------------------------------ *
 * Sending it
 * ------------------------------------------------------------------ */

/**
 * The receipt as a WhatsApp message.
 *
 * Plain text, because that is what actually arrives: an image gets compressed,
 * saved to a gallery and lost, while text is searchable in the chat two months
 * later when somebody is looking for exactly this transaction code.
 */
export function receiptText(receipt: Receipt) {
  const rows = receipt.lines.map((line) =>
    line.qty > 1
      ? `${line.qty} × ${line.label} — ${money(line.total)}`
      : `${line.label} — ${money(line.total)}`,
  );

  const parts = [
    `*${receipt.business.name}*`,
    `Receipt ${receipt.number}`,
    `${fullDate(receipt.paidAt)}, ${clockTime(receipt.paidAt)}`,
    "",
    ...rows,
  ];

  if (receipt.bargained > 0) parts.push(`You saved — ${money(receipt.bargained)}`);
  if (receipt.discount > 0) parts.push(`Discount — ${money(-receipt.discount)}`);
  if (receipt.deliveryCharged > 0) parts.push(`Delivery — ${money(receipt.deliveryCharged)}`);

  parts.push("", `*Paid: ${money(receipt.paid)}* (${methodLabel[receipt.method]})`);
  if (receipt.balance > 0) parts.push(`Balance still due: ${money(receipt.balance)}`);
  if (receipt.riderPaidSeparately > 0) {
    parts.push(
      `Delivery ${money(receipt.riderPaidSeparately)} paid directly to the rider — not included above.`,
    );
  }

  parts.push("", receipt.proof.line);
  if (receipt.business.phone) parts.push("", `Questions: ${receipt.business.phone}`);

  return parts.join("\n");
}

/** What the customer actually spent, receipted portion and boda fare together. */
export function totalSpent(receipt: Receipt) {
  return receipt.total + receipt.riderPaidSeparately;
}

/** Every payment that can be receipted, newest first. */
export function receiptablePayments(db: Database) {
  return db.payments
    .filter(receiptable)
    .sort((a, b) => +new Date(b.receivedAt) - +new Date(a.receivedAt));
}

/** The order a receipt belongs to, for screens that start from the order. */
export function receiptsForOrder(db: Database, order: Order) {
  return db.payments.filter((p) => p.orderId === order.id && receiptable(p));
}

/** What the customer owes after everything receipted so far. */
export function outstandingOn(db: Database, order: Order) {
  const paid = receiptsForOrder(db, order).reduce((sum, p) => sum + p.amount, 0);
  return Math.max(0, customerPays(order) - riderOwed(order) - paid);
}

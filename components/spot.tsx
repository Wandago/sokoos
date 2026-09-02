/* Flat spot illustrations. Heavy outlines, two flat fills, a ground shadow —
 * the same construction across the set, so a card, an ad and the landing page
 * all read as one system. Every one draws inside a 200×200 box. */

/**
 * The surface the drawing sits on. Illustrations are never boxed in a white
 * panel — they draw straight onto the card, and their own palette flips so the
 * whole card stays one solid colour.
 */
export type SpotSurface = "forest" | "lime" | "cream" | "paper";

interface Palette {
  /** Outlines and detail. */
  ink: string;
  /** The filled accent that carries the eye. */
  accent: string;
  /**
   * A second accent, warmer than the first.
   *
   * One colour makes a drawing read as a diagram; two make it read as an
   * illustration. It is used sparingly — a bag, a coin, a bubble — so the
   * card still belongs to the brand rather than becoming a rainbow.
   */
  pop: string;
  /** Interior panels — screens, pages, wheels. */
  paper: string;
  /** The ground ellipse. */
  shadow: string;
  shadowOpacity: number;
}

const palettes: Record<SpotSurface, Palette> = {
  // Cream line art with lime fills, cut out of the forest card behind it.
  forest: {
    ink: "#EFF3E2",
    accent: "var(--lime-500)",
    pop: "var(--amber-500)",
    paper: "var(--forest-900)",
    shadow: "#EFF3E2",
    shadowOpacity: 0.14,
  },
  // On lime the outlines carry the weight and the fills stay light, so a
  // drawing never becomes a black mass on a bright card.
  lime: {
    ink: "var(--forest-950)",
    accent: "#ffffff",
    pop: "var(--amber-500)",
    paper: "#EAF6C7",
    shadow: "var(--forest-950)",
    shadowOpacity: 0.16,
  },
  cream: {
    ink: "var(--forest-950)",
    accent: "var(--lime-500)",
    pop: "var(--amber-500)",
    paper: "#ffffff",
    shadow: "var(--forest-950)",
    shadowOpacity: 0.1,
  },
  paper: {
    ink: "var(--forest-950)",
    accent: "var(--lime-500)",
    pop: "var(--amber-500)",
    paper: "#ffffff",
    shadow: "var(--forest-950)",
    shadowOpacity: 0.1,
  },
};

interface SpotProps {
  className?: string;
  /** Which card colour the drawing is sitting on. Defaults to a light one. */
  surface?: SpotSurface;
  /** Per-part overrides, for the rare case a card needs its own mix. */
  ink?: string;
  accent?: string;
  pop?: string;
  paper?: string;
}

function resolve({ surface = "paper", ink, accent, paper, pop }: SpotProps): Palette {
  const base = palettes[surface];
  return {
    ...base,
    ink: ink ?? base.ink,
    accent: accent ?? base.accent,
    pop: pop ?? base.pop,
    paper: paper ?? base.paper,
  };
}

function Frame({
  className,
  children,
  label,
  /** Nudges a composition so its ink, not its box, sits on the centre lines. */
  offsetX = 0,
  offsetY = 0,
}: {
  className?: string;
  children: React.ReactNode;
  label: string;
  offsetX?: number;
  offsetY?: number;
}) {
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label={label}>
      {offsetX || offsetY ? (
        <g transform={`translate(${offsetX} ${offsetY})`}>{children}</g>
      ) : (
        children
      )}
    </svg>
  );
}

/** A conversation turning into an order. */
export function SpotConversation(props: SpotProps) {
  const c = resolve(props);
  const { className } = props;
  return (
    <Frame className={className} label="A chat message becoming an order" offsetX={-21} offsetY={4}>
      <ellipse cx="100" cy="182" rx="58" ry="8" fill={c.shadow} opacity={c.shadowOpacity} />
      <rect x="54" y="46" width="84" height="130" rx="16" fill={c.accent} stroke={c.ink} strokeWidth="5" />
      <rect x="66" y="62" width="60" height="86" rx="8" fill={c.paper} stroke={c.ink} strokeWidth="4" />
      <rect x="74" y="72" width="30" height="9" rx="4.5" fill={c.ink} opacity="0.18" />
      <rect x="74" y="88" width="44" height="9" rx="4.5" fill={c.accent} stroke={c.ink} strokeWidth="2.5" />
      <rect x="74" y="104" width="24" height="9" rx="4.5" fill={c.ink} opacity="0.18" />
      <rect x="74" y="120" width="36" height="9" rx="4.5" fill={c.ink} opacity="0.18" />
      <circle cx="96" cy="162" r="5" fill={c.ink} />
      <rect x="112" y="16" width="76" height="52" rx="14" fill={c.paper} stroke={c.ink} strokeWidth="5" />
      <path d="M128 66 l4 16 12 -14 z" fill={c.paper} stroke={c.ink} strokeWidth="5" strokeLinejoin="round" />
      <circle cx="136" cy="42" r="4.5" fill={c.ink} />
      <circle cx="150" cy="42" r="4.5" fill={c.ink} />
      <circle cx="164" cy="42" r="4.5" fill={c.ink} />
    </Frame>
  );
}

/** A receipt read and filed. */
export function SpotCapture(props: SpotProps) {
  const c = resolve(props);
  const { className } = props;
  return (
    <Frame className={className} label="A receipt being read and filed" offsetX={-5} offsetY={-7}>
      <ellipse cx="100" cy="184" rx="56" ry="8" fill={c.shadow} opacity={c.shadowOpacity} />
      <path
        d="M52 34 h96 v128 l-12 -9 -12 9 -12 -9 -12 9 -12 -9 -12 9 -12 -9 -12 9 z"
        fill={c.paper}
        stroke={c.ink}
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <rect x="68" y="54" width="42" height="9" rx="4.5" fill={c.ink} opacity="0.2" />
      <rect x="68" y="72" width="64" height="9" rx="4.5" fill={c.ink} opacity="0.2" />
      <rect x="68" y="98" width="64" height="16" rx="8" fill={c.accent} stroke={c.ink} strokeWidth="3" />
      <rect x="68" y="126" width="34" height="9" rx="4.5" fill={c.ink} opacity="0.2" />
      {/* Scan brackets */}
      <path d="M30 62 v-16 a8 8 0 0 1 8 -8 h16" fill="none" stroke={c.ink} strokeWidth="5" strokeLinecap="round" />
      <path d="M170 138 v16 a8 8 0 0 1 -8 8 h-16" fill="none" stroke={c.ink} strokeWidth="5" strokeLinecap="round" />
      {/* Spark */}
      <path
        d="M160 30 c2 14 6 18 20 20 c-14 2 -18 6 -20 20 c-2 -14 -6 -18 -20 -20 c14 -2 18 -6 20 -20 z"
        fill={c.accent}
        stroke={c.ink}
        strokeWidth="4"
        strokeLinejoin="round"
      />
    </Frame>
  );
}

/** A rider on the way. */
export function SpotRider(props: SpotProps) {
  const c = resolve(props);
  const { className } = props;
  return (
    <Frame className={className} label="A rider carrying a delivery" offsetX={10} offsetY={-26}>
      <ellipse cx="100" cy="182" rx="66" ry="8" fill={c.shadow} opacity={c.shadowOpacity} />
      {/* Motion lines */}
      <path d="M16 92 h26 M10 112 h34 M20 132 h20" stroke={c.ink} strokeWidth="5" strokeLinecap="round" opacity="0.35" />
      {/* Box */}
      <rect x="52" y="72" width="52" height="46" rx="8" fill={c.accent} stroke={c.ink} strokeWidth="5" />
      <path d="M78 72 v46 M52 92 h52" stroke={c.ink} strokeWidth="4" />
      {/* Scooter body */}
      <path
        d="M64 148 h44 l14 -30 h20"
        fill="none"
        stroke={c.ink}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M132 118 h22 a6 6 0 0 1 6 6 v10" fill="none" stroke={c.ink} strokeWidth="6" strokeLinecap="round" />
      <rect x="104" y="104" width="34" height="14" rx="7" fill={c.paper} stroke={c.ink} strokeWidth="5" />
      <circle cx="58" cy="152" r="20" fill={c.paper} stroke={c.ink} strokeWidth="6" />
      <circle cx="150" cy="152" r="20" fill={c.paper} stroke={c.ink} strokeWidth="6" />
      <circle cx="58" cy="152" r="5" fill={c.ink} />
      <circle cx="150" cy="152" r="5" fill={c.ink} />
    </Frame>
  );
}

/** Money landing, matched. */
export function SpotPayment(props: SpotProps) {
  const c = resolve(props);
  const { className } = props;
  return (
    <Frame className={className} label="A payment arriving and matching an order" offsetY={-7}>
      <ellipse cx="100" cy="184" rx="58" ry="8" fill={c.shadow} opacity={c.shadowOpacity} />
      {/* Wallet */}
      <rect x="36" y="88" width="128" height="80" rx="16" fill={c.accent} stroke={c.ink} strokeWidth="5" />
      <path d="M36 112 h128" stroke={c.ink} strokeWidth="5" />
      <rect x="116" y="120" width="48" height="26" rx="13" fill={c.paper} stroke={c.ink} strokeWidth="5" />
      <circle cx="140" cy="133" r="5" fill={c.ink} />
      {/* Notes flying in */}
      <rect
        x="56"
        y="30"
        width="66"
        height="42"
        rx="8"
        fill={c.paper}
        stroke={c.ink}
        strokeWidth="5"
        transform="rotate(-12 89 51)"
      />
      <circle cx="89" cy="51" r="10" fill={c.accent} stroke={c.ink} strokeWidth="4" transform="rotate(-12 89 51)" />
      {/* Arrow down into the wallet */}
      <path
        d="M150 34 v34 M140 58 l10 12 10 -12"
        fill="none"
        stroke={c.ink}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Frame>
  );
}

/** Books that keep themselves. */
export function SpotLedger(props: SpotProps) {
  const c = resolve(props);
  const { className } = props;
  return (
    <Frame className={className} label="A ledger balancing itself" offsetY={-16}>
      <ellipse cx="100" cy="182" rx="60" ry="8" fill={c.shadow} opacity={c.shadowOpacity} />
      <path
        d="M24 52 h64 a12 12 0 0 1 12 12 v96 a12 12 0 0 0 -12 -12 h-64 z"
        fill={c.paper}
        stroke={c.ink}
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path
        d="M176 52 h-64 a12 12 0 0 0 -12 12 v96 a12 12 0 0 1 12 -12 h64 z"
        fill={c.accent}
        stroke={c.ink}
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path d="M38 76 h38 M38 96 h38 M38 116 h26" stroke={c.ink} strokeWidth="4.5" strokeLinecap="round" opacity="0.35" />
      <circle cx="140" cy="100" r="26" fill={c.paper} stroke={c.ink} strokeWidth="5" />
      <path
        d="M128 100 l9 10 16 -20"
        fill="none"
        stroke={c.ink}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Frame>
  );
}

/** The business, growing. */
export function SpotGrowth(props: SpotProps) {
  const c = resolve(props);
  const { className } = props;
  return (
    <Frame className={className} label="Business performance rising" offsetX={12} offsetY={-7}>
      <ellipse cx="100" cy="182" rx="62" ry="8" fill={c.shadow} opacity={c.shadowOpacity} />
      <rect x="30" y="118" width="30" height="52" rx="8" fill={c.paper} stroke={c.ink} strokeWidth="5" />
      <rect x="72" y="90" width="30" height="80" rx="8" fill={c.accent} stroke={c.ink} strokeWidth="5" />
      <rect x="114" y="62" width="30" height="108" rx="8" fill={c.paper} stroke={c.ink} strokeWidth="5" />
      <path
        d="M38 74 l32 -22 26 16 46 -34"
        fill="none"
        stroke={c.ink}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M126 32 h20 v20" fill="none" stroke={c.ink} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="70" cy="52" r="7" fill={c.accent} stroke={c.ink} strokeWidth="4" />
      <circle cx="96" cy="68" r="7" fill={c.accent} stroke={c.ink} strokeWidth="4" />
    </Frame>
  );
}

/** Everything in one place. */
export function SpotAllInOne(props: SpotProps) {
  const c = resolve(props);
  const { className } = props;
  return (
    <Frame className={className} label="Orders, payments and delivery in one place" offsetY={-7}>
      <ellipse cx="100" cy="184" rx="58" ry="8" fill={c.shadow} opacity={c.shadowOpacity} />
      <rect x="58" y="30" width="84" height="140" rx="18" fill={c.ink} />
      <rect x="66" y="42" width="68" height="112" rx="10" fill={c.accent} />
      <rect x="74" y="54" width="52" height="22" rx="8" fill={c.paper} stroke={c.ink} strokeWidth="3" />
      <rect x="74" y="84" width="24" height="24" rx="7" fill={c.paper} stroke={c.ink} strokeWidth="3" />
      <rect x="102" y="84" width="24" height="24" rx="7" fill={c.paper} stroke={c.ink} strokeWidth="3" />
      <rect x="74" y="116" width="52" height="10" rx="5" fill={c.paper} opacity="0.75" />
      <rect x="74" y="132" width="34" height="10" rx="5" fill={c.paper} opacity="0.75" />
      {/* Satellites: a chat, a coin, a box */}
      <rect x="8" y="52" width="44" height="34" rx="12" fill={c.paper} stroke={c.ink} strokeWidth="5" />
      <path d="M20 86 l3 12 9 -10 z" fill={c.paper} stroke={c.ink} strokeWidth="5" strokeLinejoin="round" />
      <circle cx="164" cy="66" r="24" fill={c.accent} stroke={c.ink} strokeWidth="5" />
      <path d="M156 66 h16 M164 58 v16" stroke={c.ink} strokeWidth="5" strokeLinecap="round" />
      <rect x="146" y="124" width="42" height="38" rx="8" fill={c.paper} stroke={c.ink} strokeWidth="5" />
      <path d="M167 124 v38 M146 143 h42" stroke={c.ink} strokeWidth="4" />
    </Frame>
  );
}

/* ------------------------------------------------------------------ *
 * The second set
 *
 * Drawn after the receipt work, in a slightly warmer register than the first
 * five: two accents rather than one, rounder shapes, and a bit of character in
 * each — a tick, a smile, a coin mid-air. The construction is identical, so
 * they mix with the originals on the same card without looking borrowed.
 * ------------------------------------------------------------------ */

/** A receipt with the code that makes it worth keeping. */
export function SpotReceipt(props: SpotProps) {
  const c = resolve(props);
  const { className } = props;
  return (
    <Frame className={className} label="A receipt carrying its transaction code" offsetY={-4}>
      <ellipse cx="100" cy="182" rx="52" ry="8" fill={c.shadow} opacity={c.shadowOpacity} />
      {/* The paper, with a torn foot — the shape everyone recognises. */}
      <path
        d="M52 26 h96 a6 6 0 0 1 6 6 v128 l-12 -8 -12 8 -12 -8 -12 8 -12 -8 -12 8 -12 -8 -12 8 V32 a6 6 0 0 1 6 -6 z"
        fill={c.paper}
        stroke={c.ink}
        strokeWidth="5"
        strokeLinejoin="round"
      />
      {/* The code block: the one thing on a receipt worth setting large. */}
      <rect x="66" y="44" width="68" height="26" rx="7" fill={c.accent} stroke={c.ink} strokeWidth="4" />
      <path d="M76 57 h12 M94 57 h10 M110 57 h14" stroke={c.ink} strokeWidth="4" strokeLinecap="round" />
      <path d="M68 88 h44 M68 104 h64 M68 120 h34" stroke={c.ink} strokeWidth="4.5" strokeLinecap="round" opacity="0.5" />
      <rect x="100" y="112" width="32" height="14" rx="7" fill={c.pop} stroke={c.ink} strokeWidth="3.5" />
      {/* Checked, by somebody who could check it. */}
      <circle cx="146" cy="140" r="26" fill={c.accent} stroke={c.ink} strokeWidth="5" />
      <path d="M134 140 l8 9 16 -18" stroke={c.ink} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Frame>
  );
}

/** A phone paying a till, and the money going straight past us. */
export function SpotTill(props: SpotProps) {
  const c = resolve(props);
  const { className } = props;
  return (
    <Frame className={className} label="A customer paying a till directly" offsetY={-2}>
      <ellipse cx="100" cy="180" rx="62" ry="8" fill={c.shadow} opacity={c.shadowOpacity} />
      {/* The phone in the customer's hand. */}
      <rect x="14" y="52" width="62" height="106" rx="15" fill={c.ink} />
      <rect x="21" y="62" width="48" height="82" rx="8" fill={c.paper} />
      <rect x="28" y="72" width="34" height="9" rx="4.5" fill={c.ink} opacity="0.2" />
      <rect x="28" y="88" width="24" height="9" rx="4.5" fill={c.ink} opacity="0.2" />
      <rect x="28" y="108" width="34" height="18" rx="9" fill={c.accent} stroke={c.ink} strokeWidth="3" />
      {/* The till it goes to — the seller's own, not ours. */}
      <rect x="120" y="66" width="66" height="80" rx="12" fill={c.accent} stroke={c.ink} strokeWidth="5" />
      <rect x="132" y="80" width="42" height="26" rx="6" fill={c.paper} stroke={c.ink} strokeWidth="4" />
      <path d="M140 92 h10 M158 92 h8" stroke={c.ink} strokeWidth="4" strokeLinecap="round" />
      <circle cx="140" cy="124" r="6" fill={c.ink} />
      <circle cx="158" cy="124" r="6" fill={c.ink} />
      {/* Coins in the air between them: the money never lands anywhere else. */}
      <circle cx="92" cy="48" r="14" fill={c.pop} stroke={c.ink} strokeWidth="4.5" />
      <circle cx="92" cy="48" r="6" fill="none" stroke={c.ink} strokeWidth="3" />
      <circle cx="120" cy="34" r="9" fill={c.pop} stroke={c.ink} strokeWidth="4" />
      <circle cx="120" cy="34" r="3.5" fill="none" stroke={c.ink} strokeWidth="2.5" />
    </Frame>
  );
}

/** Speaking a sale, in whichever language comes out. */
export function SpotVoice(props: SpotProps) {
  const c = resolve(props);
  const { className } = props;
  return (
    <Frame className={className} label="Logging a sale by speaking to the phone" offsetY={-4}>
      <ellipse cx="100" cy="180" rx="54" ry="8" fill={c.shadow} opacity={c.shadowOpacity} />
      {/* The mic. */}
      <rect x="80" y="34" width="40" height="72" rx="20" fill={c.accent} stroke={c.ink} strokeWidth="5" />
      <path d="M64 88 a36 36 0 0 0 72 0" stroke={c.ink} strokeWidth="5.5" strokeLinecap="round" fill="none" />
      <path d="M100 124 v22" stroke={c.ink} strokeWidth="5.5" strokeLinecap="round" />
      <path d="M80 150 h40" stroke={c.ink} strokeWidth="5.5" strokeLinecap="round" />
      {/* Sound, both sides: the two languages it listens for. */}
      <path d="M46 58 a30 30 0 0 0 0 40" stroke={c.ink} strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M28 46 a48 48 0 0 0 0 64" stroke={c.pop} strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M154 58 a30 30 0 0 1 0 40" stroke={c.ink} strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M172 46 a48 48 0 0 1 0 64" stroke={c.pop} strokeWidth="5" strokeLinecap="round" fill="none" />
    </Frame>
  );
}

/** The mini site, open to anybody with the link. */
export function SpotShopfront(props: SpotProps) {
  const c = resolve(props);
  const { className } = props;
  return (
    <Frame className={className} label="A mini site with the seller's products" offsetY={-6}>
      <ellipse cx="100" cy="180" rx="60" ry="8" fill={c.shadow} opacity={c.shadowOpacity} />
      {/* The awning — the one shape that says "shop" without a word. */}
      <path d="M30 60 h140 l-10 -28 h-120 z" fill={c.pop} stroke={c.ink} strokeWidth="5" strokeLinejoin="round" />
      <path d="M58 32 l-4 28 M86 32 l-2 28 M114 32 l2 28 M142 32 l4 28" stroke={c.ink} strokeWidth="4" />
      <rect x="36" y="60" width="128" height="106" rx="12" fill={c.paper} stroke={c.ink} strokeWidth="5" />
      {/* Three things for sale. */}
      <rect x="50" y="76" width="32" height="32" rx="8" fill={c.accent} stroke={c.ink} strokeWidth="4" />
      <rect x="90" y="76" width="32" height="32" rx="8" fill={c.accent} stroke={c.ink} strokeWidth="4" />
      <rect x="130" y="76" width="20" height="32" rx="8" fill={c.accent} stroke={c.ink} strokeWidth="4" opacity="0.55" />
      <path d="M50 126 h68 M50 142 h44" stroke={c.ink} strokeWidth="5" strokeLinecap="round" opacity="0.35" />
    </Frame>
  );
}

/** A bale, and what comes out of it. */
export function SpotBale(props: SpotProps) {
  const c = resolve(props);
  const { className } = props;
  return (
    <Frame className={className} label="A bale opened and priced by grade" offsetY={-2}>
      <ellipse cx="100" cy="178" rx="58" ry="8" fill={c.shadow} opacity={c.shadowOpacity} />

      {/* Folded cloth spilling over the top, so the bundle below reads as
          clothes rather than as a crate. */}
      <path d="M56 92 q10 -22 30 -18 q18 4 14 20 z" fill={c.paper} stroke={c.ink} strokeWidth="4.5" strokeLinejoin="round" />
      <path d="M104 92 q8 -30 30 -24 q20 6 14 26 z" fill={c.pop} stroke={c.ink} strokeWidth="4.5" strokeLinejoin="round" />

      {/* The bale itself: squat, softly bulging at the sides from being
          compressed, and held by two straps. The straps are the tell. */}
      <path
        d="M50 92 h100 q10 0 10 12 v48 q0 12 -12 12 H52 q-12 0 -12 -12 v-48 q0 -12 10 -12 z"
        fill={c.accent}
        stroke={c.ink}
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path d="M74 92 v72 M126 92 v72" stroke={c.ink} strokeWidth="6" />
      <path d="M42 122 h116" stroke={c.ink} strokeWidth="6" />

      {/* The label a mtumba bale arrives with — grade and weight. */}
      <rect x="84" y="132" width="32" height="20" rx="5" fill={c.paper} stroke={c.ink} strokeWidth="4" />
      <path d="M92 142 h16" stroke={c.ink} strokeWidth="3.5" strokeLinecap="round" />
    </Frame>
  );
}

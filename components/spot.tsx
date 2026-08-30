/* Flat spot illustrations. Heavy outlines, two flat fills, a ground shadow —
 * the same construction across the set, so a card, an ad and the landing page
 * all read as one system. Every one draws inside a 200×200 box. */

interface SpotProps {
  className?: string;
  /** Outline and detail colour. */
  ink?: string;
  /** The filled accent, usually lime. */
  accent?: string;
  /** Paper colour for panels sitting on a coloured card. */
  paper?: string;
}

const defaults = {
  ink: "var(--forest-950)",
  accent: "var(--lime-500)",
  paper: "#ffffff",
};

function Frame({
  className,
  children,
  label,
}: {
  className?: string;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label={label}>
      {children}
    </svg>
  );
}

/** A conversation turning into an order. */
export function SpotConversation({ className, ink, accent, paper }: SpotProps) {
  const c = { ...defaults, ink: ink ?? defaults.ink, accent: accent ?? defaults.accent, paper: paper ?? defaults.paper };
  return (
    <Frame className={className} label="A chat message becoming an order">
      <ellipse cx="100" cy="182" rx="58" ry="8" fill={c.ink} opacity="0.15" />
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
export function SpotCapture({ className, ink, accent, paper }: SpotProps) {
  const c = { ...defaults, ink: ink ?? defaults.ink, accent: accent ?? defaults.accent, paper: paper ?? defaults.paper };
  return (
    <Frame className={className} label="A receipt being read and filed">
      <ellipse cx="100" cy="184" rx="56" ry="8" fill={c.ink} opacity="0.15" />
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
export function SpotRider({ className, ink, accent, paper }: SpotProps) {
  const c = { ...defaults, ink: ink ?? defaults.ink, accent: accent ?? defaults.accent, paper: paper ?? defaults.paper };
  return (
    <Frame className={className} label="A rider carrying a delivery">
      <ellipse cx="100" cy="182" rx="66" ry="8" fill={c.ink} opacity="0.15" />
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
export function SpotPayment({ className, ink, accent, paper }: SpotProps) {
  const c = { ...defaults, ink: ink ?? defaults.ink, accent: accent ?? defaults.accent, paper: paper ?? defaults.paper };
  return (
    <Frame className={className} label="A payment arriving and matching an order">
      <ellipse cx="100" cy="184" rx="58" ry="8" fill={c.ink} opacity="0.15" />
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
export function SpotLedger({ className, ink, accent, paper }: SpotProps) {
  const c = { ...defaults, ink: ink ?? defaults.ink, accent: accent ?? defaults.accent, paper: paper ?? defaults.paper };
  return (
    <Frame className={className} label="A ledger balancing itself">
      <ellipse cx="100" cy="182" rx="60" ry="8" fill={c.ink} opacity="0.15" />
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
export function SpotGrowth({ className, ink, accent, paper }: SpotProps) {
  const c = { ...defaults, ink: ink ?? defaults.ink, accent: accent ?? defaults.accent, paper: paper ?? defaults.paper };
  return (
    <Frame className={className} label="Business performance rising">
      <ellipse cx="100" cy="182" rx="62" ry="8" fill={c.ink} opacity="0.15" />
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
export function SpotAllInOne({ className, ink, accent, paper }: SpotProps) {
  const c = { ...defaults, ink: ink ?? defaults.ink, accent: accent ?? defaults.accent, paper: paper ?? defaults.paper };
  return (
    <Frame className={className} label="Orders, payments and delivery in one place">
      <ellipse cx="100" cy="184" rx="58" ry="8" fill={c.ink} opacity="0.15" />
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

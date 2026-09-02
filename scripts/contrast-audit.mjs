/**
 * Contrast audit.
 *
 * Walks the built site in a real browser and measures the contrast of every
 * piece of text against what is actually behind it. Doing this in the browser
 * rather than against the token file is the whole point: half the surfaces in
 * this app are translucent — a panel at 35% white over lime, a chip at 12%
 * white over forest — and the colour a reader actually sees is the composite,
 * which only the browser knows.
 *
 * Ratios are WCAG 2.1. The bar is 4.5 for body text and 3.0 for large text
 * (24px, or 18.66px when bold), which is the line between "a bit low" and
 * "unreadable on a phone in Nairobi sunlight".
 *
 * Playwright is not a dependency of this project — it is a tool, not part of
 * what ships — so point NODE_PATH at wherever it is installed:
 *
 *   npm run build && npx serve out -l 4124
 *   NODE_PATH=/path/to/node_modules node scripts/contrast-audit.mjs
 */
const { chromium } = await import("playwright");

const BASE = process.argv[2] ?? "http://127.0.0.1:4124";

const ROUTES = [
  "/welcome/",
  "/landing/",
  "/",
  "/orders/",
  "/payments/",
  "/products/",
  "/pos/",
  "/cfo/",
  "/settings/",
  "/stock/",
  "/deliveries/",
];

const audit = () => {
  /* sRGB relative luminance, per WCAG. The gamma expansion is the part people
   * skip, and skipping it makes mid-tones look far safer than they are. */
  const channel = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const luminance = ([r, g, b]) =>
    0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  const ratio = (a, b) => {
    const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  };

  /* Colours are resolved by painting them, not by parsing them.
   *
   * Tailwind v4 emits oklab()/oklch(), and getComputedStyle hands those back
   * verbatim. A regex over rgba() silently returns null for them, the audit
   * treats the surface as transparent, and a white wordmark on a dark header
   * gets reported as white-on-white. Letting the canvas do the conversion
   * means every colour syntax the browser supports is handled by definition. */
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  const parse = (value) => {
    if (!value || value === "transparent" || value === "none") return null;
    ctx.clearRect(0, 0, 1, 1);
    // A sentinel first: an unparseable value leaves fillStyle untouched, and
    // this makes that case detectable instead of silently reusing the last one.
    ctx.fillStyle = "#ff00ff";
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    if (a === 0) return null;
    return { rgb: [r, g, b], a: a / 255 };
  };

  const over = (top, bottom) => [
    Math.round(top.rgb[0] * top.a + bottom[0] * (1 - top.a)),
    Math.round(top.rgb[1] * top.a + bottom[1] * (1 - top.a)),
    Math.round(top.rgb[2] * top.a + bottom[2] * (1 - top.a)),
  ];

  /** The colour actually behind an element, compositing every translucent
   *  ancestor down onto the page background. */
  const behind = (el) => {
    const stack = [];
    for (let node = el; node && node !== document.documentElement; node = node.parentElement) {
      const bg = parse(getComputedStyle(node).backgroundColor);
      if (bg && bg.a > 0) stack.push(bg);
    }
    const root = parse(getComputedStyle(document.body).backgroundColor) ?? { rgb: [255, 255, 255], a: 1 };
    let base = root.a >= 1 ? root.rgb : [255, 255, 255];
    for (let i = stack.length - 1; i >= 0; i--) base = over(stack[i], base);
    return base;
  };

  const results = [];
  const seen = new Set();

  for (const el of document.querySelectorAll("body *")) {
    // Only elements that render their own text.
    const text = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(" ")
      .trim();
    if (!text) continue;

    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none") continue;
    if (parseFloat(style.opacity) < 0.35) continue;

    const box = el.getBoundingClientRect();
    if (box.width < 2 || box.height < 2) continue;

    const fg = parse(style.color);
    if (!fg || fg.a === 0) continue;

    const bg = behind(el);
    // Text can be translucent too; composite it before comparing.
    const front = fg.a < 1 ? over(fg, bg) : fg.rgb;

    const size = parseFloat(style.fontSize);
    const weight = Number(style.fontWeight) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = large ? 3 : 4.5;
    const got = ratio(front, bg);

    const key = `${text.slice(0, 24)}|${style.color}|${bg.join(",")}|${Math.round(size)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (got < need) {
      results.push({
        text: text.slice(0, 46),
        ratio: Math.round(got * 100) / 100,
        need,
        size: Math.round(size),
        weight,
        color: style.color,
        on: `rgb(${bg.join(", ")})`,
        where: el.className?.toString?.().slice(0, 60) ?? "",
      });
    }
  }

  return results.sort((a, b) => a.ratio - b.ratio);
};

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
let total = 0;

for (const theme of ["light", "dark"]) {
  const context = await browser.newContext({
    viewport: { width: 402, height: 900 },
    colorScheme: theme,
  });
  const page = await context.newPage();

  // Signed in, so the app's own screens render rather than redirecting.
  await page.goto(`${BASE}/login/`);
  await page.evaluate((t) => {
    localStorage.setItem("sokoos.onboarded", "1");
    localStorage.setItem("sokoos.theme", t);
  }, theme);
  await page.goto(`${BASE}/login/`, { waitUntil: "networkidle" });
  const demo = page.getByRole("button", { name: /demo/i }).first();
  if (await demo.count()) await demo.click().catch(() => {});
  await page.waitForTimeout(900);

  for (const route of ROUTES) {
    const response = await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" }).catch(() => null);
    if (!response || response.status() >= 400) continue;
    await page.waitForTimeout(700);

    const bad = await page.evaluate(audit);
    if (!bad.length) continue;

    total += bad.length;
    console.log(`\n\x1b[1m${theme} · ${route}\x1b[0m`);
    for (const r of bad) {
      console.log(
        `  ${String(r.ratio).padStart(5)} (need ${r.need})  ${r.size}px/${r.weight}  ` +
          `${r.color} on ${r.on}  “${r.text}”`,
      );
    }
  }

  await context.close();
}

await browser.close();
console.log(
  total ? `\n\x1b[31m${total} contrast failures\x1b[0m` : "\n\x1b[32mevery text passes WCAG AA\x1b[0m",
);
process.exit(total ? 1 : 0);

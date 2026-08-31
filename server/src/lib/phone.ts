/**
 * Normalising a Kenyan phone number.
 *
 * The same person will give you 0722 000 145, +254722000145, 254722000145 and
 * 722000145 on four different days, and if any two of those become separate
 * accounts the seller loses their business and blames the app. So there is one
 * canonical form — E.164 — and everything is converted to it on the way in.
 *
 * Kenya is assumed as the default country because that is who this is for; a
 * number that already carries a country code keeps it.
 */

const KE = "254";

/** Every valid Kenyan mobile prefix, after the country code. */
const KE_MOBILE = /^(?:1[01]\d|7\d{2})\d{6}$/;

export class InvalidPhone extends Error {
  constructor(input: string) {
    super(`Not a phone number we can use: ${input}`);
    this.name = "InvalidPhone";
  }
}

export function normalisePhone(input: string): string {
  const digits = String(input ?? "").replace(/[^\d+]/g, "");
  if (!digits) throw new InvalidPhone(input);

  let national: string;

  if (digits.startsWith("+")) {
    const rest = digits.slice(1);
    // Already international. Only Kenyan numbers are validated in detail;
    // anything else is accepted as given, so a diaspora seller is not locked out.
    if (rest.startsWith(KE)) national = rest.slice(KE.length);
    else return `+${rest}`;
  } else if (digits.startsWith(KE)) {
    national = digits.slice(KE.length);
  } else if (digits.startsWith("0")) {
    national = digits.slice(1);
  } else {
    national = digits;
  }

  if (!KE_MOBILE.test(national)) throw new InvalidPhone(input);
  return `+${KE}${national}`;
}

/** How a number is shown back to the person who typed it. */
export function displayPhone(e164: string): string {
  const m = e164.match(/^\+254(\d{3})(\d{3})(\d{3})$/);
  return m ? `0${m[1]} ${m[2]} ${m[3]}` : e164;
}

/** Masked for logs and for "we sent a code to …". */
export function maskPhone(e164: string): string {
  return e164.length > 6 ? `${e164.slice(0, -6)}••${e164.slice(-4)}` : e164;
}

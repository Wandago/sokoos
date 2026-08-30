/**
 * Ids for records created in the browser. Kept out of component bodies so a
 * re-render never quietly mints a different one for the same action.
 */
export function newId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

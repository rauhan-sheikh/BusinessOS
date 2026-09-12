/**
 * Makes Prisma rows safe to send over the wire or across the RSC boundary.
 *
 * BigInt has no JSON representation, so money columns (amountMinor,
 * receivableMinor, payableMinor) throw on serialization unless converted.
 * They become decimal strings, which preserves precision that a JS number
 * would lose - callers should render them with formatCurrency rather than
 * doing arithmetic on them.
 */
type Serialized<T> = T extends bigint
  ? string
  : T extends Date
    ? Date
    : T extends (infer U)[]
      ? Serialized<U>[]
      : T extends object
        ? { [K in keyof T]: Serialized<T[K]> }
        : T;

export function serializeBigInt<T>(value: T): Serialized<T> {
  return JSON.parse(
    JSON.stringify(value, (_key, v: unknown) => (typeof v === "bigint" ? v.toString() : v))
  ) as Serialized<T>;
}

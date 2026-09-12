/**
 * The ledger engine: how a transaction moves a party's balance.
 *
 * Receivable and payable are tracked GROSS and independently. A counterparty
 * that is both a customer and a supplier carries a real figure on each side;
 * the net is derived for display and never stored. The previous model collapsed
 * the two into one signed number, which made gross A/R and A/P unrecoverable
 * and aging reports impossible.
 *
 * Because every entry moves exactly one column by a signed delta, the
 * repository can apply it with an atomic increment/decrement instead of a
 * read-modify-write. That is what removes the lost-update race in which two
 * concurrent payments against one party could each overwrite the other.
 */
import type { TransactionType, BalanceDirection } from "@/generated/prisma/client";
import { AppError } from "@/shared/errors/app-error";

export type BalanceColumn = "receivableMinor" | "payableMinor";

/** The single column an entry moves, and the direction it moves it. */
export interface BalanceEffect {
  column: BalanceColumn;
  sign: 1 | -1;
}

/** The subset of a Transaction the engine needs to score it. */
export interface LedgerEntry {
  id: string;
  transactionType: TransactionType;
  direction: BalanceDirection | null;
  amountMinor: bigint;
  reversedTransactionId: string | null;
}

export interface PartyBalanceTotals {
  receivableMinor: bigint;
  payableMinor: bigint;
}

const COLUMN_FOR: Record<BalanceDirection, BalanceColumn> = {
  RECEIVABLE: "receivableMinor",
  PAYABLE: "payableMinor",
};

/**
 * The effect of an entry whose type determines it on its own.
 *
 * REVERSAL is deliberately absent: a reversal's effect is the inverse of the
 * entry it reverses, which cannot be recovered from (type, direction) alone -
 * the column is shared but the sign is not. Use resolveEffect for those.
 */
export function effectOf(
  transactionType: TransactionType,
  direction: BalanceDirection | null
): BalanceEffect {
  switch (transactionType) {
    // The customer owes us more / less.
    case "SALE":
      return { column: "receivableMinor", sign: 1 };
    case "PAYMENT_RECEIVED":
      return { column: "receivableMinor", sign: -1 };

    // We owe the supplier more / less.
    case "PURCHASE":
      return { column: "payableMinor", sign: 1 };
    case "PAYMENT_MADE":
      return { column: "payableMinor", sign: -1 };

    // The caller chooses the side.
    case "OPENING_BALANCE":
    case "ADJUSTMENT": {
      if (!direction) {
        throw new AppError(
          `A ${transactionType} entry requires a direction of RECEIVABLE or PAYABLE.`,
          400
        );
      }
      return { column: COLUMN_FOR[direction], sign: 1 };
    }

    case "REVERSAL":
      throw new AppError(
        "A REVERSAL is scored from the entry it reverses; use resolveEffect.",
        500
      );
  }
}

/** The exact opposite of an effect: same column, opposite sign. */
export function invert(effect: BalanceEffect): BalanceEffect {
  return { column: effect.column, sign: effect.sign === 1 ? -1 : 1 };
}

/**
 * Scores any entry, resolving a REVERSAL against the entry it reverses.
 *
 * `others` supplies the candidate originals - for a whole-ledger replay that is
 * every entry keyed by id. A reversal that is unlinked or points at something
 * missing is a corrupted ledger and throws rather than silently scoring zero.
 */
export function resolveEffect(
  entry: LedgerEntry,
  others: ReadonlyMap<string, LedgerEntry>
): BalanceEffect {
  if (entry.transactionType !== "REVERSAL") {
    return effectOf(entry.transactionType, entry.direction);
  }

  if (!entry.reversedTransactionId) {
    throw new AppError(
      `Reversal ${entry.id} has no reversedTransactionId; the ledger is inconsistent.`,
      500
    );
  }

  const original = others.get(entry.reversedTransactionId);
  if (!original) {
    throw new AppError(
      `Reversal ${entry.id} points at unknown transaction ${entry.reversedTransactionId}.`,
      500
    );
  }

  return invert(effectOf(original.transactionType, original.direction));
}

/**
 * Replays a party's whole ledger into gross balances.
 *
 * The ledger is the source of truth and PartyBalance is a cache of this
 * function, so it doubles as the repair path when a snapshot is suspected of
 * having drifted.
 */
export function recomputeBalance(entries: readonly LedgerEntry[]): PartyBalanceTotals {
  const byId = new Map(entries.map((e) => [e.id, e]));

  let receivableMinor = 0n;
  let payableMinor = 0n;

  for (const entry of entries) {
    const { column, sign } = resolveEffect(entry, byId);
    const delta = BigInt(sign) * entry.amountMinor;

    if (column === "receivableMinor") {
      receivableMinor += delta;
    } else {
      payableMinor += delta;
    }
  }

  return { receivableMinor, payableMinor };
}

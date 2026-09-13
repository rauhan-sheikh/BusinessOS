/**
 * The posting engine.
 *
 * Pure functions that turn a business event into balanced journal lines. They
 * touch no database, so the accounting rules can be tested directly and read in
 * one place, rather than being spread across the services that trigger them.
 *
 * Sign convention: amountMinor is positive for a debit and negative for a
 * credit. One signed column means one invariant - the lines of an entry sum to
 * zero - instead of two columns that could both be set, or neither.
 */
import type { LedgerAccountKey } from "@/generated/prisma/client";
import { AppError } from "@/shared/errors/app-error";

/** A line before it is written, referring to accounts by their system key. */
export interface DraftLine {
  accountKey: LedgerAccountKey;
  /** Positive debits, negative credits. */
  amountMinor: bigint;
  /** Required on control accounts, so the balance can be split per party. */
  partyId?: string | null;
  description?: string | null;
}

export interface DraftEntry {
  lines: DraftLine[];
  narration?: string | null;
}

/** Accounts whose lines must name a counterparty. */
const CONTROL_ACCOUNTS: ReadonlySet<LedgerAccountKey> = new Set([
  "ACCOUNTS_RECEIVABLE",
  "ACCOUNTS_PAYABLE",
]);

export function debit(
  accountKey: LedgerAccountKey,
  amountMinor: bigint,
  extra: Omit<DraftLine, "accountKey" | "amountMinor"> = {}
): DraftLine {
  return { accountKey, amountMinor, ...extra };
}

export function credit(
  accountKey: LedgerAccountKey,
  amountMinor: bigint,
  extra: Omit<DraftLine, "accountKey" | "amountMinor"> = {}
): DraftLine {
  return { accountKey, amountMinor: -amountMinor, ...extra };
}

/** Sum of the lines. Zero for a balanced entry. */
export function imbalanceOf(lines: readonly DraftLine[]): bigint {
  return lines.reduce((total, line) => total + line.amountMinor, 0n);
}

export function totalDebits(lines: readonly DraftLine[]): bigint {
  return lines.reduce((t, l) => (l.amountMinor > 0n ? t + l.amountMinor : t), 0n);
}

export function totalCredits(lines: readonly DraftLine[]): bigint {
  return lines.reduce((t, l) => (l.amountMinor < 0n ? t - l.amountMinor : t), 0n);
}

/**
 * Rejects an entry that could not be posted honestly.
 *
 * Called before anything reaches the database, so an unbalanced entry is a 500
 * from a bug rather than a silently lopsided ledger. The whole point of moving
 * to a journal is that this invariant exists; it is worth enforcing loudly.
 */
export function assertPostable(lines: readonly DraftLine[]): void {
  if (lines.length < 2) {
    throw new AppError(
      `A journal entry needs at least two lines; received ${lines.length}.`,
      500
    );
  }

  if (lines.some((line) => line.amountMinor === 0n)) {
    throw new AppError("A journal line cannot be for zero.", 500);
  }

  const imbalance = imbalanceOf(lines);
  if (imbalance !== 0n) {
    throw new AppError(
      `Journal entry does not balance: debits ${totalDebits(lines)} against credits ${totalCredits(lines)} (out by ${imbalance}).`,
      500
    );
  }

  for (const line of lines) {
    if (CONTROL_ACCOUNTS.has(line.accountKey) && !line.partyId) {
      throw new AppError(
        `A line against ${line.accountKey} must name a counterparty.`,
        500
      );
    }
    if (!CONTROL_ACCOUNTS.has(line.accountKey) && line.partyId) {
      throw new AppError(
        `${line.accountKey} is not a control account and must not name a counterparty.`,
        500
      );
    }
  }
}

/** The exact opposite of an entry, for reversals and credit notes. */
export function invertLines(lines: readonly DraftLine[]): DraftLine[] {
  return lines.map((line) => ({ ...line, amountMinor: -line.amountMinor }));
}

/**
 * Distributes a rounding difference onto the rounding account.
 *
 * Percentage tax on several lines rarely sums to the rounded document total, so
 * rather than nudging a real account by a paisa, the difference is posted where
 * it can be seen and explained.
 */
export function withRoundingAdjustment(lines: readonly DraftLine[]): DraftLine[] {
  const imbalance = imbalanceOf(lines);
  if (imbalance === 0n) return [...lines];

  return [
    ...lines,
    {
      accountKey: "ROUNDING",
      // Opposite sign, so the entry closes.
      amountMinor: -imbalance,
      description: "Rounding difference",
    },
  ];
}

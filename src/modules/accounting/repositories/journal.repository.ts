import { prisma } from "@/db";
import type { Prisma, JournalSourceType } from "@/generated/prisma/client";
import { AppError } from "@/shared/errors/app-error";
import { assertPostable, invertLines, type DraftLine } from "../journal";
import { accountRepository } from "./account.repository";

export interface PostEntryParams {
  businessId: string;
  createdById: string;
  entryDate: Date;
  sourceType: JournalSourceType;
  sourceId?: string | null;
  narration?: string | null;
  lines: DraftLine[];
}

/**
 * How a set of journal lines moves a party's cached balance.
 *
 * Receivable is a debit-balance account, so a debit increases it. Payable is
 * credit-balance, so the sign is flipped to keep the stored figure positive
 * when money is owed - matching toNaturalBalance.
 */
function balanceDeltas(lines: readonly DraftLine[]) {
  const deltas = new Map<string, { receivable: bigint; payable: bigint }>();

  for (const line of lines) {
    if (!line.partyId) continue;

    const current = deltas.get(line.partyId) ?? { receivable: 0n, payable: 0n };

    if (line.accountKey === "ACCOUNTS_RECEIVABLE") {
      current.receivable += line.amountMinor;
    } else if (line.accountKey === "ACCOUNTS_PAYABLE") {
      current.payable -= line.amountMinor;
    }

    deltas.set(line.partyId, current);
  }

  return deltas;
}

async function applyBalanceDeltas(
  tx: Prisma.TransactionClient,
  businessId: string,
  lines: readonly DraftLine[]
) {
  for (const [partyId, delta] of balanceDeltas(lines)) {
    if (delta.receivable === 0n && delta.payable === 0n) continue;

    // Atomic increments, so concurrent postings against one party serialise on
    // the row rather than overwriting each other.
    await tx.partyBalance.upsert({
      where: { partyId },
      create: {
        businessId,
        partyId,
        receivableMinor: delta.receivable,
        payableMinor: delta.payable,
      },
      update: {
        receivableMinor: { increment: delta.receivable },
        payableMinor: { increment: delta.payable },
      },
    });
  }
}

export const journalRepository = {
  /**
   * Writes one balanced entry and moves the balances it affects.
   *
   * Accepts an existing transaction client, so a document and its posting
   * commit together - an invoice that saved but failed to post would leave the
   * books wrong with no error anywhere.
   */
  async post(params: PostEntryParams, tx?: Prisma.TransactionClient) {
    const run = async (client: Prisma.TransactionClient) => {
      assertPostable(params.lines);

      const accounts = await accountRepository.requireSystemAccounts(
        params.businessId,
        client
      );

      const entry = await client.journalEntry.create({
        data: {
          businessId: params.businessId,
          entryDate: params.entryDate,
          narration: params.narration ?? null,
          sourceType: params.sourceType,
          sourceId: params.sourceId ?? null,
          createdById: params.createdById,
          lines: {
            create: params.lines.map((line) => {
              const account = accounts.get(line.accountKey);
              if (!account) {
                throw new AppError(
                  `This workspace has no ${line.accountKey} account.`,
                  500
                );
              }
              return {
                accountId: account.id,
                amountMinor: line.amountMinor,
                partyId: line.partyId ?? null,
                description: line.description ?? null,
              };
            }),
          },
        },
        include: { lines: true },
      });

      await applyBalanceDeltas(client, params.businessId, params.lines);
      return entry;
    };

    return tx ? run(tx) : prisma.$transaction(run);
  },

  /**
   * Posts the exact opposite of an existing entry.
   *
   * The original is never edited. The unique constraint on reversedEntryId means
   * two concurrent reversals cannot both succeed, so this needs no
   * check-then-act read.
   *
   * Accepts an existing transaction client for the same reason post() does, and
   * it matters more here: callers reverse an entry as one step of undoing a
   * document. Opening a private transaction would commit the reversal
   * independently of the work around it, so a failure afterwards would roll
   * back the document's own cleanup while leaving the books already reversed -
   * and on a bounded connection pool, a nested transaction can deadlock waiting
   * for a connection the outer one is holding.
   */
  async reverse(
    entryId: string,
    businessId: string,
    createdById: string,
    narration?: string,
    tx?: Prisma.TransactionClient
  ) {
    const run = async (client: Prisma.TransactionClient) => {
      const original = await client.journalEntry.findFirst({
        where: { id: entryId, businessId },
        include: { lines: { include: { account: true } } },
      });

      if (!original) {
        throw new AppError("Journal entry not found", 404);
      }

      if (original.reversedEntryId) {
        throw new AppError("A reversing entry cannot itself be reversed", 400);
      }

      const originalLines: DraftLine[] = original.lines.map((line) => {
        if (!line.account.systemKey) {
          throw new AppError(
            "This entry posts to a custom account and cannot be reversed automatically.",
            400
          );
        }
        return {
          accountKey: line.account.systemKey,
          amountMinor: line.amountMinor,
          partyId: line.partyId,
          description: line.description,
        };
      });

      const lines = invertLines(originalLines);

      const reversal = await this.post(
        {
          businessId,
          createdById,
          entryDate: new Date(),
          sourceType: original.sourceType,
          sourceId: original.sourceId,
          narration: narration ?? `Reversal of entry ${original.id.slice(0, 8)}`,
          lines,
        },
        client
      );

      // The unique constraint lives on this column, so this is the statement a
      // concurrent second reversal loses on - not the post above, where the
      // check used to sit and could therefore never fire.
      await client.journalEntry
        .update({
          where: { id: reversal.id },
          data: { reversedEntryId: original.id },
        })
        .catch((err: unknown) => {
          if (
            typeof err === "object" &&
            err !== null &&
            (err as { code?: string }).code === "P2002"
          ) {
            throw new AppError("This entry has already been reversed", 409);
          }
          throw err;
        });

      return reversal;
    };

    return tx ? run(tx) : prisma.$transaction(run);
  },

  /**
   * Rebuilds a party's cached balance from the journal.
   *
   * The journal is the source of truth and PartyBalance is a cache of it, so
   * this is both the repair path and the check that the two still agree.
   */
  async recomputePartyBalance(partyId: string, businessId: string, tx?: Prisma.TransactionClient) {
    const client = tx ?? prisma;

    const totals = await client.journalLine.groupBy({
      by: ["accountId"],
      where: {
        partyId,
        journalEntry: { businessId },
        account: { systemKey: { in: ["ACCOUNTS_RECEIVABLE", "ACCOUNTS_PAYABLE"] } },
      },
      _sum: { amountMinor: true },
    });

    const accounts = await accountRepository.requireSystemAccounts(businessId, client);
    const arId = accounts.get("ACCOUNTS_RECEIVABLE")?.id;
    const apId = accounts.get("ACCOUNTS_PAYABLE")?.id;

    let receivableMinor = 0n;
    let payableMinor = 0n;

    for (const row of totals) {
      const sum = row._sum.amountMinor ?? 0n;
      if (row.accountId === arId) receivableMinor = sum;
      // Payable is credit-balance, so flip the sign to store what is owed.
      if (row.accountId === apId) payableMinor = -sum;
    }

    return client.partyBalance.upsert({
      where: { partyId },
      create: { businessId, partyId, receivableMinor, payableMinor },
      update: { receivableMinor, payableMinor },
    });
  },

  /** Entries for the journal view, newest first. */
  async listEntries(
    businessId: string,
    options?: { limit?: number; offset?: number; sourceType?: JournalSourceType }
  ) {
    const { limit = 50, offset = 0, sourceType } = options ?? {};
    const where = { businessId, ...(sourceType ? { sourceType } : {}) };

    const [entries, totalCount] = await Promise.all([
      prisma.journalEntry.findMany({
        where,
        include: {
          lines: { include: { account: true, party: { select: { id: true, name: true } } } },
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
        take: limit,
        skip: offset,
      }),
      prisma.journalEntry.count({ where }),
    ]);

    return { entries, totalCount };
  },

  /**
   * Signed totals per account, for a trial balance.
   *
   * A correct set of books sums to zero across every account, which is the
   * check the trial balance exists to make.
   */
  async accountTotals(businessId: string, upTo?: Date) {
    return prisma.journalLine.groupBy({
      by: ["accountId"],
      where: {
        journalEntry: { businessId, ...(upTo ? { entryDate: { lte: upTo } } : {}) },
      },
      _sum: { amountMinor: true },
    });
  },
};

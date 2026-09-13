import { prisma } from "@/db";
import type { Prisma, LedgerAccount, LedgerAccountKey } from "@/generated/prisma/client";
import { AppError } from "@/shared/errors/app-error";
import { SYSTEM_ACCOUNTS } from "../chart-of-accounts";

/** The system accounts of a business, keyed for posting. */
export type AccountsByKey = Map<LedgerAccountKey, LedgerAccount>;

export const accountRepository = {
  /**
   * Creates any system accounts the business is missing.
   *
   * Idempotent, so it is safe to call on business creation, from a backfill,
   * and again after a new system account is introduced in a later release -
   * existing businesses pick it up without a data migration.
   */
  async ensureSystemAccounts(
    businessId: string,
    tx: Prisma.TransactionClient = prisma
  ): Promise<AccountsByKey> {
    const existing = await tx.ledgerAccount.findMany({
      where: { businessId, systemKey: { not: null } },
    });

    const byKey: AccountsByKey = new Map(
      existing.map((account) => [account.systemKey as LedgerAccountKey, account])
    );

    const missing = SYSTEM_ACCOUNTS.filter((seed) => !byKey.has(seed.key));
    if (missing.length === 0) return byKey;

    for (const seed of missing) {
      const created = await tx.ledgerAccount.create({
        data: {
          businessId,
          code: seed.code,
          name: seed.name,
          type: seed.type,
          systemKey: seed.key,
          isControl: seed.isControl ?? false,
          description: seed.description,
        },
      });
      byKey.set(seed.key, created);
    }

    return byKey;
  },

  /**
   * The system accounts of a business, for posting.
   *
   * Throws rather than creating them: a posting path finding no chart of
   * accounts means the business was set up incompletely, and silently creating
   * accounts mid-transaction would hide that.
   */
  async requireSystemAccounts(
    businessId: string,
    tx: Prisma.TransactionClient = prisma
  ): Promise<AccountsByKey> {
    const accounts = await tx.ledgerAccount.findMany({
      where: { businessId, systemKey: { not: null } },
    });

    if (accounts.length === 0) {
      throw new AppError(
        "This workspace has no chart of accounts. It was created before double-entry bookkeeping was enabled.",
        500
      );
    }

    return new Map(accounts.map((a) => [a.systemKey as LedgerAccountKey, a]));
  },

  /** Every account in the chart, for the accounts screen and reports. */
  async listAccounts(businessId: string, options?: { includeArchived?: boolean }) {
    return prisma.ledgerAccount.findMany({
      where: {
        businessId,
        ...(options?.includeArchived ? {} : { isArchived: false }),
      },
      orderBy: { code: "asc" },
    });
  },
};

import { prisma } from "@/db";
import type { CreatePartyInput, UpdatePartyInput } from "../schemas/party.schema";
import { toMinorUnits } from "@/shared/utils/currency";
import { effectOf } from "@/modules/transactions/ledger";

export interface PartyFilterOptions {
  search?: string;
  type?: "all" | "receivable" | "payable";
  includeArchived?: boolean;
}

export const partyRepository = {
  async findManyByBusiness(businessId: string, options?: PartyFilterOptions) {
    const { search, type = "all", includeArchived = false } = options || {};

    return prisma.party.findMany({
      where: {
        businessId,
        ...(includeArchived ? {} : { isArchived: false }),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { phone: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(type === "receivable"
          ? { balance: { receivableMinor: { gt: BigInt(0) } } }
          : type === "payable"
          ? { balance: { payableMinor: { gt: BigInt(0) } } }
          : {}),
      },
      include: {
        balance: true,
      },
      orderBy: { updatedAt: "desc" },
    });
  },

  async findById(id: string, businessId: string) {
    return prisma.party.findFirst({
      where: { id, businessId },
      include: {
        balance: true,
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 50,
          include: {
            createdBy: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });
  },

  async create(businessId: string, userId: string, data: CreatePartyInput) {
    const openingMinor = data.openingBalanceAmount
      ? toMinorUnits(data.openingBalanceAmount as string | number)
      : BigInt(0);

    const openingType = data.openingBalanceType || "RECEIVABLE";

    // The opening balance is scored by the same engine as every other entry,
    // rather than by a second copy of the balance rules living here.
    const effect = openingMinor > 0n ? effectOf("OPENING_BALANCE", openingType) : null;

    return prisma.$transaction(async (tx) => {
      const party = await tx.party.create({
        data: {
          businessId,
          name: data.name,
          phone: data.phone || null,
          email: data.email || null,
          address: data.address || null,
          gstin: data.gstin || null,
          pan: data.pan || null,
          notes: data.notes || null,
        },
      });

      const balance = await tx.partyBalance.create({
        data: {
          businessId,
          partyId: party.id,
          receivableMinor:
            effect?.column === "receivableMinor" ? BigInt(effect.sign) * openingMinor : 0n,
          payableMinor:
            effect?.column === "payableMinor" ? BigInt(effect.sign) * openingMinor : 0n,
        },
      });

      const openingTransaction =
        openingMinor > 0n
          ? await tx.transaction.create({
              data: {
                businessId,
                partyId: party.id,
                transactionType: "OPENING_BALANCE",
                amountMinor: openingMinor,
                direction: openingType,
                notes: "Opening balance on registration",
                createdById: userId,
              },
            })
          : null;

      return { ...party, balance, openingTransaction };
    });
  },

  async update(id: string, businessId: string, data: UpdatePartyInput) {
    return prisma.party.update({
      where: { id, businessId },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.phone !== undefined ? { phone: data.phone || null } : {}),
        ...(data.email !== undefined ? { email: data.email || null } : {}),
        ...(data.address !== undefined ? { address: data.address || null } : {}),
        ...(data.gstin !== undefined ? { gstin: data.gstin || null } : {}),
        ...(data.pan !== undefined ? { pan: data.pan || null } : {}),
        ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
        ...(data.isArchived !== undefined ? { isArchived: data.isArchived } : {}),
      },
      include: {
        balance: true,
      },
    });
  },

  async getAggregates(businessId: string) {
    const [totalParties, balances] = await Promise.all([
      prisma.party.count({
        where: { businessId, isArchived: false },
      }),
      prisma.partyBalance.aggregate({
        where: { businessId },
        _sum: {
          receivableMinor: true,
          payableMinor: true,
        },
      }),
    ]);

    return {
      totalParties,
      totalReceivablesMinor: balances._sum.receivableMinor || BigInt(0),
      totalPayablesMinor: balances._sum.payableMinor || BigInt(0),
    };
  },
};

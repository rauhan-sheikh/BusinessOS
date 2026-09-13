import { prisma } from "@/db";
import type { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/shared/errors/app-error";

export interface ItemInput {
  name: string;
  description?: string | null;
  hsnSacCode?: string | null;
  unitOfMeasure?: string | null;
  unitPriceMinor: bigint;
  taxRateBps: number;
}

/**
 * A catalogue of things sold, so lines can be picked rather than retyped.
 *
 * An item supplies defaults only. Its description, price and rate are copied
 * onto an invoice line at creation, so editing an item never rewrites the
 * arithmetic on invoices already issued.
 */
export const itemRepository = {
  async create(businessId: string, input: ItemInput) {
    return prisma.item
      .create({
        data: {
          businessId,
          name: input.name.trim(),
          description: input.description ?? null,
          hsnSacCode: input.hsnSacCode ?? null,
          unitOfMeasure: input.unitOfMeasure ?? null,
          unitPriceMinor: input.unitPriceMinor,
          taxRateBps: input.taxRateBps,
        },
      })
      .catch((err: unknown) => {
        if (
          typeof err === "object" &&
          err !== null &&
          (err as { code?: string }).code === "P2002"
        ) {
          throw new AppError(`An item named "${input.name}" already exists.`, 409);
        }
        throw err;
      });
  },

  async update(id: string, businessId: string, input: Partial<ItemInput>) {
    const existing = await prisma.item.findFirst({
      where: { id, businessId },
      select: { id: true },
    });
    if (!existing) throw new AppError("Item not found", 404);

    return prisma.item.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.hsnSacCode !== undefined ? { hsnSacCode: input.hsnSacCode } : {}),
        ...(input.unitOfMeasure !== undefined ? { unitOfMeasure: input.unitOfMeasure } : {}),
        ...(input.unitPriceMinor !== undefined
          ? { unitPriceMinor: input.unitPriceMinor }
          : {}),
        ...(input.taxRateBps !== undefined ? { taxRateBps: input.taxRateBps } : {}),
      },
    });
  },

  /**
   * Archives rather than deletes.
   *
   * Invoice lines reference the item, so removing one would either break that
   * link or cascade into documents that must not change.
   */
  async archive(id: string, businessId: string) {
    const existing = await prisma.item.findFirst({
      where: { id, businessId },
      select: { id: true },
    });
    if (!existing) throw new AppError("Item not found", 404);

    return prisma.item.update({ where: { id }, data: { isArchived: true } });
  },

  async findMany(
    businessId: string,
    options?: { search?: string; includeArchived?: boolean; limit?: number; offset?: number }
  ) {
    const { search, includeArchived = false, limit = 50, offset = 0 } = options ?? {};

    const where: Prisma.ItemWhereInput = {
      businessId,
      ...(includeArchived ? {} : { isArchived: false }),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
              { hsnSacCode: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, totalCount] = await Promise.all([
      prisma.item.findMany({ where, orderBy: { name: "asc" }, take: limit, skip: offset }),
      prisma.item.count({ where }),
    ]);

    return { items, totalCount };
  },
};

import { prisma } from "@/db";
import type { CreateBusinessInput } from "../schemas/business.schema";

export const businessRepository = {
  /**
   * Create a new Business and a BusinessUser membership (OWNER) atomically.
   */
  async createWithOwner(userId: string, data: CreateBusinessInput) {
    return prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: {
          name: data.name,
          legalName: data.legalName ?? null,
          phone: data.phone ?? null,
          email: data.email || null,
          address: data.address ?? null,
          gstin: data.gstin ?? null,
          pan: data.pan ?? null,
          currency: data.currency,
          timezone: data.timezone,
        },
      });

      await tx.businessUser.create({
        data: {
          businessId: business.id,
          userId,
          role: "OWNER",
        },
      });

      return business;
    });
  },

  /**
   * Return all businesses the given user is a member of.
   */
  async findAllByUserId(userId: string) {
    return prisma.businessUser.findMany({
      where: { userId },
      include: { business: true },
      orderBy: { joinedAt: "asc" },
    });
  },

  /**
   * Update business details.
   */
  async update(businessId: string, data: Partial<CreateBusinessInput>) {
    return prisma.business.update({
      where: { id: businessId },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.legalName !== undefined ? { legalName: data.legalName || null } : {}),
        ...(data.phone !== undefined ? { phone: data.phone || null } : {}),
        ...(data.email !== undefined ? { email: data.email || null } : {}),
        ...(data.address !== undefined ? { address: data.address || null } : {}),
        ...(data.gstin !== undefined ? { gstin: data.gstin || null } : {}),
        ...(data.pan !== undefined ? { pan: data.pan || null } : {}),
        ...(data.currency ? { currency: data.currency } : {}),
        ...(data.timezone ? { timezone: data.timezone } : {}),
      },
    });
  },

  /**
   * Return all members for a business.
   */
  async findMembers(businessId: string) {
    return prisma.businessUser.findMany({
      where: { businessId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            createdAt: true,
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    });
  },

  /**
   * Add a registered user to a business workspace with a specified role.
   */
  async addMember(businessId: string, userId: string, role: "OWNER" | "ADMIN" | "ACCOUNTANT") {
    return prisma.businessUser.create({
      data: {
        businessId,
        userId,
        role,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
          },
        },
      },
    });
  },

  /**
   * Remove a member from a business.
   */
  async removeMember(businessId: string, membershipId: string) {
    return prisma.businessUser.delete({
      where: { id: membershipId, businessId },
    });
  },
};

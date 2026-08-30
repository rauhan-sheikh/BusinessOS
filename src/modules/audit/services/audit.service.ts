import { prisma } from "@/db";
import type { Prisma } from "@/generated/prisma/client";

export interface CreateAuditLogParams {
  businessId: string;
  userId: string;
  actionType: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export class AuditService {
  async log(
    params: CreateAuditLogParams,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    try {
      return await client.auditLog.create({
        data: {
          businessId: params.businessId,
          userId: params.userId,
          actionType: params.actionType,
          metadata: (params.metadata || {}) as Prisma.InputJsonValue,
          ipAddress: params.ipAddress ?? null,
          userAgent: params.userAgent ?? null,
        },
      });
    } catch (error) {
      // Audit logging failures should be recorded server-side without crashing primary operation
      console.error("Failed to write audit log:", error);
    }
  }

  async getRecentLogs(businessId: string, limit: number = 20) {
    return prisma.auditLog.findMany({
      where: { businessId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }
}

export const auditService = new AuditService();

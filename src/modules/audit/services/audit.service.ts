import { prisma } from "@/db";
import type { AuditAction, Prisma } from "@/generated/prisma/client";

export interface CreateAuditLogParams {
  businessId: string;
  userId: string;
  actionType: AuditAction;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export class AuditService {
  /**
   * Records a business-accountability event.
   *
   * Pass `tx` when the event describes work being done inside a transaction.
   * The audit row then commits or rolls back with it, and a write failure
   * propagates rather than being swallowed - a Postgres transaction that has
   * already errored is aborted regardless, so catching here would only hide a
   * broken transaction while letting the caller believe it committed.
   *
   * Without `tx` the write is best-effort: the operation it describes has
   * already committed, and failing the request afterwards would report a
   * success as an error.
   */
  async log(params: CreateAuditLogParams, tx?: Prisma.TransactionClient) {
    const data = {
      businessId: params.businessId,
      userId: params.userId,
      actionType: params.actionType,
      metadata: (params.metadata || {}) as Prisma.InputJsonValue,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
    };

    if (tx) {
      return tx.auditLog.create({ data });
    }

    try {
      return await prisma.auditLog.create({ data });
    } catch (error) {
      console.error(
        `Failed to write audit log for ${params.actionType} (business ${params.businessId}):`,
        error
      );
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

import { prisma } from "@/db";
import { businessRepository } from "../repositories/business.repository";
import {
  createBusinessSchema,
  type CreateBusinessInput,
} from "../schemas/business.schema";
import {
  updateBusinessProfileSchema,
  addMemberSchema,
  type UpdateBusinessProfileInput,
  type AddMemberInput,
} from "../schemas/member.schema";
import { auditService } from "@/modules/audit/services/audit.service";
import { AppError } from "@/shared/errors/app-error";

export class BusinessService {
  /**
   * Validate input and create a business with the caller as OWNER.
   */
  async createBusiness(userId: string, input: CreateBusinessInput) {
    const validated = createBusinessSchema.parse(input);
    const business = await businessRepository.createWithOwner(userId, validated);

    await auditService.log({
      businessId: business.id,
      userId,
      actionType: "BUSINESS_CREATED",
      metadata: { businessName: business.name },
    });

    return business;
  }

  /**
   * Return all businesses the user belongs to.
   */
  async getBusinessesForUser(userId: string) {
    return businessRepository.findAllByUserId(userId);
  }

  /**
   * Update business settings/profile.
   */
  async updateBusiness(
    businessId: string,
    userId: string,
    input: UpdateBusinessProfileInput,
    clientInfo?: { ipAddress?: string | null; userAgent?: string | null }
  ) {
    const validated = updateBusinessProfileSchema.parse(input);
    const updated = await businessRepository.update(businessId, validated);

    await auditService.log({
      businessId,
      userId,
      actionType: "BUSINESS_SETTINGS_UPDATED",
      metadata: { changes: validated },
      ipAddress: clientInfo?.ipAddress,
      userAgent: clientInfo?.userAgent,
    });

    return updated;
  }

  /**
   * Get all members for a business.
   */
  async getMembers(businessId: string) {
    return businessRepository.findMembers(businessId);
  }

  /**
   * Add a team member to a business by their registered email address.
   */
  async addMember(
    businessId: string,
    requesterUserId: string,
    input: AddMemberInput,
    clientInfo?: { ipAddress?: string | null; userAgent?: string | null }
  ) {
    const validated = addMemberSchema.parse(input);

    const user = await prisma.user.findUnique({
      where: { email: validated.email.toLowerCase().trim() },
    });

    if (!user) {
      throw new AppError(
        `User with email "${validated.email}" was not found. They must first create an account on BusinessOS.`,
        404
      );
    }

    // Check if already a member
    const existing = await prisma.businessUser.findFirst({
      where: { businessId, userId: user.id },
    });

    if (existing) {
      throw new AppError("This user is already a member of this workspace.", 400);
    }

    const membership = await businessRepository.addMember(businessId, user.id, validated.role);

    await auditService.log({
      businessId,
      userId: requesterUserId,
      actionType: "MEMBER_ADDED",
      metadata: {
        addedUserId: user.id,
        addedUserEmail: user.email,
        role: validated.role,
      },
      ipAddress: clientInfo?.ipAddress,
      userAgent: clientInfo?.userAgent,
    });

    return membership;
  }

  /**
   * Remove a member from the business workspace.
   */
  async removeMember(
    businessId: string,
    membershipId: string,
    requesterUserId: string,
    clientInfo?: { ipAddress?: string | null; userAgent?: string | null }
  ) {
    const membership = await prisma.businessUser.findUnique({
      where: { id: membershipId },
    });

    if (!membership || membership.businessId !== businessId) {
      throw new AppError("Membership not found", 404);
    }

    // If removing an OWNER, ensure at least one other OWNER remains
    if (membership.role === "OWNER") {
      const ownerCount = await prisma.businessUser.count({
        where: { businessId, role: "OWNER" },
      });
      if (ownerCount <= 1) {
        throw new AppError("Cannot remove the only workspace OWNER.", 400);
      }
    }

    await businessRepository.removeMember(businessId, membershipId);

    await auditService.log({
      businessId,
      userId: requesterUserId,
      actionType: "MEMBER_REMOVED",
      metadata: { removedMembershipId: membershipId, removedUserId: membership.userId },
      ipAddress: clientInfo?.ipAddress,
      userAgent: clientInfo?.userAgent,
    });

    return { success: true };
  }

  /**
   * Return recent audit logs for the business.
   */
  async getAuditLogs(businessId: string, limit: number = 50) {
    return auditService.getRecentLogs(businessId, limit);
  }
}

export const businessService = new BusinessService();

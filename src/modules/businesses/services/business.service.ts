import { prisma } from "@/db";
import { businessRepository } from "../repositories/business.repository";
import { createBusinessSchema, type CreateBusinessInput } from "../schemas/business.schema";
import {
  updateBusinessProfileSchema,
  addMemberSchema,
  updateMemberRoleSchema,
  type UpdateBusinessProfileInput,
  type AddMemberInput,
  type UpdateMemberRoleInput,
} from "../schemas/member.schema";
import { auditService } from "@/modules/audit/services/audit.service";
import { AppError } from "@/shared/errors/app-error";
import {
  PERMISSION,
  requirePermission,
  assertCanAssignRole,
  type Actor,
} from "@/modules/auth/permissions";

export class BusinessService {
  /**
   * Creates a business with the caller as OWNER.
   *
   * Takes a bare userId rather than an Actor: there is no workspace to hold a
   * role in yet, which is exactly why this is the one unauthorized entry point.
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

  /** Every business the user belongs to. Used to resolve the active workspace. */
  async getBusinessesForUser(userId: string) {
    return businessRepository.findAllByUserId(userId);
  }

  async updateBusiness(
    businessId: string,
    actor: Actor,
    input: UpdateBusinessProfileInput,
    clientInfo?: { ipAddress?: string | null; userAgent?: string | null }
  ) {
    requirePermission(actor, PERMISSION.BUSINESS_SETTINGS_UPDATE);

    const validated = updateBusinessProfileSchema.parse(input);

    // Changing the currency would silently reinterpret every amountMinor
    // already recorded, so it is only editable while the ledger is empty.
    if (validated.currency) {
      const existing = await prisma.business.findUnique({
        where: { id: businessId },
        select: { currency: true },
      });

      if (existing && existing.currency !== validated.currency) {
        const ledgerEntries = await prisma.transaction.count({ where: { businessId } });
        if (ledgerEntries > 0) {
          throw new AppError(
            "Currency cannot be changed once transactions have been recorded, because stored amounts are denominated in it.",
            409
          );
        }
      }
    }

    const updated = await businessRepository.update(businessId, validated);

    await auditService.log({
      businessId,
      userId: actor.userId,
      actionType: "BUSINESS_SETTINGS_UPDATED",
      metadata: { changes: validated },
      ipAddress: clientInfo?.ipAddress,
      userAgent: clientInfo?.userAgent,
    });

    return updated;
  }

  async getMembers(businessId: string, actor: Actor) {
    requirePermission(actor, PERMISSION.MEMBER_VIEW);
    return businessRepository.findMembers(businessId);
  }

  /** Adds an already-registered user to the workspace. */
  async addMember(
    businessId: string,
    actor: Actor,
    input: AddMemberInput,
    clientInfo?: { ipAddress?: string | null; userAgent?: string | null }
  ) {
    const validated = addMemberSchema.parse(input);

    // Gates both the action and the role being granted, so an ADMIN cannot
    // mint an OWNER.
    assertCanAssignRole(actor, validated.role);

    const user = await prisma.user.findUnique({
      where: { email: validated.email.toLowerCase().trim() },
    });

    if (!user) {
      throw new AppError(
        `User with email "${validated.email}" was not found. They must first create an account on BusinessOS.`,
        404
      );
    }

    const existing = await prisma.businessUser.findFirst({
      where: { businessId, userId: user.id },
    });

    if (existing) {
      throw new AppError("This user is already a member of this workspace.", 409);
    }

    const membership = await businessRepository.addMember(businessId, user.id, validated.role);

    await auditService.log({
      businessId,
      userId: actor.userId,
      actionType: "MEMBER_ADDED",
      metadata: { addedUserId: user.id, addedUserEmail: user.email, role: validated.role },
      ipAddress: clientInfo?.ipAddress,
      userAgent: clientInfo?.userAgent,
    });

    return membership;
  }

  /** Changes an existing member's role, so a rogue member can be demoted. */
  async updateMemberRole(
    businessId: string,
    membershipId: string,
    actor: Actor,
    input: UpdateMemberRoleInput,
    clientInfo?: { ipAddress?: string | null; userAgent?: string | null }
  ) {
    const validated = updateMemberRoleSchema.parse(input);

    const membership = await this.findMembershipInBusiness(businessId, membershipId);

    // Granting OWNER and revoking it are both ownership-level acts.
    assertCanAssignRole(actor, validated.role);
    if (membership.role === "OWNER") {
      requirePermission(actor, PERMISSION.MEMBER_GRANT_OWNER);
      await this.assertNotLastOwner(businessId, membership.role);
    }

    const updated = await businessRepository.updateMemberRole(
      businessId,
      membershipId,
      validated.role
    );

    await auditService.log({
      businessId,
      userId: actor.userId,
      actionType: "MEMBER_ROLE_CHANGED",
      metadata: {
        membershipId,
        targetUserId: membership.userId,
        from: membership.role,
        to: validated.role,
      },
      ipAddress: clientInfo?.ipAddress,
      userAgent: clientInfo?.userAgent,
    });

    return updated;
  }

  async removeMember(
    businessId: string,
    membershipId: string,
    actor: Actor,
    clientInfo?: { ipAddress?: string | null; userAgent?: string | null }
  ) {
    requirePermission(actor, PERMISSION.MEMBER_REMOVE);

    const membership = await this.findMembershipInBusiness(businessId, membershipId);

    if (membership.role === "OWNER") {
      // Removing an owner is an ownership-level act. Without this an ADMIN
      // could add an OWNER they control, then remove the original.
      requirePermission(actor, PERMISSION.MEMBER_GRANT_OWNER);
      await this.assertNotLastOwner(businessId, membership.role);
    }

    await businessRepository.removeMember(businessId, membershipId);

    await auditService.log({
      businessId,
      userId: actor.userId,
      actionType: "MEMBER_REMOVED",
      metadata: { removedMembershipId: membershipId, removedUserId: membership.userId },
      ipAddress: clientInfo?.ipAddress,
      userAgent: clientInfo?.userAgent,
    });

    return { success: true };
  }

  async getAuditLogs(businessId: string, actor: Actor, limit: number = 50) {
    requirePermission(actor, PERMISSION.AUDIT_VIEW);
    return auditService.getRecentLogs(businessId, limit);
  }

  private async findMembershipInBusiness(businessId: string, membershipId: string) {
    const membership = await prisma.businessUser.findUnique({ where: { id: membershipId } });

    if (!membership || membership.businessId !== businessId) {
      throw new AppError("Membership not found", 404);
    }

    return membership;
  }

  /** A workspace must always retain at least one owner. */
  private async assertNotLastOwner(businessId: string, role: string) {
    if (role !== "OWNER") return;

    const ownerCount = await prisma.businessUser.count({
      where: { businessId, role: "OWNER" },
    });

    if (ownerCount <= 1) {
      throw new AppError("Cannot remove or demote the only workspace OWNER.", 409);
    }
  }
}

export const businessService = new BusinessService();

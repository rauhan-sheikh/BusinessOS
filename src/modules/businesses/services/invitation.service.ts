import crypto from "crypto";
import { prisma } from "@/db";
import { AppError } from "@/shared/errors/app-error";
import { auditService } from "@/modules/audit/services/audit.service";
import { emailListService } from "@/modules/emailList/services/emailList.service";
import { sendInvitationEmail } from "@/lib/email";
import type { BusinessRole } from "@/generated/prisma/client";
import {
  PERMISSION,
  requirePermission,
  assertCanAssignRole,
  type Actor,
} from "@/modules/auth/permissions";

/** Absolute URL a recipient follows to accept an invitation. */
function buildInviteUrl(token: string): string {
  const baseUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000";
  return `${baseUrl}/invite/${token}`;
}

export class InvitationService {
  /**
   * Invite a team member to a business workspace by email with an assigned role.
   * Auto-syncs the email to the EmailList and dispatches an invitation link.
   */
  async inviteMember(
    businessId: string,
    actor: Actor,
    email: string,
    role: BusinessRole,
    clientInfo?: { ipAddress?: string | null; userAgent?: string | null }
  ) {
    requirePermission(actor, PERMISSION.MEMBER_INVITE);
    // Gates the role being granted too, so an ADMIN cannot invite an OWNER.
    assertCanAssignRole(actor, role);

    const inviterId = actor.userId;
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Auto-sync to EmailList
    await emailListService.ensureEmail(normalizedEmail);

    // 2. Fetch business and inviter details
    const [business, inviter] = await Promise.all([
      prisma.business.findUnique({ where: { id: businessId } }),
      prisma.user.findUnique({ where: { id: inviterId } }),
    ]);

    if (!business) {
      throw new AppError("Business not found", 404);
    }
    if (!inviter) {
      throw new AppError("Inviter user not found", 404);
    }

    // 3. Check if user with this email is already a member of this business
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      const existingMembership = await prisma.businessUser.findFirst({
        where: { businessId, userId: existingUser.id },
      });

      if (existingMembership) {
        throw new AppError("This user is already an active member of this workspace.", 400);
      }
    }

    // 4. Revoke any previous pending invitations for this email in this business
    await prisma.invitation.updateMany({
      where: {
        businessId,
        email: normalizedEmail,
        status: "PENDING",
      },
      data: { status: "REVOKED" },
    });

    // 5. Generate secure invitation token valid for 7 days
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invitation = await prisma.invitation.create({
      data: {
        businessId,
        inviterId,
        email: normalizedEmail,
        role,
        token,
        status: "PENDING",
        expiresAt,
      },
      include: {
        business: { select: { id: true, name: true } },
        inviter: { select: { id: true, name: true, email: true } },
      },
    });

    // 6. Build invitation URL
    const inviteUrl = buildInviteUrl(token);

    // 7. Dispatch invitation email
    try {
      await sendInvitationEmail({
        to: normalizedEmail,
        inviterName: inviter.name,
        businessName: business.name,
        role,
        inviteUrl,
      });
    } catch (err) {
      console.error("Failed to send invitation email via Resend:", err);
      // We still return the invitation so the link can be copied manually
    }

    // 8. Log audit trail
    await auditService.log({
      businessId,
      userId: inviterId,
      actionType: "MEMBER_INVITED",
      metadata: {
        invitedEmail: normalizedEmail,
        role,
        invitationId: invitation.id,
      },
      ipAddress: clientInfo?.ipAddress,
      userAgent: clientInfo?.userAgent,
    });

    return {
      invitation,
      inviteUrl,
    };
  }

  /**
   * Pending and recent invitations for a business.
   *
   * The raw token is never returned. It is a bearer credential: anyone holding
   * it can claim the invited role through the unauthenticated register
   * endpoint, so this previously let a lower-privileged member read a pending
   * ADMIN invite and claim it. Callers get a ready-built invite URL instead,
   * and only if they are allowed to invite in the first place.
   */
  async listInvitations(businessId: string, actor: Actor) {
    requirePermission(actor, PERMISSION.INVITATION_VIEW);

    const invitations = await prisma.invitation.findMany({
      where: { businessId },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        expiresAt: true,
        createdAt: true,
        token: true,
        inviter: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const canShare = actor.role === "OWNER" || actor.role === "ADMIN";

    return invitations.map(({ token, ...invitation }) => ({
      ...invitation,
      // Only a still-actionable invitation needs a shareable link.
      inviteUrl: canShare && invitation.status === "PENDING" ? buildInviteUrl(token) : null,
    }));
  }

  /**
   * Revoke a pending invitation.
   */
  async revokeInvitation(
    businessId: string,
    invitationId: string,
    actor: Actor,
    clientInfo?: { ipAddress?: string | null; userAgent?: string | null }
  ) {
    requirePermission(actor, PERMISSION.MEMBER_INVITE);

    const userId = actor.userId;
    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation || invitation.businessId !== businessId) {
      throw new AppError("Invitation not found", 404);
    }

    const updated = await prisma.invitation.update({
      where: { id: invitationId },
      data: { status: "REVOKED" },
    });

    await auditService.log({
      businessId,
      userId,
      actionType: "INVITATION_REVOKED",
      metadata: { invitationId, revokedEmail: invitation.email },
      ipAddress: clientInfo?.ipAddress,
      userAgent: clientInfo?.userAgent,
    });

    return updated;
  }

  /**
   * Retrieve and validate an invitation by token.
   */
  async getInvitationByToken(token: string) {
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            legalName: true,
            currency: true,
          },
        },
        inviter: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!invitation) {
      throw new AppError("Invitation not found", 404);
    }

    if (invitation.status !== "PENDING") {
      throw new AppError(`This invitation is no longer active (${invitation.status.toLowerCase()}).`, 400);
    }

    if (invitation.expiresAt < new Date()) {
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: "EXPIRED" },
      });
      throw new AppError("This invitation link has expired. Please ask the business admin for a new invite.", 400);
    }

    // Check if the user already exists in the system
    const userExists = await prisma.user.findUnique({
      where: { email: invitation.email },
      select: { id: true, name: true, email: true },
    });

    return {
      invitation,
      userExists: !!userExists,
      user: userExists,
    };
  }

  /**
   * Accept an invitation for an existing, authenticated user.
   */
  async acceptInvitation(
    token: string,
    userId: string,
    clientInfo?: { ipAddress?: string | null; userAgent?: string | null }
  ) {
    const { invitation } = await this.getInvitationByToken(token);

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError("User not found", 404);
    }

    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new AppError(
        `This invitation was sent to ${invitation.email}, but you are currently signed in as ${user.email}. Please sign in with the invited email.`,
        403
      );
    }

    // Atomically create membership and mark invitation accepted
    return prisma.$transaction(async (tx) => {
      // Check if already a member
      const existing = await tx.businessUser.findFirst({
        where: { businessId: invitation.businessId, userId: user.id },
      });

      let membership = existing;
      if (!membership) {
        membership = await tx.businessUser.create({
          data: {
            businessId: invitation.businessId,
            userId: user.id,
            role: invitation.role,
          },
        });
      }

      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED" },
      });

      await auditService.log({
        businessId: invitation.businessId,
        userId: user.id,
        actionType: "INVITATION_ACCEPTED",
        metadata: {
          invitationId: invitation.id,
          role: invitation.role,
        },
        ipAddress: clientInfo?.ipAddress,
        userAgent: clientInfo?.userAgent,
      });

      return { businessId: invitation.businessId, membership };
    });
  }
}

export const invitationService = new InvitationService();

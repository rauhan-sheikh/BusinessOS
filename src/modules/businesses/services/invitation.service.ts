import crypto from "crypto";
import { prisma } from "@/db";
import { AppError } from "@/shared/errors/app-error";
import { auditService } from "@/modules/audit/services/audit.service";
import { emailListService } from "@/modules/emailList/services/emailList.service";
import { sendInvitationEmail } from "@/lib/email";
import type { BusinessRole } from "@/generated/prisma/client";

export class InvitationService {
  /**
   * Invite a team member to a business workspace by email with an assigned role.
   * Auto-syncs the email to the EmailList and dispatches an invitation link.
   */
  async inviteMember(
    businessId: string,
    inviterId: string,
    email: string,
    role: BusinessRole,
    clientInfo?: { ipAddress?: string | null; userAgent?: string | null }
  ) {
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
    const baseUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000";
    const inviteUrl = `${baseUrl}/invite/${token}`;

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
   * List pending and recent invitations for a business.
   */
  async listInvitations(businessId: string) {
    return prisma.invitation.findMany({
      where: { businessId },
      include: {
        inviter: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Revoke a pending invitation.
   */
  async revokeInvitation(
    businessId: string,
    invitationId: string,
    userId: string,
    clientInfo?: { ipAddress?: string | null; userAgent?: string | null }
  ) {
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

  /**
   * Accept invitation for a new user: creates their account, marks email verified,
   * establishes business membership, and returns the new user.
   */
  async registerAndAcceptInvitation(
    token: string,
    params: { name: string; passwordHash: string },
    clientInfo?: { ipAddress?: string | null; userAgent?: string | null }
  ) {
    const { invitation } = await this.getInvitationByToken(token);

    // Ensure email is in emailList
    await emailListService.ensureEmail(invitation.email);

    return prisma.$transaction(async (tx) => {
      // Check if user exists
      let user = await tx.user.findUnique({
        where: { email: invitation.email },
      });

      if (!user) {
        // Create user
        const newUserId = crypto.randomUUID();
        user = await tx.user.create({
          data: {
            id: newUserId,
            name: params.name,
            email: invitation.email,
            emailVerified: true, // Acceptance of invitation verifies the email address!
            isActive: true,
          },
        });

        // Create password account for Better Auth
        await tx.account.create({
          data: {
            id: crypto.randomUUID(),
            accountId: newUserId,
            providerId: "credential",
            userId: newUserId,
            password: params.passwordHash,
          },
        });
      }

      // Add to BusinessUser
      const membership = await tx.businessUser.create({
        data: {
          businessId: invitation.businessId,
          userId: user.id,
          role: invitation.role,
        },
      });

      // Update invitation status
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED" },
      });

      await auditService.log({
        businessId: invitation.businessId,
        userId: user.id,
        actionType: "INVITATION_ACCEPTED_NEW_USER",
        metadata: {
          invitationId: invitation.id,
          role: invitation.role,
        },
        ipAddress: clientInfo?.ipAddress,
        userAgent: clientInfo?.userAgent,
      });

      return {
        user,
        businessId: invitation.businessId,
        membership,
      };
    });
  }
}

export const invitationService = new InvitationService();

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { invitationService } from "@/modules/businesses/services/invitation.service";
import { prisma } from "@/db";
import { AppError } from "@/shared/errors/app-error";
import { z } from "zod";
import { setActiveBusinessCookie } from "@/shared/api/cookies";
import { getClientInfo } from "@/shared/api/request";
import { withApiHandler } from "@/shared/api/handler";

const registerInviteSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

/**
 * Creates an account from an invitation and joins the workspace.
 *
 * Account creation goes through Better Auth, which owns password hashing and
 * cannot join a Prisma transaction. Membership and email verification are
 * therefore committed together in one transaction, and a failure there rolls
 * the new account back - otherwise a failure at the last step left a verified
 * orphan account with no workspace and a still-pending invitation.
 *
 * This is the one handler that keeps an inner try: it has cleanup to run before
 * the shared wrapper turns the error into a response.
 */
export const POST = withApiHandler(
  "POST /api/invitations/[token]/register",
  async (request: Request, props: { params: Promise<{ token: string }> }) => {
    const { token } = await props.params;
    const reqHeaders = await headers();
    const body = await request.json();
    const validated = registerInviteSchema.parse(body);

    // Validate the invitation before creating anything.
    const { invitation } = await invitationService.getInvitationByToken(token);

    const signUpResult = await auth.api.signUpEmail({
      body: {
        email: invitation.email,
        password: validated.password,
        name: validated.name,
      },
      headers: reqHeaders,
    });

    if (!signUpResult?.user) {
      throw new AppError("Failed to create account. Please try again.", 400);
    }

    const createdUserId = signUpResult.user.id;

    try {
      // Membership and verification commit together; following a link sent to
      // the invited address is what proves ownership of it.
      const acceptResult = await invitationService.acceptInvitation(
        token,
        createdUserId,
        getClientInfo(reqHeaders),
        { markEmailVerified: true }
      );

      const response = NextResponse.json(
        {
          user: signUpResult.user,
          businessId: acceptResult.businessId,
          membership: acceptResult.membership,
        },
        { status: 201 }
      );

      setActiveBusinessCookie(response, acceptResult.businessId);
      return response;
    } catch (err) {
      await rollbackAccount(createdUserId);
      throw err;
    }
  }
);

/**
 * Compensating action for the non-transactional signup above. Best-effort: if
 * cleanup itself fails the request has already failed, and leaving a stray
 * account is preferable to masking the original error.
 */
async function rollbackAccount(userId: string): Promise<void> {
  try {
    const hasMembership = await prisma.businessUser.count({ where: { userId } });
    if (hasMembership > 0) return;

    await prisma.$transaction([
      prisma.session.deleteMany({ where: { userId } }),
      prisma.account.deleteMany({ where: { userId } }),
      prisma.user.delete({ where: { id: userId } }),
    ]);
  } catch (cleanupError) {
    console.error("Failed to roll back partially created account:", cleanupError);
  }
}

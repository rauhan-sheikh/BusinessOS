import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { invitationService } from "@/modules/businesses/services/invitation.service";
import { prisma } from "@/db";
import { AppError } from "@/shared/errors/app-error";
import { z } from "zod";

const registerInviteSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(
  request: Request,
  props: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await props.params;
    const reqHeaders = await headers();
    const body = await request.json();
    const validated = registerInviteSchema.parse(body);

    const { invitation } = await invitationService.getInvitationByToken(token);

    // 1. Sign up user via Better Auth
    const signUpResult = await auth.api.signUpEmail({
      body: {
        email: invitation.email,
        password: validated.password,
        name: validated.name,
      },
      headers: reqHeaders,
    });

    if (!signUpResult || !signUpResult.user) {
      throw new AppError("Failed to create account. Please try again.", 400);
    }

    const userId = signUpResult.user.id;

    // 2. Mark email as verified since invitation acceptance confirms ownership
    await prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    });

    // 3. Accept invitation and create business membership
    const ipAddress = reqHeaders.get("x-forwarded-for") || null;
    const userAgent = reqHeaders.get("user-agent") || null;

    const acceptResult = await invitationService.acceptInvitation(token, userId, {
      ipAddress,
      userAgent,
    });

    const response = NextResponse.json(
      {
        user: signUpResult.user,
        businessId: acceptResult.businessId,
        membership: acceptResult.membership,
      },
      { status: 201 }
    );

    // Set active_business_id cookie
    response.cookies.set("active_business_id", acceptResult.businessId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return response;
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("POST /api/invitations/[token]/register error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}

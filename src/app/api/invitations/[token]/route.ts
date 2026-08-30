import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { invitationService } from "@/modules/businesses/services/invitation.service";
import { AppError } from "@/shared/errors/app-error";

export async function GET(
  _request: Request,
  props: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await props.params;
    const details = await invitationService.getInvitationByToken(token);

    return NextResponse.json(details, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("GET /api/invitations/[token] error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(
  _request: Request,
  props: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await props.params;
    const reqHeaders = await headers();
    const session = await auth.api.getSession({ headers: reqHeaders });

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "You must be signed in to accept this invitation." },
        { status: 401 }
      );
    }

    const ipAddress = reqHeaders.get("x-forwarded-for") || null;
    const userAgent = reqHeaders.get("user-agent") || null;

    const result = await invitationService.acceptInvitation(token, session.user.id, {
      ipAddress,
      userAgent,
    });

    const response = NextResponse.json(result, { status: 200 });
    // Set active_business_id cookie to the newly joined business
    response.cookies.set("active_business_id", result.businessId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return response;
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("POST /api/invitations/[token] error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

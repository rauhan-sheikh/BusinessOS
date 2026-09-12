import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { invitationService } from "@/modules/businesses/services/invitation.service";
import { setActiveBusinessCookie } from "@/shared/api/cookies";
import { getClientInfo } from "@/shared/api/request";
import { withApiHandler } from "@/shared/api/handler";

export const GET = withApiHandler(
  "GET /api/invitations/[token]",
  async (_request: Request,
  props: { params: Promise<{ token: string }> }) => {
    const { token } = await props.params;
    const details = await invitationService.getInvitationByToken(token);

    return NextResponse.json(details, { status: 200 });
  }
);

export const POST = withApiHandler(
  "POST /api/invitations/[token]",
  async (_request: Request,
  props: { params: Promise<{ token: string }> }) => {
    const { token } = await props.params;
    const reqHeaders = await headers();
    const session = await auth.api.getSession({ headers: reqHeaders });

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "You must be signed in to accept this invitation." },
        { status: 401 }
      );
    }

    const { ipAddress, userAgent } = getClientInfo(reqHeaders);

    const result = await invitationService.acceptInvitation(token, session.user.id, {
      ipAddress,
      userAgent,
    });

    const response = NextResponse.json(result, { status: 200 });
    // Set active_business_id cookie to the newly joined business
    setActiveBusinessCookie(response, result.businessId);

    return response;
  }
);

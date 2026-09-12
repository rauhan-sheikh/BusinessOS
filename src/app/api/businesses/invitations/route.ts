import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getActiveBusinessContext } from "@/modules/auth/utils/session-helper";
import { invitationService } from "@/modules/businesses/services/invitation.service";
import { addMemberSchema } from "@/modules/businesses/schemas/member.schema";
import { getClientInfo } from "@/shared/api/request";
import { withApiHandler } from "@/shared/api/handler";

export const GET = withApiHandler(
  "GET /api/businesses/invitations",
  async () => {
    const { business, actor } = await getActiveBusinessContext();

    const invitations = await invitationService.listInvitations(business.id, actor);

    return NextResponse.json({ invitations }, { status: 200 });
  }
);

export const POST = withApiHandler(
  "POST /api/businesses/invitations",
  async (request: Request) => {
    const reqHeaders = await headers();
    const { business, actor } = await getActiveBusinessContext();

    const body = await request.json();
    const validated = addMemberSchema.parse(body);

    const { ipAddress, userAgent } = getClientInfo(reqHeaders);

    const result = await invitationService.inviteMember(
      business.id,
      actor,
      validated.email,
      validated.role,
      { ipAddress, userAgent }
    );

    return NextResponse.json(result, { status: 201 });
  }
);

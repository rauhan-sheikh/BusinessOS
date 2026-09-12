import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getActiveBusinessContext } from "@/modules/auth/utils/session-helper";
import { invitationService } from "@/modules/businesses/services/invitation.service";
import { getClientInfo } from "@/shared/api/request";
import { withApiHandler } from "@/shared/api/handler";

export const DELETE = withApiHandler(
  "DELETE /api/businesses/invitations/[id]",
  async (_request: Request,
  props: { params: Promise<{ id: string }> }) => {
    const { id } = await props.params;
    const reqHeaders = await headers();
    const { business, actor } = await getActiveBusinessContext();

    const { ipAddress, userAgent } = getClientInfo(reqHeaders);

    const result = await invitationService.revokeInvitation(business.id, id, actor, {
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ invitation: result }, { status: 200 });
  }
);

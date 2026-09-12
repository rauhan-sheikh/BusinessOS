import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getActiveBusinessContext } from "@/modules/auth/utils/session-helper";
import { invitationService } from "@/modules/businesses/services/invitation.service";
import { AppError } from "@/shared/errors/app-error";
import { getClientInfo } from "@/shared/api/request";

export async function DELETE(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const reqHeaders = await headers();
    const { business, actor } = await getActiveBusinessContext(reqHeaders);

    const { ipAddress, userAgent } = getClientInfo(reqHeaders);

    const result = await invitationService.revokeInvitation(business.id, id, actor, {
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ invitation: result }, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("DELETE /api/businesses/invitations/[id] error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

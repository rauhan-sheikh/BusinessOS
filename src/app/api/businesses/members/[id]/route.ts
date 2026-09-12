import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getActiveBusinessContext } from "@/modules/auth/utils/session-helper";
import { businessService } from "@/modules/businesses/services/business.service";
import { getClientInfo } from "@/shared/api/request";
import { withApiHandler } from "@/shared/api/handler";

/**
 * Change a member's role.
 *
 * Without this a mis-assigned or rogue member could only be deleted, never
 * demoted. Granting or revoking OWNER is gated to owners inside the service.
 */
export const PATCH = withApiHandler(
  "PATCH /api/businesses/members/[id]",
  async (request: Request,
  props: { params: Promise<{ id: string }> }) => {
    const { id } = await props.params;
    const reqHeaders = await headers();
    const { business, actor } = await getActiveBusinessContext();

    const body = await request.json();
    const { ipAddress, userAgent } = getClientInfo(reqHeaders);

    const membership = await businessService.updateMemberRole(business.id, id, actor, body, {
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ membership }, { status: 200 });
  }
);

export const DELETE = withApiHandler(
  "DELETE /api/businesses/members/[id]",
  async (_request: Request,
  props: { params: Promise<{ id: string }> }) => {
    const { id } = await props.params;
    const reqHeaders = await headers();
    const { business, actor } = await getActiveBusinessContext();

    const { ipAddress, userAgent } = getClientInfo(reqHeaders);

    const result = await businessService.removeMember(business.id, id, actor, {
      ipAddress,
      userAgent,
    });

    return NextResponse.json(result, { status: 200 });
  }
);

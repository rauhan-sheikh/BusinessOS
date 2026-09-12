import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getActiveBusinessContext } from "@/modules/auth/utils/session-helper";
import { businessService } from "@/modules/businesses/services/business.service";
import { getClientInfo } from "@/shared/api/request";
import { withApiHandler } from "@/shared/api/handler";

export const GET = withApiHandler(
  "GET /api/businesses/members",
  async () => {
    const { business, actor } = await getActiveBusinessContext();

    const members = await businessService.getMembers(business.id, actor);

    return NextResponse.json({ members }, { status: 200 });
  }
);

export const POST = withApiHandler(
  "POST /api/businesses/members",
  async (request: Request) => {
    const reqHeaders = await headers();
    const { business, actor } = await getActiveBusinessContext();

    const body = await request.json();
    const { ipAddress, userAgent } = getClientInfo(reqHeaders);

    const membership = await businessService.addMember(business.id, actor, body, {
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ membership }, { status: 201 });
  }
);

import { NextResponse } from "next/server";
import { getActiveBusinessContext } from "@/modules/auth/utils/session-helper";
import { businessService } from "@/modules/businesses/services/business.service";
import { withApiHandler } from "@/shared/api/handler";

export const GET = withApiHandler(
  "GET /api/businesses/audit",
  async () => {
    const { business, actor } = await getActiveBusinessContext();

    const logs = await businessService.getAuditLogs(business.id, actor, 50);

    return NextResponse.json({ logs }, { status: 200 });
  }
);

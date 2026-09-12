import { NextResponse } from "next/server";
import { getActiveBusinessContext } from "@/modules/auth/utils/session-helper";
import { emailTemplateService } from "@/modules/businesses/services/email-template.service";
import { withApiHandler } from "@/shared/api/handler";

export const GET = withApiHandler(
  "GET /api/businesses/email-templates",
  async () => {
    const { business, actor } = await getActiveBusinessContext();

    const templates = await emailTemplateService.listTemplates(business.id, actor);

    return NextResponse.json({ templates }, { status: 200 });
  }
);

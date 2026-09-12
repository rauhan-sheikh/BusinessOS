import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getActiveBusinessContext } from "@/modules/auth/utils/session-helper";
import { emailTemplateService } from "@/modules/businesses/services/email-template.service";
import { AppError } from "@/shared/errors/app-error";

export async function GET() {
  try {
    const reqHeaders = await headers();
    const { business, actor } = await getActiveBusinessContext(reqHeaders);

    const templates = await emailTemplateService.listTemplates(business.id, actor);

    return NextResponse.json({ templates }, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("GET /api/businesses/email-templates error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

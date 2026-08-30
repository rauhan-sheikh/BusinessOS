import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getActiveBusinessContext } from "@/modules/auth/utils/session-helper";
import { businessService } from "@/modules/businesses/services/business.service";
import { AppError } from "@/shared/errors/app-error";

export async function GET() {
  try {
    const reqHeaders = await headers();
    const { business } = await getActiveBusinessContext(reqHeaders);

    const logs = await businessService.getAuditLogs(business.id, 50);

    return NextResponse.json({ logs }, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("GET /api/businesses/audit error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

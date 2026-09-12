import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getActiveBusinessContext } from "@/modules/auth/utils/session-helper";
import { businessService } from "@/modules/businesses/services/business.service";
import { ZodError } from "zod";
import { AppError } from "@/shared/errors/app-error";
import { getClientInfo } from "@/shared/api/request";

export async function GET() {
  try {
    const reqHeaders = await headers();
    const { business, actor } = await getActiveBusinessContext(reqHeaders);

    const members = await businessService.getMembers(business.id, actor);

    return NextResponse.json({ members }, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("GET /api/businesses/members error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const reqHeaders = await headers();
    const { business, actor } = await getActiveBusinessContext(reqHeaders);

    const body = await request.json();
    const { ipAddress, userAgent } = getClientInfo(reqHeaders);

    const membership = await businessService.addMember(business.id, actor, body, {
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ membership }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("POST /api/businesses/members error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

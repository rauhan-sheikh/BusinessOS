import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getActiveBusinessContext } from "@/modules/auth/utils/session-helper";
import { businessService } from "@/modules/businesses/services/business.service";
import { ZodError } from "zod";
import { AppError } from "@/shared/errors/app-error";

export async function GET() {
  try {
    const reqHeaders = await headers();
    const { business } = await getActiveBusinessContext(reqHeaders);

    const members = await businessService.getMembers(business.id);

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
    const { business, user, role } = await getActiveBusinessContext(reqHeaders);

    if (role !== "OWNER" && role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only Owners and Admins can add members to this workspace." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const ipAddress = reqHeaders.get("x-forwarded-for") || null;
    const userAgent = reqHeaders.get("user-agent") || null;

    const membership = await businessService.addMember(business.id, user.id, body, {
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
